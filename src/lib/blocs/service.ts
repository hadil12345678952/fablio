import "server-only";
import { and, eq, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blocsFable, exercices, fables, type BlocFableRow, type ExerciceRow } from "@/db/schema";
import { sql } from "drizzle-orm";
import { validerContenuBloc } from "./validation";
import { contenuParDefaut } from "./registre";
import type { TypeBloc, ContenuBloc } from "./types";

// ---------------------------------------------------------------------------
// Service métier des blocs : toutes les opérations garantissent l'invariant
// « ordres contigus 0..n-1 » via transaction et verrouillage FOR UPDATE.
// ---------------------------------------------------------------------------

/** Vérifie la propriété : l'enseignant possède la fable du bloc. */
export async function fablePossedee(fableId: string, enseignantId: string) {
  const [fable] = await db
    .select()
    .from(fables)
    .where(and(eq(fables.id, fableId), eq(fables.enseignantId, enseignantId)))
    .limit(1);
  return fable ?? null;
}

export async function blocPossede(blocId: string, enseignantId: string) {
  const lignes = await db
    .select({ bloc: blocsFable, fable: fables })
    .from(blocsFable)
    .innerJoin(fables, eq(fables.id, blocsFable.fableId))
    .where(and(eq(blocsFable.id, blocId), eq(fables.enseignantId, enseignantId)))
    .limit(1);
  return lignes[0] ?? null;
}

type TxDrizzle = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Réécrit les ordres de la fable de façon contiguë 0..n-1 (dans une transaction). */
async function normaliserOrdres(tx: TxDrizzle, fableId: string): Promise<void> {
  // On force un jeu de valeurs temporaires négatives puis les ordres cibles,
  // pour éviter toute collision pendant le réordonnancement multi-lignes.
  await tx.execute(sql`
    UPDATE blocs_fable SET ordre = -ordre - 1 WHERE fable_id = ${fableId}
  `);
  await tx.execute(sql`
    UPDATE blocs_fable b
    SET ordre = sub.n - 1
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY ordre, cree_le) AS n
      FROM blocs_fable WHERE fable_id = ${fableId}
    ) sub
    WHERE b.id = sub.id AND b.fable_id = ${fableId}
  `);
}

/** Charge et verrouille les blocs d'une fable pour modification. */
async function blocsVerrouilles(fableId: string) {
  return db.transaction(async (tx) => {
    const lignes = await tx
      .select()
      .from(blocsFable)
      .where(eq(blocsFable.fableId, fableId))
      .orderBy(asc(blocsFable.ordre))
      .for("update");
    return { tx, lignes };
  });
}

// ----- CRUD -------------------------------------------------------------------

