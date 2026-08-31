import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fables, tentatives } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/enseignant/reponses/[id] — correction manuelle (question ouverte)
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;

  const [tentative] = await db
    .select()
    .from(tentatives)
    .where(eq(tentatives.id, id))
    .limit(1);
  if (!tentative) return erreurJson("Réponse introuvable.", 404);

  const [fable] = await db
    .select()
    .from(fables)
    .where(
      and(eq(fables.id, tentative.fableId), eq(fables.enseignantId, auth.enseignant.id))
    )
    .limit(1);
  if (!fable) return erreurJson("Réponse introuvable.", 404);

  const corps = await lireCorps(req);
  const scoreBrut = Number(corps?.score);
  if (!Number.isFinite(scoreBrut) || scoreBrut < 0 || scoreBrut > tentative.maxScore)
    return erreurJson(`Le score doit être compris entre 0 et ${tentative.maxScore}.`);
  const score = Math.round(scoreBrut * 4) / 4;

  const [maj] = await db
    .update(tentatives)
    .set({ score, estCorrect: score >= tentative.maxScore, corrigeLe: new Date() })
    .where(eq(tentatives.id, id))
    .returning();
  return NextResponse.json({ ok: true, tentative: maj });
}
