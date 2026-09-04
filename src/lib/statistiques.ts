import "server-only";
import { and, eq, inArray } from "drizzle-orm";
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
import { ETIQUETTES_TYPES, normaliser, type TypeExercice } from "@/lib/exercices";
import { etiquetteDateHeure, etiquetteJour } from "@/lib/format";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

const pct = (score: number | null, max: number) =>
  score === null || max <= 0 ? null : (score / max) * 100;

function serieJours(essais: TentativeRow[], jours = 14) {
  const suite: { jour: string; tentatives: number; moyenne: number | null }[] = [];
  const aujourd = new Date();
  aujourd.setHours(0, 0, 0, 0);
  for (let i = jours - 1; i >= 0; i--) {
    const d = new Date(aujourd);
    d.setDate(d.getDate() - i);
    const du = essais.filter((t) => {
      const c = new Date(t.creeLe);
      return (
        c.getFullYear() === d.getFullYear() &&
        c.getMonth() === d.getMonth() &&
        c.getDate() === d.getDate()
      );
    });
    const moyennes = du
      .map((t) => pct(t.score, t.maxScore))
      .filter((v): v is number => v !== null);
    suite.push({
      jour: etiquetteJour(d),
      tentatives: du.length,
      moyenne: moyennes.length
        ? Math.round(moyennes.reduce((a, b) => a + b, 0) / moyennes.length)
        : null,
    });
  }
  return suite;
}

async function chargeContexteEnseignant(enseignantId: string) {
  const [els, fbs] = await Promise.all([
    db.select().from(eleves).where(eq(eleves.enseignantId, enseignantId)),
    db.select().from(fables).where(eq(fables.enseignantId, enseignantId)),
  ]);
  const fableIds = fbs.map((f) => f.id);
  const exos = fableIds.length
    ? await db.select().from(exercices).where(inArray(exercices.fableId, fableIds))
    : [];
  const essais = fableIds.length
    ? await db.select().from(tentatives).where(inArray(tentatives.fableId, fableIds))
    : [];
  return { els, fbs, exos, essais };
}

// ---------------------------------------------------------------------------
// Synthèse générale (tableau de bord enseignant)
// ---------------------------------------------------------------------------

export interface SyntheseEnseignant {
  nbEleves: number;
  nbFables: number;
  nbFablesPubliees: number;
  nbExercices: number;
  nbTentatives: number;
  scoreMoyenPct: number;
  tauxReussite: number;
  serie14: { jour: string; tentatives: number; moyenne: number | null }[];
  parFable: { id: string; titre: string; taux: number; tentatives: number }[];
  activitesRecentes: {
    id: string;
    pseudo: string;
    fableTitre: string;
    typeEtiquette: string;
    score: number | null;
    maxScore: number;
    estCorrect: boolean | null;
    dateEtiquette: string;
  }[];
}

export async function syntheseEnseignant(
  enseignantId: string
): Promise<SyntheseEnseignant> {
  const { els, fbs, exos, essais } = await chargeContexteEnseignant(enseignantId);
  const notes = essais
    .map((t) => pct(t.score, t.maxScore))
    .filter((v): v is number => v !== null);
  const exoParId = new Map(exos.map((e) => [e.id, e]));
  const fableParId = new Map(fbs.map((f) => [f.id, f]));
  const eleveParId = new Map(els.map((e) => [e.id, e]));

  const parFable = fbs.map((f) => {
    const de = essais.filter((t) => t.fableId === f.id);
    const reussies = de.filter((t) => t.estCorrect === true).length;
    return {
      id: f.id,
      titre: f.titre,
      taux: de.length ? Math.round((reussies / de.length) * 100) : 0,
      tentatives: de.length,
    };
  });

  const recentes = [...essais]
    .sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime())
    .slice(0, 8)
    .map((t) => {
      const exo = exoParId.get(t.exerciceId);
      return {
        id: t.id,
        pseudo: eleveParId.get(t.eleveId)?.pseudo ?? "Élève",
        fableTitre: fableParId.get(t.fableId)?.titre ?? "",
        typeEtiquette: exo
          ? ETIQUETTES_TYPES[exo.type as TypeExercice] ?? exo.type
          : "Exercice",
        score: t.score,
        maxScore: t.maxScore,
        estCorrect: t.estCorrect,
        dateEtiquette: etiquetteDateHeure(t.creeLe),
      };
    });

  return {
    nbEleves: els.length,
    nbFables: fbs.length,
    nbFablesPubliees: fbs.filter((f) => f.publie).length,
    nbExercices: exos.length,
    nbTentatives: essais.length,
    scoreMoyenPct: notes.length
      ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length)
      : 0,
    tauxReussite:
      essais.length === 0
        ? 0
        : Math.round(
            (essais.filter((t) => t.estCorrect === true).length /
              Math.max(1, essais.filter((t) => t.estCorrect !== null).length)) *
              100
          ),
    serie14: serieJours(essais),
    parFable,
    activitesRecentes: recentes,
  };
}

