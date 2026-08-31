import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { codesParrainage, eleves } from "@/db/schema";
import { ouvrirSession, verifierSecret } from "@/lib/auth";
import { erreurJson, lireCorps, chaine } from "@/lib/api";

export async function POST(req: Request) {
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const pseudo = chaine(corps.pseudo);
  const code = chaine(corps.code).toUpperCase();
  const pin = typeof corps.pin === "string" ? corps.pin : "";

  const [codeTrouve] = await db
    .select()
    .from(codesParrainage)
    .where(eq(codesParrainage.code, code))
    .limit(1);
  if (!codeTrouve || !codeTrouve.actif)
    return erreurJson("Code de classe invalide. Vérifie avec ton enseignant.", 401);

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
    return erreurJson("Pseudo ou code secret incorrect.", 401);
  }
  await ouvrirSession("eleve", eleve.id);
  return NextResponse.json({ ok: true });
}
