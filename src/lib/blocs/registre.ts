import type { MetaBloc, TypeBloc, TypeBlocFutur, ContenuBloc } from "./types";
import type { LucideIcon } from "lucide-react";
import {
  Type as IconeTexte,
  Image as IconeImage,
  Volume2 as IconeAudio,
  Clapperboard as IconeVideo,
  ListChecks as IconeExercice,
  FileText,
  FileImage,
  Quote,
  MessageSquareQuote,
  Table2,
  Images,
  CircleHelp,
  Puzzle,
  Boxes,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Registre des types de blocs : c'est ICI qu'on ajoute un type futur, sans
// toucher à l'éditeur. actif=true → créable ; actif=false → carte « bientôt ».
// ---------------------------------------------------------------------------

export const REGISTRE_BLOCS: MetaBloc[] = [
  {
    type: "texte",
    nom: "Texte",
    description: "Paragraphes, gras, italique, listes et liens (Markdown).",
    actif: true,
  },
  {
    type: "image",
    nom: "Image",
    description: "Illustration par upload ou URL, avec texte alternatif.",
    actif: true,
  },
  {
    type: "audio",
    nom: "Audio",
    description: "Narration ou consigne écoutée (MP3, WAV, OGG).",
    actif: true,
  },
  {
    type: "video",
    nom: "Vidéo",
    description: "Fichier, YouTube ou Vimeo, validée par une liste blanche.",
    actif: true,
  },
  {
    type: "exercice",
    nom: "Exercice",
    description: "L'un des 8 types existants, préparé dans le moteur Fablio.",
    actif: true,
  },
  // ----- Cartes d'extensibilité (inactives en V1) -----
  { type: "document", nom: "Document", description: "Fichier téléchargeable.", actif: false },
  { type: "pdf", nom: "PDF", description: "Document PDF intégré à la page.", actif: false },
  { type: "citation", nom: "Citation", description: "Extrait mis en valeur.", actif: false },
  { type: "encadre", nom: "Encadré", description: "Information, astuce ou avertissement.", actif: false },
  { type: "tableau", nom: "Tableau", description: "Données en lignes et colonnes.", actif: false },
  { type: "galerie", nom: "Galerie", description: "Plusieurs images côte à côte.", actif: false },
  { type: "question", nom: "Question", description: "Question de réflexion sans notation.", actif: false },
  { type: "activite", nom: "Activité", description: "Activité interactive générique.", actif: false },
  { type: "h5p", nom: "H5P", description: "Activité H5P autonome.", actif: false },
];

export const ICONES_BLOCS: Record<string, LucideIcon> = {
  texte: IconeTexte,
  image: IconeImage,
  audio: IconeAudio,
  video: IconeVideo,
  exercice: IconeExercice,
  document: FileText,
  pdf: FileImage,
  citation: Quote,
  encadre: MessageSquareQuote,
  tableau: Table2,
  galerie: Images,
  question: CircleHelp,
  activite: Puzzle,
  h5p: Boxes,
};

export function metaBloc(type: string): MetaBloc {
  return (
    REGISTRE_BLOCS.find((m) => m.type === type) ??
    REGISTRE_BLOCS[0]
  );
}

export function estTypeBlocActif(type: string): type is TypeBloc {
  return TYPES_ACTIFS.has(type as TypeBloc);
}

const TYPES_ACTIFS = new Set<TypeBloc>(
  REGISTRE_BLOCS.filter((m) => m.actif).map((m) => m.type as TypeBloc)
);

// ----- Valeurs par défaut ----------------------------------------------------

export function contenuParDefaut(type: TypeBloc): ContenuBloc {
  switch (type) {
    case "texte":
      return { markdown: "" };
    case "image":
      return { source: "url", url: "", alt: "", legende: "" };
    case "audio":
      return { source: "url", url: "", titre: "", description: "" };
    case "video":
      return { source: "youtube", url: "", titre: "", description: "" };
    case "exercice":
      return {};
  }
}
