import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercices, fables, tentatives } from "@/db/schema";
import { eleveConnecte, erreurJson, lireCorps } from "@/lib/api";
import {
  corrigeExercice,
  noterExercice,
  type ReponseEleve,
  type TypeExercice,
} from "@/lib/exercices";
import { moodleConfigure } from "@/integrations/moodle";
import { noterDansMoodle } from "@/integrations/moodle/creation";
import { estMappableMoodle } from "@/integrations/moodle/conversion";
import type { ScoreMoodle } from "@/integrations/moodle/creation";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/exercices/[id]/soumettre — l'élève envoie sa réponse
export async function POST(req: Request, ctx: Ctx) {
  const auth = await eleveConnecte();
  if ("echec" in auth) return auth.echec;
  const eleve = auth.eleve;
  const { id } = await ctx.params;

  const [exo] = await db
    .select()
    .from(exercices)
    .where(and(eq(exercices.id, id), eq(exercices.publie, true)))
    .limit(1);
  if (!exo) return erreurJson("Exercice introuvable.", 404);

  const [fable] = await db
    .select()
    .from(fables)
    .where(
      and(
        eq(fables.id, exo.fableId),
        eq(fables.enseignantId, eleve.enseignantId),
        eq(fables.publie, true)
      )
    )
    .limit(1);
  if (!fable) return erreurJson("Cette fable n'est pas disponible pour ta classe.", 403);

  const cibles = fable.cibleCodeIds ?? [];
  if (cibles.length > 0 && (!eleve.codeId || !cibles.includes(eleve.codeId)))
    return erreurJson("Cette fable n'est pas affectée à ton groupe.", 403);

  const deja = await db
    .select()
    .from(tentatives)
    .where(and(eq(tentatives.eleveId, eleve.id), eq(tentatives.exerciceId, exo.id)));
  if (exo.maxTentatives !== null && deja.length >= exo.maxTentatives)
    return erreurJson("Tu as utilisé toutes tes tentatives pour cet exercice.", 403);

  const corps = await lireCorps(req);
  if (!corps || !("reponse" in corps)) return erreurJson("Réponse manquante.");
  const reponse = corps.reponse as ReponseEleve;
  const dureeBrutes = Number(corps.dureeSecondes ?? 0);
  const dureeSecondes = Number.isFinite(dureeBrutes)
    ? Math.min(3600, Math.max(0, Math.round(dureeBrutes)))
    : 0;

  const type = exo.type as TypeExercice;
  const note = noterExercice(type, exo.payload, reponse, exo.points);

  const [cree] = await db
    .insert(tentatives)
    .values({
      eleveId: eleve.id,
      exerciceId: exo.id,
      fableId: exo.fableId,
      reponse: reponse as unknown,
      score: note.score,
      maxScore: note.maxScore,
      estCorrect: note.estCorrect,
      numero: deja.length + 1,
      dureeSecondes,
    })
    .returning();

  const feedback =
    note.estCorrect === null
      ? "Ta réponse a bien été enregistrée : ton enseignant va la corriger."
      : note.estCorrect
        ? exo.feedbackCorrect || "Bravo, c'est exactement ça !"
        : exo.feedbackIncorrect ||
          "Ce n'est pas tout à fait ça… Relis bien la fable et réessaie !";

  const correction =
    note.estCorrect === false ? corrigeExercice(type, exo.payload) : [];

  // --- Moteur Moodle : si l'exercice est lié à un quiz, Moodle fournit la   ---
  // note (source de vérité). En cas d'indisponibilité, on conserve la note   ---
  // native : la plateforme reste utilisable (mode dégradé).                  ---
  let moodle: ScoreMoodle | null = null;
  if (
    moodleConfigure() &&
    exo.moodleQuizId !== null &&
    estMappableMoodle(type)
  ) {
    try {
      moodle = await noterDansMoodle(fable.enseignantId, eleve.id, exo, reponse);
    } catch (err) {
      console.error("[moodle] notation impossible, score natif conservé :", err);
    }
  }

  return NextResponse.json({
    ok: true,
    resultat: {
      tentativeId: cree.id,
      score: note.score,
      maxScore: note.maxScore,
      estCorrect: note.estCorrect,
      feedback,
      correction,
      tentativesUtilisees: deja.length + 1,
      tentativesRestantes:
        exo.maxTentatives === null
          ? null
          : Math.max(0, exo.maxTentatives - (deja.length + 1)),
      moodle,
    },
  });
}
