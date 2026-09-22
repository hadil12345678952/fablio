import type { TypeBloc, ContenuBloc, ContenuTexte, ContenuImage, ContenuAudio, ContenuVideo } from "./types";
import { melanger } from "@/lib/exercices";
import { normaliserVideo } from "@/lib/medias";

// ---------------------------------------------------------------------------
// Validation des contenus de blocs.
//
// Deux niveaux :
//   - brouillon (défaut) : tolère les champs vides (l'enseignant construit
//     progressivement) ; refuse uniquement les données présentes mais
//     invalides (HTML actif, adresse mal formée, source vidéo inconnue).
//   - strict : exige un bloc complet — utilisé UNIQUEMENT avant publication.
//
// Ainsi, ajouter un bloc vide ne renvoie plus jamais un 400 : l'enseignant
// le complète ensuite ; la publication reste exigeante.
// ---------------------------------------------------------------------------

const vide = (s: unknown) => typeof s !== "string" || s.trim() === "";

export interface OptionsValidationBloc {
  /** strict = true → exige un bloc complet (validation avant publication). */
  strict?: boolean;
}

export function validerContenuBloc(
  type: TypeBloc,
  contenu: ContenuBloc,
  options: OptionsValidationBloc = {}
): string | null {
  const strict = options.strict === true;
  switch (type) {
    case "texte": {
      const c = contenu as ContenuTexte;
      if (typeof c.markdown !== "string")
        return "Le contenu du texte est invalide.";
      // Sécurité : le HTML actif est refusé à tout moment, brouillon compris.
      if (/<\/?(script|iframe|object|embed)/i.test(c.markdown))
        return "Le HTML actif (script, iframe…) n'est pas autorisé dans le texte.";
      if (strict && vide(c.markdown)) return "Le contenu du texte est vide.";
      return null;
    }
    case "image": {
      const c = contenu as ContenuImage;
      if (!vide(c.url) && !/^https?:\/\//i.test(c.url) && !c.url.startsWith("/"))
        return "L'adresse de l'image doit commencer par https:// (ou être locale).";
      if (strict) {
        if (vide(c.url)) return "Indiquez l'adresse de l'image.";
        if (vide(c.alt))
          return "Le texte alternatif est obligatoire (accessibilité).";
      }
      return null;
    }
    case "audio": {
      const c = contenu as ContenuAudio;
      if (!vide(c.url) && !/^https?:\/\//i.test(c.url) && !c.url.startsWith("/"))
        return "L'adresse de l'audio doit commencer par https:// (ou être locale).";
      if (strict && vide(c.url)) return "Indiquez l'adresse du fichier audio.";
      return null;
    }
    case "video": {
      const c = contenu as ContenuVideo;
      // Une URL présente mais non reconnue est toujours refusée (liste blanche).
      if (!vide(c.url)) {
        const v = normaliserVideo(c.url);
        if (v.fournisseur === "inconnu")
          return "Source non autorisée : utilisez YouTube, Vimeo ou un fichier .mp4.";
      } else if (strict) {
        return "Indiquez l'adresse de la vidéo.";
      }
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
