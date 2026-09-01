import "server-only";

// ---------------------------------------------------------------------------
// Configuration de l'intégration Moodle — UNIQUEMENT par variables
// d'environnement côté serveur. Le token n'est jamais exposé : il ne quitte
// pas ce dossier (aucun appel depuis un composant client).
//
//   MOODLE_URL=https://moodle.mon-etablissement.tn
//   MOODLE_TOKEN=<jeton du service web>
//   MOODLE_SERVICE=nom du service externe (affichage/diagnostic)
//   MOODLE_CATEGORY_ID=id de la catégorie de cours (défaut : 1)
// ---------------------------------------------------------------------------

export interface ConfigurationMoodle {
  configure: boolean;
  url: string;
  service: string;
  categorieId: number;
}

export function configMoodle(): ConfigurationMoodle {
  const url = (process.env.MOODLE_URL ?? "").trim().replace(/\/+$/, "");
  const token = (process.env.MOODLE_TOKEN ?? "").trim();
  return {
    configure: url.startsWith("http") && token.length > 0,
    url,
    service: process.env.MOODLE_SERVICE?.trim() || "service Moodle par défaut",
    categorieId: Number(process.env.MOODLE_CATEGORY_ID) || 1,
  };
}

/** Le jeton n'est lu qu'ici, au moment posté vers Moodle. */
export function tokenMoodle(): string {
  return (process.env.MOODLE_TOKEN ?? "").trim();
}
