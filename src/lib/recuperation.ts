import "server-only";
import crypto from "node:crypto";
import { and, eq, gt, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { enseignants, jetonsReinitialisation } from "@/db/schema";
import { hacherSecret } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Récupération de mot de passe — ENSEIGNANT (compte avec email).
//
// Sécurité :
//   • le jeton est aléatoire (32 octets) et n'est stocké que HACHÉ (SHA-256) ;
//   • usage unique, durée de vie 60 minutes ;
//   • les anciens jetons de l'enseignant sont invalidés à chaque demande ;
//   • la réponse de l'API ne révèle JAMAIS si un compte existe (anti-énumération) ;
//   • limitation : au plus 3 demandes par compte et par quart d'heure ;
//   • à l'usage du jeton, toutes les SESSIONS de l'enseignant sont fermées.
//
// Les élèves n'ont pas d'email : leur code secret est réinitialisé par leur
// enseignant via la fiche élève (mécanisme déjà en place, inchangé).
// ---------------------------------------------------------------------------

const DUREE_MINUTES = 60;
const MAX_DEMANDES_PAR_QUART_HEURE = 3;

function hacherJeton(jeton: string): string {
  return crypto.createHash("sha256").update(jeton).digest("hex");
}

export interface DemandeCreee {
  /** Jeton en clair : transmis une seule fois (courriel ou remise en main propre). */
  jeton: string;
  expireLe: Date;
}

/**
 * Crée une demande de réinitialisation si le compte existe.
 * Retourne null si le compte est inconnu ou si le quota est atteint :
 * l'appelant doit répondre le même message dans les deux cas.
 */
export async function creerDemandeReinitialisation(
  email: string
): Promise<DemandeCreee | null> {
  const [compte] = await db
    .select()
    .from(enseignants)
    .where(eq(enseignants.email, email.trim().toLowerCase()))
    .limit(1);
  if (!compte) return null;

  // Limitation de fréquence (anti-abus).
  const ilYAUnQuartDHeure = new Date(Date.now() - 15 * 60 * 1000);
  const recentes = await db
    .select({ id: jetonsReinitialisation.id })
    .from(jetonsReinitialisation)
    .where(
      and(
        eq(jetonsReinitialisation.enseignantId, compte.id),
        gt(jetonsReinitialisation.creeLe, ilYAUnQuartDHeure)
      )
    );
  if (recentes.length >= MAX_DEMANDES_PAR_QUART_HEURE) return null;

  // Invalide les demandes encore actives (une seule valide à la fois).
  await db
    .update(jetonsReinitialisation)
    .set({ utiliseLe: new Date() })
    .where(
      and(
        eq(jetonsReinitialisation.enseignantId, compte.id),
        isNull(jetonsReinitialisation.utiliseLe)
      )
    );

  const jeton = crypto.randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_MINUTES * 60 * 1000);
  await db.insert(jetonsReinitialisation).values({
    enseignantId: compte.id,
    jetonHash: hacherJeton(jeton),
    expireLe,
  });
  return { jeton, expireLe };
}

export type VerificationJeton =
  | { valide: true; enseignantId: string; email: string }
  | { valide: false; raison: string };

export async function verifierJeton(jeton: string): Promise<VerificationJeton> {
  const propre = (jeton ?? "").trim();
  if (propre.length < 20) return { valide: false, raison: "Lien invalide." };

  const [ligne] = await db
    .select()
    .from(jetonsReinitialisation)
    .where(eq(jetonsReinitialisation.jetonHash, hacherJeton(propre)))
    .limit(1);

  if (!ligne) return { valide: false, raison: "Ce lien n'est pas valide." };
  if (ligne.utiliseLe)
    return { valide: false, raison: "Ce lien a déjà été utilisé. Demandez-en un nouveau." };
  if (ligne.expireLe.getTime() < Date.now())
    return { valide: false, raison: "Ce lien a expiré (validité : 1 heure). Demandez-en un nouveau." };

  const [compte] = await db
    .select()
    .from(enseignants)
    .where(eq(enseignants.id, ligne.enseignantId))
    .limit(1);
  if (!compte) return { valide: false, raison: "Compte introuvable." };

  return { valide: true, enseignantId: compte.id, email: compte.email };
}

/** Applique le nouveau mot de passe, consomme le jeton et ferme les sessions. */
export async function appliquerNouveauMotDePasse(
  jeton: string,
  motDePasse: string
): Promise<{ ok: true; email: string } | { ok: false; erreur: string }> {
  if (motDePasse.length < 8)
    return { ok: false, erreur: "Le mot de passe doit contenir au moins 8 caractères." };

  const verif = await verifierJeton(jeton);
  if (!verif.valide) return { ok: false, erreur: verif.raison };

  const { sessions } = await import("@/db/schema");
  await db.transaction(async (tx) => {
    await tx
      .update(enseignants)
      .set({ motDePasseHash: await hacherSecret(motDePasse) })
      .where(eq(enseignants.id, verif.enseignantId));
    await tx
      .update(jetonsReinitialisation)
      .set({ utiliseLe: new Date() })
      .where(eq(jetonsReinitialisation.jetonHash, hacherJeton(jeton.trim())));
    // Sécurité : toutes les sessions ouvertes de ce compte sont révoquées.
    await tx.delete(sessions).where(eq(sessions.enseignantId, verif.enseignantId));
  });

  return { ok: true, email: verif.email };
}

/** Dernière demande active (diagnostic enseignant, sans exposer le jeton). */
export async function derniereDemande(enseignantId: string) {
  const [l] = await db
    .select()
    .from(jetonsReinitialisation)
    .where(eq(jetonsReinitialisation.enseignantId, enseignantId))
    .orderBy(desc(jetonsReinitialisation.creeLe))
    .limit(1);
  return l ?? null;
}
