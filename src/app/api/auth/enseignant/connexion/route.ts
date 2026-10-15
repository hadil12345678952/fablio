import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { enseignants } from "@/db/schema";
import { ouvrirSession, verifierSecret } from "@/lib/auth";
import { erreurJson, lireCorps, chaine, tropDeTentatives } from "@/lib/api";
import {
  effacerEchecs,
  enregistrerEchec,
  etatDeBlocage,
  reponseBlocage,
} from "@/lib/securite";

export async function POST(req: Request) {
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const email = chaine(corps.email).toLowerCase();
  const motDePasse = typeof corps.motDePasse === "string" ? corps.motDePasse : "";

  // ANTI-FORCE-BRUTE (audit 2026-10) : on consulte le bornage AVANT de dépenser
  // un bcrypt (le hachage est justement là pour être coûteux : ne jamais le
  // rendre gratuite à lancer en boucle pour un attaquant).
  const blocage = await etatDeBlocage("enseignant", email);
  if (blocage.actif) {
    const { message, retryAfter } = reponseBlocage(blocage, "enseignant");
    return tropDeTentatives(message, retryAfter);
  }

  const [compte] = await db
    .select()
    .from(enseignants)
    .where(eq(enseignants.email, email))
    .limit(1);
  if (!compte || !(await verifierSecret(motDePasse, compte.motDePasseHash))) {
    await enregistrerEchec("enseignant", email);
    // Réponse volontairement identique que le compte existe ou non
    // (pas d'énumération de comptes par les messages).
    return erreurJson("Email ou mot de passe incorrect.", 401);
  }
  await effacerEchecs("enseignant", email);
  await ouvrirSession("enseignant", compte.id);
  return NextResponse.json({ ok: true });
}
