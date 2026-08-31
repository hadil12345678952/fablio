"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, PuzzleIcon, TriangleAlert } from "lucide-react";

// ---------------------------------------------------------------------------
// Intégration d'une activité H5P hébergée à l'extérieur (h5p.org, h5p.com,
// Lumi, Moodle, WordPress…).
//
// H5P communique avec la page hôte par `postMessage` (protocole du script
// officiel h5p-resizer.js). On réimplémente ici la partie utile — le
// redimensionnement automatique de l'iframe — sans charger de script tiers :
// c'est plus sûr (pas de code externe injecté) et plus fiable.
// ---------------------------------------------------------------------------

interface MessageH5p {
  context?: string;
  action?: string;
  scrollHeight?: number;
}

export function ActiviteH5p({
  embedUrl,
  titre,
  hauteurInitiale = 480,
}: {
  embedUrl: string;
  titre: string;
  hauteurInitiale?: number;
}) {
  const [hauteur, setHauteur] = useState(hauteurInitiale);
  const [echec, setEchec] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function surMessage(evenement: MessageEvent) {
      const donnees = evenement.data as MessageH5p | undefined;
      if (!donnees || donnees.context !== "h5p") return;
      // On n'écoute que notre propre iframe.
      if (
        iframeRef.current?.contentWindow &&
        evenement.source !== iframeRef.current.contentWindow
      ) {
        return;
      }
      switch (donnees.action) {
        case "hello":
          // Poignée de main : l'activité peut commencer à envoyer ses tailles.
          iframeRef.current?.contentWindow?.postMessage(
            { context: "h5p", action: "hello" },
            "*"
          );
          break;
        case "prepareResize":
        case "resize": {
          const h = Number(donnees.scrollHeight);
          if (Number.isFinite(h) && h > 150 && h < 4000) setHauteur(Math.ceil(h));
          break;
        }
      }
    }
    window.addEventListener("message", surMessage);
    return () => window.removeEventListener("message", surMessage);
  }, []);

  // Si l'activité n'a rien affiché au bout de 8 s, on propose le lien direct.
  useEffect(() => {
    const minuteur = setTimeout(() => {
      const cadre = iframeRef.current;
      if (cadre && cadre.clientHeight < 60) setEchec(true);
    }, 8000);
    return () => clearTimeout(minuteur);
  }, []);

  function pleinEcran() {
    const cadre = iframeRef.current;
    if (cadre?.requestFullscreen) void cadre.requestFullscreen();
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-titre flex items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-xl bg-azur/12 text-azur">
            <PuzzleIcon className="size-4.5" />
          </span>
          {titre || "Activité interactive H5P"}
        </p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={pleinEcran} className="btn-ligne px-3 py-1.5 text-xs">
            <Maximize2 className="size-3.5" /> Plein écran
          </button>
          <a
            href={embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-fantome px-3 py-1.5 text-xs"
          >
            <ExternalLink className="size-3.5" /> Ouvrir
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border-3 border-encre/12 bg-white">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={titre || "Activité H5P"}
          style={{ height: `${hauteur}px` }}
          className="w-full"
          allow="autoplay; fullscreen; geolocation *; microphone *; camera *; midi *; encrypted-media *"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
        />
      </div>

      {echec && (
        <p className="flex items-start gap-2 rounded-2xl bg-ambre/12 px-4 py-3 text-sm font-bold text-ambre-fonce">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          L&apos;activité met du temps à s&apos;afficher. Utilise le bouton « Ouvrir » pour la
          lancer dans un nouvel onglet, puis reviens valider ici.
        </p>
      )}
    </div>
  );
}
