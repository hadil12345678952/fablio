import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { codesParrainage, eleves } from "@/db/schema";
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

  const pseudo = chaine(corps.pseudo);
  const code = chaine(corps.code).toUpperCase();
  const pin = typeof corps.pin === "string" ? corps.pin : "";

  // ANTI-FORCE-BRUTE (audit 2026-10) : le code secret d'un élève fait 4 à 12
  // caractères — sans bornage, un PIN à 4 chiffres se teste par force brute.
  // La clé de comptage est le COUPLE code+pseudo (un élève bloqué n'en bloque
  // pas un autre de la même classe).
  const identifiant = `${code}|${pseudo}`;
  const blocage = await etatDeBlocage("eleve", identifiant);
  if (blocage.actif) {
    const { message, retryAfter } = reponseBlocage(blocage, "eleve");
    return tropDeTentatives(message, retryAfter);
  }

  const [codeTrouve] = await db
    .select()
    .from(codesParrainage)
    .where(eq(codesParrainage.code, code))
    .limit(1);
  if (!codeTrouve || !codeTrouve.actif) {
    await enregistrerEchec("eleve", identifiant);
    return erreurJson("Code de classe invalide. Vérifie avec ton enseignant.", 401);
  }

  const [eleve] = await db
    .select()
    .from(eleves)
    .where(
      and(
        eq(eleves.enseignantId, codeTrouve.enseignantId),
        sql`lower(${eleves.pseudo}) = ${pseudo.toLowerCase()}`
      )
    )
    .limit(1);
  if (!eleve || !(await verifierSecret(pin, eleve.pinHash))) {
    await enregistrerEchec("eleve", identifiant);
    return erreurJson("Pseudo ou code secret incorrect.", 401);
  }
  await effacerEchecs("eleve", identifiant);
  await ouvrirSession("eleve", eleve.id);
  return NextResponse.json({ ok: true });
}
