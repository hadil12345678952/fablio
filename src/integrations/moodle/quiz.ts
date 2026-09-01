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

  const reponse = await appelerMoodle<{ attempts?: TentativeMoodle[] }>(
    "mod_quiz_get_user_attempts",
    { quizid: quizId, userid: 0, status: "finished", includepreview: 0 }
  );
  const tentatives = reponse.attempts ?? [];

  // Résolution des noms d'utilisateurs (appel groupé).
  const ids = [...new Set(tentatives.map((t) => t.userid))].slice(0, 60);
  const noms = new Map<number, string>();
  if (ids.length > 0) {
    try {
      const utilisateurs = await appelerMoodle<
        { id: number; username?: string; firstname?: string; lastname?: string }[]
      >("core_user_get_users_by_field", { field: "id", values: ids });
      for (const u of utilisateurs ?? []) {
        noms.set(u.id, [u.firstname, u.lastname].filter(Boolean).join(" ") || (u.username ?? `#${u.id}`));
      }
    } catch {
      // Les identifiants bruts seront affichés.
    }
  }

  const totalPoints = quiz.sumgrades ?? 0;
  const noteMaxQuiz = quiz.grade ?? 0;

  return {
    quiz: { id: quiz.id, nom: quiz.name ?? `Quiz n°${quiz.id}`, noteMax: noteMaxQuiz, totalPoints },
    tentatives: tentatives
      .sort((a, b) => (a.userid - b.userid) || ((a.attempt ?? 0) - (b.attempt ?? 0)))
      .map((t) => {
        const brut = t.sumgrades ?? null;
        const noteFinale =
          brut !== null && totalPoints > 0
            ? Math.round(((brut / totalPoints) * noteMaxQuiz) * 100) / 100
            : null;
        return {
          tentativeId: t.id,
          utilisateur: noms.get(t.userid) ?? `utilisateur #${t.userid}`,
          numero: t.attempt ?? 1,
          etat: t.state ?? "finished",
          note: noteFinale,
          noteSur: noteMaxQuiz || null,
          debutLe: dateFr(t.timestart),
          finLe: dateFr(t.timefinish),
        };
      }),
  };
}
