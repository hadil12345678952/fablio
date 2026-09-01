import { NextResponse } from "next/server";
import { enseignantConnecte } from "@/lib/api";
import { statutIntegrationMoodle } from "@/integrations/moodle";

// GET /api/integrations/moodle/statut — état de l'intégration pour l'enseignant
export async function GET() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const statut = await statutIntegrationMoodle(auth.enseignant.id);
  return NextResponse.json({ statut });
}
