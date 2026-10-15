// ---------------------------------------------------------------------------
// Provisionne COMPLÈTEMENT la base Fablio (idempotent — peut être relancé).
//
//   node scripts/setup-db.mjs
//   DATABASE_URL="postgresql://…neon.tech/…?sslmode=require" node scripts/setup-db.mjs
//
// - Crée TOUTES les tables attendues par le code (visions cible : fables,
//   exercices, tentatives, … + blocs_fable) avec leurs contraintes et index.
// - Idempotent : CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
//   ALTER TABLE ADD COLUMN IF NOT EXISTS.
// - N'efface aucune donnée existante.
// - Option --supprimer-moodle : retire les tables/colonne Moodle résiduelles
//   (exportez-les d'abord si vous devez les conserver).
// ---------------------------------------------------------------------------

import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const SUPPRIME_MOODLE = process.argv.includes("--supprimer-moodle");

const SQL = `
BEGIN;

-- ---------- Cœur de la plateforme ------------------------------------------
CREATE TABLE IF NOT EXISTS enseignants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  email text NOT NULL CONSTRAINT enseignants_email_unique UNIQUE,
  mot_de_passe_hash text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS codes_parrainage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enseignant_id uuid NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  code text NOT NULL CONSTRAINT codes_parrainage_code_unique UNIQUE,
  etiquette text NOT NULL DEFAULT '',
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eleves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enseignant_id uuid NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  code_id uuid REFERENCES codes_parrainage(id) ON DELETE SET NULL,
  pseudo text NOT NULL,
  pin_hash text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enseignant_id uuid NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  titre text NOT NULL,
  texte text NOT NULL,
  morale text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  audio_url text NOT NULL DEFAULT '',
  video_url text NOT NULL DEFAULT '',
  difficulte text NOT NULL DEFAULT 'facile',
  publie boolean NOT NULL DEFAULT false,
  cible_code_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fable_id uuid NOT NULL REFERENCES fables(id) ON DELETE CASCADE,
  type text NOT NULL,
  consigne text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  points integer NOT NULL DEFAULT 10,
  feedback_correct text NOT NULL DEFAULT '',
  feedback_incorrect text NOT NULL DEFAULT '',
  ordre integer NOT NULL DEFAULT 0,
  publie boolean NOT NULL DEFAULT true,
  max_tentatives integer,
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tentatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  exercice_id uuid NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  fable_id uuid NOT NULL REFERENCES fables(id) ON DELETE CASCADE,
  reponse jsonb,
  score double precision,
  max_score double precision NOT NULL,
  est_correct boolean,
  numero integer NOT NULL DEFAULT 1,
  duree_secondes integer NOT NULL DEFAULT 0,
  corrige_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  type_utilisateur text NOT NULL,
  enseignant_id uuid REFERENCES enseignants(id) ON DELETE CASCADE,
  eleve_id uuid REFERENCES eleves(id) ON DELETE CASCADE,
  expire_le timestamptz NOT NULL
);

-- ---------- Moteur pédagogique interne (parcours par blocs) ----------------
CREATE TABLE IF NOT EXISTS blocs_fable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fable_id uuid NOT NULL REFERENCES fables(id) ON DELETE CASCADE,
  type text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  titre text NOT NULL DEFAULT '',
  contenu jsonb NOT NULL DEFAULT '{}'::jsonb,
  exercice_id uuid REFERENCES exercices(id) ON DELETE CASCADE,
  visible boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

-- ---------- Bornage anti-force-brute de la connexion (audit 2026-10) -------
-- Compteur d'échecs en base : en serverless, la mémoire par instance ne suffit
-- pas. La clé est un SHA-256 de l'identifiant saisi (aucun email, aucun pseudo).
CREATE TABLE IF NOT EXISTS tentatives_connexion (
  cle text PRIMARY KEY,
  echecs integer NOT NULL DEFAULT 0,
  premiere_fenetre_le timestamptz NOT NULL DEFAULT now(),
  derniere_le timestamptz NOT NULL DEFAULT now(),
  bloque_jusqua timestamptz
);

-- ---------- Récupération de mot de passe enseignant ------------------------
CREATE TABLE IF NOT EXISTS jetons_reinitialisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enseignant_id uuid NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  jeton_hash text NOT NULL,
  expire_le timestamptz NOT NULL,
  utilise_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now()
);

-- ---------- Index ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_connexion_bloque_jusqua ON tentatives_connexion(bloque_jusqua);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jeton_hash ON jetons_reinitialisation(jeton_hash);
CREATE INDEX IF NOT EXISTS idx_jeton_enseignant ON jetons_reinitialisation(enseignant_id);
CREATE INDEX IF NOT EXISTS idx_codes_enseignant ON codes_parrainage(enseignant_id);
CREATE INDEX IF NOT EXISTS idx_eleves_enseignant ON eleves(enseignant_id);
CREATE INDEX IF NOT EXISTS idx_fables_enseignant ON fables(enseignant_id);
CREATE INDEX IF NOT EXISTS idx_exercices_fable ON exercices(fable_id);
CREATE INDEX IF NOT EXISTS idx_tentatives_eleve ON tentatives(eleve_id);
CREATE INDEX IF NOT EXISTS idx_tentatives_exercice ON tentatives(exercice_id);
CREATE INDEX IF NOT EXISTS idx_tentatives_fable ON tentatives(fable_id);
CREATE INDEX IF NOT EXISTS idx_blocs_fable_ordre ON blocs_fable(fable_id, ordre);
CREATE INDEX IF NOT EXISTS idx_blocs_exercice ON blocs_fable(exercice_id);
-- Les clés étrangères ne sont pas indexées automatiquement par PostgreSQL :
-- ces index servent à la révocation des sessions et à la purge des expirées.
CREATE INDEX IF NOT EXISTS idx_sessions_enseignant ON sessions(enseignant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_eleve ON sessions(eleve_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire_le);

-- ---------- Contraintes d'unicité manquantes sur bases déjà créées ---------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_eleves_pseudo_enseignant') THEN
    CREATE UNIQUE INDEX uq_eleves_pseudo_enseignant ON eleves(enseignant_id, pseudo);
  END IF;
END $$;

-- ---------- Noms de contraintes alignés sur Drizzle (drizzle-kit push) ------
-- PostgreSQL nomme « <table>_<colonne>_key » les contraintes UNIQUE déclarées
-- en ligne, alors que Drizzle attend « <table>_<colonne>_unique ». Sans cette
-- mise en cohérence, drizzle-kit push (utilisé par la configuration Vercel)
-- tente d'ajouter une SECONDE contrainte unique identique — et pose une question
-- interactive (truncate ?) qui fait ÉCHOUER le build en CI (pas de TTY).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enseignants_email_key') THEN
    ALTER TABLE enseignants RENAME CONSTRAINT enseignants_email_key TO enseignants_email_unique;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'codes_parrainage_code_key') THEN
    ALTER TABLE codes_parrainage RENAME CONSTRAINT codes_parrainage_code_key TO codes_parrainage_code_unique;
  END IF;
END $$;

COMMIT;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL manquante (fichier .env ou variable d'environnement).");
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl: /sslmode=require|neon\.tech/i.test(url)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();

  console.log("→ Provisionnement du schéma Fablio (idempotent)…");
  await client.query(SQL);

  if (SUPPRIME_MOODLE) {
    console.log("→ Retrait des tables/colonne Moodle résiduelles…");
    await client.query(`
      BEGIN;
      DROP TABLE IF EXISTS liens_moodle_utilisateurs;
      DROP TABLE IF EXISTS liens_moodle_cours;
      DROP TABLE IF EXISTS journal_moodle;
      ALTER TABLE exercices DROP COLUMN IF EXISTS moodle_quiz_id;
      COMMIT;
    `);
  }

  const tables = (
    await client.query(
      `SELECT string_agg(table_name,', ' ORDER BY table_name)
       FROM information_schema.tables WHERE table_schema='public'`
    )
  ).rows[0].string_agg;
  console.log("✓ Schéma prêt.");
  console.log(`  Tables : ${tables}`);

  const nbBlocs = await client.query(
    `SELECT count(*)::int n FROM blocs_fable`
  );
  console.log(
    `  blocs_fable : ${nbBlocs.rows[0].n} bloc(s) — s'il y en a 0 alors que des fables existent, ` +
      `exécutez aussi : node scripts/migrer-blocs.mjs --execute`
  );

  await client.end();
}

main().catch((e) => {
  console.error("Échec du provisionnement :", e.message);
  process.exit(1);
});
