import { NextResponse } from "next/server";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";
import { deplacerBloc } from "@/lib/blocs/service";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/enseignant/blocs/[id]/deplacer  { delta: 1 | -1 }
export async function POST(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const corps = await lireCorps(req);
  const delta = Number(corps?.delta);
  if (delta !== 1 && delta !== -1) return erreurJson("Delta invalide (1 ou -1 attendu).");
  const resultat = await deplacerBloc(id, auth.enseignant.id, delta as 1 | -1);
  if (resultat.erreur) return erreurJson(resultat.erreur, 400);
  return NextResponse.json({ ok: true });
}
