import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blocsFable, exercices, tentatives, fables, type BlocFableRow } from "@/db/schema";
import { ETIQUETTES_TYPES, fabriquerPresentation, type TypeExercice } from "@/lib/exercices";
import type { ExerciceEleveVue, ExerciceEnseignant } from "@/lib/queries";
import type { BlocVue, TypeBloc } from "./types";

// ---------------------------------------------------------------------------
// Lecture groupée des blocs d'une fable (PAS une requête par bloc).
// ---------------------------------------------------------------------------

export function versBlocVue(b: BlocFableRow): BlocVue {
  return {
    id: b.id,
    fableId: b.fableId,
    type: b.type as TypeBloc,
    ordre: b.ordre,
    titre: b.titre ?? "",
    contenu: b.contenu ?? {},
    exerciceId: b.exerciceId ?? null,
    visible: b.visible,
    modifieLeISO: b.modifieLe.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Résilience déploiement : si la base de production n'a pas encore la table
// `blocs_fable` (migration non exécutée après le push Vercel), l'application
// ne doit PAS planter en 500 : on retourne une valeur sûre et on bascule sur
// l'affichage historique. Détecté une seule fois puis journalisé.
// ---------------------------------------------------------------------------

let avertissementSchema = false;

/**
 * Détecte l'erreur « table blocs_fable absente » en **inspecant la chaîne des
 * causes** : Drizzle ORM emballe l'erreur PostgreSQL
 * (DrizzleQueryError / « Failed query ») et l'erreur native (code SQLSTATE
 * `42P01`, « relation does not exist ») est portée par `error.cause`.
 */
export function blocsNonDisponibles(erreur: unknown): boolean {
  let courant: unknown = erreur;
  for (let i = 0; i < 4 && courant !== null && courant !== undefined; i++) {
    const e = courant as { code?: unknown; message?: unknown; cause?: unknown };
    const code = typeof e.code === "string" ? e.code : "";
    const message = typeof e.message === "string" ? e.message : String(e);
    if (
      (code === "42P01" && message.includes("blocs_fable")) ||
      (message.includes("blocs_fable") &&
        (message.includes("does not exist") ||
          message.includes("n'existe pas") ||
          message.includes("undefined table")))
    ) {
      return true;
    }
    courant = e.cause;
  }
  return false;
}

function journaliserSchemaManquant(e: unknown): void {
  if (avertissementSchema) return;
  avertissementSchema = true;
  console.warn(
    "[fablio] ⚠ La table blocs_fable n'existe pas dans la base : exécuter " +
      "« node scripts/setup-db.mjs » sur cette base (déploiement)",
    e instanceof Error ? `— ${e.message.slice(0, 220)}` : ""
  );
}

/** Blocs d'une fable, dans l'ordre — [] si la table n'existe pas (fallback historique). */
export async function blocsDeFable(fableId: string): Promise<BlocVue[]> {
  try {
    const lignes = await db
      .select()
      .from(blocsFable)
      .where(eq(blocsFable.fableId, fableId))
      .orderBy(asc(blocsFable.ordre));
    return lignes.map(versBlocVue);
  } catch (e) {
    if (blocsNonDisponibles(e)) {
      journaliserSchemaManquant(e);
      return [];
    }
    throw e;
  }
}

/**
 * Retourne les blocs ENRICHIS : chaque bloc EXERCICE embarque la vue complète
 * de son exercice (1 requête groupée pour tous les exercices de la fable).
 * Le reste des blocs est retourné tel quel.
 */
export interface BlocEnrichi extends BlocVue {
  exerciceEleve?: ExerciceEleveVue;
  exerciceEnseignant?: ExerciceEnseignant;
}

const versEnseignant = (e: typeof exercices.$inferSelect): ExerciceEnseignant => {
  const type = e.type as TypeExercice;
  return {
    id: e.id,
    fableId: e.fableId,
    type,
    typeEtiquette: ETIQUETTES_TYPES[type] ?? e.type,
    consigne: e.consigne,
    payload: e.payload,
    points: e.points,
    feedbackCorrect: e.feedbackCorrect,
    feedbackIncorrect: e.feedbackIncorrect,
    ordre: e.ordre,
    publie: e.publie,
    maxTentatives: e.maxTentatives,
  };
};

export async function blocsEnrichisPourEleve(
  fableId: string,
  eleveId: string
): Promise<BlocEnrichi[]> {
  const blocs = await blocsDeFable(fableId);
  if (blocs.length === 0) return blocs; // table absente ou parcours vide
  const exoIds = blocs
    .map((b) => b.exerciceId)
    .filter((x): x is string => x !== null);

  const exos = exoIds.length
    ? await db
        .select()
        .from(exercices)
        .where(inArray(exercices.id, exoIds))
    : [];
  const essais = await db
    .select()
    .from(tentatives)
    .where(and(eq(tentatives.eleveId, eleveId), eq(tentatives.fableId, fableId)));

  const map = new Map(exos.map((e) => [e.id, e]));

  return blocs.map((b) => {
    if (b.type !== "exercice" || !b.exerciceId) return b;
    const e = map.get(b.exerciceId);
    if (!e) return { ...b, visible: false }; // référence cassée → masqué
    const type = e.type as TypeExercice;
    const de = essais.filter((t) => t.exerciceId === e.id);
    const notes = de.map((t) => t.score).filter((s): s is number => s !== null);
    const tentativesUtilisees = de.length;
    return {
      ...b,
      exerciceEleve: {
        id: e.id,
        type,
        typeEtiquette: ETIQUETTES_TYPES[type] ?? e.type,
        consigne: e.consigne,
        points: e.points,
        feedbackCorrect: e.feedbackCorrect,
        feedbackIncorrect: e.feedbackIncorrect,
        payload: e.payload,
        presentation: fabriquerPresentation(type, e.payload, `${e.id}:${eleveId}`),
        maxTentatives: e.maxTentatives,
        tentativesUtilisees,
        tentativesRestantes:
          e.maxTentatives === null
            ? null
            : Math.max(0, e.maxTentatives - tentativesUtilisees),
        meilleurScore: notes.length ? Math.max(...notes) : null,
        reussi: de.some((t) => t.estCorrect === true),
      },
      exercices_publie: undefined,
    } as BlocEnrichi;
  });
}

export async function blocsEnrichisPourEnseignant(
  fableId: string
): Promise<BlocEnrichi[]> {
  const blocs = await blocsDeFable(fableId);
  const exoIds = blocs
    .map((b) => b.exerciceId)
    .filter((x): x is string => x !== null);

  const exos = exoIds.length
    ? await db.select().from(exercices).where(inArray(exercices.id, exoIds))
    : [];
  const map = new Map(exos.map((e) => [e.id, e]));

  return blocs.map((b) => {
    if (b.type !== "exercice" || !b.exerciceId) return b;
    const e = map.get(b.exerciceId);
    if (!e) return b;
    return { ...b, exerciceEnseignant: versEnseignant(e) };
  });
}

/** Nombre de blocs d'une fable (pour détecter le basculement vers le nouveau rendu). */
export async function nombreBlocs(fableId: string): Promise<number> {
  try {
    const lignes = await db
      .select({ id: blocsFable.id })
      .from(blocsFable)
      .where(eq(blocsFable.fableId, fableId));
    return lignes.length;
  } catch (e) {
    if (blocsNonDisponibles(e)) {
      journaliserSchemaManquant(e);
      return 0; // conduit au rendu historique (fallback existant)
    }
    throw e;
  }
}

/** Fable si publiée et accessible à l'élève (contrôle d'accès existant conservé). */
export async function fablePourEleve(fableId: string, eleveEnseignantId: string, eleveCodeId: string | null) {
  const [fable] = await db
    .select()
    .from(fables)
    .where(and(eq(fables.id, fableId), eq(fables.enseignantId, eleveEnseignantId), eq(fables.publie, true)))
    .limit(1);
  if (!fable) return null;
  const cibles = fable.cibleCodeIds ?? [];
  const visible = cibles.length === 0 || (eleveCodeId ? cibles.includes(eleveCodeId) : false);
  return visible ? fable : null;
}
