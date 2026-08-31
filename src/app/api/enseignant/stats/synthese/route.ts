import { NextResponse } from "next/server";
import { enseignantConnecte } from "@/lib/api";
import { syntheseEnseignant } from "@/lib/statistiques";

// GET /api/enseignant/stats/synthese
export async function GET() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  return NextResponse.json({ synthese: await syntheseEnseignant(auth.enseignant.id) });
}
