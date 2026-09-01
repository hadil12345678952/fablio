import { NextResponse } from "next/server";
import { enseignantConnecte } from "@/lib/api";
import { synchroniserPourEnseignant } from "@/integrations/moodle";

export const maxDuration = 60;

// POST /api/integrations/moodle/synchroniser — idempotent : comptes + cours + inscriptions
export async function POST() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const resume = await synchroniserPourEnseignant(auth.enseignant);
  return NextResponse.json({ resume });
}
