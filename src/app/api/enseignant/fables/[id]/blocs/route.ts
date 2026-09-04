import { NextResponse } from "next/server";
import { enseignantConnecte, erreurJson, lireCorps, chaine } from "@/lib/api";
import { blocsDeFable } from "@/lib/blocs/queries";
import { creerBloc, fablePossedee } from "@/lib/blocs/service";
import { estTypeBlocActif } from "@/lib/blocs/registre";
import type { TypeBloc, ContenuBloc } from "@/lib/blocs/types";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/enseignant/fables/[id]/blocs — liste ordonnée
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const fable = await fablePossedee(id, auth.enseignant.id);
  if (!fable) return erreurJson("Fable introuvable.", 404);
  return NextResponse.json({ blocs: await blocsDeFable(id) });
}

// POST /api/enseignant/fables/[id]/blocs — ajouter un bloc
export async function POST(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const type = chaine(corps.type);
  if (!estTypeBlocActif(type)) return erreurJson("Type de bloc invalide ou non disponible.");

  const positionBrut = corps.position;
  const position =
    positionBrut === null || positionBrut === undefined || positionBrut === ""
      ? null
      : Math.max(0, Math.round(Number(positionBrut)) || 0);

  const resultat = await creerBloc(id, auth.enseignant.id, {
    type: type as TypeBloc,
    titre: chaine(corps.titre),
    contenu: (corps.contenu as ContenuBloc) ?? undefined,
    exerciceId: typeof corps.exerciceId === "string" ? corps.exerciceId : null,
    position,
  });
  if (resultat.erreur) return erreurJson(resultat.erreur, 400);
  return NextResponse.json({ ok: true, bloc: resultat.bloc });
}
