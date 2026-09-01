import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { PayloadExercice } from "@/lib/exercices";

// ---------------------------------------------------------------------------
// Enseignants : compte principal (email + mot de passe haché)
// ---------------------------------------------------------------------------
export const enseignants = pgTable("enseignants", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: text("nom").notNull(),
  email: text("email").notNull().unique(),
  motDePasseHash: text("mot_de_passe_hash").notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Codes de parrainage : générés par l'enseignant, un par classe/groupe
// ---------------------------------------------------------------------------
export const codesParrainage = pgTable(
  "codes_parrainage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enseignantId: uuid("enseignant_id")
      .notNull()
      .references(() => enseignants.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    etiquette: text("etiquette").notNull().default(""),
    actif: boolean("actif").notNull().default(true),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_codes_enseignant").on(t.enseignantId)]
);

// ---------------------------------------------------------------------------
// Élèves : rattachés à un enseignant via le code de parrainage (pseudo + PIN)
// ---------------------------------------------------------------------------
export const eleves = pgTable(
  "eleves",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enseignantId: uuid("enseignant_id")
      .notNull()
      .references(() => enseignants.id, { onDelete: "cascade" }),
    codeId: uuid("code_id").references(() => codesParrainage.id, {
      onDelete: "set null",
    }),
    pseudo: text("pseudo").notNull(),
    pinHash: text("pin_hash").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_eleves_pseudo_enseignant").on(t.enseignantId, t.pseudo),
    index("idx_eleves_enseignant").on(t.enseignantId),
  ]
);

// ---------------------------------------------------------------------------
// Fables créées par l'enseignant
// ---------------------------------------------------------------------------
export const fables = pgTable(
  "fables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enseignantId: uuid("enseignant_id")
      .notNull()
      .references(() => enseignants.id, { onDelete: "cascade" }),
    titre: text("titre").notNull(),
    texte: text("texte").notNull(),
    morale: text("morale").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    audioUrl: text("audio_url").notNull().default(""),
    videoUrl: text("video_url").notNull().default(""),
    difficulte: text("difficulte").notNull().default("facile"), // facile | moyen | difficile
    publie: boolean("publie").notNull().default(false),
    // tableau d'ids de codes de parrainage : vide = visible par tous les élèves
    cibleCodeIds: jsonb("cible_code_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    modifieLe: timestamp("modifie_le", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_fables_enseignant").on(t.enseignantId)]
);

// ---------------------------------------------------------------------------
// Exercices rattachés à une fable (payload JSON selon le type)
// ---------------------------------------------------------------------------
export const exercices = pgTable(
  "exercices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fableId: uuid("fable_id")
      .notNull()
      .references(() => fables.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // qcm | vrai_faux | texte_trous | ordre | association | question_ouverte
    consigne: text("consigne").notNull().default(""),
    payload: jsonb("payload").$type<PayloadExercice>().notNull(),
    points: integer("points").notNull().default(10),
    feedbackCorrect: text("feedback_correct").notNull().default(""),
    feedbackIncorrect: text("feedback_incorrect").notNull().default(""),
    ordre: integer("ordre").notNull().default(0),
    publie: boolean("publie").notNull().default(true),
    maxTentatives: integer("max_tentatives"), // null = illimité
    // Lien facultatif vers un quiz Moodle créé dans Moodle (source de vérité).
    moodleQuizId: integer("moodle_quiz_id"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_exercices_fable").on(t.fableId)]
);

// ---------------------------------------------------------------------------
// Tentatives / réponses des élèves (source des statistiques)
// ---------------------------------------------------------------------------
export const tentatives = pgTable(
  "tentatives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eleveId: uuid("eleve_id")
      .notNull()
      .references(() => eleves.id, { onDelete: "cascade" }),
    exerciceId: uuid("exercice_id")
      .notNull()
      .references(() => exercices.id, { onDelete: "cascade" }),
    fableId: uuid("fable_id")
      .notNull()
      .references(() => fables.id, { onDelete: "cascade" }),
    reponse: jsonb("reponse").$type<unknown>(),
    score: doublePrecision("score"), // null = en attente de correction manuelle
    maxScore: doublePrecision("max_score").notNull(),
    estCorrect: boolean("est_correct"), // null = en attente
    numero: integer("numero").notNull().default(1),
    dureeSecondes: integer("duree_secondes").notNull().default(0),
    corrigeLe: timestamp("corrige_le", { withTimezone: true }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_tentatives_eleve").on(t.eleveId),
    index("idx_tentatives_exercice").on(t.exerciceId),
    index("idx_tentatives_fable").on(t.fableId),
  ]
);

// ---------------------------------------------------------------------------
// Intégration Moodle — liaisons uniquement, AUCUNE donnée pédagogique dupliquée
// (Moodle reste la source de vérité : cours, comptes, tentatives, notes).
// Ces tables sont additives : l'application fonctionne sans elles.
// ---------------------------------------------------------------------------

// Correspondance comptes plateforme ↔ comptes Moodle (un seul compte Moodle
// par utilisateur plateforme : synchronisation idempotente garantie ici).
export const liensMoodleUtilisateurs = pgTable(
  "liens_moodle_utilisateurs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    typeUtilisateur: text("type_utilisateur").notNull(), // enseignant | eleve
    utilisateurId: uuid("utilisateur_id").notNull(), // id plateforme
    moodleUserId: integer("moodle_user_id").notNull(),
    identifiantMoodle: text("identifiant_moodle").notNull().default(""),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_liens_moodle_u_plateforme").on(t.typeUtilisateur, t.utilisateurId),
    uniqueIndex("uq_liens_moodle_u_moodle").on(t.moodleUserId),
  ]
);

// Classe plateforme (code de parrainage) ↔ cours Moodle
export const liensMoodleCours = pgTable(
  "liens_moodle_cours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => codesParrainage.id, { onDelete: "cascade" }),
    moodleCourseId: integer("moodle_course_id").notNull(),
    titreCours: text("titre_cours").notNull().default(""),
    identifiantCours: text("identifiant_cours").notNull().default(""),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_liens_moodle_c_code").on(t.codeId),
    uniqueIndex("uq_liens_moodle_c_moodle").on(t.moodleCourseId),
  ]
);

// Journal des opérations de synchronisation (200 dernières retenues).
export const journalMoodle = pgTable("journal_moodle", {
  id: uuid("id").defaultRandom().primaryKey(),
  operation: text("operation").notNull(), // tester | utilisateurs | cours | quiz
  statut: text("statut").notNull(), // ok | erreur | info
  message: text("message").notNull(),
  details: text("details").notNull().default(""),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Sessions (cookie httpOnly)
// ---------------------------------------------------------------------------
export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  typeUtilisateur: text("type_utilisateur").notNull(), // enseignant | eleve
  enseignantId: uuid("enseignant_id").references(() => enseignants.id, {
    onDelete: "cascade",
  }),
  eleveId: uuid("eleve_id").references(() => eleves.id, {
    onDelete: "cascade",
  }),
  expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
});

// Types pratiques
export type EnseignantRow = typeof enseignants.$inferSelect;
export type EleveRow = typeof eleves.$inferSelect;
export type CodeRow = typeof codesParrainage.$inferSelect;
export type FableRow = typeof fables.$inferSelect;
export type ExerciceRow = typeof exercices.$inferSelect;
export type TentativeRow = typeof tentatives.$inferSelect;
