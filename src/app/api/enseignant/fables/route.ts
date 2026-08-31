import { NextResponse } from "next/server";
import { db } from "@/db";
import { fables } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";
import { fablesDeEnseignant } from "@/lib/queries";
import { validerChampsFable } from "@/lib/validation";

// GET /api/enseignant/fables
export async function GET() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  return NextResponse.json({
    fables: await fablesDeEnseignant(auth.enseignant.id),
  });
}

// POST /api/enseignant/fables — création d'une fable
export async function POST(req: Request) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;

  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");
  const resultat = validerChampsFable(corps);
  if (!resultat.ok) return erreurJson(resultat.erreur);

  const [cree] = await db
    .insert(fables)
    .values({ enseignantId: auth.enseignant.id, ...resultat.donnees })
    .returning();
  return NextResponse.json({ ok: true, fable: cree });
}
