import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { enseignants } from "@/db/schema";
import { ouvrirSession, verifierSecret } from "@/lib/auth";
import { erreurJson, lireCorps, chaine } from "@/lib/api";

export async function POST(req: Request) {
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const email = chaine(corps.email).toLowerCase();
  const motDePasse = typeof corps.motDePasse === "string" ? corps.motDePasse : "";

  const [compte] = await db
    .select()
    .from(enseignants)
    .where(eq(enseignants.email, email))
    .limit(1);
  if (!compte || !(await verifierSecret(motDePasse, compte.motDePasseHash))) {
    return erreurJson("Email ou mot de passe incorrect.", 401);
  }
  await ouvrirSession("enseignant", compte.id);
  return NextResponse.json({ ok: true });
}
