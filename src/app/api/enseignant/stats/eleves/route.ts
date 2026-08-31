import { NextResponse } from "next/server";
import { enseignantConnecte } from "@/lib/api";
import { statsEleves } from "@/lib/statistiques";

// GET /api/enseignant/stats/eleves
export async function GET() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  return NextResponse.json({ eleves: await statsEleves(auth.enseignant.id) });
}
