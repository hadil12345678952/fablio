// ---------------------------------------------------------------------------
// Moteur d'exercices Fablio — logique pure (utilisable côté serveur ET client)
// ---------------------------------------------------------------------------

export const TYPES_EXERCICES = [
  "qcm",
  "vrai_faux",
  "texte_trous",
  "ordre",
  "association",
  "question_ouverte",
  "video_interactive",
  "h5p",
] as const;

export type TypeExercice = (typeof TYPES_EXERCICES)[number];

export const ETIQUETTES_TYPES: Record<TypeExercice, string> = {
  qcm: "QCM",
  vrai_faux: "Vrai / Faux",
  texte_trous: "Texte à trous",
  ordre: "Remise en ordre",
  association: "Association",
  question_ouverte: "Question ouverte",
  video_interactive: "Vidéo interactive",
  h5p: "Activité H5P",
};

export const DESCRIPTIONS_TYPES: Record<TypeExercice, string> = {
  qcm: "L'élève choisit la ou les bonnes réponses parmi plusieurs propositions.",
  vrai_faux: "L'élève dit si une affirmation est vraie ou fausse.",
  texte_trous: "L'élève complète les mots manquants d'un extrait de la fable.",
  ordre: "L'élève replace des phrases ou événements dans le bon ordre.",
  association: "L'élève relie des éléments de deux colonnes (mot ↔ définition…).",
  question_ouverte: "Réponse libre courte, corrigée automatiquement ou par l'enseignant.",
  video_interactive:
    "Une vidéo qui s'arrête aux moments choisis pour poser une question à l'élève.",
  h5p: "Une activité H5P externe (h5p.org, Lumi, Moodle…) intégrée à la fable.",
};

// ----- Payloads par type ---------------------------------------------------

export interface QcmPayload {
  question: string;
  options: string[];
  corrects: number[]; // index des bonnes réponses
  multiple: boolean;
}
export interface VraiFauxPayload {
  enonce: string;
  reponse: boolean;
}
export interface TrousPayload {
  segments: string[]; // texte entre les trous (longueur = nb trous + 1)
  reponses: string[][]; // réponses acceptées par trou (la 1re = référence)
  afficherBanque: boolean;
  banque: string[]; // mots supplémentaires affichés dans la banque
}
export interface OrdrePayload {
  elements: string[]; // dans le BON ordre (mélangé pour l'élève)
}
export interface PaireAssociation {
  gauche: string;
  droite: string;
}
export interface AssociationPayload {
  paires: PaireAssociation[];
}
export interface OuvertePayload {
  question: string;
  corrigeType: string; // corrigé type affiché après
  reponsesAcceptees: string[]; // si non vide → correction automatique
}

/** Un arrêt de la vidéo : à `temps` secondes, on pose une question. */
export interface ArretVideo {
  temps: number; // en secondes
  question: string;
  options: string[];
  correct: number; // index de la bonne réponse
  explication: string;
}
export interface VideoInteractivePayload {
  videoUrl: string;
  arrets: ArretVideo[];
}

export interface H5pPayload {
  /** URL d'intégration (iframe) de l'activité H5P. */
  embedUrl: string;
  titre: string;
  /** Hauteur initiale de l'iframe en pixels (ajustée ensuite automatiquement). */
  hauteur: number;
  /** true : terminer l'activité vaut tous les points ; false : l'enseignant corrige. */
  validationAutomatique: boolean;
  /** Demander à l'élève son score H5P (auto-évaluation transmise à l'enseignant). */
  demanderScore: boolean;
}

export type PayloadExercice =
  | QcmPayload
  | VraiFauxPayload
  | TrousPayload
  | OrdrePayload
  | AssociationPayload
  | OuvertePayload
  | VideoInteractivePayload
  | H5pPayload;

export type ReponseEleve =
  | number[]
  | (number | null)[]
  | boolean
  | string[]
  | string;

// ----- Utilitaires ----------------------------------------------------------

