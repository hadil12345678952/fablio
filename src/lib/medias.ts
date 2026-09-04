// ---------------------------------------------------------------------------
// Normalisation des médias fournis par l'enseignant (images, vidéos, H5P).
// Logique pure : utilisable côté serveur ET client.
// ---------------------------------------------------------------------------

// ----- Images ---------------------------------------------------------------

/**
 * Transforme un lien de partage en URL d'image directement affichable.
 * Gère Google Drive, Dropbox, OneDrive et les liens directs classiques.
 *
 *  https://drive.google.com/file/d/ABC123/view?usp=sharing
 *      → https://lh3.googleusercontent.com/d/ABC123=w1600
 */
export function normaliserUrlImage(url: string): string {
  const brut = (url ?? "").trim();
  if (brut === "") return "";

  // Chemin local du projet (ex. /images/fables/…)
  if (brut.startsWith("/")) return brut;

  // --- Google Drive -------------------------------------------------------
  const drive =
    brut.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/) ??
    brut.match(/drive\.google\.com\/open\?id=([\w-]{10,})/) ??
    brut.match(/drive\.google\.com\/uc\?[^ ]*id=([\w-]{10,})/) ??
    brut.match(/docs\.google\.com\/uc\?[^ ]*id=([\w-]{10,})/);
  if (drive) return `https://lh3.googleusercontent.com/d/${drive[1]}=w1600`;

  // Lien Google Photos/Usercontent déjà direct
  if (/lh\d\.googleusercontent\.com/.test(brut)) return brut;

  // --- Dropbox ------------------------------------------------------------
  if (/dropbox\.com\//.test(brut)) {
    return brut
      .replace(/([?&])dl=0/, "$1raw=1")
      .replace(/www\.dropbox\.com/, "dl.dropboxusercontent.com");
  }

  // --- OneDrive / SharePoint ---------------------------------------------
  if (/1drv\.ms|onedrive\.live\.com/.test(brut) && !/download/.test(brut)) {
    return brut.includes("?") ? `${brut}&download=1` : `${brut}?download=1`;
  }

  return brut;
}

/** Vrai si l'URL semble utilisable comme image (après normalisation). */
export function urlImageValide(url: string): boolean {
  const u = normaliserUrlImage(url);
  if (u === "") return false;
  return u.startsWith("/") || /^https?:\/\//i.test(u);
}

// ----- Vidéos ---------------------------------------------------------------

export type FournisseurVideo = "youtube" | "vimeo" | "fichier" | "drive" | "inconnu";

export interface VideoNormalisee {
  fournisseur: FournisseurVideo;
  /** Identifiant (YouTube/Vimeo/Drive) ou URL du fichier. */
  identifiant: string;
  /** URL prête pour un <iframe> (YouTube, Vimeo, Drive). */
  urlIframe: string;
  /** URL prête pour une balise <video> (fichiers .mp4/.webm/.ogg). */
  urlFichier: string;
  /**
   * Vrai si la lecture peut être pilotée par la plateforme (pause automatique
   * aux moments choisis par l'enseignant). YouTube + fichiers uniquement.
   */
  interactif: boolean;
}