// ---------------------------------------------------------------------------
// Statistiques par élève (liste + détail)
// ---------------------------------------------------------------------------

export interface LigneEleveStats {
  id: string;
  pseudo: string;
  codeEtiquette: string;
  tentatives: number;
  scoreMoyenPct: number | null;
  tauxReussite: number;
  tempsSecondes: number;
  fablesTouchees: number;
  derniereActivite: string | null;
}

export async function statsEleves(
  enseignantId: string
): Promise<LigneEleveStats[]> {
  const { els, essais } = await chargeContexteEnseignant(enseignantId);
  const codes = await db
    .select()
    .from(codesParrainage)
    .where(eq(codesParrainage.enseignantId, enseignantId));
  const codeParId = new Map(codes.map((c) => [c.id, c]));

  return els
    .map((e) => {
      const de = essais.filter((t) => t.eleveId === e.id);
      const notes = de
        .map((t) => pct(t.score, t.maxScore))
        .filter((v): v is number => v !== null);
      const triees = [...de].sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime());
      const corrigees = de.filter((t) => t.estCorrect !== null);
      return {
        id: e.id,
        pseudo: e.pseudo,
        codeEtiquette: e.codeId ? codeParId.get(e.codeId)?.etiquette ?? "—" : "—",
        tentatives: de.length,
        scoreMoyenPct: notes.length
          ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length)
          : null,
        tauxReussite: corrigees.length
          ? Math.round(
              (de.filter((t) => t.estCorrect === true).length / corrigees.length) * 100
            )
          : 0,
        tempsSecondes: de.reduce((a, t) => a + t.dureeSecondes, 0),
        fablesTouchees: new Set(de.map((t) => t.fableId)).size,
        derniereActivite: triees[0] ? etiquetteDateHeure(triees[0].creeLe) : null,
      } satisfies LigneEleveStats;
    })
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"));
}

export interface DetailEleveStats {
  eleve: { id: string; pseudo: string; codeEtiquette: string; creeLeEtiquette: string };
  pointsCumules: number;
  serie14: { jour: string; tentatives: number; moyenne: number | null }[];
  parFable: {
    fableId: string;
    titre: string;
    exercices: number;
    reussis: number;
    meilleureNotePct: number | null;
    tentatives: number;
    tempsSecondes: number;
    terminee: boolean;
  }[];
  historique: {
    id: string;
    fableTitre: string;
    typeEtiquette: string;
    score: number | null;
    maxScore: number;
    estCorrect: boolean | null;
    numero: number;
    dateEtiquette: string;
  }[];
}

