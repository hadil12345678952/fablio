import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { codesParrainage } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

async function codePossede(id: string, enseignantId: string) {
  const [code] = await db
    .select()
    .from(codesParrainage)
    .where(
      and(eq(codesParrainage.id, id), eq(codesParrainage.enseignantId, enseignantId))
    )
    .limit(1);
  return code ?? null;
}

// PATCH /api/enseignant/codes/[id] — activer/désactiver, renommer
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const existant = await codePossede(id, auth.enseignant.id);
  if (!existant) return erreurJson("Code introuvable.", 404);

  const corps = await lireCorps(req);
  const patch: Partial<{ actif: boolean; etiquette: string }> = {};
  if (typeof corps?.actif === "boolean") patch.actif = corps.actif;
  if (typeof corps?.etiquette === "string") patch.etiquette = corps.etiquette.slice(0, 40);
  if (Object.keys(patch).length === 0) return erreurJson("Rien à modifier.");

  const [maj] = await db
    .update(codesParrainage)
    .set(patch)
    .where(eq(codesParrainage.id, id))
    .returning();
  return NextResponse.json({ ok: true, code: maj });
}

// DELETE /api/enseignant/codes/[id]
export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const existant = await codePossede(id, auth.enseignant.id);
  if (!existant) return erreurJson("Code introuvable.", 404);
  await db.delete(codesParrainage).where(eq(codesParrainage.id, id));
  return NextResponse.json({ ok: true });
}