export function normaliserVideo(url: string): VideoNormalisee {
  const brut = (url ?? "").trim();
  const vide: VideoNormalisee = {
    fournisseur: "inconnu",
    identifiant: "",
    urlIframe: "",
    urlFichier: "",
    interactif: false,
  };
  if (brut === "") return vide;

  // --- YouTube ------------------------------------------------------------
  const yt =
    brut.match(/youtube\.com\/watch\?[^ ]*v=([\w-]{6,})/) ??
    brut.match(/youtu\.be\/([\w-]{6,})/) ??
    brut.match(/youtube\.com\/embed\/([\w-]{6,})/) ??
    brut.match(/youtube\.com\/shorts\/([\w-]{6,})/) ??
    brut.match(/youtube-nocookie\.com\/embed\/([\w-]{6,})/);
  if (yt) {
    return {
      fournisseur: "youtube",
      identifiant: yt[1],
      urlIframe: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1&enablejsapi=1`,
      urlFichier: "",
      interactif: true,
    };
  }

  // --- Fichier vidéo direct ----------------------------------------------
  if (/\.(mp4|webm|ogg|ogv|m4v)(\?|#|$)/i.test(brut) || brut.startsWith("/")) {
    return {
      fournisseur: "fichier",
      identifiant: brut,
      urlIframe: "",
      urlFichier: brut,
      interactif: true,
    };
  }

  // --- Vimeo --------------------------------------------------------------
  const vimeo = brut.match(/vimeo\.com\/(?:video\/)?(\d{5,})/);
  if (vimeo) {
    return {
      fournisseur: "vimeo",
      identifiant: vimeo[1],
      urlIframe: `https://player.vimeo.com/video/${vimeo[1]}`,
      urlFichier: "",
      interactif: false,
    };
  }

  // --- Google Drive (lecture simple, pilotage impossible) -----------------
  const drive =
    brut.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/) ??
    brut.match(/drive\.google\.com\/open\?id=([\w-]{10,})/);
  if (drive) {
    return {
      fournisseur: "drive",
      identifiant: drive[1],
      urlIframe: `https://drive.google.com/file/d/${drive[1]}/preview`,
      urlFichier: "",
      interactif: false,
    };
  }

  return vide;
}

export const ETIQUETTES_FOURNISSEUR: Record<FournisseurVideo, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  fichier: "Fichier vidéo (MP4)",
  drive: "Google Drive",
  inconnu: "Lien non reconnu",
};

/** Convertit "1:35" ou "95" en secondes. */
export function tempsEnSecondes(saisie: string): number {
  const s = (saisie ?? "").trim();
  if (s === "") return 0;
  if (s.includes(":")) {
    const parties = s.split(":").map((p) => Number(p.trim()) || 0);
    return parties.reduce((total, p) => total * 60 + p, 0);
  }
  return Math.max(0, Math.round(Number(s) || 0));
}

/** Convertit 95 en "1:35". */
export function secondesEnTemps(secondes: number): string {
  const s = Math.max(0, Math.round(secondes || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// ----- H5P ------------------------------------------------------------------

/**
 * Extrait l'URL d'intégration H5P depuis :
 *  - un code <iframe src="…/embed"> complet copié depuis H5P,
 *  - une URL d'embed directe (h5p.org, h5p.com, Lumi, WordPress, LMS…),
 *  - une URL de page de contenu h5p.org (convertie en /h5p/embed/ID).
 */
export function normaliserUrlH5p(saisie: string): string {
  const brut = (saisie ?? "").trim();
  if (brut === "") return "";

  // Code d'intégration complet : on récupère l'attribut src.
  const srcIframe = brut.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  const url = (srcIframe ? srcIframe[1] : brut).trim();

  if (!/^https?:\/\//i.test(url)) return "";

  // Page de contenu h5p.org → URL d'intégration
  const pageOrg = url.match(/^https?:\/\/h5p\.org\/(?:node\/)?(\d+)(?:[/?#]|$)/i);
  if (pageOrg) return `https://h5p.org/h5p/embed/${pageOrg[1]}`;

  // h5p.com : .../content/123456 → .../content/123456/embed
  const pageCom = url.match(/^(https?:\/\/[\w.-]*h5p\.com\/content\/\d+)(?:\/)?$/i);
  if (pageCom) return `${pageCom[1]}/embed`;

  return url;
}

/** Contrôle de sécurité : n'accepte que du HTTPS et des hôtes plausibles. */
export function urlH5pValide(url: string): boolean {
  const u = normaliserUrlH5p(url);
  if (!/^https:\/\//i.test(u)) return false;
  return /\/embed|h5p/i.test(u);
}
