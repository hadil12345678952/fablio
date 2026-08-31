import { NextResponse } from "next/server";
import { eleveConnecte } from "@/lib/api";
import { progressionEleve } from "@/lib/queries";

// GET /api/eleve/progression — score global, historique, fables terminées
export async function GET() {
  const auth = await eleveConnecte();
  if ("echec" in auth) return auth.echec;
  return NextResponse.json({ progression: await progressionEleve(auth.eleve) });
}
