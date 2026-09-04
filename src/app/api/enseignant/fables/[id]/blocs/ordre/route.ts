import { NextResponse } from "next/server";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";
import { reordonnerBlocs } from "@/lib/blocs/service";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/enseignant/fables/[id]/blocs/ordre  { ids: [...] }
export async function PUT(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const corps = await lireCorps(req);
  const ids = Array.isArray(corps?.ids)
    ? corps.ids.filter((x): x is string => typeof x === "string")
    : null;
  if (!ids || ids.length === 0) return erreurJson("Liste d'identifiants de blocs manquante.");

  const resultat = await reordonnerBlocs(id, auth.enseignant.id, ids);
  if (resultat.erreur) return erreurJson(resultat.erreur, 400);
  return NextResponse.json({ ok: true });
}
