import { NextResponse } from "next/server";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";
import { modifierBloc, supprimerBloc, blocPossede } from "@/lib/blocs/service";
import type { ContenuBloc } from "@/lib/blocs/types";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/enseignant/blocs/[id]
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const poss = await blocPossede(id, auth.enseignant.id);
  if (!poss) return erreurJson("Bloc introuvable.", 404);
  return NextResponse.json({ bloc: poss.bloc });
}

// PUT /api/enseignant/blocs/[id] — modifier contenu / titre / visibilité
export async function PUT(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const resultat = await modifierBloc(id, auth.enseignant.id, {
    titre: typeof corps.titre === "string" ? corps.titre : undefined,
    contenu: corps.contenu !== undefined ? (corps.contenu as ContenuBloc) : undefined,
    visible: typeof corps.visible === "boolean" ? corps.visible : undefined,
  });
  if (resultat.erreur) return erreurJson(resultat.erreur, 400);
  return NextResponse.json({ ok: true, bloc: resultat.bloc });
}

// DELETE /api/enseignant/blocs/[id] — supprimer le bloc (jamais l'exercice)
export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const resultat = await supprimerBloc(id, auth.enseignant.id);
  if (resultat.erreur) return erreurJson(resultat.erreur, 404);
  return NextResponse.json({ ok: true });
}
