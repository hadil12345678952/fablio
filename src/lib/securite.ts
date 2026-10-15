import "server-only";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// ---------------------------------------------------------------------------
// ANTI-FORCE-BRUTE SUR LA CONNEXION
// ---------------------------------------------------------------------------
//
// Constat d'audit : seule la récupération de mot de passe était limitée
// (3 demandes / 15 min / compte). La connexion enseignant (mot de passe) et
// celle de l'élève (code secret de 4 à 12 caractères) ne l'étaient PAS : un
// PIN de 4 chiffres se teste entièrement en quelques milliers de requêtes,
// sans coût pour l'attaquant et sans trace exploitable.
//
// Choix techniques :
//   • compteur en BASE DE DONNÉES (et non en mémoire) : sur Vercel, plusieurs
//     instances serverless servent le même site ; un `Map()` mémoire ne serait
//     ni partagé ni persistant, et serait contourné en chauffant le froid.
//   • écriture ATOMIQUE en une seule instruction (`INSERT … ON CONFLICT DO
//     UPDATE`) : deux tentatives simultanées ne peuvent pas se lire l'une
//     l'autre en retard (« time-of-check/time-of-use » éliminé).
//   • la clé est un SHA-256 de l'identifiant saisi : aucun email ni pseudo
//     d'élève n'est stocké en clair dans cette table.
//   • fenêtre glissante : les échecs s'effacent d'eux-mêmes si la dernière
//     erreur est plus ancienne que la fenêtre (un élève qui s'est trompé trois
//     fois il y a une heure repart de zéro).
//
// Dégradation volontairement OUVERTE (fail-open) : si la table n'existe pas
// encore (déploiement n'ayant pas encore appliqué le schéma) ou si la base est
// injoignable, la connexion reste possible et un avertissement est journalisé
// UNE seule fois. Un outil de classe ne doit pas empêcher 30 élèves d'entrer
// parce qu'une migration manque. Pour un comportement inverse (refus tant que
// le bornage n'est pas actif), définir FABLIO_CONNEXION_STRICT=1.
// Pour désactiver entièrement le bornage : FABLIO_CONNEXION_LIMITATION=off.
// ---------------------------------------------------------------------------

export type ContexteConnexion = "enseignant" | "eleve";

interface Regles {
  /** Nombre d'échecs dans la fenêtre avant blocage. */
  seuil: number;
  /** Fenêtre de comptage, en minutes. */
  fenetreMinutes: number;
  /** Durée du blocage temporaire, en minutes. */
  blocageMinutes: number;
}

export const REGLES_CONNEXION: Record<ContexteConnexion, Regles> = {
  // Un adulte oublieux n'échoue pas 5 fois de suite avec 15 min d'écart ;
  // 10 minutes de pause décourage un script sans pénaliser personne.
  enseignant: { seuil: 5, fenetreMinutes: 15, blocageMinutes: 10 },
  // Un élève se trompe facilement de code : seuil identique mais blocage court.
  eleve: { seuil: 5, fenetreMinutes: 10, blocageMinutes: 5 },
};

export type EtatBlocage =
  | { actif: false }
  | { actif: true; secondesRestantes: number };

function mode(): "off" | "ouvert" | "strict" {
  const brut = process.env.FABLIO_CONNEXION_LIMITATION?.trim().toLowerCase();
  if (brut === "off" || brut === "aucun" || brut === "desactive") return "off";
  if (process.env.FABLIO_CONNEXION_STRICT?.trim() === "1") return "strict";
  return "ouvert";
}

let avertissementDejaPose = false;
/** Cause compacte : `e.message` contient la requête entière → une seule ligne. */
function causeCompacte(e: unknown): string {
  const brut = e instanceof Error ? e.message : String(e);
  const premiere = brut.split("\n")[0] ?? brut;
  return premiere.replace(/\s+/g, " ").trim().slice(0, 180);
}

function signalerPanne(cause: string): void {
  if (avertissementDejaPose) return;
  avertissementDejaPose = true;
  console.warn(
    `[fablio:securite] ⚠ bornage anti-force-brute inactif (${cause}). ` +
      `Appliquez le schéma : npx drizzle-kit push (ou node scripts/setup-db.mjs). ` +
      `La connexion continue de fonctionner (dégradation ouverte) ; ` +
      `FABLIO_CONNEXION_STRICT=1 pour refuser les connexions tant que la table manque.`
  );
}

/** Clé de comptage : SHA-256 de l'identifiant, préfixée par le contexte. */
export function cleDeComptage(
  contexte: ContexteConnexion,
  identifiant: string
): string {
  const normalise = identifiant.trim().toLowerCase().replace(/\s+/g, " ");
  return `connexion-${contexte}:${crypto
    .createHash("sha256")
    .update(`fablio/v1|${normalise}`)
    .digest("hex")}`;
}