export async function detailEleveStats(
  enseignantId: string,
  eleveId: string
): Promise<DetailEleveStats | null> {
  const el = await db
    .select()
    .from(eleves)
    .where(and(eq(eleves.id, eleveId), eq(eleves.enseignantId, enseignantId)))
    .limit(1);
  const eleve = el[0];
  if (!eleve) return null;

  const fbs = await db
    .select()
    .from(fables)
    .where(and(eq(fables.enseignantId, enseignantId), eq(fables.publie, true)));
  const exos = fbs.length
    ? await db
        .select()
        .from(exercices)
        .where(
          and(
            inArray(exercices.fableId, fbs.map((f) => f.id)),
            eq(exercices.publie, true)
          )
        )
    : [];
  const essais = await db
    .select()
    .from(tentatives)
    .where(eq(tentatives.eleveId, eleve.id));
  const code = eleve.codeId
    ? await db
        .select()
        .from(codesParrainage)
        .where(eq(codesParrainage.id, eleve.codeId))
        .limit(1)
    : [];

  const exoParId = new Map(exos.map((e) => [e.id, e]));
  const meilleurs = new Map<string, number>();
  for (const t of essais) {
    if (t.score === null) continue;
    meilleurs.set(t.exerciceId, Math.max(meilleurs.get(t.exerciceId) ?? 0, t.score));
  }

  const parFable = fbs
    .map((f) => {
      const exosFable = exos.filter((e) => e.fableId === f.id);
      const de = essais.filter((t) => t.fableId === f.id);
      const reussis = exosFable.filter((e) =>
        de.some((t) => t.exerciceId === e.id && t.estCorrect === true)
      ).length;
      const notes = exosFable
        .map((e) => {
          const s = meilleurs.get(e.id);
          return s === undefined ? null : pct(s, e.points);
        })
        .filter((v): v is number => v !== null);
      return {
        fableId: f.id,
        titre: f.titre,
        exercices: exosFable.length,
        reussis,
        meilleureNotePct: notes.length
          ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length)
          : null,
        tentatives: de.length,
        tempsSecondes: de.reduce((a, t) => a + t.dureeSecondes, 0),
        terminee: exosFable.length > 0 && reussis >= exosFable.length,
      };
    })
    .filter((l) => l.tentatives > 0 || l.exercices > 0);

  return {
    eleve: {
      id: eleve.id,
      pseudo: eleve.pseudo,
      codeEtiquette: code[0]?.etiquette ?? "—",
      creeLeEtiquette: etiquetteJour(eleve.creeLe),
    },
    pointsCumules: [...meilleurs.values()].reduce((a, b) => a + b, 0),
    serie14: serieJours(essais),
    parFable,
    historique: [...essais]
      .sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime())
      .slice(0, 15)
      .map((t) => {
        const exo = exoParId.get(t.exerciceId);
        return {
          id: t.id,
          fableTitre: fbs.find((f) => f.id === t.fableId)?.titre ?? "",
          typeEtiquette: exo
            ? ETIQUETTES_TYPES[exo.type as TypeExercice] ?? exo.type
            : "Exercice",
          score: t.score,
          maxScore: t.maxScore,
          estCorrect: t.estCorrect,
          numero: t.numero,
          dateEtiquette: etiquetteDateHeure(t.creeLe),
        };
      }),
  };
}

// ---------------------------------------------------------------------------
// Statistiques par fable (et par exercice)
// ---------------------------------------------------------------------------

export interface DistributionChoix {
  etiquette: string;
  nombre: number;
  correct: boolean;
}
export interface ErreursTrous {
  trou: number;
  reference: string;
  erreurs: { mot: string; nombre: number }[];
  tauxErreur: number;
}
export interface ReponseEnAttente {
  tentativeId: string;
  pseudo: string;
  reponse: string;
  dateEtiquette: string;
}

export interface StatsExercice {
  id: string;
  ordre: number;
  type: TypeExercice;
  typeEtiquette: string;
  consigne: string;
  resume: string;
  points: number;
  tentatives: number;
  elevesDistincts: number;
  tauxReussite: number;
  noteMoyennePct: number | null;
  tempsMoyenSecondes: number;
  distribution: DistributionChoix[] | null;
  erreursTrous: ErreursTrous[] | null;
  enAttente: ReponseEnAttente[] | null;
}

export interface StatsFable {
  fable: { id: string; titre: string; publie: boolean };
  nbElevesActifs: number;
  nbTentatives: number;
  tauxReussiteGlobal: number;
  noteMoyennePct: number | null;
  tempsMoyenSecondes: number;
  exercices: StatsExercice[];
  parEleve: {
    id: string;
    pseudo: string;
    tentatives: number;
    meilleureNotePct: number | null;
    tauxReussite: number;
    tempsSecondes: number;
  }[];
}

function resumeExercice(exo: ExerciceRow): string {
  const p = exo.payload as unknown as Record<string, unknown>;
  switch (exo.type as TypeExercice) {
    case "qcm":
      return String(p.question ?? "");
    case "vrai_faux":
      return String(p.enonce ?? "");
    case "texte_trous": {
      const segments = (p.segments as string[]) ?? [];
      return segments.join(" ____ ").slice(0, 140);
    }
    case "ordre":
      return `${((p.elements as string[]) ?? []).length} éléments à classer`;
    case "association":
      return `${((p.paires as unknown[]) ?? []).length} paires à relier`;
    case "question_ouverte":
      return String(p.question ?? "");
    case "video_interactive":
      return `Vidéo interactive · ${((p.arrets as unknown[]) ?? []).length} question(s) pendant la lecture`;
    case "h5p":
      return String(p.titre || "Activité H5P externe");
  }
}

