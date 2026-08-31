import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercices, fables } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps, chaine } from "@/lib/api";
import { validerChampsExercice } from "@/lib/validation";

// POST /api/enseignant/exercices — création d'un exercice pour une fable
export async function POST(req: Request) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;

  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const fableId = chaine(corps.fableId);
  const [fable] = await db
    .select()
    .from(fables)
    .where(and(eq(fables.id, fableId), eq(fables.enseignantId, auth.enseignant.id)))
    .limit(1);
  if (!fable) return erreurJson("Fable introuvable.", 404);

  const resultat = validerChampsExercice(corps);
  if (!resultat.ok) return erreurJson(resultat.erreur);

  const existants = await db
    .select({ ordre: exercices.ordre })
    .from(exercices)
    .where(eq(exercices.fableId, fableId));
  const ordre = existants.reduce((max, e) => Math.max(max, e.ordre), -1) + 1;

  const [cree] = await db
    .insert(exercices)
    .values({ fableId, ordre, ...resultat.donnees })
    .returning();
  return NextResponse.json({ ok: true, exercice: cree });
}
