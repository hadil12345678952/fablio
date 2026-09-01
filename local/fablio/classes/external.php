<?php
/**
 * Fablio — fonctions des web services exposées via le service « fablio-ws ».
 *
 * Ces fonctions sont appelées UNIQUEMENT par le backend de la plateforme Fablio
 * (le jeton reste côté serveur Fablio). Chaque fonction vérifie la propriété /
 * la capacité requise (local/fablio:manage ou :view selon le cas).
 *
 * @package    local_fablio
 * @copyright  2026 Fablio
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace local_fablio;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/externallib.php');

class external extends \external_api {

    public static function get_site_info_parameters(): \external_function_parameters {
        return new \external_function_parameters([]);
    }
    public static function get_site_info_returns(): \external_single_structure {
        return new \external_single_structure([
            'sitename' => new \external_value(PARAM_TEXT),
            'username' => new \external_value(PARAM_TEXT),
            'release' => new \external_value(PARAM_TEXT),
            'version' => new \external_value(PARAM_TEXT),
        ]);
    }
    public static function get_site_info(): array {
        global $CFG, $USER, $DB;
        $user = $DB->get_record('user', ['id' => $USER->id]);
        $version = get_config('', 'version');
        return [
            'sitename' => get_string('sitename', 'core'),
            'username' => $USER->username,
            'release' => $CFG->release ?? '',
            'version' => $version ? date('Y.m.d', strtotime(substr($version, 0, 8))) : '',
        ];
    }

    // ------------------------------------------------------------------ quiz
    public static function create_quiz_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'courseid' => new \external_value(PARAM_INT),
            'name' => new \external_value(PARAM_TEXT),
            'intro' => new \external_value(PARAM_RAW, '', VALUE_DEFAULT, ''),
            'maxgrade' => new \external_value(PARAM_FLOAT, '', VALUE_DEFAULT, 10.0),
        ]);
    }
    public static function create_quiz_returns(): \external_single_structure {
        return new \external_single_structure([
            'quizid' => new \external_value(PARAM_INT),
            'coursemoduleid' => new \external_value(PARAM_INT),
        ]);
    }
    public static function create_quiz(int $courseid, string $name, string $intro = '', float $maxgrade = 10.0): array {
        $params = self::validate_parameters(self::create_quiz_parameters(), [
            'courseid' => $courseid, 'name' => $name, 'intro' => $intro, 'maxgrade' => $maxgrade,
        ]);
        self::require_course_context($params['courseid'], 'manage');
        return helper::create_quiz($params['courseid'], $params['name'], $params['intro'], $params['maxgrade']);
    }

    public static function list_quizzes_parameters(): \external_function_parameters {
        return new \external_function_parameters(['courseid' => new \external_value(PARAM_INT)]);
    }
    public static function list_quizzes_returns(): \external_multiple_structure {
        return new \external_multiple_structure(new \external_single_structure([
            'id' => new \external_value(PARAM_INT),
            'name' => new \external_value(PARAM_TEXT),
            'coursemoduleid' => new \external_value(PARAM_INT),
        ]));
    }
    public static function list_quizzes(int $courseid): array {
        $params = self::validate_parameters(self::list_quizzes_parameters(), ['courseid' => $courseid]);
        self::require_course_context($params['courseid'], 'view');
        global $DB;
        $out = [];
        foreach ($DB->get_records('quiz', ['course' => $params['courseid']], 'id') as $q) {
            $cm = get_coursemodule_from_instance('quiz', $q->id);
            $out[] = ['id' => (int) $q->id, 'name' => $q->name, 'coursemoduleid' => $cm ? (int) $cm->id : 0];
        }
        return $out;
    }

    // -------------------------------------------------------------- question
    public static function create_question_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'quizid' => new \external_value(PARAM_INT),
            'qtype' => new \external_value(PARAM_ALPHA),
            'name' => new \external_value(PARAM_TEXT),
            'questiontext' => new \external_value(PARAM_RAW),
            'maxmark' => new \external_value(PARAM_FLOAT),
            'data' => new \external_value(PARAM_RAW, '', VALUE_DEFAULT, '{}'),
        ]);
    }
    public static function create_question_returns(): \external_single_structure {
        return new \external_single_structure(['questionid' => new \external_value(PARAM_INT)]);
    }
    public static function create_question(int $quizid, string $qtype, string $name,
            string $questiontext, float $maxmark, string $data = '{}'): array {
        global $DB;
        $params = self::validate_parameters(self::create_question_parameters(), [
            'quizid' => $quizid, 'qtype' => $qtype, 'name' => $name,
            'questiontext' => $questiontext, 'maxmark' => $maxmark, 'data' => $data,
        ]);
        $quiz = $DB->get_record('quiz', ['id' => $params['quizid']], '*', MUST_EXIST);
        self::require_course_context((int) $quiz->course, 'manage');
        $decoded = json_decode($params['data'], true);
        $decoded = is_array($decoded) ? $decoded : [];
        return helper::create_question($params['quizid'], $params['qtype'], $params['name'],
            $params['questiontext'], $params['maxmark'], $decoded);
    }

    public static function get_quiz_detail_parameters(): \external_function_parameters {
        return new \external_function_parameters(['quizid' => new \external_value(PARAM_INT)]);
    }
    public static function get_quiz_detail_returns(): \external_single_structure {
        return new \external_single_structure([
            'quizid' => new \external_value(PARAM_INT),
            'name' => new \external_value(PARAM_TEXT),
            'maxgrade' => new \external_value(PARAM_FLOAT),
            'sumgrades' => new \external_value(PARAM_FLOAT),
            'questioncount' => new \external_value(PARAM_INT),
            'questions' => new \external_multiple_structure(new \external_single_structure([
                'id' => new \external_value(PARAM_INT),
                'slot' => new \external_value(PARAM_INT),
                'qtype' => new \external_value(PARAM_ALPHA),
                'name' => new \external_value(PARAM_TEXT),
                'maxmark' => new \external_value(PARAM_FLOAT),
            ])),
        ]);
    }
    public static function get_quiz_detail(int $quizid): array {
        global $DB;
        $params = self::validate_parameters(self::get_quiz_detail_parameters(), ['quizid' => $quizid]);
        $quiz = $DB->get_record('quiz', ['id' => $params['quizid']], '*', MUST_EXIST);
        self::require_course_context((int) $quiz->course, 'view');
        $slots = $DB->get_records('quiz_slots', ['quizid' => $params['quizid']], 'slot');
        $questions = [];
        foreach ($slots as $slot) {
            $q = $DB->get_record('question', ['id' => $slot->questionid]);
            if ($q) {
                $questions[] = [
                    'id' => (int) $q->id,
                    'slot' => (int) $slot->slot,
                    'qtype' => $q->qtype,
                    'name' => $q->name,
                    'maxmark' => (float) $slot->maxmark,
                ];
            }
        }
        return [
            'quizid' => (int) $quiz->id,
            'name' => $quiz->name,
            'maxgrade' => (float) $quiz->grade,
            'sumgrades' => (float) ($quiz->sumgrades ?? 0),
            'questioncount' => count($questions),
            'questions' => $questions,
        ];
    }

    public static function set_quiz_visible_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'quizid' => new \external_value(PARAM_INT),
            'visible' => new \external_value(PARAM_BOOL),
        ]);
    }
    public static function set_quiz_visible_returns(): \external_single_structure {
        return new \external_single_structure(['result' => new \external_value(PARAM_BOOL)]);
    }
    public static function set_quiz_visible(int $quizid, bool $visible): array {
        global $DB;
        $params = self::validate_parameters(self::set_quiz_visible_parameters(),
            ['quizid' => $quizid, 'visible' => $visible]);
        $quiz = $DB->get_record('quiz', ['id' => $params['quizid']], '*', MUST_EXIST);
        self::require_course_context((int) $quiz->course, 'manage');
        $cm = get_coursemodule_from_instance('quiz', $params['quizid']);
        if ($cm) {
            set_coursemodule_visible($cm->id, $params['visible']);
        }
        return ['result' => true];
    }

    // -------------------------------------------------------------- tentative
    public static function submit_attempt_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'quizid' => new \external_value(PARAM_INT),
            'userid' => new \external_value(PARAM_INT),
            'answers' => new \external_value(PARAM_RAW), // JSON {slot: {…}}
        ]);
    }
    public static function submit_attempt_returns(): \external_single_structure {
        return new \external_single_structure([
            'attemptid' => new \external_value(PARAM_INT),
            'grade' => new \external_value(PARAM_FLOAT),
            'maxgrade' => new \external_value(PARAM_FLOAT),
            'percent' => new \external_value(PARAM_FLOAT),
            'correctcount' => new \external_value(PARAM_INT),
            'questioncount' => new \external_value(PARAM_INT),
            'feedback' => new \external_value(PARAM_TEXT),
        ]);
    }
    public static function submit_attempt(int $quizid, int $userid, string $answers): array {
        global $DB;
        $params = self::validate_parameters(self::submit_attempt_parameters(),
            ['quizid' => $quizid, 'userid' => $userid, 'answers' => $answers]);
        $quiz = $DB->get_record('quiz', ['id' => $params['quizid']], '*', MUST_EXIST);
        self::require_course_context((int) $quiz->course, 'manage');
        // L'utilisateur doit exister et être inscrit au cours du quiz.
        $user = $DB->get_record('user', ['id' => $params['userid']], '*', MUST_EXIST);
        if (!is_enrolled(get_context_instance(CONTEXT_COURSE, (int) $quiz->course), $user)) {
            throw new \moodle_exception('L\'utilisateur n\'est pas inscrit au cours du quiz.');
        }
        $decoded = json_decode($params['answers'], true);
        $decoded = is_array($decoded) ? $decoded : [];
        return helper::submit_attempt($params['quizid'], $params['userid'], $decoded);
    }

    public static function get_attempts_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'quizid' => new \external_value(PARAM_INT),
            'userid' => new \external_value(PARAM_INT, '', VALUE_DEFAULT, 0),
        ]);
    }
    public static function get_attempts_returns(): \external_multiple_structure {
        return new \external_multiple_structure(new \external_single_structure([
            'attemptid' => new \external_value(PARAM_INT),
            'userid' => new \external_value(PARAM_INT),
            'username' => new \external_value(PARAM_TEXT),
            'firstname' => new \external_value(PARAM_TEXT),
            'lastname' => new \external_value(PARAM_TEXT),
            'attempt' => new \external_value(PARAM_INT),
            'grade' => new \external_value(PARAM_FLOAT),
            'maxgrade' => new \external_value(PARAM_FLOAT),
            'percent' => new \external_value(PARAM_FLOAT),
            'correctcount' => new \external_value(PARAM_INT),
            'questioncount' => new \external_value(PARAM_INT),
            'timecreated' => new \external_value(PARAM_INT),
        ]));
    }
    public static function get_attempts(int $quizid, int $userid = 0): array {
        global $DB;
        $params = self::validate_parameters(self::get_attempts_parameters(),
            ['quizid' => $quizid, 'userid' => $userid]);
        $quiz = $DB->get_record('quiz', ['id' => $params['quizid']], '*', MUST_EXIST);
        self::require_course_context((int) $quiz->course, 'view');
        $rows = helper::get_attempts($params['quizid']);
        if ($params['userid'] > 0) {
            $rows = array_values(array_filter($rows, fn($r) => $r['userid'] === $params['userid']));
        }
        return $rows;
    }

    public static function get_progress_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'quizid' => new \external_value(PARAM_INT),
            'userid' => new \external_value(PARAM_INT),
        ]);
    }
    public static function get_progress_returns(): \external_single_structure {
        return new \external_single_structure([
            'quizid' => new \external_value(PARAM_INT),
            'userid' => new \external_value(PARAM_INT),
            'attempts' => new \external_value(PARAM_INT),
            'attemptscompleted' => new \external_value(PARAM_INT),
            'percent' => new \external_value(PARAM_FLOAT),
            'grade' => new \external_value(PARAM_FLOAT),
            'maxgrade' => new \external_value(PARAM_FLOAT),
            'completed' => new \external_value(PARAM_BOOL),
        ]);
    }
    public static function get_progress(int $quizid, int $userid): array {
        global $DB;
        $params = self::validate_parameters(self::get_progress_parameters(),
            ['quizid' => $quizid, 'userid' => $userid]);
        $quiz = $DB->get_record('quiz', ['id' => $params['quizid']], '*', MUST_EXIST);
        self::require_course_context((int) $quiz->course, 'view');
        return helper::get_progress($params['quizid'], $params['userid']);
    }

    // ------------------------------------------------------------- utilities
    private static function require_course_context(int $courseid, string $cap): void {
        global $USER, $DB;
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
        $context = \context_course::instance($courseid);
        self::validate_context($context);
        $capability = $cap === 'manage' ? 'local/fablio:manage' : 'local/fablio:view';
        if (!has_capability($capability, $context, $USER->id)) {
            throw new \moodle_exception('Capacité ' . $capability . ' requise sur le cours.');
        }
    }
}
