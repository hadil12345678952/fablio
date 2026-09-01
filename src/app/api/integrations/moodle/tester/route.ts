import { NextResponse } from "next/server";
import { enseignantConnecte } from "@/lib/api";
import { testerConnexionMoodle } from "@/integrations/moodle";

// POST /api/integrations/moodle/tester — teste le jeton + la joignabilité Moodle
export async function POST() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const resultat = await testerConnexionMoodle();
  return NextResponse.json({ resultat });
}
