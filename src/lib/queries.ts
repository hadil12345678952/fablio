import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  codesParrainage,
  eleves,
  exercices,
  fables,
  tentatives,
  type EleveRow,
  type ExerciceRow,
  type TentativeRow,
} from "@/db/schema";
import {
  fabriquerPresentation,
  type PresentationExercice,
  type TypeExercice,
  ETIQUETTES_TYPES,
} from "@/lib/exercices";
import { etiquetteDateHeure } from "@/lib/format";

// ---------------------------------------------------------------------------
// Fables — vue enseignant
// ---------------------------------------------------------------------------

export interface FableListeEnseignant {
  id: string;
  titre: string;
  morale: string;
  imageUrl: string;
  difficulte: string;
  publie: boolean;
  nbExercices: number;
  nbExercicesPublies: number;
  nbCibles: number;
  creeLeISO: string;
}

export async function fablesDeEnseignant(
  enseignantId: string
): Promise<FableListeEnseignant[]> {
  const lignes = await db
    .select()
    .from(fables)
    .where(eq(fables.enseignantId, enseignantId))
    .orderBy(desc(fables.creeLe));
  if (lignes.length === 0) return [];
  const exos = await db
    .select()
    .from(exercices)
    .where(
      inArray(
        exercices.fableId,
        lignes.map((f) => f.id)
      )
    );
  return lignes.map((f) => {
    const deLaFable = exos.filter((e) => e.fableId === f.id);
    return {
      id: f.id,
      titre: f.titre,
      morale: f.morale,
      imageUrl: f.imageUrl,
      difficulte: f.difficulte,
      publie: f.publie,
      nbExercices: deLaFable.length,
      nbExercicesPublies: deLaFable.filter((e) => e.publie).length,
      nbCibles: (f.cibleCodeIds ?? []).length,
      creeLeISO: f.creeLe.toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Exercices — vue enseignant
// ---------------------------------------------------------------------------

export interface ExerciceEnseignant {
  id: string;
  fableId: string;
  type: TypeExercice;
  typeEtiquette: string;
  consigne: string;
  payload: ExerciceRow["payload"];
  points: number;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  ordre: number;
  publie: boolean;
  maxTentatives: number | null;
}

export function versExerciceEnseignant(e: ExerciceRow): ExerciceEnseignant {
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
}

export async function exercicesDeFable(
  fableId: string
): Promise<ExerciceEnseignant[]> {
  const lignes = await db
    .select()
    .from(exercices)
    .where(eq(exercices.fableId, fableId))
    .orderBy(asc(exercices.ordre), asc(exercices.creeLe));
  return lignes.map(versExerciceEnseignant);
}

// ---------------------------------------------------------------------------
// Fables — vue élève (filtrage par rattachement + affectation ciblée)
// ---------------------------------------------------------------------------

export interface FableEleveCarte {
  id: string;
  titre: string;
  morale: string;
  imageUrl: string;
  difficulte: string;
  nbExercices: number;
  nbReussis: number;
  terminee: boolean;
}

export async function fablesPourEleve(
  eleve: EleveRow
): Promise<FableEleveCarte[]> {
  const publiees = await db
    .select()
    .from(fables)
    .where(and(eq(fables.enseignantId, eleve.enseignantId), eq(fables.publie, true)))
    .orderBy(asc(fables.creeLe));

  const visibles = publiees.filter((f) => {
    const cibles = f.cibleCodeIds ?? [];
    return cibles.length === 0 || (eleve.codeId ? cibles.includes(eleve.codeId) : false);
  });
  if (visibles.length === 0) return [];

  const exos = await db
    .select()
    .from(exercices)
    .where(
      and(
        inArray(exercices.fableId, visibles.map((f) => f.id)),
        eq(exercices.publie, true)
      )
    );
  const essais = await db
    .select()
    .from(tentatives)
    .where(eq(tentatives.eleveId, eleve.id));

  return visibles.map((f) => {
    const deLaFable = exos.filter((e) => e.fableId === f.id);
    const reussis = new Set(
      essais
        .filter((t) => t.fableId === f.id && t.estCorrect === true)
        .map((t) => t.exerciceId)
    ).size;
    const nb = deLaFable.length;
    return {
      id: f.id,
      titre: f.titre,
      morale: f.morale,
      imageUrl: f.imageUrl,
      difficulte: f.difficulte,
      nbExercices: nb,
      nbReussis: Math.min(reussis, nb),
      terminee: nb > 0 && reussis >= nb,
    };
  });
}

// ---------------------------------------------------------------------------
// Exercices — vue élève (avec présentations mélangées + état des tentatives)
// ---------------------------------------------------------------------------

export interface ExerciceEleveVue {
  id: string;
  type: TypeExercice;
  typeEtiquette: string;
  consigne: string;
  points: number;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  payload: ExerciceRow["payload"];
  presentation: PresentationExercice;
  maxTentatives: number | null;
  tentativesUtilisees: number;
  tentativesRestantes: number | null;
  meilleurScore: number | null;
  reussi: boolean;
}

export async function exercicesPourEleve(
  fableId: string,
  eleve: EleveRow
): Promise<ExerciceEleveVue[]> {
  const lignes = await db
    .select()
    .from(exercices)
    .where(and(eq(exercices.fableId, fableId), eq(exercices.publie, true)))
    .orderBy(asc(exercices.ordre), asc(exercices.creeLe));

  const essais = await db
    .select()
    .from(tentatives)
    .where(and(eq(tentatives.eleveId, eleve.id), eq(tentatives.fableId, fableId)));

  return lignes.map((e) => {
    const type = e.type as TypeExercice;
    const de = essais.filter((t) => t.exerciceId === e.id);
    const notes = de.map((t) => t.score).filter((s): s is number => s !== null);
    const tentativesUtilisees = de.length;
    return {
      id: e.id,
      type,
      typeEtiquette: ETIQUETTES_TYPES[type] ?? e.type,
      consigne: e.consigne,
      points: e.points,
      feedbackCorrect: e.feedbackCorrect,
      feedbackIncorrect: e.feedbackIncorrect,
      payload: e.payload,
      presentation: fabriquerPresentation(type, e.payload, `${e.id}:${eleve.id}`),
      maxTentatives: e.maxTentatives,
      tentativesUtilisees,
      tentativesRestantes:
        e.maxTentatives === null
          ? null
          : Math.max(0, e.maxTentatives - tentativesUtilisees),
      meilleurScore: notes.length ? Math.max(...notes) : null,
      reussi: de.some((t) => t.estCorrect === true),
    };
  });
}

// ---------------------------------------------------------------------------
// Progression élève (page profil)
// ---------------------------------------------------------------------------

export interface TentativeHistorique {
  id: string;
  fableTitre: string;
  typeEtiquette: string;
  numero: number;
  score: number | null;
  maxScore: number;
  estCorrect: boolean | null;
  dureeSecondes: number;
  dateEtiquette: string;
}

export interface ProgressionEleve {
  pointsCumules: number;
  fablesTerminees: number;
  nbFables: number;
  totalTentatives: number;
  tempsTotalSecondes: number;
  derniereActivite: string | null;
  historique: TentativeHistorique[];
}

export async function progressionEleve(eleve: EleveRow): Promise<ProgressionEleve> {
  const cartes = await fablesPourEleve(eleve);
  const essais = await db
    .select()
    .from(tentatives)
    .where(eq(tentatives.eleveId, eleve.id))
    .orderBy(desc(tentatives.creeLe));

  const exoIds = [...new Set(essais.map((t) => t.exerciceId))];
  const exos = exoIds.length
    ? await db.select().from(exercices).where(inArray(exercices.id, exoIds))
    : [];
  const fableIds = [...new Set(essais.map((t) => t.fableId))];
  const fbs = fableIds.length
    ? await db.select().from(fables).where(inArray(fables.id, fableIds))
    : [];

  const exoParId = new Map(exos.map((e) => [e.id, e]));
  const fableParId = new Map(fbs.map((f) => [f.id, f]));

  // meilleur score par exercice ⇒ points cumulés
  const meilleurs = new Map<string, number>();
  for (const t of essais) {
    if (t.score === null) continue;
    meilleurs.set(t.exerciceId, Math.max(meilleurs.get(t.exerciceId) ?? 0, t.score));
  }
  const pointsCumules = [...meilleurs.values()].reduce((a, b) => a + b, 0);

  return {
    pointsCumules,
    fablesTerminees: cartes.filter((c) => c.terminee).length,
    nbFables: cartes.length,
    totalTentatives: essais.length,
    tempsTotalSecondes: essais.reduce((a, t) => a + t.dureeSecondes, 0),
    derniereActivite: essais[0] ? etiquetteDateHeure(essais[0].creeLe) : null,
    historique: essais.slice(0, 20).map((t) => {
      const exo = exoParId.get(t.exerciceId);
      return {
        id: t.id,
        fableTitre: fableParId.get(t.fableId)?.titre ?? "Fable",
        typeEtiquette: exo
          ? ETIQUETTES_TYPES[exo.type as TypeExercice] ?? exo.type
          : "Exercice",
        numero: t.numero,
        score: t.score,
        maxScore: t.maxScore,
        estCorrect: t.estCorrect,
        dureeSecondes: t.dureeSecondes,
        dateEtiquette: etiquetteDateHeure(t.creeLe),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Codes de parrainage
// ---------------------------------------------------------------------------

export interface CodeAvecEffectif {
  id: string;
  code: string;
  etiquette: string;
  actif: boolean;
  nbEleves: number;
  creeLeISO: string;
}

export async function codesDeEnseignant(
  enseignantId: string
): Promise<CodeAvecEffectif[]> {
  const lignes = await db
    .select()
    .from(codesParrainage)
    .where(eq(codesParrainage.enseignantId, enseignantId))
    .orderBy(asc(codesParrainage.creeLe));
  const els = await db
    .select()
    .from(eleves)
    .where(eq(eleves.enseignantId, enseignantId));
  return lignes.map((c) => ({
    id: c.id,
    code: c.code,
    etiquette: c.etiquette,
    actif: c.actif,
    nbEleves: els.filter((e) => e.codeId === c.id).length,
    creeLeISO: c.creeLe.toISOString(),
  }));
}

export { tentatives, exercices, fables, eleves, codesParrainage };
export type { TentativeRow };
