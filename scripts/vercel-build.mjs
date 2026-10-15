// ---------------------------------------------------------------------------
// Commande de build Vercel — Fablio
// ---------------------------------------------------------------------------
//
// POURQUOI CE SCRIPT (audit du 15/10/2026)
//
// La documentation de déploiement enchaînait, dans la commande de build Vercel :
//
//     npx drizzle-kit push && npm run build
//
// Or une commande de build s'exécute aussi pour **chaque déploiement de
// prévisualisation**, et Vercel partage les variables d'environnement de
// production avec les aperçus par défaut. Résultat : la moindre branche testée
// envoyait un `drizzle-kit push` — donc un DDL (créations, et dans le pire des
// cas suppressions/questions de troncature) — sur la base **de production**
// partagée. Un aperçu doit être sans effet de bord.
//
// Désormais :
//   • VERCEL_ENV=production … le schéma est poussé (comportement attendu), puis build ;
//   • preview / development … AUCUNE écriture de schéma, puis build ;
//   • forcer un push sur un aperçu : FABLIO_SCHEMA_PUSH=1 (à réserver à une base
//     d'aperçu isolée — idéalement une branche Neon, voir DEPLOIEMENT.md §« aperçus ») ;
//   • désactiver le push même en production : FABLIO_SCHEMA_PUSH=0 (migrations
//     gérées à la main).
//
// Le script ne fait JAMAIS échouer le build pour un problème de schéma en
// prévisualisation : un aperçu doit rester consultable, même sans base.
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
// Lit .env en local (sans effet sur Vercel, où les variables viennent de la
// configuration du projet) : le script prend ainsi les mêmes décisions de push
// ici et là-bas.
import "dotenv/config";

const env = process.env;
const environnement = env.VERCEL_ENV ?? "development";
const surVercel = env.VERCEL === "1";

function lancer(commande, arguments_, label) {
  console.log(`\n\x1b[1m▸ ${label}\x1b[0m`);
  const res = spawnSync(commande, arguments_, {
    stdio: "inherit",
    env,
    shell: false,
  });
  if (res.error) throw res.error;
  return res.status ?? 1;
}

// --- 1. Schéma --------------------------------------------------------------
const pousseExplicitement = env.FABLIO_SCHEMA_PUSH;
const doitPousser =
  pousseExplicitement === "1"
    ? true
    : pousseExplicitement === "0"
      ? false
      : environnement === "production";

if (!env.DATABASE_URL) {
  console.log(
    "⚠ DATABASE_URL absente : aucun push de schéma, et l'application tournera en mode dégradé " +
      "(/api/health répondra ok:false). Définissez la variable pour cet environnement dans Vercel."
  );
} else if (!doitPousser) {
  console.log(
    `ℹ Environnement « ${environnement} » : push de schéma IGNORÉ volontairement ` +
      `(aucun effet de bord sur une base partagée depuis un aperçu). ` +
      `Pour isoler vos aperçus, créez une branche Neon par aperçu et pointez-y DATABASE_URL ; ` +
      `pour forcer ici : FABLIO_SCHEMA_PUSH=1.`
  );
} else {
  const code = lancer("npx", ["--no-install", "drizzle-kit", "push"], `Schéma (${environnement})`);
  if (code !== 0) {
    if (surVercel && environnement === "production") {
      console.error(
        "✗ Le push de schéma a échoué. Cause la plus fréquente : `drizzle-kit push` pose une " +
          "question interactive (contrainte/index divergents) et n'a pas de terminal. " +
          "Rattrapage : lancer une fois « DATABASE_URL=… node scripts/setup-db.mjs » depuis un poste " +
          "avec terminal, puis relancer le déploiement."
      );
      process.exit(code);
    }
    console.warn("⚠ Push de schéma sans succès : le build continue (aperçu consultable malgré tout).");
  }
}

// --- 2. Build ---------------------------------------------------------------
const codeBuild = lancer("npx", ["--no-install", "next", "build"], "Build Next.js");
process.exit(codeBuild);
