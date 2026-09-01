import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  codesParrainage,
  eleves,
  exercices,
  fables,
  type EnseignantRow,
  type ExerciceRow,
} from "@/db/schema";
import { appelerMoodle, ErreurMoodle } from "./client";
import { configMoodle } from "./config";
import { journaliserMoodle } from "./journal";
import { assurerCoursMoodle } from "./cours";
import { assurerUtilisateurMoodle } from "./utilisateurs";
import {
  convertirVersMoodle,
  resumerQuestions,
  reponsesPourMoodle,
  type QuestionMoodle,
} from "./conversion";
import type { TypeExercice, ReponseEleve } from "@/lib/exercices";

// ---------------------------------------------------------------------------
// Création automatique d'un quiz Moodle depuis un exercice Fablio, puis score
// d'une tentative d'élève. L'enseignant n'a jamais à manipuler Moodle.
// ---------------------------------------------------------------------------

async function determinerCours(enseignant: EnseignantRow, cibleCodeIds: string[]): Promise<number> {
  const codes = await db
    .select()
    .from(codesParrainage)
    .where(eq(codesParrainage.enseignantId, enseignant.id));
  const prioritaire = cibleCodeIds.length
    ? codes.find((c) => cibleCodeIds.includes(c.id))
    : codes[0];
  if (!prioritaire) {
    throw new ErreurMoodle(
      "Aucune classe (code de parrainage) ne permet d'héberger ce quiz : créez une classe puis synchronisez."
    );
  }
  return assurerCoursMoodle(prioritaire);
}

export interface ResultatCreationActivite {
  quizId: number;
  coursMoodleId: number;
  nom: string;
  questionCount: number;
  questionsResume: string;
  mappable: boolean;
  raison?: string;
}

/** Crée le quiz + ses questions dans Moodle et associe l'exercice (mapping). */
export async function creerActiviteMoodle(
  enseignant: EnseignantRow,
  exercice: ExerciceRow
): Promise<ResultatCreationActivite> {
  const [fable] = await db
    .select()
    .from(fables)
    .where(
      and(eq(fables.id, exercice.fableId), eq(fables.enseignantId, enseignant.id))
    )
    .limit(1);
  if (!fable) throw new ErreurMoodle("Fable introuvable.");

  const type = exercice.type as TypeExercice;
  const conversion = convertirVersMoodle(type, exercice.payload, exercice.points, fable.titre, exercice.consigne);
  if (!conversion.mappable) {
    return {
      quizId: 0,
      coursMoodleId: 0,
      nom: "",
      questionCount: 0,
      questionsResume: "",
      mappable: false,
      raison: conversion.raison,
    };
  }

  const coursMoodleId = await determinerCours(enseignant, fable.cibleCodeIds ?? []);

  const creeQuiz = await appelerMoodle<{ quizid: number; coursemoduleid: number }>(
    "local_fablio_create_quiz",
    {
      courseid: coursMoodleId,
      name: `${fable.titre} — ${exerciseEtiquette(type)}`,
      intro: exercice.consigne || fable.titre,
      maxgrade: exercice.points || 10,
    }
  );
  const quizId = creeQuiz.quizid;

  for (const q of conversion.questions) {
    await appelerMoodle<{ questionid: number }>("local_fablio_create_question", {
      quizid: quizId,
      qtype: q.qtype,
      name: q.name,
      questiontext: q.questiontext,
      maxmark: q.maxmark,
      data: JSON.stringify(q.data),
    });
  }

  if (exercice.moodleQuizId === null || exercice.moodleQuizId !== quizId) {
    await db
      .update(exercices)
      .set({ moodleQuizId: quizId })
      .where(eq(exercices.id, exercice.id));
  }

  const resume = resumerQuestions(conversion.questions);
  await journaliserMoodle(
    "quiz",
    "ok",
    `Activité « ${fable.titre} » créée dans Moodle : quiz n°${quizId} (${conversion.questions.length} question(s) : ${resume}).`
  );

  return {
    quizId,
    coursMoodleId,
    nom: `${fable.titre} — ${exerciseEtiquette(type)}`,
    questionCount: conversion.questions.length,
    questionsResume: resume,
    mappable: true,
  };
}

function exerciseEtiquette(type: TypeExercice): string {
  const map: Record<string, string> = {
    qcm: "QCM",
    vrai_faux: "Vrai / Faux",
    question_ouverte: "Question ouverte",
    texte_trous: "Texte à trous",
  };
  return map[type] ?? type;
}

// --- Score d'une tentative (la note provient de Moodle = source de vérité) ---

export interface ScoreMoodle {
  attemptid: number;
  grade: number;
  maxgrade: number;
  percent: number;
  correctcount: number;
  questioncount: number;
  feedback: string;
}

export async function noterDansMoodle(
  enseignantId: string,
  eleveId: string,
  exercice: ExerciceRow,
  reponse: ReponseEleve
): Promise<ScoreMoodle | null> {
  if (!configMoodle().configure || exercice.moodleQuizId === null) return null;
  const type = exercice.type as TypeExercice;

  const [eleve] = await db
    .select()
    .from(eleves)
    .where(and(eq(eleves.id, eleveId), eq(eleves.enseignantId, enseignantId)))
    .limit(1);
  if (!eleve) return null;

  const moodle = await assurerUtilisateurMoodle({
    type: "eleve",
    id: eleve.id,
    prenom: eleve.pseudo,
    nom: "Élève",
    email: eleve.pseudo,
  });

  const reponses = reponsesPourMoodle(type, exercice.payload, reponse);
  const score = await appelerMoodle<ScoreMoodle>("local_fablio_submit_attempt", {
    quizid: exercice.moodleQuizId,
    userid: moodle.moodleUserId,
    answers: JSON.stringify(reponses),
  });
  return score;
}

// --- Progression d'un élève sur un quiz Moodle (lecture) ---------------------

export interface ProgressionMoodle {
  quizid: number;
  userid: number;
  attempts: number;
  percent: number;
  grade: number;
  maxgrade: number;
  completed: boolean;
}

export async function progressionMoodlePour(
  eleveId: string,
  quizId: number
): Promise<ProgressionMoodle | null> {
  if (!configMoodle().configure) return null;
  const [eleve] = await db.select().from(eleves).where(eq(eleves.id, eleveId)).limit(1);
  if (!eleve) return null;
  const moodle = await assurerUtilisateurMoodle({
    type: "eleve",
    id: eleve.id,
    prenom: eleve.pseudo,
    nom: "Élève",
    email: eleve.pseudo,
  });
  return appelerMoodle<ProgressionMoodle>("local_fablio_get_progress", {
    quizid: quizId,
    userid: moodle.moodleUserId,
  });
}

export { type QuestionMoodle };
