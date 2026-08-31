"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  CircleHelp,
  Check,
  Clock,
  Film,
  TriangleAlert,
} from "lucide-react";
import type { ArretVideo } from "@/lib/exercices";
import { normaliserVideo, secondesEnTemps } from "@/lib/medias";

// ---------------------------------------------------------------------------
// Chargement à la demande de l'API IFrame de YouTube
// ---------------------------------------------------------------------------

interface LecteurYoutube {
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  seekTo(secondes: number, exact: boolean): void;
  destroy(): void;
}
interface ApiYoutube {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>
  ) => LecteurYoutube;
}
type FenetreYt = Window & {
  YT?: ApiYoutube;
  onYouTubeIframeAPIReady?: () => void;
};

let promesseApiYt: Promise<ApiYoutube> | null = null;

function chargerApiYoutube(): Promise<ApiYoutube> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const fenetre = window as FenetreYt;
  if (fenetre.YT?.Player) return Promise.resolve(fenetre.YT);
  if (promesseApiYt) return promesseApiYt;

  promesseApiYt = new Promise<ApiYoutube>((resolve, reject) => {
    const precedent = fenetre.onYouTubeIframeAPIReady;
    fenetre.onYouTubeIframeAPIReady = () => {
      precedent?.();
      if (fenetre.YT?.Player) resolve(fenetre.YT);
      else reject(new Error("API YouTube indisponible"));
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Chargement YouTube impossible"));
    document.body.appendChild(script);
    setTimeout(() => reject(new Error("Délai dépassé")), 12000);
  });
  return promesseApiYt;
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function VideoInteractive({
  videoUrl,
  arrets,
  verrouille,
  onReponses,
}: {
  videoUrl: string;
  arrets: ArretVideo[];
  verrouille: boolean;
  onReponses: (reponses: (number | null)[], complet: boolean) => void;
}) {
  const video = normaliserVideo(videoUrl);
  const [reponses, setReponses] = useState<(number | null)[]>(() =>
    arrets.map(() => null)
  );
  const [arretActif, setArretActif] = useState<number | null>(null);
  const [pret, setPret] = useState(video.fournisseur !== "youtube");
  const [erreur, setErreur] = useState<string | null>(null);

  const conteneurYt = useRef<HTMLDivElement | null>(null);
  const lecteurYt = useRef<LecteurYoutube | null>(null);
  const videoHtml = useRef<HTMLVideoElement | null>(null);
  const traites = useRef<Set<number>>(new Set());

  const mettreEnPause = useCallback(() => {
    lecteurYt.current?.pauseVideo();
    videoHtml.current?.pause();
  }, []);

  const reprendre = useCallback(() => {
    lecteurYt.current?.playVideo();
    void videoHtml.current?.play();
  }, []);

  /** Vérifie s'il faut interrompre la lecture à l'instant `temps`. */
  const verifierArrets = useCallback(
    (temps: number) => {
      if (verrouille) return;
      for (let i = 0; i < arrets.length; i++) {
        if (traites.current.has(i)) continue;
        if (temps >= arrets[i].temps) {
          traites.current.add(i);
          mettreEnPause();
          setArretActif(i);
          break;
        }
      }
    },
    [arrets, mettreEnPause, verrouille]
  );

  // --- Lecteur YouTube ------------------------------------------------------
  useEffect(() => {
    if (video.fournisseur !== "youtube" || !conteneurYt.current) return;
    let annule = false;
    let minuteur: ReturnType<typeof setInterval> | null = null;

    chargerApiYoutube()
      .then((YT) => {
        if (annule || !conteneurYt.current) return;
        lecteurYt.current = new YT.Player(conteneurYt.current, {
          videoId: video.identifiant,
          host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => {
              if (!annule) setPret(true);
            },
          },
        });
        minuteur = setInterval(() => {
          const lecteur = lecteurYt.current;
          if (!lecteur) return;
          try {
            verifierArrets(lecteur.getCurrentTime());
          } catch {
            /* lecteur pas encore prêt */
          }
        }, 400);
      })
      .catch(() => {
        if (!annule)
          setErreur(
            "La vidéo YouTube n'a pas pu être chargée : vérifie ta connexion."
          );
      });

    return () => {
      annule = true;
      if (minuteur) clearInterval(minuteur);
      try {
        lecteurYt.current?.destroy();
      } catch {
        /* déjà détruit */
      }
      lecteurYt.current = null;
    };
  }, [video.fournisseur, video.identifiant, verifierArrets]);

  function repondre(indexArret: number, choix: number) {
    const suivantes = reponses.map((r, i) => (i === indexArret ? choix : r));
    setReponses(suivantes);
    onReponses(
      suivantes,
      suivantes.every((r) => r !== null)
    );
    setArretActif(null);
    setTimeout(reprendre, 250);
  }

  /** Permet de répondre aux questions restantes sans regarder toute la vidéo. */
  function ouvrirQuestion(index: number) {
    traites.current.add(index);
    mettreEnPause();
    setArretActif(index);
  }

  const nbRepondues = reponses.filter((r) => r !== null).length;

  if (video.fournisseur === "inconnu") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-corail/10 px-5 py-4 font-bold text-corail">
        <TriangleAlert className="size-5" /> Le lien de la vidéo n&apos;est pas reconnu.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lecteur */}
      <div className="relative overflow-hidden rounded-3xl border-3 border-encre/12 bg-encre">
        <div className="aspect-video w-full">
          {video.fournisseur === "youtube" && <div ref={conteneurYt} className="size-full" />}

          {video.fournisseur === "fichier" && (
            <video
              ref={videoHtml}
              src={video.urlFichier}
              controls
              playsInline
              className="size-full"
              onTimeUpdate={(e) => verifierArrets(e.currentTarget.currentTime)}
            >
              Ton navigateur ne peut pas lire cette vidéo.
            </video>
          )}

          {(video.fournisseur === "vimeo" || video.fournisseur === "drive") && (
            <iframe
              src={video.urlIframe}
              title="Vidéo de la fable"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="size-full"
            />
          )}
        </div>

        {/* Superposition : la question posée pendant la pause */}
        {arretActif !== null && (
          <div className="anim-apparition absolute inset-0 z-20 flex items-center justify-center bg-encre/92 p-4 sm:p-8">
            <div className="w-full max-w-xl">
              <p className="badge mb-3 bg-ambre text-white">
                <Clock className="size-3.5" /> Pause à {secondesEnTemps(arrets[arretActif].temps)}
              </p>
              <p className="font-titre text-2xl leading-snug font-bold text-papier">
                {arrets[arretActif].question}
              </p>
              <div className="mt-5 grid gap-2.5">
                {arrets[arretActif].options.map((option, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => repondre(arretActif, i)}
                    className="flex items-center gap-3 rounded-2xl border-3 border-papier/25 bg-papier/10 px-5 py-3.5 text-left text-lg font-bold text-papier transition-all hover:border-papier hover:bg-papier hover:text-encre"
                  >
                    <span className="font-titre grid size-8 shrink-0 place-items-center rounded-full border-2 border-current text-sm">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {!pret && video.fournisseur === "youtube" && !erreur && (
          <div className="absolute inset-0 grid place-items-center bg-encre">
            <p className="anim-pulser flex items-center gap-2 font-titre font-bold text-papier">
              <Film className="size-5" /> Chargement de la vidéo…
            </p>
          </div>
        )}
      </div>

      {erreur && (
        <p className="rounded-xl border-2 border-corail/30 bg-corail/10 px-4 py-2.5 text-sm font-bold text-corail">
          {erreur}
        </p>
      )}

      {!video.interactif && (
        <p className="flex items-start gap-2 rounded-2xl bg-ambre/12 px-4 py-3 text-sm font-bold text-ambre-fonce">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Cette source ne permet pas la pause automatique : regarde la vidéo, puis réponds aux
          questions ci-dessous.
        </p>
      )}

      {/* Suivi des questions */}
      <div className="rounded-2xl bg-papier px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-titre flex items-center gap-2 font-bold">
            <CircleHelp className="size-4.5 text-azur" />
            Questions pendant la vidéo
          </p>
          <span className="badge bg-menthe/15 text-menthe-fonce">
            {nbRepondues} / {arrets.length} répondue(s)
          </span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {arrets.map((arret, i) => {
            const repondu = reponses[i] !== null;
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={verrouille || repondu}
                  onClick={() => ouvrirQuestion(i)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-left text-sm font-bold transition-all ${
                    repondu
                      ? "border-menthe/40 bg-menthe/10 text-menthe-fonce"
                      : "border-encre/12 bg-white text-encre hover:border-azur"
                  }`}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/70 text-xs">
                    {repondu ? <Check className="size-4" strokeWidth={3} /> : <Play className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {secondesEnTemps(arret.temps)} · {arret.question}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
