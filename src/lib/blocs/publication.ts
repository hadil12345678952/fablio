import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blocsFable, exercices, fables } from "@/db/schema";
import type { TypeBloc } from "./types";
import { validerContenuBloc } from "./validation";

// ---------------------------------------------------------------------------
// Validation d'une fable avant publication (BROUILLON -> PUBLIÉ).
// ---------------------------------------------------------------------------

export interface ResultatValidationPublication {
  publiable: boolean;
  erreurs: string[];
}

export async function validerFablePourPublication(
  fableId: string,
  enseignantId: string
): Promise<ResultatValidationPublication> {
  const erreurs: string[] = [];

  const [fable] = await db
    .select()
    .from(fables)
    .where(and(eq(fables.id, fableId), eq(fables.enseignantId, enseignantId)))
    .limit(1);
  if (!fable) return { publiable: false, erreurs: ["Fable introuvable."] };

  if (!fable.titre?.trim()) erreurs.push("Le titre est obligatoire.");
  if (!fable.difficulte) erreurs.push("Le niveau de difficulté est obligatoire.");

  const blocs = await db
    .select()
    .from(blocsFable)
    .where(eq(blocsFable.fableId, fableId))
    .orderBy(asc(blocsFable.ordre));

  const visibles = blocs.filter((b) => b.visible);
  if (visibles.length === 0) {
    erreurs.push("La fable doit contenir au moins un bloc visible avant publication.");
  }

  const exoIds = blocs.map((b) => b.exerciceId).filter((x): x is string => x !== null);
  const exos = exoIds.length
    ? await db.select().from(exercices).where(inArray(exercices.id, exoIds))
    : [];
  const mapExo = new Map(exos.map((e) => [e.id, e]));

  for (const [i, b] of blocs.entries()) {
    if (!b.visible) continue;
    const type = b.type as TypeBloc;
    const nom = `Bloc ${i + 1} (${type})`;

    const erreurC = validerContenuBloc(type, b.contenu ?? {});
    if (erreurC) erreurs.push(`${nom} : ${erreurC}`);

    if (type === "exercice") {
      if (!b.exerciceId) {
        erreurs.push(`${nom} : aucun exercice n'est attaché à ce bloc.`);
      } else {
        const exo = mapExo.get(b.exerciceId);
        if (!exo) {
          erreurs.push(`${nom} : l'exercice référencé n'existe plus.`);
        } else if (!exo.publie) {
          erreurs.push(`${nom} : l'exercice rattaché est en brouillon (publiez-le d'abord).`);
        }
      }
    }
  }

  return { publiable: erreurs.length === 0, erreurs };
}