export async function creerBloc(
  fableId: string,
  enseignantId: string,
  params: {
    type: TypeBloc;
    titre?: string;
    contenu?: ContenuBloc;
    exerciceId?: string | null;
    position?: number | null;
  }
): Promise<{ bloc?: BlocFableRow; erreur?: string }> {
  const fable = await fablePossedee(fableId, enseignantId);
  if (!fable) return { erreur: "Fable introuvable." };

  const type = params.type;
  const contenu = params.contenu ?? contenuParDefaut(type);
  const erreur = validerContenuBloc(type, contenu);
  if (erreur) return { erreur };

  // Bloc exercice : on exige une référence valide appartenant à cette fable.
  let exerciceId: string | null = null;
  if (type === "exercice") {
    if (!params.exerciceId) return { erreur: "Sélectionnez un exercice pour ce bloc." };
    const [exo] = await db
      .select()
      .from(exercices)
      .where(and(eq(exercices.id, params.exerciceId), eq(exercices.fableId, fableId)))
      .limit(1);
    if (!exo) return { erreur: "Exercice introuvable ou n'appartenant pas à cette fable." };
    exerciceId = exo.id;
  }

  return db.transaction(async (tx) => {
    const lignes = await tx
      .select()
      .from(blocsFable)
      .where(eq(blocsFable.fableId, fableId))
      .orderBy(asc(blocsFable.ordre))
      .for("update");

    const n = lignes.length;
    const doInsertAt =
      params.position !== null &&
      params.position !== undefined &&
      params.position >= 0 &&
      params.position < n;

    if (doInsertAt) {
      // Décale les blocs existants à partir de la position d'insertion,
      // AVANT d'insérer, en déplaçant d'abord vers le négatif pour éviter les collisions.
      for (const l of lignes) {
        if (l.ordre >= params.position!) {
          await tx
            .update(blocsFable)
            .set({ ordre: -(l.ordre + 2) })
            .where(and(eq(blocsFable.id, l.id), eq(blocsFable.fableId, fableId)));
        }
      }
      for (const l of lignes) {
        if (l.ordre >= params.position!) {
          await tx
            .update(blocsFable)
            .set({ ordre: l.ordre + 1 })
            .where(and(eq(blocsFable.id, l.id), eq(blocsFable.fableId, fableId)));
        }
      }
    }

    const ordre = doInsertAt ? params.position! : n;

    const [bloc] = await tx
      .insert(blocsFable)
      .values({
        fableId,
        type,
        ordre,
        titre: (params.titre ?? "").slice(0, 200),
        contenu: contenu as Record<string, unknown>,
        exerciceId,
        visible: true,
      })
      .returning();

    await normaliserOrdres(tx, fableId);

    // Retourne le bloc avec son nouvel ordre normalisé
    const [blocFinal] = await tx
      .select()
      .from(blocsFable)
      .where(eq(blocsFable.id, bloc.id))
      .limit(1);
    return { bloc: blocFinal };
  });
}

export async function modifierBloc(
  blocId: string,
  enseignantId: string,
  params: {
    titre?: string;
    contenu?: ContenuBloc;
    visible?: boolean;
  }
): Promise<{ bloc?: BlocFableRow; erreur?: string }> {
  const poss = await blocPossede(blocId, enseignantId);
  if (!poss) return { erreur: "Bloc introuvable." };
  const type = poss.bloc.type as TypeBloc;

  const contenu = params.contenu ?? poss.bloc.contenu;
  const erreur = validerContenuBloc(type, contenu);
  if (erreur) return { erreur };

  const [bloc] = await db
    .update(blocsFable)
    .set({
      ...(params.titre !== undefined ? { titre: params.titre.slice(0, 200) } : {}),
      contenu: contenu as Record<string, unknown>,
      ...(params.visible !== undefined ? { visible: params.visible } : {}),
    })
    .where(eq(blocsFable.id, blocId))
    .returning();
  return { bloc };
}

/**
 * Supprime le bloc — UNIQUEMENT le bloc. L'exercice référencé et ses tentatives
 * sont conservés intacts (test dédié obligatoire).
 */
export async function supprimerBloc(
  blocId: string,
  enseignantId: string
): Promise<{ supprime?: boolean; erreur?: string }> {
  const poss = await blocPossede(blocId, enseignantId);
  if (!poss) return { erreur: "Bloc introuvable." };

  await db.transaction(async (tx) => {
    await tx.delete(blocsFable).where(eq(blocsFable.id, blocId));
    await normaliserOrdres(tx, poss.fable.id);
  });
  return { supprime: true };
}

/** Duplique un bloc (copie indépendante : JSON cloné, Nouvel identifiant). */
export async function dupliquerBloc(
  blocId: string,
  enseignantId: string
): Promise<{ bloc?: BlocFableRow; erreur?: string }> {
  const poss = await blocPossede(blocId, enseignantId);
  if (!poss) return { erreur: "Bloc introuvable." };
  const source = poss.bloc;

  // Copie indépendante : le contenu JSON est cloné. Pour un bloc exercice, on
  // conserve LA MÊME RÉFÉRENCE (l'exercice d'origine est réutilisé, pas cloné :
  // l'architecture le permet et évite de créer involontairement des doublons).
  const contenuClone = JSON.parse(JSON.stringify(source.contenu ?? {})) as Record<string, unknown>;

  return creerBloc(poss.fable.id, enseignantId, {
    type: source.type as TypeBloc,
    titre: source.titre,
    contenu: contenuClone,
    exerciceId: source.exerciceId,
    position: source.ordre + 1,
  });
}

