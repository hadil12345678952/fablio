import "server-only";
import { appelerMoodle } from "./client";
import type { QuizMoodle, TentativeMoodle } from "./types";

// ---------------------------------------------------------------------------
// Quiz Moodle (moteur d'évaluation) — lecture des quiz, tentatives et notes.
// Moodle reste la source pédagogique ; la plateforme ne fait que présenter.
// ---------------------------------------------------------------------------

export async function listerQuizzes(courseMoodleId: number): Promise<QuizMoodle[]> {
  const reponse = await appelerMoodle<{ quizzes?: QuizMoodle[] }>(
    "mod_quiz_get_quizzes_by_courses",
    { courseids: [courseMoodleId] }
  );
  return reponse.quizzes ?? [];
}

export interface TentativePresentee {
  tentativeId: number;
  utilisateur: string;
  numero: number;
  etat: string;
  note: number | null;
  noteSur: number | null;
  debutLe: string | null;
  finLe: string | null;
}
export interface PanierTentativesQuiz {
  quiz: { id: number; nom: string; noteMax: number; totalPoints: number };
  tentatives: TentativePresentee[];
}

const dateFr = (epoch?: number) =>
  epoch ? new Date(epoch * 1000).toLocaleString("fr-FR") : null;

/**
 * Récupère les tentatives d'un quiz Moodle (tous utilisateurs — requiert un
 * jeton disposant du droit « mod/quiz:viewreports », habituel pour un
 * compte enseignant/gestionnaire).
 */
export async function tentativesDepuisMoodle(
  courseMoodleId: number,
  quizId: number
): Promise<PanierTentativesQuiz> {
  const quizzes = await listerQuizzes(courseMoodleId);
  const quiz = quizzes.find((q) => q.id === quizId);
  if (!quiz)
    return {
      quiz: { id: quizId, nom: `Quiz Moodle n°${quizId}`, noteMax: 0, totalPoints: 0 },
      tentatives: [],
    };

  // Note / progression issues du plugin local_fablio (source de vérité).
  const detail = await appelerMoodle<{
    quizid: number;
    name: string;
    maxgrade: number;
    sumgrades: number;
    questioncount: number;
  }>("local_fablio_get_quiz_detail", { quizid: quizId });

  const brut = await appelerMoodle<
    {
      attemptid: number;
      userid: number;
      username: string;
      firstname: string;
      lastname: string;
      attempt: number;
      grade: number;
      maxgrade: number;
      percent: number;
      timecreated: number;
    }[]
  >("local_fablio_get_attempts", { quizid: quizId });

  const nom = detail.name || quiz.name || `Quiz n°${quizId}`;
  const noteMaxQuiz = detail.maxgrade || quiz.grade || 0;

  return {
    quiz: {
      id: quizId,
      nom,
      noteMax: noteMaxQuiz,
      totalPoints: detail.sumgrades || 0,
    },
    tentatives: brut
      .map((t) => {
        const utilisateur =
          [t.firstname, t.lastname].filter(Boolean).join(" ").trim() ||
          t.username ||
          `utilisateur #${t.userid}`;
        return {
          tentativeId: t.attemptid,
          utilisateur,
          numero: t.attempt,
          etat: "finished",
          note: t.grade,
          noteSur: t.maxgrade || noteMaxQuiz || null,
          debutLe: null,
          finLe: dateFr(t.timecreated),
        };
      })
      .sort((a, b) => a.utilisateur.localeCompare(b.utilisateur, "fr") || a.numero - b.numero),
  };
}
