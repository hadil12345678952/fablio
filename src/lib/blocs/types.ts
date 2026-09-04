// ---------------------------------------------------------------------------
// Blocs pédagogiques — types et contenus typés (purs, client ET serveur).
// L'ajout d'un futur type ne modifie qu'une entrée du registre.
// ---------------------------------------------------------------------------

// Types livrés en V1.
export const TYPES_BLOCS = [
  "texte",
  "image",
  "audio",
  "video",
  "exercice",
] as const;
export type TypeBloc = (typeof TYPES_BLOCS)[number];

// Types prévus pour l'extensibilité (registre : actif = false pour l'instant).
export const TYPES_BLOCS_FUTURS = [
  "document",
  "pdf",
  "citation",
  "encadre",
  "tableau",
  "galerie",
  "question",
  "activite",
  "h5p",
] as const;
export type TypeBlocFutur = (typeof TYPES_BLOCS_FUTURS)[number];

// ----- Contenus ------------------------------------------------------------

export interface ContenuTexte {
  markdown: string;
}

export interface ContenuImage {
  source: "url" | "bibliotheque";
  url: string;
  alt: string;
  legende: string;
}

export interface ContenuAudio {
  source: "url" | "bibliotheque";
  url: string;
  titre: string;
  description: string;
}

export interface ContenuVideo {
  source: "youtube" | "vimeo" | "fichier" | "drive";
  url: string;
  titre: string;
  description: string;
}

/** Le bloc exercice ne porte PAS de logique : il référence un exercice existant. */
export interface ContenuExercice {
  // vide : la référence vit dans la colonne dédiée blocs_fable.exercice_id
}

/** Format exposé par /api/enseignant/fables/:id → exercicesDeFable() */
export interface ExerciceEditable {
  id: string;
  fableId: string;
  type: string;
  typeEtiquette: string;
  consigne: string;
  payload: unknown;
  points: number;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  ordre: number;
  publie: boolean;
  maxTentatives: number | null;
}

export type ContenuBloc =
  | ContenuTexte
  | ContenuImage
  | ContenuAudio
  | ContenuVideo
  | ContenuExercice
  | Record<string, unknown>;

// ----- Bloc mis en forme pour l'UI (client & serveur) -----------------------

export interface BlocVue {
  id: string;
  fableId: string;
  type: TypeBloc;
  ordre: number;
  titre: string;
  contenu: ContenuBloc;
  exerciceId: string | null;
  visible: boolean;
  modifieLeISO: string;
}

// ----- Métiers du registre ---------------------------------------------------

export interface MetaBloc {
  type: TypeBloc | TypeBlocFutur;
  nom: string;
  description: string;
  /** true = créable dès maintenant ; false = affiché « bientôt ». */
  actif: boolean;
}
