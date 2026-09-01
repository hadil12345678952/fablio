// Validation des champs des formulaires (serveur) — types discriminés propres.
import { chaine } from "@/lib/api";
import {
  TYPES_EXERCICES,
  validerPayload,
  type PayloadExercice,
  type TypeExercice,
} from "@/lib/exercices";
import {
  normaliserUrlH5p,
  normaliserUrlImage,
  normaliserVideo,
  urlImageValide,
} from "@/lib/medias";

export type Valide<T> = { ok: true; donnees: T } | { ok: false; erreur: string };

export const DIFFICULTES = ["facile", "moyen", "difficile"] as const;
export type Difficulte = (typeof DIFFICULTES)[number];

export interface DonneesFable {
  titre: string;
  texte: string;
  morale: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl: string;
  difficulte: Difficulte;
  publie: boolean;
  cibleCodeIds: string[];
}

export function validerChampsFable(
  corps: Record<string, unknown>
): Valide<DonneesFable> {
  const titre = chaine(corps.titre);
  const texte = chaine(corps.texte);
  const morale = chaine(corps.morale);
  // Les liens de partage (Google Drive, Dropbox…) sont convertis en URL
  // directement affichable : c'est ce qui est stocké en base.
  const imageUrl = normaliserUrlImage(chaine(corps.imageUrl));
  const audioUrl = chaine(corps.audioUrl);
  const videoUrl = chaine(corps.videoUrl);
  const difficulteBrute = chaine(corps.difficulte) || "facile";
  const publie = corps.publie === true;
  const cibleBrutes = Array.isArray(corps.cibleCodeIds) ? corps.cibleCodeIds : [];
  const cibleCodeIds = cibleBrutes.filter(
    (c): c is string => typeof c === "string"
  );

  if (titre.length < 2 || titre.length > 120)
    return { ok: false, erreur: "Le titre doit contenir entre 2 et 120 caractères." };
  if (texte.length < 10)
    return { ok: false, erreur: "Le texte de la fable est trop court (10 caractères min.)." };
  if (morale.length > 300)
    return { ok: false, erreur: "La morale est trop longue (300 max.)." };
  if (!DIFFICULTES.includes(difficulteBrute as Difficulte))
    return { ok: false, erreur: "Niveau de difficulté invalide." };
  if (imageUrl !== "" && !urlImageValide(imageUrl))
    return {
      ok: false,
      erreur:
        "Lien d'image invalide : collez une adresse commençant par https:// (ou un lien de partage Google Drive).",
    };
  if (videoUrl !== "" && normaliserVideo(videoUrl).fournisseur === "inconnu")
    return {
      ok: false,
      erreur:
        "Lien vidéo non reconnu : utilisez YouTube, Vimeo, Google Drive ou un fichier .mp4.",
    };

  return {
    ok: true,
    donnees: {
      titre,
      texte,
      morale,
      imageUrl,
      audioUrl,
      videoUrl,
      difficulte: difficulteBrute as Difficulte,
      publie,
      cibleCodeIds,
    },
  };
}

export interface DonneesExercice {
  type: TypeExercice;
  consigne: string;
  points: number;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  publie: boolean;
  maxTentatives: number | null;
  moodleQuizId: number | null;
  payload: PayloadExercice;
}

export function validerChampsExercice(
  corps: Record<string, unknown>
): Valide<DonneesExercice> {
  const type = chaine(corps.type) as TypeExercice;
  if (!TYPES_EXERCICES.includes(type))
    return { ok: false, erreur: "Type d'exercice invalide." };

  const consigne = chaine(corps.consigne);
  const pointsBrut = Number(corps.points ?? 10);
  const points = Number.isFinite(pointsBrut)
    ? Math.min(100, Math.max(1, Math.round(pointsBrut)))
    : 10;
  const feedbackCorrect = chaine(corps.feedbackCorrect).slice(0, 300);
  const feedbackIncorrect = chaine(corps.feedbackIncorrect).slice(0, 300);
  const publie = corps.publie !== false;
  const maxBrut = corps.maxTentatives;
  const maxTentatives =
    maxBrut === null || maxBrut === undefined || maxBrut === ""
      ? null
      : Math.min(20, Math.max(1, Math.round(Number(maxBrut)) || 1));
  // Liaison facultative à un quiz Moodle existant (ID numérique dans Moodle).
  const quizBrut = corps.moodleQuizId;
  let moodleQuizId: number | null = null;
  if (quizBrut !== null && quizBrut !== undefined && quizBrut !== "") {
    const n = Math.round(Number(quizBrut));
    if (!Number.isInteger(n) || n <= 0 || n > 1_000_000_000)
      return { ok: false, erreur: "L'identifiant du quiz Moodle doit être un nombre entier positif." };
    moodleQuizId = n;
  }

  let payload = corps.payload as PayloadExercice;
  if (!payload || typeof payload !== "object")
    return { ok: false, erreur: "Paramètres de l'exercice manquants." };

  // H5P : l'enseignant peut coller le code <iframe> complet ou l'URL de la
  // page de contenu — on en extrait toujours l'adresse d'intégration.
  if (type === "h5p") {
    const p = payload as { embedUrl?: unknown };
    payload = {
      ...(payload as object),
      embedUrl: normaliserUrlH5p(chaine(p.embedUrl)),
    } as PayloadExercice;
  }

  const erreurPayload = validerPayload(type, payload);
  if (erreurPayload) return { ok: false, erreur: erreurPayload };

  return {
    ok: true,
    donnees: {
      type,
      consigne,
      points,
      feedbackCorrect,
      feedbackIncorrect,
      publie,
      maxTentatives,
      moodleQuizId,
      payload,
    },
  };
}
