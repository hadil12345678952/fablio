import type { TypeBloc, ContenuBloc, ContenuTexte, ContenuImage, ContenuAudio, ContenuVideo } from "./types";
import { melanger } from "@/lib/exercices";
import { normaliserVideo } from "@/lib/medias";

// ---------------------------------------------------------------------------
// Validation des contenus de blocs — utilisée à la création, à l'édition et
// avant publication. Logique pure, sans accès réseau.
// ---------------------------------------------------------------------------

const vide = (s: unknown) => typeof s !== "string" || s.trim() === "";

export function validerContenuBloc(
  type: TypeBloc,
  contenu: ContenuBloc
): string | null {
  switch (type) {
    case "texte": {
      const c = contenu as ContenuTexte;
      if (vide(c.markdown)) return "Le contenu du texte est vide.";
      if (/<\/?(script|iframe|object|embed)/i.test(c.markdown))
        return "Le HTML actif (script, iframe…) n'est pas autorisé dans le texte.";
      return null;
    }
    case "image": {
      const c = contenu as ContenuImage;
      if (vide(c.url)) return "Indiquez l'adresse de l'image.";
      if (!/^https?:\/\//i.test(c.url) && !c.url.startsWith("/"))
        return "L'adresse de l'image doit commencer par https:// (ou être locale).";
      if (vide(c.alt)) return "Le texte alternatif est obligatoire (accessibilité).";
      return null;
    }
    case "audio": {
      const c = contenu as ContenuAudio;
      if (vide(c.url)) return "Indiquez l'adresse du fichier audio.";
      if (!/^https?:\/\//i.test(c.url) && !c.url.startsWith("/"))
        return "L'adresse de l'audio doit commencer par https:// (ou être locale).";
      return null;
    }
    case "video": {
      const c = contenu as ContenuVideo;
      if (vide(c.url)) return "Indiquez l'adresse de la vidéo.";
      const v = normaliserVideo(c.url);
      if (v.fournisseur === "inconnu")
        return "Source non autorisée : utilisez YouTube, Vimeo ou un fichier .mp4.";
      return null;
    }
    case "exercice":
      // La référence vit dans la colonne exercice_id ; rien à valider dans contenu.
      return null;
  }
}

// ----- Résumé lisible pour l'éditeur -----------------------------------------

export function resumeBloc(type: TypeBloc, contenu: ContenuBloc, extra?: { titreExercice?: string }): string {
  switch (type) {
    case "texte": {
      const c = contenu as ContenuTexte;
      const brut = c.markdown.replace(/[*_`#>\[\]]/g, "").replace(/\s+/g, " ").trim();
      return brut.length > 90 ? `${brut.slice(0, 90)}…` : brut || "Texte vide";
    }
    case "image": {
      const c = contenu as ContenuImage;
      return c.alt || "Illustration";
    }
    case "audio": {
      const c = contenu as ContenuAudio;
      return c.titre || "Piste audio";
    }
    case "video": {
      const c = contenu as ContenuVideo;
      return c.titre || "Vidéo";
    }
    case "exercice":
      return extra?.titreExercice || "Exercice";
  }
}

// Ré-export pratique (réutilisé dans des rendus variés).
export { melanger };
