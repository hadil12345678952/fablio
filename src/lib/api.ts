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

/**
 * Origine publique du site, utilisée pour construire les liens envoyés par
 * courriel (réinitialisation de mot de passe).
 *
 * CORRECTIF (2026-10) — l'ancienne version retombait directement sur
 * `new URL(req.url).origin`, ce qui produisait des liens INUTILISABLES derrière
 * un proxy ou quand le serveur écoute sur 0.0.0.0 (constaté : un lien
 * « http://0.0.0.0:3000/… » — l'enseignant ne peut pas l'ouvrir).
 *
 * Ordre de préférence :
 *   1. `NEXT_PUBLIC_URL_SITE` (recommandé en production : c'est aussi ce qui
 *      empêche un lien d'être construit à partir d'un en-tête forgé) ;
 *   2. en-têtes de proxy (`x-forwarded-host` + `x-forwarded-proto`) ;
 *   3. en-tête `host` de la requête ;
 *   4. origine de `req.url` (dernier recours).
 * Un avertissement est journalisé une seule fois si l'URL n'est pas configurée.
 */
let avertissementOrigineSignale = false;

export function originePublique(req: Request): string {
  const configure = process.env.NEXT_PUBLIC_URL_SITE?.trim();
  if (configure) return configure.replace(/\/+$/, "");

  const entetes = req.headers;
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host");
  if (hote) {
    const protocole =
      entetes.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (hote.startsWith("localhost") || hote.startsWith("127.") ? "http" : "https");
    return `${protocole}://${hote}`.replace(/\/+$/, "");
  }

  if (!avertissementOrigineSignale) {
    avertissementOrigineSignale = true;
    console.warn(
      "[fablio] ⚠ NEXT_PUBLIC_URL_SITE n'est pas définie : les liens de courriel sont construits " +
        "à partir de la requête. Définissez cette variable en production (voir .env.example)."
    );
  }
  return new URL(req.url).origin;
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
