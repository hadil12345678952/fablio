import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { exercices, fables } from "@/db/schema";
import { enseignantConnecte } from "@/lib/api";
import { moodleConfigure } from "@/integrations/moodle";
import { creerActiviteMoodle } from "@/integrations/moodle/creation";
import { estMappableMoodle } from "@/integrations/moodle/conversion";
import { journaliserMoodle } from "@/integrations/moodle/journal";
import type { TypeExercice } from "@/lib/exercices";

export const maxDuration = 60;

// POST /api/integrations/moodle/migrer
// Migration progressive : crée un quiz Moodle pour chaque exercice existant
// de l'enseignant dont le type est convertible et qui n'est pas encore lié.
export async function POST() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  if (!moodleConfigure()) {
    return NextResponse.json({
      configure: false,
      migres: 0,
      ignores: 0,
      erreurs: [],
      message: "Moodle n'est pas configuré : migration ignorée.",
    });
  }

  const mesFables = await db
    .select({ id: fables.id })
    .from(fables)
    .where(eq(fables.enseignantId, auth.enseignant.id));
  const fableIds = mesFables.map((f) => f.id);
  const mesExercices = fableIds.length
    ? await db.select().from(exercices).where(inArray(exercices.fableId, fableIds))
    : [];

  let migres = 0;
  let ignores = 0;
  const erreurs: string[] = [];

  for (const e of mesExercices) {
    if (e.moodleQuizId !== null) {
      migres++; // déjà lié : compté comme traité (idempotent)
      continue;
    }
    if (!estMappableMoodle(e.type as TypeExercice)) {
      ignores++;
      continue;
    }
    try {
      await creerActiviteMoodle(auth.enseignant, e);
      migres++;
    } catch (err) {
      erreurs.push(`${e.id} : ${err instanceof Error ? err.message : "erreur inconnue"}`);
    }
  }

  await journaliserMoodle(
    "quiz",
    erreurs.length ? "erreur" : "ok",
    `Migration : ${migres} exercice(s) traités, ${ignores} non convertibles.`,
    erreurs.join("\n")
  );

  return NextResponse.json({ configure: true, migres, ignores, erreurs });
}
