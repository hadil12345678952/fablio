import "server-only";
import { configMoodle, tokenMoodle } from "./config";

// ---------------------------------------------------------------------------
// Client HTTP pour les web services Moodle (endpoint REST standard) :
//   POST {MOODLE_URL}/webservice/rest/server.php
//   corps form-urlencoded : wstoken, wsfunction, moodlewsrestformat=json + params
//
// Robustesse exigée :
//   - timeout (12 s) via AbortController ;
//   - 1 nouvel essai uniquement sur panne réseau / 5xx (jamais sur erreur métier) ;
//   - erreurs métier Moodle détectées ({exception, errorcode, message}) ;
//   - une indisponibilité Moodle ne doit JAMAIS faire planter la plateforme :
//     on lève MoodleIndisponible, capturée par les appelants (mode dégradé).
// ---------------------------------------------------------------------------

export class ErreurMoodle extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ErreurMoodle";
  }
}

export class MoodleIndisponible extends ErreurMoodle {
  constructor(message: string) {
    super(message);
    this.name = "MoodleIndisponible";
  }
}

const TIMEOUT_MS = 12_000;

/** Met les paramètres au format Moodle : users[0][username]=… */
function aplatir(
  valeur: unknown,
  prefixe: string,
  sortie: URLSearchParams
): void {
  if (Array.isArray(valeur)) {
    valeur.forEach((v, i) => aplatir(v, `${prefixe}[${i}]`, sortie));
    return;
  }
  if (valeur !== null && typeof valeur === "object") {
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      aplatir(v, `${prefixe}[${cle}]`, sortie);
    }
    return;
  }
  if (valeur !== undefined && valeur !== null) {
    sortie.append(prefixe, String(valeur));
  }
}

export async function appelerMoodle<T = unknown>(
  fonction: string,
  parametres: Record<string, unknown> = {}
): Promise<T> {
  const { url } = configMoodle();
  const token = tokenMoodle();
  if (!url || !token) {
    throw new MoodleIndisponible(
      "Moodle n'est pas configuré : renseignez MOODLE_URL et MOODLE_TOKEN côté serveur."
    );
  }

  const corps = new URLSearchParams();
  corps.set("wstoken", token);
  corps.set("wsfunction", fonction);
  corps.set("moodlewsrestformat", "json");
  for (const [cle, valeur] of Object.entries(parametres)) {
    aplatir(valeur, cle, corps);
  }

  let derniereErreur: unknown = null;
  for (let essai = 0; essai < 2; essai++) {
    const controleur = new AbortController();
    const chrono = setTimeout(() => controleur.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${url}/webservice/rest/server.php`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: corps,
        signal: controleur.signal,
        cache: "no-store",
      });
      clearTimeout(chrono);

      if (res.status >= 500)
        throw new MoodleIndisponible(`Moodle a répondu ${res.status} (serveur indisponible).`);
      if (!res.ok) throw new ErreurMoodle(`Moodle a répondu ${res.status}.`);

      const json = (await res.json()) as unknown;
      // Moodle signale ses erreurs métier dans le corps JSON, même en HTTP 200.
      if (json !== null && typeof json === "object" && !Array.isArray(json)) {
        const obj = json as { exception?: string; errorcode?: string; message?: string };
        if (obj.exception || obj.errorcode) {
          throw new ErreurMoodle(
            obj.message ?? "Erreur Moodle inconnue.",
            obj.errorcode ?? obj.exception
          );
        }
      }
      return json as T;
    } catch (e) {
      clearTimeout(chrono);
      // Erreurs métier : inutile de réessayer.
      if (e instanceof ErreurMoodle) throw e;
      derniereErreur = e;
    }
  }
  console.error("[moodle] indisponible après nouvel essai :", derniereErreur);
  throw new MoodleIndisponible(
    "Moodle ne répond pas (délai dépassé ou serveur injoignable). Réessayez dans quelques instants."
  );
}
