import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  exercices,
  fables,
  tentatives,
  type EleveRow,
} from "@/db/schema";
import { ETIQUETTES_TYPES, type TypeExercice } from "@/lib/exercices";
import { etiquetteDateHeure } from "@/lib/format";
import { fablesPourEleve } from "@/lib/queries";

// ---------------------------------------------------------------------------
// Tableau de bord élève — TOUTES les valeurs proviennent de la base réelle
// (tentatives, exercices publiés, fables visibles). Aucune donnée simulée.
//
// Règles de comptage (cohérentes avec le moteur d'exercices existant) :
//   • « exercice réussi »  = au moins une tentative avec est_correct = true
//   • « exercice tenté »   = au moins une tentative (même échouée / en attente)
//   • « fable terminée »   = tous ses exercices publiés sont réussis
//   • « fable en cours »   = au moins une tentative, mais pas terminée
//   • « à commencer »      = aucune tentative sur ses exercices
//   • « points »           = somme des MEILLEURS scores par exercice
// Une activité ouverte mais non validée n'est jamais comptée comme réussie.
// ---------------------------------------------------------------------------

export type StatutFable = "terminee" | "en_cours" | "a_commencer";

export interface FableParcours {
  id: string;
  titre: string;
  morale: string;
  imageUrl: string;
  difficulte: string;
  statut: StatutFable;
  nbExercices: number;
  nbReussis: number;
  nbTentes: number;
  progressionPct: number;
  /** Points déjà gagnés sur cette fable (meilleurs scores). */
  points: number;
  /** Points possibles (somme des barèmes des exercices publiés). */
  pointsMax: number;
  derniereActiviteISO: string | null;
}

export interface BadgeEleve {
  cle: string;
  nom: string;
  description: string;
  obtenu: boolean;
  /** Progression vers le badge : 0..1 (permet une barre « presque ! »). */
  avancement: number;
  /** Ex. « 2 / 3 fables ». */
  detail: string;
}

export interface ActiviteRecente {
  id: string;
  fableId: string;
  fableTitre: string;
  typeEtiquette: string;
  score: number | null;
  maxScore: number;
  estCorrect: boolean | null;
  dateEtiquette: string;
}

export interface RepriseSuggeree {
  fableId: string;
  titre: string;
  imageUrl: string;
  /** continuer = commencée non finie · revoir = terminée · decouvrir = neuve */
  action: "continuer" | "revoir" | "decouvrir";
  nbReussis: number;
  nbExercices: number;
}

export interface TableauDeBordEleve {
  pseudo: string;
  // Compteurs globaux (réels)
  points: number;
  pointsMax: number;
  fablesTerminees: number;
  fablesCommencees: number;
  nbFables: number;
  exercicesReussis: number;
  exercicesTentes: number;
  exercicesTotal: number;
  totalTentatives: number;
  tempsTotalSecondes: number;
  progressionGlobalePct: number;
  derniereActivite: string | null;
  // Détails
  parcours: FableParcours[];
  reprise: RepriseSuggeree | null;
  activitesRecentes: ActiviteRecente[];
  badges: BadgeEleve[];
}

/** Règles de badges — vérifiables, calculées sur les données réelles. */
function calculerBadges(donnees: {
  exercicesReussis: number;
  fablesTerminees: number;
  points: number;
  totalTentatives: number;
  typesTravailles: number;
}): BadgeEleve[] {
  const { exercicesReussis, fablesTerminees, points, totalTentatives, typesTravailles } =
    donnees;

  const palier = (
    cle: string,
    nom: string,
    description: string,
    valeur: number,
    cible: number,
    unite: string
  ): BadgeEleve => ({
    cle,
    nom,
    description,
    obtenu: valeur >= cible,
    avancement: Math.max(0, Math.min(1, valeur / cible)),
    detail: `${Math.min(valeur, cible)} / ${cible} ${unite}`,
  });

  return [
    palier("premier_pas", "Premier pas", "Réussir un premier exercice", exercicesReussis, 1, "exercice"),
    palier("petit_lecteur", "Petit lecteur", "Terminer une fable entière", fablesTerminees, 1, "fable"),
    palier("perseverant", "Persévérant", "Faire 10 exercices", totalTentatives, 10, "essais"),
    palier("explorateur", "Explorateur", "Essayer 4 types d'exercices", typesTravailles, 4, "types"),
    palier("collectionneur", "Collectionneur", "Terminer 3 fables", fablesTerminees, 3, "fables"),
    palier("etoile_or", "Étoile d'or", "Gagner 100 points", points, 100, "points"),
    palier("champion", "Champion des fables", "Gagner 300 points", points, 300, "points"),
  ];
}