export async function statsFable(
  enseignantId: string,
  fableId: string
): Promise<StatsFable | null> {
  const [fable] = await db
    .select()
    .from(fables)
    .where(and(eq(fables.id, fableId), eq(fables.enseignantId, enseignantId)))
    .limit(1);
  if (!fable) return null;

  const exos = await db
    .select()
    .from(exercices)
    .where(eq(exercices.fableId, fableId));
  const essais = await db
    .select()
    .from(tentatives)
    .where(eq(tentatives.fableId, fableId));
  const eleveIds = [...new Set(essais.map((t) => t.eleveId))];
  const els = eleveIds.length
    ? await db.select().from(eleves).where(inArray(eleves.id, eleveIds))
    : [];
  const eleveParId = new Map(els.map((e) => [e.id, e]));

  const ordonnes = [...exos].sort((a, b) => a.ordre - b.ordre);

  const exercicesStats: StatsExercice[] = ordonnes.map((exo) => {
    const de = essais.filter((t) => t.exerciceId === exo.id);
    const corrigees = de.filter((t) => t.estCorrect !== null);
    const notes = de
      .map((t) => pct(t.score, t.maxScore))
      .filter((v): v is number => v !== null);
    const type = exo.type as TypeExercice;

    // Distribution des choix (QCM, vrai/faux)
    let distribution: DistributionChoix[] | null = null;
    if (type === "qcm") {
      const p = exo.payload as { options: string[]; corrects: number[] };
      distribution = p.options.map((option, i) => ({
        etiquette: option,
        nombre: de.filter(
          (t) => Array.isArray(t.reponse) && (t.reponse as number[]).includes(i)
        ).length,
        correct: p.corrects.includes(i),
      }));
    } else if (type === "vrai_faux") {
      const p = exo.payload as { reponse: boolean };
      const vrai = de.filter((t) => t.reponse === true).length;
      distribution = [
        { etiquette: "Vrai", nombre: vrai, correct: p.reponse === true },
        { etiquette: "Faux", nombre: de.length - vrai, correct: p.reponse === false },
      ];
    }

    // Erreurs les plus fréquentes (texte à trous)
    let erreursTrous: ErreursTrous[] | null = null;
    if (type === "texte_trous") {
      const p = exo.payload as { reponses: string[][] };
      erreursTrous = p.reponses.map((acceptees, i) => {
        const compteur = new Map<string, number>();
        let fautes = 0;
        for (const t of de) {
          if (!Array.isArray(t.reponse)) continue;
          const donnee = String((t.reponse as string[])[i] ?? "");
          const ok = acceptees.some(
            (a) => normaliser(a) === normaliser(donnee)
          );
          if (!ok && donnee.trim()) {
            fautes++;
            const cle = donnee.trim();
            compteur.set(cle, (compteur.get(cle) ?? 0) + 1);
          }
        }
        return {
          trou: i + 1,
          reference: acceptees[0] ?? "",
          erreurs: [...compteur.entries()]
            .map(([mot, nombre]) => ({ mot, nombre }))
            .sort((a, b) => b.nombre - a.nombre)
            .slice(0, 4),
          tauxErreur: de.length ? Math.round((fautes / de.length) * 100) : 0,
        };
      });
    }

    // Réponses en attente de correction manuelle (questions ouvertes et H5P)
    let enAttente: ReponseEnAttente[] | null = null;
    if (type === "question_ouverte" || type === "h5p") {
      const attente = de.filter((t) => t.estCorrect === null);
      enAttente = attente.map((t) => ({
        tentativeId: t.id,
        pseudo: eleveParId.get(t.eleveId)?.pseudo ?? "Élève",
        reponse: String(t.reponse ?? ""),
        dateEtiquette: etiquetteDateHeure(t.creeLe),
      }));
    }

    // Vidéo interactive : réussite question par question
    if (type === "video_interactive") {
      const p = exo.payload as { arrets: { question: string; correct: number }[] };
      distribution = p.arrets.map((arret, i) => ({
        etiquette: `Q${i + 1} · ${arret.question.slice(0, 42)}`,
        nombre: de.filter(
          (t) => Array.isArray(t.reponse) && (t.reponse as number[])[i] === arret.correct
        ).length,
        correct: true,
      }));
    }

    return {
      id: exo.id,
      ordre: exo.ordre,
      type,
      typeEtiquette: ETIQUETTES_TYPES[type] ?? exo.type,
      consigne: exo.consigne,
      resume: resumeExercice(exo),
      points: exo.points,
      tentatives: de.length,
      elevesDistincts: new Set(de.map((t) => t.eleveId)).size,
      tauxReussite: corrigees.length
        ? Math.round(
            (de.filter((t) => t.estCorrect === true).length / corrigees.length) * 100
          )
        : 0,
      noteMoyennePct: notes.length
        ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length)
        : null,
      tempsMoyenSecondes: de.length
        ? Math.round(de.reduce((a, t) => a + t.dureeSecondes, 0) / de.length)
        : 0,
      distribution,
      erreursTrous,
      enAttente,
    };
  });

  const parEleve = eleveIds
    .map((id) => {
      const de = essais.filter((t) => t.eleveId === id);
      const corrigees = de.filter((t) => t.estCorrect !== null);
      // meilleure note par exercice
      const meilleurs = new Map<string, { score: number; max: number }>();
      for (const t of de) {
        if (t.score === null) continue;
        const actuel = meilleurs.get(t.exerciceId);
        if (!actuel || t.score > actuel.score)
          meilleurs.set(t.exerciceId, { score: t.score, max: t.maxScore });
      }
      const notes = [...meilleurs.values()]
        .map((n) => pct(n.score, n.max))
        .filter((v): v is number => v !== null);
      return {
        id,
        pseudo: eleveParId.get(id)?.pseudo ?? "Élève",
        tentatives: de.length,
        meilleureNotePct: notes.length
          ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length)
          : null,
        tauxReussite: corrigees.length
          ? Math.round(
              (de.filter((t) => t.estCorrect === true).length / corrigees.length) * 100
            )
          : 0,
        tempsSecondes: de.reduce((a, t) => a + t.dureeSecondes, 0),
      };
    })
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"));

  const corrigeesGlobales = essais.filter((t) => t.estCorrect !== null);
  const notesGlobales = essais
    .map((t) => pct(t.score, t.maxScore))
    .filter((v): v is number => v !== null);

  return {
    fable: { id: fable.id, titre: fable.titre, publie: fable.publie },
    nbElevesActifs: eleveIds.length,
    nbTentatives: essais.length,
    tauxReussiteGlobal: corrigeesGlobales.length
      ? Math.round(
          (essais.filter((t) => t.estCorrect === true).length /
            corrigeesGlobales.length) *
            100
        )
      : 0,
    noteMoyennePct: notesGlobales.length
      ? Math.round(notesGlobales.reduce((a, b) => a + b, 0) / notesGlobales.length)
      : null,
    tempsMoyenSecondes: essais.length
      ? Math.round(
          essais.reduce((a, t) => a + t.dureeSecondes, 0) / essais.length
        )
      : 0,
    exercices: exercicesStats,
    parEleve,
  };
}

