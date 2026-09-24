import { NextResponse } from "next/server";
import { erreurJson, lireCorps, chaine } from "@/lib/api";
import { verifierJeton, appliquerNouveauMotDePasse } from "@/lib/recuperation";

// GET /api/auth/mot-de-passe/reinitialiser?jeton=… — validité du lien
export async function GET(req: Request) {
  const jeton = new URL(req.url).searchParams.get("jeton") ?? "";
  const verif = await verifierJeton(jeton);
  return NextResponse.json(
    verif.valide
      ? { valide: true, email: verif.email }
      : { valide: false, raison: verif.raison }
  );
}

// POST /api/auth/mot-de-passe/reinitialiser  { jeton, motDePasse }
export async function POST(req: Request) {
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const jeton = chaine(corps.jeton);
  const motDePasse =
    typeof corps.motDePasse === "string" ? corps.motDePasse : "";

  const resultat = await appliquerNouveauMotDePasse(jeton, motDePasse);
  if (!resultat.ok) return erreurJson(resultat.erreur, 400);

  return NextResponse.json({
    ok: true,
    message:
      "Mot de passe modifié. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
  });
}
