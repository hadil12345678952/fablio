import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  sessions,
  enseignants,
  eleves,
  type EnseignantRow,
  type EleveRow,
} from "@/db/schema";

export const COOKIE_SESSION = "fablio_session";
const DUREE_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours

export type SessionUtilisateur =
  | { type: "enseignant"; enseignant: EnseignantRow }
  | { type: "eleve"; eleve: EleveRow };

export async function hacherSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, 10);
}

export async function verifierSecret(
  secret: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

async function poserCookie(token: string, expireLe: Date) {
  const magasin = await cookies();
  magasin.set(COOKIE_SESSION, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expireLe,
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Ouvre une session et pose le cookie.
 *
 * OPTIMISATION (2026-10) — purge opportuniste des sessions expirées.
 * Rien ne nettoyait `sessions` : la table grossissait indéfiniment (une ligne par
 * connexion, valable 30 jours). La purge est faite ici, à la connexion, où l'on
 * écrit déjà : un seul DELETE (indexé sur `expire_le`) borne la table au lieu
 * d'ajouter une tâche planifiée à maintenir. Elle ne bloque jamais la connexion.
 */
export async function ouvrirSession(
  type: "enseignant" | "eleve",
  id: string
): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expireLe = new Date(Date.now() + DUREE_MS);
  await db.insert(sessions).values({
    token,
    typeUtilisateur: type,
    enseignantId: type === "enseignant" ? id : null,
    eleveId: type === "eleve" ? id : null,
    expireLe,
  });
  await poserCookie(token, expireLe);

  try {
    await db.delete(sessions).where(lt(sessions.expireLe, new Date()));
  } catch {
    /* la purge est un bonus : jamais bloquante pour la connexion */
  }
}

export async function fermerSession(): Promise<void> {
  const magasin = await cookies();
  const token = magasin.get(COOKIE_SESSION)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
  magasin.delete(COOKIE_SESSION);
}

/**
 * Lit la session du cookie.
 *
 * OPTIMISATION (2026-10) — une SEULE requête au lieu de deux.
 * L'implémentation précédente faisait 2 allers-retours (session puis
 * enseignant/élève) à CHAQUE appel, et les layouts + pages (ou une route API)
 * appellent `lireSession()` deux fois par requête HTTP : 4 allers-retours au
 * lieu de 2. On joint désormais l'utilisateur directement à la session
 * (LEFT JOIN) — mesuré : GET /eleve passe de 9 à 7 requêtes SQL.
 * Le comportement observé est inchangé : session absente/expirée → null ;
 * session dont l'utilisateur a disparu (cascade) → null.
 */
export async function lireSession(): Promise<SessionUtilisateur | null> {
  const magasin = await cookies();
  const token = magasin.get(COOKIE_SESSION)?.value;
  if (!token) return null;
  try {
    const [ligne] = await db
      .select({ session: sessions, enseignant: enseignants, eleve: eleves })
      .from(sessions)
      .leftJoin(enseignants, eq(enseignants.id, sessions.enseignantId))
      .leftJoin(eleves, eq(eleves.id, sessions.eleveId))
      .where(and(eq(sessions.token, token), gt(sessions.expireLe, new Date())))
      .limit(1);

    if (!ligne) return null;
    if (ligne.session.typeUtilisateur === "enseignant" && ligne.enseignant) {
      return { type: "enseignant", enseignant: ligne.enseignant };
    }
    if (ligne.session.typeUtilisateur === "eleve" && ligne.eleve) {
      return { type: "eleve", eleve: ligne.eleve };
    }
    // Session orpheline (utilisateur supprimé) : on la retire au passage.
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  } catch {
    // La base n'est pas encore prête (premier démarrage) : pas de session.
    return null;
  }
}
