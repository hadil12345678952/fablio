import { NextResponse } from "next/server";
import { eleveConnecte } from "@/lib/api";
import { fablesPourEleve } from "@/lib/queries";

// GET /api/eleve/fables — fables visibles par l'élève connecté
export async function GET() {
  const auth = await eleveConnecte();
  if ("echec" in auth) return auth.echec;
  return NextResponse.json({ fables: await fablesPourEleve(auth.eleve) });
}
