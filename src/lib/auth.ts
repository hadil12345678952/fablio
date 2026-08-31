import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
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
}

export async function fermerSession(): Promise<void> {
  const magasin = await cookies();
  const token = magasin.get(COOKIE_SESSION)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
  magasin.delete(COOKIE_SESSION);
}

export async function lireSession(): Promise<SessionUtilisateur | null> {
  const magasin = await cookies();
  const token = magasin.get(COOKIE_SESSION)?.value;
  if (!token) return null;
  try {
    const [s] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.token, token), gt(sessions.expireLe, new Date())))
      .limit(1);
    if (!s) return null;
    if (s.typeUtilisateur === "enseignant" && s.enseignantId) {
      const [e] = await db
        .select()
        .from(enseignants)
        .where(eq(enseignants.id, s.enseignantId))
        .limit(1);
      return e ? { type: "enseignant", enseignant: e } : null;
    }
    if (s.typeUtilisateur === "eleve" && s.eleveId) {
      const [el] = await db
        .select()
        .from(eleves)
        .where(eq(eleves.id, s.eleveId))
        .limit(1);
      return el ? { type: "eleve", eleve: el } : null;
    }
    return null;
  } catch {
    // La base n'est pas encore prête (premier démarrage) : pas de session.
    return null;
  }
}
