import { NextResponse } from "next/server";
import { db } from "@/db";
import { codesParrainage } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps, chaine } from "@/lib/api";
import { codesDeEnseignant } from "@/lib/queries";
import { genererCodeParrainage } from "@/lib/exercices";

// GET /api/enseignant/codes — liste des codes avec effectifs
export async function GET() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  return NextResponse.json({ codes: await codesDeEnseignant(auth.enseignant.id) });
}

// POST /api/enseignant/codes — génère un nouveau code de parrainage
export async function POST(req: Request) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;

  const corps = await lireCorps(req);
  const etiquette = chaine(corps?.etiquette).slice(0, 40);

  for (let essai = 0; essai < 5; essai++) {
    const code = genererCodeParrainage(etiquette);
    try {
      const [cree] = await db
        .insert(codesParrainage)
        .values({ enseignantId: auth.enseignant.id, code, etiquette })
        .returning();
      return NextResponse.json({ ok: true, code: cree });
    } catch {
      // collision improbable sur l'unicité du code : on réessaie
    }
  }
  return erreurJson("Impossible de générer un code unique, réessayez.", 500);
}