// ---------------------------------------------------------------------------
// Export CSV des résultats
// ---------------------------------------------------------------------------

export async function donneesExportCsv(enseignantId: string): Promise<string> {
  const { els, fbs, exos, essais } = await chargeContexteEnseignant(enseignantId);
  const codeLignes = await db
    .select()
    .from(codesParrainage)
    .where(eq(codesParrainage.enseignantId, enseignantId));
  const eleveParId = new Map(els.map((e) => [e.id, e]));
  const fableParId = new Map(fbs.map((f) => [f.id, f]));
  const exoParId = new Map(exos.map((e) => [e.id, e]));
  const codeParId = new Map(codeLignes.map((c) => [c.id, c]));

  const echapper = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const enTetes = [
    "Eleve",
    "Classe / code",
    "Fable",
    "Exercice",
    "Type",
    "Tentative n°",
    "Score",
    "Score max",
    "Reussi",
    "Duree (s)",
    "Date",
  ];
  const lignes = [enTetes.join(";")];
  for (const t of [...essais].sort(
    (a, b) => a.creeLe.getTime() - b.creeLe.getTime()
  )) {
    const el = eleveParId.get(t.eleveId);
    const exo = exoParId.get(t.exerciceId);
    lignes.push(
      [
        el?.pseudo ?? "?",
        el?.codeId ? codeParId.get(el.codeId)?.etiquette ?? "" : "",
        fableParId.get(t.fableId)?.titre ?? "?",
        exo ? resumeExercice(exo) : "?",
        exo ? ETIQUETTES_TYPES[exo.type as TypeExercice] ?? exo.type : "?",
        t.numero,
        t.score === null ? "en attente" : t.score,
        t.maxScore,
        t.estCorrect === null ? "en attente" : t.estCorrect ? "oui" : "non",
        t.dureeSecondes,
        t.creeLe.toISOString(),
      ]
        .map(echapper)
        .join(";")
    );
  }
  return "﻿" + lignes.join("\n");
}
