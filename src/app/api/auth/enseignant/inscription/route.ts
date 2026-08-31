import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { enseignants } from "@/db/schema";
import { hacherSecret, ouvrirSession } from "@/lib/auth";
import { erreurJson, lireCorps, chaine } from "@/lib/api";

export async function POST(req: Request) {
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const nom = chaine(corps.nom);
  const email = chaine(corps.email).toLowerCase();
  const motDePasse = typeof corps.motDePasse === "string" ? corps.motDePasse : "";

  if (nom.length < 2 || nom.length > 60)
    return erreurJson("Le nom doit contenir entre 2 et 60 caractères.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return erreurJson("Adresse email invalide.");
  if (motDePasse.length < 8)
    return erreurJson("Le mot de passe doit contenir au moins 8 caractères.");

  const existant = await db
    .select({ id: enseignants.id })
    .from(enseignants)
    .where(eq(enseignants.email, email))
    .limit(1);
  if (existant.length > 0)
    return erreurJson("Un compte existe déjà avec cette adresse email.", 409);

  const [cree] = await db
    .insert(enseignants)
    .values({ nom, email, motDePasseHash: await hacherSecret(motDePasse) })
    .returning();
  await ouvrirSession("enseignant", cree.id);
  return NextResponse.json({ ok: true, id: cree.id });
}
