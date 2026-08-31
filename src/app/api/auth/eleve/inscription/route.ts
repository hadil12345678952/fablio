import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { codesParrainage, eleves } from "@/db/schema";
import { hacherSecret, ouvrirSession } from "@/lib/auth";
import { erreurJson, lireCorps, chaine } from "@/lib/api";

export async function POST(req: Request) {
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const pseudo = chaine(corps.pseudo);
  const code = chaine(corps.code).toUpperCase();
  const pin = typeof corps.pin === "string" ? corps.pin : "";

  if (!/^[\p{L}\p{N}_-]{2,20}$/u.test(pseudo))
    return erreurJson(
      "Le pseudo doit contenir 2 à 20 lettres ou chiffres (sans espaces)."
    );
  if (code.length < 4) return erreurJson("Code de parrainage invalide.");
  if (pin.length < 4 || pin.length > 12)
    return erreurJson("Le code secret (PIN) doit contenir entre 4 et 12 caractères.");

  const [codeTrouve] = await db
    .select()
    .from(codesParrainage)
    .where(eq(codesParrainage.code, code))
    .limit(1);
  if (!codeTrouve || !codeTrouve.actif)
    return erreurJson(
      "Ce code de parrainage est invalide ou désactivé. Demande-le à ton enseignant.",
      404
    );

  const dejaPris = await db
    .select({ id: eleves.id })
    .from(eleves)
    .where(
      and(
        eq(eleves.enseignantId, codeTrouve.enseignantId),
        sql`lower(${eleves.pseudo}) = ${pseudo.toLowerCase()}`
      )
    )
    .limit(1);
  if (dejaPris.length > 0)
    return erreurJson(
      "Ce pseudo est déjà utilisé dans ta classe. Choisis-en un autre ou connecte-toi.",
      409
    );

  const [cree] = await db
    .insert(eleves)
    .values({
      enseignantId: codeTrouve.enseignantId,
      codeId: codeTrouve.id,
      pseudo,
      pinHash: await hacherSecret(pin),
    })
    .returning();
  await ouvrirSession("eleve", cree.id);
  return NextResponse.json({ ok: true, id: cree.id });
}
