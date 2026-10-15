// ---------------------------------------------------------------------------
// Remet la base de DÉMONSTRATION locale dans son état d'origine (celui du seed).
//
//   node scripts/reinitialiser-demo.mjs              → simulation (aucune écriture)
//   node scripts/reinitialiser-demo.mjs --confirmer  → applique les changements
//
// Ce que fait le script, dans une seule transaction :
//   1. supprime les comptes de test créés par la suite E2E
//      (enseignants « prof.<suffixe>@fablio.test » et leurs élèves) ;
//   2. supprime les élèves de test « max<suffixe> » rattachés à l'enseignant de
//      démonstration (créés par tests/e2e-fablio.mjs, section 7) ;
//   3. supprime les tentatives ajoutées par les tests (toute tentative dont le
//      triplet (élève, exercice, numéro) n'est pas celui du seed) ;
//   4. supprime toutes les sessions (les cookies de test deviennent invalides) ;
//   5. réinstalle le mot de passe de démonstration « demo1234 » (bcrypt, coût 10,
//      comme src/lib/auth.ts) — aucune autre valeur n'est écrite.
//
// Garde-fous : le script refuse de s'exécuter si l'enseignant de démonstration est
// absent ou si la base contient un enseignant qui n'est ni la démonstration ni un
// compte de test « prof.*@fablio.test ». Il n'écrit jamais un secret dans la sortie.
// ---------------------------------------------------------------------------

import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;

const DEMO = {
  id: "11111111-1111-4000-8000-111111111111",
  email: "demo.enseignant@fablio.tn",
  motDePasse: "demo1234",
  eleves: [
    "55555555-5555-4000-8000-555555555551", // lina
    "55555555-5555-4000-8000-555555555552", // samy
    "55555555-5555-4000-8000-555555555553", // nour
  ],
};

// Triplets (élève, exercice, numéro) insérés par scripts/seed.mjs — à tenir à jour
// avec lui : toute autre tentative sur un élève de démonstration vient d'un test.
const TENTATIVES_DU_SEED = [
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444441", 1],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444441", 2],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444442", 1],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444443", 1],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444443", 2],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444444", 1],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444444", 2],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444445", 1],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444446", 1],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444447", 1],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444448", 1],
  ["55555555-5555-4000-8000-555555555551", "44444444-4444-4000-8000-444444444449", 1],
  ["55555555-5555-4000-8000-555555555552", "44444444-4444-4000-8000-444444444441", 1],
  ["55555555-5555-4000-8000-555555555552", "44444444-4444-4000-8000-444444444442", 1],
  ["55555555-5555-4000-8000-555555555552", "44444444-4444-4000-8000-444444444443", 1],
  ["55555555-5555-4000-8000-555555555552", "44444444-4444-4000-8000-444444444444", 1],
  ["55555555-5555-4000-8000-555555555552", "44444444-4444-4000-8000-444444444445", 1],
  ["55555555-5555-4000-8000-555555555552", "44444444-4444-4000-8000-444444444446", 1],
  ["55555555-5555-4000-8000-555555555552", "44444444-4444-4000-8000-444444444446", 2],
  ["55555555-5555-4000-8000-555555555552", "44444444-4444-4000-8000-444444444448", 1],
  ["55555555-5555-4000-8000-555555555553", "44444444-4444-4000-8000-444444444441", 1],
  ["55555555-5555-4000-8000-555555555553", "44444444-4444-4000-8000-444444444443", 1],
  ["55555555-5555-4000-8000-555555555553", "44444444-4444-4000-8000-444444444447", 1],
];

const confirmer = process.argv.includes("--confirmer");
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL est requise (voir .env.example).");
  process.exit(1);
}

const valeursSeed = TENTATIVES_DU_SEED.map(
  ([eleve, exercice, numero]) => `('${eleve}'::uuid, '${exercice}'::uuid, ${numero})`
).join(",\n    ");

const CTE_SEED = `with seed(eleve_id, exercice_id, numero) as (values
    ${valeursSeed}
  )`;

const SUPPRIMER_TENTATIVES_DE_TEST = `${CTE_SEED}
  delete from tentatives t using eleves el
  where el.id = t.eleve_id
    and el.id = any($1::uuid[])
    and not exists (
      select 1 from seed s
      where s.eleve_id = t.eleve_id and s.exercice_id = t.exercice_id and s.numero = t.numero
    )`;

const client = new Client({ connectionString: url });
await client.connect();

try {
  const demo = await client.query(`select id, email from enseignants where id = $1 and email = $2`, [
    DEMO.id,
    DEMO.email,
  ]);
  if (demo.rowCount === 0) {
    console.error(
      `Arrêt : l'enseignant de démonstration (${DEMO.email}) est introuvable — cette base n'est pas la base de démonstration attendue.`
    );
    process.exit(1);
  }

  const etrangers = await client.query(
    `select email from enseignants where id <> $1 and email not like 'prof.%@fablio.test'`,
    [DEMO.id]
  );
  if (etrangers.rowCount > 0) {
    console.error(
      `Arrêt : ${etrangers.rowCount} enseignant(s) hors périmètre détecté(s) — le script ne touche qu'aux bases de démonstration et de test.`
    );
    process.exit(1);
  }

  const compteurs = async () =>
    (
      await client.query(`select
        (select count(*) from enseignants)::int as enseignants,
        (select count(*) from eleves)::int as eleves,
        (select count(*) from tentatives)::int as tentatives,
        (select count(*) from sessions)::int as sessions,
        (select count(*) from fables)::int as fables,
        (select count(*) from exercices)::int as exercices,
        (select count(*) from blocs_fable)::int as blocs`)
    ).rows[0];

  const avant = await compteurs();
  console.log("État actuel :", avant);

  await client.query("begin");
  const suppElevesTest = await client.query(
    `delete from eleves
      where enseignant_id = $1 and pseudo ~ '^max[a-z0-9]{8}$'`,
    [DEMO.id]
  );
  const suppTentatives = await client.query(SUPPRIMER_TENTATIVES_DE_TEST, [DEMO.eleves]);
  const suppSessions = await client.query(`delete from sessions`);
  const suppComptesTest = await client.query(
    `delete from enseignants where email like 'prof.%@fablio.test'`
  );
  const hash = await bcrypt.hash(DEMO.motDePasse, 10);
  const majMdp = await client.query(`update enseignants set mot_de_passe_hash = $1 where id = $2`, [
    hash,
    DEMO.id,
  ]);

  console.log("À appliquer :", {
    "élèves de test supprimés": suppElevesTest.rowCount,
    "tentatives de test supprimées": suppTentatives.rowCount,
    "sessions supprimées": suppSessions.rowCount,
    "comptes de test supprimés (cascade)": suppComptesTest.rowCount,
    "mot de passe de démonstration rétabli": majMdp.rowCount === 1,
  });

  if (confirmer) {
    await client.query("commit");
    console.log("État final :", await compteurs());
    console.log("Base de démonstration réinitialisée.");
  } else {
    await client.query("rollback");
    console.log("Simulation seulement — relancez avec --confirmer pour appliquer.");
  }
} finally {
  await client.end();
}
