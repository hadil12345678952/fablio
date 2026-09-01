<?php
/**
 * Fablio — moteur interne du plugin local_fablio.
 *
 * Gère, à l'aide des API officielles de Moodle :
 *   - la création de quiz (add_moduleinfo) ;
 *   - la création de questions dans la banque (question_bank::get_qtype->save_question) ;
 *   - l'ajout d'une question à un quiz (quiz_slots) ;
 *   - la correction des réponses d'un élève et le stockage du résultat ;
 *   - la lecture des tentatives et de la progression.
 *
 * @package    local_fablio
 * @copyright  2026 Fablio
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace local_fablio;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/lib/modinfolib.php');
require_once($CFG->dirroot . '/question/type/questiontypebase.php');

class helper {

    /**
     * Crée un quiz dans un cours.
     * @return array{quizid:int, coursemoduleid:int}
     */
    public static function create_quiz(int $courseid, string $name, string $intro, float $maxgrade): array {
        global $DB, $USER;
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);

        $mi = new \stdClass();
        $mi->modulename = 'quiz';
        $mi->course = $courseid;
        $mi->section = 0;
        $mi->name = trim($name);
        $mi->intro = $intro;
        $mi->introformat = FORMAT_HTML;
        $mi->visible = 1;
        $mi->timeopen = 0;
        $mi->timeclose = 0;
        $mi->timelimit = 0;
        $mi->attempts = 0;
        $mi->grademethod = QUIZ_GRADEHIGHEST;
        $mi->grade = max(1.0, (float) $maxgrade);
        $mi->preferredbehaviour = 'immediatefeedback';
        $mi->shufflequestions = 0;
        $mi->shuffleanswers = 1;
        $mi->showuserpicture = 0;
        $mi->navmethod = QUIZ_NAVMETHOD_FREE;
        $mi->browsersecurity = '-';
        $mi->quizpassword = '';
        $mi->overduehandling = 'autoabandon';
        $mi->graceperiod = 0;

        $cm = add_moduleinfo($mi, $course, false);

        return ['quizid' => (int) $cm->instance, 'coursemoduleid' => (int) $cm->id];
    }

    /**
     * Crée une question dans la banque associée au cours du quiz, puis l'ajoute
     * au quiz. Le paramètre $data (JSON) transporte les options propres au type.
     * @return array{questionid:int}
     */
    public static function create_question(int $quizid, string $qtype, string $name,
            string $questiontext, float $maxmark, array $data): array {
        global $DB, $USER;

        $quiz = $DB->get_record('quiz', ['id' => $quizid], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('quiz', $quizid);
        $courseid = $quiz->course;
        $coursecat = $DB->get_or_create_question_category($cm->context, 'default',
            'Default category for « ' . $quiz->name . ' »');

        $question = new \stdClass();
        $question->category = $coursecat->id;
        $question->qtype = $qtype;
        $question->createdby = $USER->id;
        $question->modifiedby = $USER->id;
        $question->timecreated = time();
        $question->timemodified = time();

        $fromform = new \stdClass();
        $fromform->name = trim($name);
        $fromform->questiontext = ['text' => $questiontext, 'format' => FORMAT_HTML];
        $fromform->generalfeedback = ['text' => '', 'format' => FORMAT_HTML];
        $fromform->defaultmark = max(0.1, (float) $maxmark);
        $fromform->tags = [];

        self::populate_qtype_fields($qtype, $fromform, $data);

        $qtypeobj = \question_bank::get_qtype($qtype);
        $newquestion = $qtypeobj->save_question($question, $fromform);

        self::add_question_to_quiz($quizid, $newquestion->id, (float) $maxmark);

        return ['questionid' => (int) $newquestion->id];
    }

    /** Alimente $fromform avec les champs propres au type de question. */
    private static function populate_qtype_fields(string $qtype, \stdClass $fromform, array $data): void {
        switch ($qtype) {
            case 'multichoice':
                $correct = $data['corrects'] ?? [];
                $fromform->single = ($data['multiple'] ?? false) ? 0 : 1;
                $fromform->shuffleanswers = 1;
                $fromform->answernumbering = 'abc';
                $fromform->correctfeedback = ['text' => $data['correct_feedback'] ?? '', 'format' => FORMAT_HTML];
                $fromform->partiallycorrectfeedback = ['text' => '', 'format' => FORMAT_HTML];
                $fromform->incorrectfeedback = ['text' => $data['incorrect_feedback'] ?? '', 'format' => FORMAT_HTML];
                $fromform->answer = [];
                $fromform->answerformat = [];
                $fromform->fraction = [];
                $fromform->feedback = [];
                foreach (($data['options'] ?? []) as $i => $opt) {
                    $fromform->answer[$i] = $opt;
                    $fromform->answerformat[$i] = FORMAT_HTML;
                    $fromform->fraction[$i] = in_array($i, (array) $correct) ? 1.0 : 0.0;
                    $fromform->feedback[$i] = ['text' => '', 'format' => FORMAT_HTML];
                }
                break;

            case 'truefalse':
                $fromform->correctanswer = ($data['answer'] ?? true) ? 1 : 0;
                $fromform->feedbacktrue = ['text' => $data['correct_feedback'] ?? '', 'format' => FORMAT_HTML];
                $fromform->feedbackfalse = ['text' => $data['incorrect_feedback'] ?? '', 'format' => FORMAT_HTML];
                break;

            case 'shortanswer':
                $fromform->answers = [['answer' => $data['answer'] ?? '', 'fraction' => 1.0,
                    'feedback' => ['text' => '', 'format' => FORMAT_HTML]]];
                $fromform->usecase = 0;
                break;

            case 'matching':
                $fromform->subquestions = [];
                $fromform->subanswers = [];
                foreach (($data['pairs'] ?? []) as $paires) {
                    $fromform->subquestions[] = ['text' => $paires['left'], 'format' => FORMAT_HTML];
                    $fromform->subanswers[] = $paires['right'];
                }
                $fromform->shuffleanswers = 1;
                break;

            default:
                // qtype non pris en charge : on ne fait rien (question vide).
                break;
        }
    }

    /** Ajoute une question existante en fin de quiz (slot), et met à jour le barème. */
    private static function add_question_to_quiz(int $quizid, int $questionid, float $maxmark): void {
        global $DB;
        $slot = $DB->get_record('quiz_slots', ['quizid' => $quizid], 'MAX(slot) AS m');
        $maxslot = $slot && $slot->m !== null ? (int) $slot->m : 0;
        $DB->insert_record('quiz_slots', [
            'slot' => $maxslot + 1,
            'quizid' => $quizid,
            'page' => 0,
            'questionid' => $questionid,
            'maxmark' => $maxmark,
        ]);
        // Le barème du quiz reflète la somme des barèmes des questions.
        $quiz = $DB->get_record('quiz', ['id' => $quizid]);
        if (isset($quiz->sumgrades)) {
            $DB->set_field('quiz', 'sumgrades',
                (float) $quiz->sumgrades + $maxmark, ['id' => $quizid]);
        }
    }

    /** Question et bonne réponse d'un slot (lecture depuis la banque). */
    private static function load_question(int $questionid): ?\stdClass {
        global $DB;
        $q = $DB->get_record('question', ['id' => $questionid]);
        if (!$q) {
            return null;
        }
        $q->options = [];
        if ($q->qtype === 'multichoice') {
            $q->answers = $DB->get_records_list('question_answers', 'question',
                [$questionid], 'id');
            foreach ($q->answers as $a) {
                $q->options[$a->id] = $a;
            }
        } elseif ($q->qtype === 'truefalse') {
            $q->answers = $DB->get_records_list('question_answers', 'question', [$questionid], 'id');
        } elseif ($q->qtype === 'shortanswer') {
            $q->answers = $DB->get_records_list('question_answers', 'question', [$questionid], 'id');
        } elseif ($q->qtype === 'matching') {
            $q->subs = $DB->get_records_list('question_match_sub', 'question', [$questionid], 'id');
        }
        return $q;
    }

    /** Compare une réponse d'élève à la bonne réponse et renvoie 0..1. */
    private static function score_question(\stdClass $q, $answer): float {
        switch ($q->qtype) {
            case 'multichoice': {
                $selected = (array) ($answer['selected'] ?? []);
                $corrects = [];
                $byorder = array_values((array) $q->answers);
                foreach ($byorder as $i => $a) {
                    if ((float) $a->fraction >= 1.0) {
                        $corrects[(string) $i] = true;
                    }
                }
                $hits = 0;
                foreach ($selected as $s) {
                    if (isset($corrects[(string) $s])) {
                        $hits++;
                    }
                }
                $faux = count($selected) - $hits;
                $total = max(1, count($corrects));
                return max(0.0, ($hits - $faux) / $total);
            }
            case 'truefalse': {
                $byorder = array_values((array) $q->answers);
                $correct = null;
                foreach ($byorder as $i => $a) {
                    if ((float) $a->fraction >= 1.0) {
                        $correct = ($a->answer === 'true');
                    }
                }
                return ($answer['value'] ?? false) === $correct ? 1.0 : 0.0;
            }
            case 'shortanswer': {
                $byorder = array_values((array) $q->answers);
                $correct = $byorder[0]->answer ?? '';
                $given = (string) ($answer['text'] ?? '');
                return self::normalize($given) === self::normalize($correct) ? 1.0 : 0.0;
            }
            case 'matching': {
                $subs = array_values((array) $q->subs);
                $pairs = (array) ($answer['pairs'] ?? []);
                $bons = 0;
                foreach ($pairs as $p) {
                    $left = (int) ($p['left'] ?? -1);
                    $right = (int) ($p['right'] ?? -1);
                    if (isset($subs[$left]) && (int) $subs[$left]->answerid === $right) {
                        $bons++;
                    }
                }
                return $bons / max(1, count($subs));
            }
        }
        return 0.0;
    }

    private static function normalize(string $s): string {
        $s = mb_strtolower(trim(str_replace('’', "'", $s)));
        $s = \core_text::remove_accents($s);
        $s = preg_replace('/[«»"]/', '', $s);
        return preg_replace('/\s+/', ' ', $s);
    }

    /**
     * Corrige une tentative d'un élève sur un quiz et enregistre le résultat.
     * @return array{attemptid:int, grade:float, maxgrade:float, percent:float,
     *               correctcount:int, questioncount:int, feedback:string}
     */
    public static function submit_attempt(int $quizid, int $userid, array $answersBySlot): array {
        global $DB;

        $slots = $DB->get_records('quiz_slots', ['quizid' => $quizid], 'slot');
        if (!$slots) {
            throw new \moodle_exception('Quiz n°' . $quizid . ' sans question.');
        }

        $correctcount = 0;
        $questioncount = count($slots);
        $earned = 0.0;
        $maxmarkSum = 0.0;

        foreach ($slots as $slot) {
            $q = self::load_question((int) $slot->questionid);
            if (!$q) {
                continue;
            }
            $answer = $answersBySlot[(string) $slot->slot] ?? [];
            $frac = self::score_question($q, $answer);
            $marks = $frac * (float) $slot->maxmark;
            $earned += $marks;
            $maxmarkSum += (float) $slot->maxmark;
            if ($frac >= 1.0) {
                $correctcount++;
            }
        }

        $maxgrade = max(0.001, (float) $DB->get_field('quiz', 'grade', ['id' => $quizid]));
        $percent = $maxmarkSum > 0 ? ($earned / $maxmarkSum) * 100.0 : 0.0;
        $grade = round($percent / 100.0 * $maxgrade, 2);

        // Numéro de tentative (idempotence par couple quiz/user/attempt).
        $attempt = 1 + (int) $DB->count_records('local_fablio_results',
            ['quizid' => $quizid, 'userid' => $userid]);

        $rec = (object) [
            'quizid' => $quizid,
            'userid' => $userid,
            'attempt' => $attempt,
            'correctcount' => $correctcount,
            'questioncount' => $questioncount,
            'grade' => $grade,
            'maxgrade' => $maxgrade,
            'percent' => round($percent, 2),
            'answers' => json_encode($answersBySlot),
            'timecreated' => time(),
        ];
        $id = $DB->insert_record('local_fablio_results', $rec);

        return [
            'attemptid' => (int) $id,
            'grade' => $grade,
            'maxgrade' => $maxgrade,
            'percent' => round($percent, 1),
            'correctcount' => $correctcount,
            'questioncount' => $questioncount,
            'feedback' => self::feedback($percent),
        ];
    }

    private static function feedback(float $percent): string {
        if ($percent >= 90) {
            return 'Excellent ! Un très bon score.';
        }
        if ($percent >= 70) {
            return 'Bravo, très bien !';
        }
        if ($percent >= 50) {
            return 'Pas mal, continue tes efforts !';
        }
        return 'Relis la fable et réessaie, tu vas y arriver !';
    }

    /** Tentatives enregistrées d'un quiz (source de vérité Moodle). */
    public static function get_attempts(int $quizid): array {
        global $DB;
        $rows = $DB->get_records('local_fablio_results', ['quizid' => $quizid], 'timecreated');
        $out = [];
        foreach ($rows as $r) {
            $u = $DB->get_record('user', ['id' => $r->userid]);
            $out[] = [
                'attemptid' => (int) $r->id,
                'userid' => (int) $r->userid,
                'username' => $u ? $u->username : '',
                'firstname' => $u ? $u->firstname : '',
                'lastname' => $u ? $u->lastname : '',
                'attempt' => (int) $r->attempt,
                'grade' => (float) $r->grade,
                'maxgrade' => (float) $r->maxgrade,
                'percent' => (float) $r->percent,
                'correctcount' => (int) $r->correctcount,
                'questioncount' => (int) $r->questioncount,
                'timecreated' => (int) $r->timecreated,
            ];
        }
        return $out;
    }

    /** Progression d'un élève (meilleur score) sur un quiz. */
    public static function get_progress(int $quizid, int $userid): array {
        global $DB;
        $rows = $DB->get_records('local_fablio_results',
            ['quizid' => $quizid, 'userid' => $userid], 'percent DESC');
        $best = $rows ? reset($rows) : null;
        return [
            'quizid' => $quizid,
            'userid' => $userid,
            'attempts' => count($rows),
            'attemptscompleted' => count($rows),
            'percent' => $best ? (float) $best->percent : 0.0,
            'grade' => $best ? (float) $best->grade : 0.0,
            'maxgrade' => $best ? (float) $best->maxgrade : 0.0,
            'completed' => $best !== false,
        ];
    }
}
