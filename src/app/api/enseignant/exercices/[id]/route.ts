import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercices, fables } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";
import { validerChampsExercice } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function exercicePossede(id: string, enseignantId: string) {
  const [exo] = await db.select().from(exercices).where(eq(exercices.id, id)).limit(1);
  if (!exo) return null;
  const [fable] = await db
    .select({ enseignantId: fables.enseignantId })
    .from(fables)
    .where(and(eq(fables.id, exo.fableId), eq(fables.enseignantId, enseignantId)))
    .limit(1);
  return fable ? exo : null;
}

// PUT /api/enseignant/exercices/[id] — mise à jour complète
export async function PUT(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const existant = await exercicePossede(id, auth.enseignant.id);
  if (!existant) return erreurJson("Exercice introuvable.", 404);

  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const fusion = { ...existant, ...corps };
  const resultat = validerChampsExercice(fusion);
  if (!resultat.ok) return erreurJson(resultat.erreur);
  if (resultat.donnees.type !== existant.type)
    return erreurJson("Le type d'un exercice ne peut pas être modifié.");

  const [maj] = await db
    .update(exercices)
    .set(resultat.donnees)
    .where(eq(exercices.id, id))
    .returning();
  return NextResponse.json({ ok: true, exercice: maj });
}

// DELETE /api/enseignant/exercices/[id]
export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const existant = await exercicePossede(id, auth.enseignant.id);
  if (!existant) return erreurJson("Exercice introuvable.", 404);
  await db.delete(exercices).where(eq(exercices.id, id));
  return NextResponse.json({ ok: true });
}