/**
 * Le compte (ou le couple pseudo+code) est-il actuellement bloqué ?
 * Ne lève jamais : en cas de pépin on répond « non bloqué » (fail-open),
 * sauf en mode strict.
 */
export async function etatDeBlocage(
  contexte: ContexteConnexion,
  identifiant: string
): Promise<EtatBlocage> {
  if (mode() === "off") return { actif: false };
  try {
    const lignes = await db.execute<{ reste_secondes: number }>(sql`
      SELECT greatest(0, ceiling(extract(epoch from (bloque_jusqua - now()))))::int
             AS reste_secondes
        FROM tentatives_connexion
       WHERE cle = ${cleDeComptage(contexte, identifiant)}
         AND bloque_jusqua IS NOT NULL
         AND bloque_jusqua > now()
       LIMIT 1
    `);
    const ligne = (Array.isArray(lignes) ? lignes : (lignes as { rows?: unknown[] }).rows)?.[0] as
      | { reste_secondes?: number }
      | undefined;
    const reste = Number(ligne?.reste_secondes ?? 0);
    return reste > 0 ? { actif: true, secondesRestantes: reste } : { actif: false };
  } catch (e) {
    signalerPanne(causeCompacte(e));
    return mode() === "strict"
      ? { actif: true, secondesRestantes: 60 }
      : { actif: false };
  }
}

/** Enregistre un échec de connexion ; déclenche le blocage au seuil. */
export async function enregistrerEchec(
  contexte: ContexteConnexion,
  identifiant: string
): Promise<void> {
  if (mode() === "off") return;
  const regles = REGLES_CONNEXION[contexte];
  const cle = cleDeComptage(contexte, identifiant);
  try {
    // Une seule instruction : lecture de l'état précédent + incrément +
    // décision de blocage, sans fenêtre de course entre deux instances.
    await db.execute(sql`
      INSERT INTO tentatives_connexion AS t
        (cle, echecs, premiere_fenetre_le, derniere_le, bloque_jusqua)
      VALUES
        (${cle}, 1, now(), now(), NULL)
      ON CONFLICT (cle) DO UPDATE SET
        echecs = CASE
          WHEN t.derniere_le < now() - make_interval(mins => ${regles.fenetreMinutes}::int)
            THEN 1
          ELSE t.echecs + 1
        END,
        premiere_fenetre_le = CASE
          WHEN t.derniere_le < now() - make_interval(mins => ${regles.fenetreMinutes}::int)
            THEN now()
          ELSE t.premiere_fenetre_le
        END,
        derniere_le = now(),
        bloque_jusqua = CASE
          WHEN (CASE
                  WHEN t.derniere_le < now() - make_interval(mins => ${regles.fenetreMinutes}::int)
                    THEN 1
                  ELSE t.echecs + 1
                END) >= ${regles.seuil}::int
            THEN now() + make_interval(mins => ${regles.blocageMinutes}::int)
          ELSE t.bloque_jusqua
        END
    `);
  } catch (e) {
    signalerPanne(causeCompacte(e));
  }
}

/** Connexion réussie : on oublie les échecs et on purge les traces anciennes. */
export async function effacerEchecs(
  contexte: ContexteConnexion,
  identifiant: string
): Promise<void> {
  if (mode() === "off") return;
  const cle = cleDeComptage(contexte, identifiant);
  try {
    await db.execute(sql`DELETE FROM tentatives_connexion WHERE cle = ${cle}`);
    // Nettoyage opportuniste (best-effort) : la table ne grossit pas sans fin.
    await db.execute(sql`
      DELETE FROM tentatives_connexion
       WHERE derniere_le < now() - interval '1 day'
    `);
  } catch (e) {
    signalerPanne(causeCompacte(e));
  }
}

/** Message utilisateur lisible + en-tête Retry-After pour la réponse HTTP. */
export function reponseBlocage(
  etat: Extract<EtatBlocage, { actif: true }>,
  contexte: ContexteConnexion
): { message: string; retryAfter: number } {
  const minutes = Math.max(1, Math.ceil(etat.secondesRestantes / 60));
  return {
    message:
      contexte === "enseignant"
        ? `Trop de tentatives échouées. Par sécurité, la connexion est temporairement fermée : réessayez dans ${minutes} min.`
        : `Trop de codes secrets essayés. Attends ${minutes} min avant de réessayer — ton enseignant peut te redonner ton code.`,
    retryAfter: etat.secondesRestantes,
  };
}

/** Diagnostic pour /api/health — sans aucune donnée personnelle. */
export async function etatBornage(): Promise<
  "actif" | "inactif (désactivé)" | "indisponible (table manquante ?)"
> {
  if (mode() === "off") return "inactif (désactivé)";
  try {
    await db.execute(sql`SELECT 1 FROM tentatives_connexion LIMIT 1`);
    return "actif";
  } catch {
    return "indisponible (table manquante ?)";
  }
}
