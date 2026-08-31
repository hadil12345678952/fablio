import { erreurJson, lireCorps, chaine } from "@/lib/api";
import { lireSession } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/tts  →  { texte, voix? }  →  audio/mpeg
//
// Synthèse vocale (lecture à voix haute des fables) via une API externe.
// Deux fournisseurs, dans l'ordre :
//   1. OpenAI TTS  — si la variable d'environnement OPENAI_API_KEY est définie
//                    (voix naturelle de haute qualité).
//   2. Google Translate TTS — service public gratuit, sans clé : utilisé par
//                    défaut. Limité à ~200 caractères par appel, on découpe
//                    donc le texte puis on concatène les segments MP3.
//
// La clé API reste TOUJOURS côté serveur : le navigateur n'appelle que cette
// route. Si tout échoue, le client bascule sur la voix intégrée du navigateur.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_CARACTERES = 4000;

/** Découpe le texte en segments ≤ maxLongueur, en respectant la ponctuation. */
function decouper(texte: string, maxLongueur = 190): string[] {
  const phrases = texte
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;:…»])\s+/)
    .filter(Boolean);

  const segments: string[] = [];
  let courant = "";

  const pousser = () => {
    if (courant.trim()) segments.push(courant.trim());
    courant = "";
  };

  for (const phrase of phrases) {
    if (phrase.length > maxLongueur) {
      pousser();
      // Phrase très longue : on coupe sur les virgules puis en tranches.
      let reste = phrase;
      while (reste.length > maxLongueur) {
        const fenetre = reste.slice(0, maxLongueur);
        const coupe = Math.max(fenetre.lastIndexOf(", "), fenetre.lastIndexOf(" "));
        const indice = coupe > 40 ? coupe : maxLongueur;
        segments.push(reste.slice(0, indice).trim());
        reste = reste.slice(indice).trim();
      }
      if (reste) courant = reste;
      continue;
    }
    if ((courant + " " + phrase).trim().length > maxLongueur) pousser();
    courant = (courant + " " + phrase).trim();
  }
  pousser();
  return segments;
}

/** Fournisseur 1 : OpenAI (si clé disponible). */
async function viaOpenAi(texte: string, cle: string): Promise<ArrayBuffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cle}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE ?? "shimmer",
      input: texte.slice(0, LIMITE_CARACTERES),
      response_format: "mp3",
      speed: 0.95,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}`);
  return res.arrayBuffer();
}

/** Fournisseur 2 : Google Translate TTS (gratuit, sans clé). */
async function viaGoogleTranslate(texte: string): Promise<ArrayBuffer> {
  const segments = decouper(texte);
  const morceaux: Uint8Array[] = [];

  for (const [index, segment] of segments.entries()) {
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fr" +
      `&total=${segments.length}&idx=${index}&textlen=${segment.length}` +
      `&q=${encodeURIComponent(segment)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Google TTS ${res.status}`);
    morceaux.push(new Uint8Array(await res.arrayBuffer()));
  }

  // Les trames MP3 se concatènent directement.
  const total = morceaux.reduce((n, m) => n + m.byteLength, 0);
  const sortie = new Uint8Array(total);
  let position = 0;
  for (const m of morceaux) {
    sortie.set(m, position);
    position += m.byteLength;
  }
  return sortie.buffer as ArrayBuffer;
}

export async function POST(req: Request) {
  // Réservé aux utilisateurs connectés (élève ou enseignant).
  const session = await lireSession();
  if (!session) return erreurJson("Authentification requise.", 401);

  const corps = await lireCorps(req);
  const texte = chaine(corps?.texte).slice(0, LIMITE_CARACTERES);
  if (texte.length < 2) return erreurJson("Texte à lire manquant.");

  const cleOpenAi = process.env.OPENAI_API_KEY;

  try {
    const audio = cleOpenAi
      ? await viaOpenAi(texte, cleOpenAi)
      : await viaGoogleTranslate(texte);

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Fournisseur-Tts": cleOpenAi ? "openai" : "google-translate",
      },
    });
  } catch (premiereErreur) {
    // Repli : si OpenAI échoue (quota, clé invalide…), on tente le gratuit.
    if (cleOpenAi) {
      try {
        const audio = await viaGoogleTranslate(texte);
        return new Response(audio, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "private, max-age=3600",
            "X-Fournisseur-Tts": "google-translate (repli)",
          },
        });
      } catch {
        /* on tombe dans l'erreur ci-dessous */
      }
    }
    console.error("Échec de la synthèse vocale :", premiereErreur);
    return erreurJson(
      "La lecture à voix haute est momentanément indisponible. La voix du navigateur va être utilisée.",
      502
    );
  }
}
