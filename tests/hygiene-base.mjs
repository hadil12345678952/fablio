// ---------------------------------------------------------------------------
// HYGIÈNE DE BASE POUR LA SUITE E2E (fichier ajouté par l'audit 2026-10)
// ---------------------------------------------------------------------------
// La suite E2E parle à l'application en HTTP uniquement — c'est voulu. Mais deux
// choses exigent d'écrire en base, sinon les tests deviennent FAUSSEMENT
// instables d'une exécution à l'autre :
//
//   1. le bornage anti-force-brute (audit 2026-10) compte les échecs PAR
//      IDENTIFIANT pendant 10 à 15 minutes ; les sondes négatives de la suite
//      utilisent des identités stables de la démo (`lina`, `CODE-BIDON`…), donc
//      au bout de quelques exécutions en moins d'un quart d'heure, une sonde
//      reçoit 429 au lieu du 401 attendu. Constaté réellement : « code de
//      classe inconnu → 401 — reçu 429 ».
//   2. la suite crée des comptes-jetons (enseignants `*.@fablio.test`, élèves
//      `max…`, `pb…`) qu'aucune route ne permet de supprimer, et le script
//      `scripts/reinitialiser-demo.mjs` refuse légitimement d'agir quand il
//      trouve des enseignants hors périmètre.
//
// Ce module fait donc, AVANT et APRÈS la campagne de tests :
//   • vidage de `tentatives_connexion` (remise à zéro du bornage) ;
//   • suppression des comptes portant le SUFFIXE de la campagne en cours.
//
// Il est CONCESSIONNEL : si `DATABASE_URL` est absente ou la base injoignable
// (par exemple quand on exécute la suite contre un déploiement de prévisualisation
// Vercel, sans accès à sa base), il n'échoue pas — il prévient et la suite
// continue, simplement non rejouable à chaud.
// ---------------------------------------------------------------------------

import "dotenv/config"; // la suite se lance par `node tests/…` : .env n'est pas chargé par Node

export async function ouvrirBaseDeTest({ silencieux = false } = {}) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (!silencieux) {
      console.log(
        "ℹ Hygiène de base ignorée (DATABASE_URL absente) : la suite reste valide, " +
          "mais ne rejouez pas plus de 4 fois en 15 min contre le même environnement — " +
          "le bornage anti-force-brute finirait par répondre 429 aux sondes négatives."
      );
    }
    return null;
  }
  try {
    // Le pilote `pg` est UNE DÉPENDANCE DU PROJET : aucune dépendance nouvelle.
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: url });
    await client.connect();
    return client;
  } catch (e) {
    if (!silencieux) {
      console.log(
        `ℹ Hygiène de base indisponible (${(e?.message ?? String(e)).split("\n")[0].slice(0, 90)}) : ` +
          `la suite continue en mode HTTP seul.`
      );
    }
    return null;
  }
}

/** Remise à zéro du bornage : rend les sondes négatives reproductibles. */
export async function reinitialiserBornage(client) {
  if (!client) return false;
  try {
    await client.query("DELETE FROM tentatives_connexion");
    return true;
  } catch {
    return false; // table absente (environnement sans le correctif) : sans gravité
  }
}

/** Suppression des comptes-jetons créés par CETTE campagne de tests. */
export async function supprimerComptesJeton(client, suffixe) {
  if (!client) return { enseignants: 0, eleves: 0 };
  const resultat = { enseignants: 0, eleves: 0 };
  try {
    const profs = await client.query(
      `DELETE FROM enseignants WHERE email LIKE $1 RETURNING id`,
      [`%${suffixe}@fablio.test`]
    );
    resultat.enseignants = profs.rowCount ?? 0;
    const eleves = await client.query(
      `DELETE FROM eleves WHERE pseudo ~ $1 RETURNING id`,
      [`^(max|pb|e|ok)${suffixe}$`]
    );
    resultat.eleves = eleves.rowCount ?? 0;
  } catch {
    /* jamais bloquant : le nettoyage est un bonus */
  }
  return resultat;
}

export async function fermerBaseDeTest(client) {
  if (!client) return;
  try {
    await client.end();
  } catch {
    /* ignorer */
  }
}
