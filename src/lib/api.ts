import "server-only";
import { NextResponse } from "next/server";
import { lireSession } from "@/lib/auth";
import type { EnseignantRow, EleveRow } from "@/db/schema";

export function erreurJson(message: string, statut = 400): NextResponse {
  return NextResponse.json({ erreur: message }, { status: statut });
}

export async function lireCorps(
  req: Request
): Promise<Record<string, unknown> | null> {
  try {
    const corps = await req.json();
    if (corps && typeof corps === "object") return corps as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

export function chaine(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function enseignantConnecte(): Promise<
  { enseignant: EnseignantRow } | { echec: NextResponse }
> {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") {
    return { echec: erreurJson("Authentification enseignant requise.", 401) };
  }
  return { enseignant: session.enseignant };
}

export async function eleveConnecte(): Promise<
  { eleve: EleveRow } | { echec: NextResponse }
> {
  const session = await lireSession();
  if (!session || session.type !== "eleve") {
    return { echec: erreurJson("Authentification élève requise.", 401) };
  }
  return { eleve: session.eleve };
}
