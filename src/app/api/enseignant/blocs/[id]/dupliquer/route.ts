import { NextResponse } from "next/server";
import { enseignantConnecte, erreurJson } from "@/lib/api";
import { dupliquerBloc } from "@/lib/blocs/service";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/enseignant/blocs/[id]/dupliquer
export async function POST(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const resultat = await dupliquerBloc(id, auth.enseignant.id);
  if (resultat.erreur) return erreurJson(resultat.erreur, 400);
  return NextResponse.json({ ok: true, bloc: resultat.bloc });
}