export async function tableauDeBordEleve(
  eleve: EleveRow
): Promise<TableauDeBordEleve> {
  // 1 requête : fables visibles (respecte publication + ciblage de classe)
  const cartes = await fablesPourEleve(eleve);
  const fableIds = cartes.map((c) => c.id);

  // 1 requête : exercices publiés de ces fables
  const exos = fableIds.length
    ? await db
        .select()
        .from(exercices)
        .where(
          and(inArray(exercices.fableId, fableIds), eq(exercices.publie, true))
        )
        .orderBy(asc(exercices.ordre))
    : [];

  // 1 requête : toutes les tentatives de l'élève
  const essais = await db
    .select()
    .from(tentatives)
    .where(eq(tentatives.eleveId, eleve.id))
    .orderBy(desc(tentatives.creeLe));

  const exoParId = new Map(exos.map((e) => [e.id, e]));
  const fableParId = new Map(cartes.map((c) => [c.id, c]));

  // Agrégats par exercice
  const reussiParExo = new Set<string>();
  const tenteParExo = new Set<string>();
  const meilleurParExo = new Map<string, number>();
  for (const t of essais) {
    tenteParExo.add(t.exerciceId);
    if (t.estCorrect === true) reussiParExo.add(t.exerciceId);
    if (t.score !== null) {
      meilleurParExo.set(
        t.exerciceId,
        Math.max(meilleurParExo.get(t.exerciceId) ?? 0, t.score)
      );
    }
  }

  // Parcours par fable
  const parcours: FableParcours[] = cartes.map((c) => {
    const deLaFable = exos.filter((e) => e.fableId === c.id);
    const nbExercices = deLaFable.length;
    const nbReussis = deLaFable.filter((e) => reussiParExo.has(e.id)).length;
    const nbTentes = deLaFable.filter((e) => tenteParExo.has(e.id)).length;
    const points = deLaFable.reduce(
      (acc, e) => acc + (meilleurParExo.get(e.id) ?? 0),
      0
    );
    const pointsMax = deLaFable.reduce((acc, e) => acc + e.points, 0);
    const derniere = essais.find((t) => t.fableId === c.id);
    const statut: StatutFable =
      nbExercices > 0 && nbReussis >= nbExercices
        ? "terminee"
        : nbTentes > 0
          ? "en_cours"
          : "a_commencer";
    return {
      id: c.id,
      titre: c.titre,
      morale: c.morale,
      imageUrl: c.imageUrl,
      difficulte: c.difficulte,
      statut,
      nbExercices,
      nbReussis,
      nbTentes,
      progressionPct:
        nbExercices > 0 ? Math.round((nbReussis / nbExercices) * 100) : 0,
      points: Math.round(points * 100) / 100,
      pointsMax,
      derniereActiviteISO: derniere ? derniere.creeLe.toISOString() : null,
    };
  });

  // Reprise conseillée : fable en cours la plus récente, sinon 1re à commencer,
  // sinon la dernière terminée (pour « revoir »).
  const enCours = parcours
    .filter((p) => p.statut === "en_cours")
    .sort((a, b) =>
      (b.derniereActiviteISO ?? "").localeCompare(a.derniereActiviteISO ?? "")
    );
  const aCommencer = parcours.filter((p) => p.statut === "a_commencer");
  const terminees = parcours
    .filter((p) => p.statut === "terminee")
    .sort((a, b) =>
      (b.derniereActiviteISO ?? "").localeCompare(a.derniereActiviteISO ?? "")
    );
  const cible = enCours[0] ?? aCommencer[0] ?? terminees[0] ?? null;
  const reprise: RepriseSuggeree | null = cible
    ? {
        fableId: cible.id,
        titre: cible.titre,
        imageUrl: cible.imageUrl,
        action:
          cible.statut === "en_cours"
            ? "continuer"
            : cible.statut === "a_commencer"
              ? "decouvrir"
              : "revoir",
        nbReussis: cible.nbReussis,
        nbExercices: cible.nbExercices,
      }
    : null;

  // Compteurs globaux
  const exercicesTotal = exos.length;
  const exercicesReussis = exos.filter((e) => reussiParExo.has(e.id)).length;
  const exercicesTentes = exos.filter((e) => tenteParExo.has(e.id)).length;
  const points = parcours.reduce((a, p) => a + p.points, 0);
  const pointsMax = parcours.reduce((a, p) => a + p.pointsMax, 0);
  const typesTravailles = new Set(
    essais
      .map((t) => exoParId.get(t.exerciceId)?.type)
      .filter((x): x is string => Boolean(x))
  ).size;

  return {
    pseudo: eleve.pseudo,
    points: Math.round(points * 100) / 100,
    pointsMax,
    fablesTerminees: parcours.filter((p) => p.statut === "terminee").length,
    fablesCommencees: parcours.filter((p) => p.statut === "en_cours").length,
    nbFables: parcours.length,
    exercicesReussis,
    exercicesTentes,
    exercicesTotal,
    totalTentatives: essais.length,
    tempsTotalSecondes: essais.reduce((a, t) => a + t.dureeSecondes, 0),
    progressionGlobalePct:
      exercicesTotal > 0
        ? Math.round((exercicesReussis / exercicesTotal) * 100)
        : 0,
    derniereActivite: essais[0] ? etiquetteDateHeure(essais[0].creeLe) : null,
    parcours,
    reprise,
    activitesRecentes: essais.slice(0, 6).map((t) => {
      const exo = exoParId.get(t.exerciceId);
      return {
        id: t.id,
        fableId: t.fableId,
        fableTitre: fableParId.get(t.fableId)?.titre ?? "Fable",
        typeEtiquette: exo
          ? ETIQUETTES_TYPES[exo.type as TypeExercice] ?? exo.type
          : "Exercice",
        score: t.score,
        maxScore: t.maxScore,
        estCorrect: t.estCorrect,
        dateEtiquette: etiquetteDateHeure(t.creeLe),
      };
    }),
    badges: calculerBadges({
      exercicesReussis,
      fablesTerminees: parcours.filter((p) => p.statut === "terminee").length,
      points,
      totalTentatives: essais.length,
      typesTravailles,
    }),
  };
}

export { fables };