// ----- Réorganisation -----------------------------------------------------------

export async function reordonnerBlocs(
  fableId: string,
  enseignantId: string,
  idsDansLordre: string[]
): Promise<{ ok?: boolean; erreur?: string }> {
  const fable = await fablePossedee(fableId, enseignantId);
  if (!fable) return { erreur: "Fable introuvable." };

  return db.transaction(async (tx) => {
    const lignes = await tx
      .select({ id: blocsFable.id, type: blocsFable.type, ordre: blocsFable.ordre })
      .from(blocsFable)
      .where(eq(blocsFable.fableId, fableId))
      .for("update");

    const existants = new Set(lignes.map((l) => l.id));
    if (
      idsDansLordre.length !== existants.size ||
      idsDansLordre.some((id) => !existants.has(id)) ||
      new Set(idsDansLordre).size !== existants.size
    ) {
      return { erreur: "La liste des blocs ne correspond pas au contenu de la fable." };
    }

    // Deux passes pour éviter les collisions dans un UNIQUE potentiel.
    for (let i = 0; i < idsDansLordre.length; i++) {
      await tx
        .update(blocsFable)
        .set({ ordre: -(i + 1) })
        .where(and(eq(blocsFable.id, idsDansLordre[i]), eq(blocsFable.fableId, fableId)));
    }
    for (let i = 0; i < idsDansLordre.length; i++) {
      await tx
        .update(blocsFable)
        .set({ ordre: i })
        .where(and(eq(blocsFable.id, idsDansLordre[i]), eq(blocsFable.fableId, fableId)));
    }

    // Invariant.
    const apres = (
      await tx
        .select({ ordre: blocsFable.ordre })
        .from(blocsFable)
        .where(eq(blocsFable.fableId, fableId))
        .orderBy(asc(blocsFable.ordre))
    ).map((r) => r.ordre);
    const contigu = apres.every((o, i) => o === i);
    if (!contigu) {
      throw new Error(`Ordres non contigus après réorganisation : ${apres.join(",")}`);
    }
    return { ok: true };
  });
}

/** Déplace un bloc d'une position (delta = +1 ou -1). */
export async function deplacerBloc(
  blocId: string,
  enseignantId: string,
  delta: 1 | -1
): Promise<{ ok?: boolean; erreur?: string }> {
  const poss = await blocPossede(blocId, enseignantId);
  if (!poss) return { erreur: "Bloc introuvable." };
  const fableId = poss.fable.id;

  return db.transaction(async (tx) => {
    const lignes = await tx
      .select()
      .from(blocsFable)
      .where(eq(blocsFable.fableId, fableId))
      .orderBy(asc(blocsFable.ordre))
      .for("update");

    const idx = lignes.findIndex((l) => l.id === blocId);
    const cible = idx + delta;
    if (idx < 0 || cible < 0 || cible >= lignes.length) {
      return { ok: true }; // rien à faire (déjà premier/dernier)
    }
    const nouvelle: string[] = lignes.map((l) => l.id);
    [nouvelle[idx], nouvelle[cible]] = [nouvelle[cible], nouvelle[idx]];

    for (let i = 0; i < nouvelle.length; i++) {
      await tx
        .update(blocsFable)
        .set({ ordre: -(i + 1) })
        .where(and(eq(blocsFable.id, nouvelle[i]), eq(blocsFable.fableId, fableId)));
    }
    for (let i = 0; i < nouvelle.length; i++) {
      await tx
        .update(blocsFable)
        .set({ ordre: i })
        .where(and(eq(blocsFable.id, nouvelle[i]), eq(blocsFable.fableId, fableId)));
    }
    return { ok: true };
  });
}

export type { BlocFableRow, ExerciceRow };
