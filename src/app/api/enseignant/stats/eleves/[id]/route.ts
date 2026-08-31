import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eleves } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps, chaine } from "@/lib/api";
import { detailEleveStats } from "@/lib/statistiques";
import { hacherSecret } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/enseignant/stats/eleves/[id] — détail d'un élève
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const detail = await detailEleveStats(auth.enseignant.id, id);
  if (!detail) return erreurJson("Élève introuvable.", 404);
  return NextResponse.json({ detail });
}

// PATCH /api/enseignant/stats/eleves/[id] — réinitialiser le code secret (PIN)
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;

  const [eleve] = await db
    .select()
    .from(eleves)
    .where(and(eq(eleves.id, id), eq(eleves.enseignantId, auth.enseignant.id)))
    .limit(1);
  if (!eleve) return erreurJson("Élève introuvable.", 404);

  const corps = await lireCorps(req);
  const pin = chaine(corps?.pin);
  if (pin.length < 4 || pin.length > 12)
    return erreurJson("Le nouveau code secret doit contenir entre 4 et 12 caractères.");

  await db
    .update(eleves)
    .set({ pinHash: await hacherSecret(pin) })
    .where(eq(eleves.id, id));
  return NextResponse.json({ ok: true });
}