/** Normalise une réponse texte : minuscules, sans accents, espaces stables. */
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Graine numérique stable à partir d'une chaîne. */
function hacher(graine: string): number {
  let h = 1779033703 ^ graine.length;
  for (let i = 0; i < graine.length; i++) {
    h = Math.imul(h ^ graine.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Mélange déterministe (même graine ⇒ même ordre), sans modifier l'original. */
export function melanger<T>(tableau: readonly T[], graine: string): T[] {
  const copie = [...tableau];
  let a = hacher(graine) || 1;
  const alea = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// ----- Texte à trous : analyse / composition -------------------------------

/** Transforme "La cigale ayant {chanté|a chanté} tout l'été" en payload. */
export function analyserTexteATrous(texte: string): TrousPayload {
  const segments: string[] = [];
  const reponses: string[][] = [];
  const motif = /\{([^}]*)\}/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(texte)) !== null) {
    segments.push(texte.slice(dernier, m.index));
    const acceptees = m[1]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    reponses.push(acceptees.length ? acceptees : ["?"]);
    dernier = m.index + m[0].length;
  }
  segments.push(texte.slice(dernier));
  return { segments, reponses, afficherBanque: false, banque: [] };
}

/** Recompose le texte avec accolades à partir d'un payload (pour l'éditeur). */
export function composerTexteATrous(p: TrousPayload): string {
  let sortie = "";
  for (let i = 0; i < p.reponses.length; i++) {
    sortie += (p.segments[i] ?? "") + "{" + p.reponses[i].join("|") + "}";
  }
  sortie += p.segments[p.segments.length - 1] ?? "";
  return sortie;
}

// ----- Présentation côté élève (mélanges déterministes) ---------------------

export interface PresentationExercice {
  /** Pour "ordre" : éléments mélangés avec leur index d'origine. */
  elementsOrdre?: { texte: string; origine: number }[];
  /** Pour "association" : colonne de droite mélangée. */
  droitesAssociation?: { texte: string; origine: number }[];
  /** Pour "texte_trous" : banque de mots mélangée (réponses + leurres). */
  banque?: string[];
}

export function fabriquerPresentation(
  type: TypeExercice,
  payload: PayloadExercice,
  graine: string
): PresentationExercice {
  if (type === "ordre") {
    const p = payload as OrdrePayload;
    const etiquettes = p.elements.map((texte, origine) => ({ texte, origine }));
    return { elementsOrdre: melanger(etiquettes, graine + ":ordre") };
  }
  if (type === "association") {
    const p = payload as AssociationPayload;
    const droites = p.paires.map((paire, origine) => ({
      texte: paire.droite,
      origine,
    }));
    return { droitesAssociation: melanger(droites, graine + ":assoc") };
  }
  if (type === "texte_trous") {
    const p = payload as TrousPayload;
    if (!p.afficherBanque) return {};
    const mots = new Set<string>();
    p.reponses.forEach((r) => r[0] && mots.add(r[0]));
    (p.banque ?? []).forEach((b) => b.trim() && mots.add(b.trim()));
    return { banque: melanger([...mots], graine + ":banque") };
  }
  return {};
}

// ----- Notation --------------------------------------------------------------

export interface ResultatNotation {
  /** null ⇒ correction manuelle en attente */
  score: number | null;
  maxScore: number;
  /** null ⇒ en attente */
  estCorrect: boolean | null;
}

const arrondiQuart = (n: number) => Math.round(n * 4) / 4;

export function noterExercice(
  type: TypeExercice,
  payload: PayloadExercice,
  reponse: ReponseEleve,
  points: number
): ResultatNotation {
  switch (type) {
    case "qcm": {
      const p = payload as QcmPayload;
      const sel = new Set(
        Array.isArray(reponse)
          ? (reponse as unknown[]).filter((x) => typeof x === "number")
          : []
      );
      const cor = new Set(p.corrects);
      const hits = [...sel].filter((i) => cor.has(i)).length;
      const faux = sel.size - hits;
      const ratio = Math.max(0, (hits - faux) / Math.max(1, cor.size));
      return {
        score: arrondiQuart(points * ratio),
        maxScore: points,
        estCorrect: ratio >= 1,
      };
    }
    case "vrai_faux": {
      const p = payload as VraiFauxPayload;
      const ok = reponse === p.reponse;
      return {
        score: ok ? points : 0,
        maxScore: points,
        estCorrect: ok,
      };
    }
    case "texte_trous": {
      const p = payload as TrousPayload;
      const rep = Array.isArray(reponse) ? (reponse as string[]) : [];
      const bons = p.reponses.reduce((acc, acceptees, i) => {
        const donnee = normaliser(String(rep[i] ?? ""));
        return acc + (acceptees.some((a) => normaliser(a) === donnee) ? 1 : 0);
      }, 0);
      const total = Math.max(1, p.reponses.length);
      return {
        score: arrondiQuart((points * bons) / total),
        maxScore: points,
        estCorrect: bons === total && total > 0,
      };
    }
    case "ordre": {
      const p = payload as OrdrePayload;
      const rep = Array.isArray(reponse) ? (reponse as number[]) : [];
      const bons = p.elements.reduce(
        (acc, _e, i) => acc + (rep[i] === i ? 1 : 0),
        0
      );
      const total = Math.max(1, p.elements.length);
      return {
        score: arrondiQuart((points * bons) / total),
        maxScore: points,
        estCorrect: bons === total && total > 0,
      };
    }
    case "association": {
      const p = payload as AssociationPayload;
      const rep = Array.isArray(reponse)
        ? (reponse as (number | null)[])
        : [];
      const bons = p.paires.reduce(
        (acc, _paire, i) => acc + (rep[i] === i ? 1 : 0),
        0
      );
      const total = Math.max(1, p.paires.length);
      return {
        score: arrondiQuart((points * bons) / total),
        maxScore: points,
        estCorrect: bons === total && total > 0,
      };
    }
    case "question_ouverte": {
      const p = payload as OuvertePayload;
      const texte = String(reponse ?? "");
      if (p.reponsesAcceptees.length > 0) {
        const ok = p.reponsesAcceptees.some(
          (a) => normaliser(a) === normaliser(texte)
        );
        return { score: ok ? points : 0, maxScore: points, estCorrect: ok };
      }
      // Pas de réponses acceptées ⇒ correction manuelle par l'enseignant
      return { score: null, maxScore: points, estCorrect: null };
    }
    case "video_interactive": {
      const p = payload as VideoInteractivePayload;
      const rep = Array.isArray(reponse) ? (reponse as (number | null)[]) : [];
      const bons = p.arrets.reduce(
        (acc, arret, i) => acc + (rep[i] === arret.correct ? 1 : 0),
        0
      );
      const total = Math.max(1, p.arrets.length);
      return {
        score: arrondiQuart((points * bons) / total),
        maxScore: points,
        estCorrect: bons === p.arrets.length && p.arrets.length > 0,
      };
    }
    case "h5p": {
      const p = payload as H5pPayload;
      // L'activité H5P est hébergée sur un site externe : elle ne peut pas
      // transmettre son score de façon fiable (iframe d'un autre domaine).
      // Deux stratégies, choisies par l'enseignant :
      if (p.validationAutomatique) {
        return { score: points, maxScore: points, estCorrect: true };
      }
      return { score: null, maxScore: points, estCorrect: null };
    }
  }
}

/** Lignes de correction affichées après la soumission. */
export function corrigeExercice(
  type: TypeExercice,
  payload: PayloadExercice
): string[] {
  switch (type) {
    case "qcm": {
      const p = payload as QcmPayload;
      return p.corrects.map((i) => `Bonne réponse : ${p.options[i] ?? "?"}`);
    }
    case "vrai_faux": {
      const p = payload as VraiFauxPayload;
      return [`La bonne réponse était : ${p.reponse ? "Vrai" : "Faux"}.`];
    }
    case "texte_trous": {
      const p = payload as TrousPayload;
      return p.reponses.map((r, i) => `Trou n°${i + 1} : « ${r[0] ?? "?"} »`);
    }
    case "ordre": {
      const p = payload as OrdrePayload;
      return p.elements.map((e, i) => `${i + 1}. ${e}`);
    }
    case "association": {
      const p = payload as AssociationPayload;
      return p.paires.map((paire) => `${paire.gauche} → ${paire.droite}`);
    }
    case "question_ouverte": {
      const p = payload as OuvertePayload;
      return p.corrigeType ? [`Corrigé type : ${p.corrigeType}`] : [];
    }
    case "video_interactive": {
      const p = payload as VideoInteractivePayload;
      return p.arrets.map((a, i) => {
        const bonne = a.options[a.correct] ?? "?";
        const suffixe = a.explication ? ` — ${a.explication}` : "";
        return `Question ${i + 1} : « ${bonne} »${suffixe}`;
      });
    }
    case "h5p":
      return [];
  }
}

// ----- Validation des payloads (création / édition) --------------------------

const vide = (s: unknown) => typeof s !== "string" || s.trim() === "";

export function validerPayload(
  type: TypeExercice,
  payload: PayloadExercice
): string | null {
  switch (type) {
    case "qcm": {
      const p = payload as QcmPayload;
      if (vide(p.question)) return "La question est obligatoire.";
      if (!Array.isArray(p.options) || p.options.length < 2)
        return "Il faut au moins 2 propositions.";
      if (p.options.some((o) => vide(o)))
        return "Toutes les propositions doivent être remplies.";
      if (p.options.length > 6) return "6 propositions maximum.";
      if (
        !Array.isArray(p.corrects) ||
        p.corrects.length < 1 ||
        p.corrects.some(
          (i) => typeof i !== "number" || i < 0 || i >= p.options.length
        )
      )
        return "Indiquez au moins une bonne réponse valide.";
      if (!p.multiple && p.corrects.length > 1)
        return "QCM à réponse unique : une seule bonne réponse possible.";
      return null;
    }
    case "vrai_faux": {
      const p = payload as VraiFauxPayload;
      if (vide(p.enonce)) return "L'affirmation est obligatoire.";
      if (typeof p.reponse !== "boolean")
        return "Choisissez la bonne réponse (vrai ou faux).";
      return null;
    }
    case "texte_trous": {
      const p = payload as TrousPayload;
      if (!p.reponses || p.reponses.length < 1)
        return "Le texte doit contenir au moins un trou entre accolades {comme ceci}.";
      if (p.reponses.length > 12) return "12 trous maximum.";
      if (p.reponses.some((r) => !r.length || r.some((a) => vide(a))))
        return "Chaque trou doit avoir au moins une réponse attendue.";
      if (p.segments.join("").trim().length < 2)
        return "Le texte autour des trous est trop court.";
      return null;
    }
    case "ordre": {
      const p = payload as OrdrePayload;
      if (!Array.isArray(p.elements) || p.elements.length < 2)
        return "Il faut au moins 2 éléments à remettre en ordre.";
      if (p.elements.length > 8) return "8 éléments maximum.";
      if (p.elements.some((e) => vide(e)))
        return "Tous les éléments doivent être remplis.";
      return null;
    }
    case "association": {
      const p = payload as AssociationPayload;
      if (!Array.isArray(p.paires) || p.paires.length < 2)
        return "Il faut au moins 2 paires à associer.";
      if (p.paires.length > 8) return "8 paires maximum.";
      if (p.paires.some((pa) => vide(pa.gauche) || vide(pa.droite)))
        return "Chaque paire doit avoir ses deux éléments remplis.";
      const droites = p.paires.map((pa) => normaliser(pa.droite));
      if (new Set(droites).size !== droites.length)
        return "Les éléments de droite doivent être différents.";
      return null;
    }
    case "question_ouverte": {
      const p = payload as OuvertePayload;
      if (vide(p.question)) return "La question est obligatoire.";
      return null;
    }
    case "video_interactive": {
      const p = payload as VideoInteractivePayload;
      if (vide(p.videoUrl)) return "L'adresse de la vidéo est obligatoire.";
      if (!Array.isArray(p.arrets) || p.arrets.length < 1)
        return "Ajoutez au moins une question à un moment de la vidéo.";
      if (p.arrets.length > 10) return "10 arrêts maximum par vidéo.";
      for (let i = 0; i < p.arrets.length; i++) {
        const a = p.arrets[i];
        if (!Number.isFinite(a.temps) || a.temps < 0)
          return `Arrêt n°${i + 1} : le moment de pause est invalide.`;
        if (vide(a.question))
          return `Arrêt n°${i + 1} : la question est obligatoire.`;
        if (!Array.isArray(a.options) || a.options.length < 2)
          return `Arrêt n°${i + 1} : il faut au moins 2 propositions.`;
        if (a.options.some((o) => vide(o)))
          return `Arrêt n°${i + 1} : toutes les propositions doivent être remplies.`;
        if (
          typeof a.correct !== "number" ||
          a.correct < 0 ||
          a.correct >= a.options.length
        )
          return `Arrêt n°${i + 1} : indiquez la bonne réponse.`;
      }
      return null;
    }
    case "h5p": {
      const p = payload as H5pPayload;
      if (vide(p.embedUrl))
        return "Collez l'adresse d'intégration (ou le code <iframe>) de l'activité H5P.";
      if (!/^https:\/\//i.test(p.embedUrl))
        return "L'adresse H5P doit commencer par https:// (intégration sécurisée).";
      if (!Number.isFinite(p.hauteur) || p.hauteur < 200 || p.hauteur > 1400)
        return "La hauteur doit être comprise entre 200 et 1400 pixels.";
      return null;
    }
  }
}

/** Génère un code de parrainage lisible : « CE2A-X7K2QM ». */
export function genererCodeParrainage(etiquette: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const base = etiquette
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  let suffixe = "";
  const octets =
    typeof crypto !== "undefined"
      ? crypto.getRandomValues(new Uint8Array(5))
      : Array.from({ length: 5 }, () => Math.floor(Math.random() * 256));
  for (const o of octets) suffixe += alphabet[o % alphabet.length];
  return `${base || "FABLE"}-${suffixe}`;
}
