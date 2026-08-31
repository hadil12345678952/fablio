"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, Play, Square, LoaderCircle, Gauge } from "lucide-react";

type Etat = "repos" | "chargement" | "lecture" | "pause";

/**
 * Bouton « Écouter la fable » : appelle l'API de synthèse vocale du serveur
 * (/api/tts) et lit le MP3 renvoyé. Si le service externe est indisponible,
 * bascule automatiquement sur la voix intégrée du navigateur
 * (SpeechSynthesis) pour que l'élève puisse toujours écouter.
 */
export function LecteurVocal({
  texte,
  compact = false,
  etiquette = "Écouter la fable",
}: {
  texte: string;
  compact?: boolean;
  etiquette?: string;
}) {
  const [etat, setEtat] = useState<Etat>("repos");
  const [vitesse, setVitesse] = useState(1);
  const [info, setInfo] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const navigateurRef = useRef(false);

  // Nettoyage à la sortie de la page
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /** Repli : voix intégrée du navigateur. */
  function lireAvecNavigateur() {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setInfo("La lecture à voix haute n'est pas disponible sur cet appareil.");
      setEtat("repos");
      return;
    }
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(texte.slice(0, 4000));
    message.lang = "fr-FR";
    message.rate = 0.9 * vitesse;
    message.pitch = 1.05;
    const voixFr = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("fr"));
    if (voixFr) message.voice = voixFr;
    message.onend = () => setEtat("repos");
    message.onerror = () => setEtat("repos");
    navigateurRef.current = true;
    setEtat("lecture");
    setInfo("Lecture avec la voix de l'appareil.");
    window.speechSynthesis.speak(message);
  }

  async function demarrer() {
    setInfo(null);

    // Audio déjà téléchargé : on relance simplement.
    if (audioRef.current && urlRef.current) {
      audioRef.current.playbackRate = vitesse;
      void audioRef.current.play();
      setEtat("lecture");
      return;
    }

    setEtat("chargement");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte }),
      });
      if (!res.ok) throw new Error("service indisponible");
      const blob = await res.blob();
      if (blob.size < 500) throw new Error("audio vide");

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.playbackRate = vitesse;
      audio.onended = () => setEtat("repos");
      audio.onerror = () => {
        setEtat("repos");
        lireAvecNavigateur();
      };
      audioRef.current = audio;
      navigateurRef.current = false;
      await audio.play();
      setEtat("lecture");
    } catch {
      lireAvecNavigateur();
    }
  }

  function basculerPause() {
    if (navigateurRef.current) {
      if (etat === "lecture") {
        window.speechSynthesis.pause();
        setEtat("pause");
      } else {
        window.speechSynthesis.resume();
        setEtat("lecture");
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (etat === "lecture") {
      audio.pause();
      setEtat("pause");
    } else {
      void audio.play();
      setEtat("lecture");
    }
  }

  function arreter() {
    if (navigateurRef.current) window.speechSynthesis.cancel();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setEtat("repos");
  }

  function changerVitesse() {
    const suivante = vitesse === 1 ? 1.25 : vitesse === 1.25 ? 0.75 : 1;
    setVitesse(suivante);
    if (audioRef.current) audioRef.current.playbackRate = suivante;
  }

  const enCours = etat === "lecture" || etat === "pause";

  return (
    <div className={compact ? "inline-flex items-center gap-1.5" : "flex flex-wrap items-center gap-2.5"}>
      {!enCours ? (
        <button
          type="button"
          onClick={demarrer}
          disabled={etat === "chargement"}
          className={
            compact
              ? "btn-ligne px-3.5 py-1.5 text-xs"
              : "btn-gomme inline-flex items-center gap-2.5 rounded-full bg-azur px-6 py-3 font-titre text-lg font-bold text-white"
          }
        >
          {etat === "chargement" ? (
            <LoaderCircle className={compact ? "size-4 animate-spin" : "size-5 animate-spin"} />
          ) : (
            <Volume2 className={compact ? "size-4" : "size-5"} />
          )}
          {etat === "chargement" ? "Préparation…" : etiquette}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={basculerPause}
            className={
              compact
                ? "btn-ligne px-3 py-1.5 text-xs"
                : "btn-gomme inline-flex items-center gap-2 rounded-full bg-azur px-5 py-3 font-titre font-bold text-white"
            }
          >
            {etat === "lecture" ? <Pause className="size-5" /> : <Play className="size-5" />}
            {etat === "lecture" ? "Pause" : "Reprendre"}
          </button>
          <button type="button" onClick={arreter} className="btn-ligne px-3 py-2" title="Arrêter">
            <Square className="size-4" />
          </button>
        </>
      )}

      {!compact && (
        <button
          type="button"
          onClick={changerVitesse}
          className="btn-ligne px-3.5 py-2 text-xs"
          title="Changer la vitesse de lecture"
        >
          <Gauge className="size-4" /> ×{vitesse}
        </button>
      )}

      {info && <span className="text-xs font-bold text-encre/45">{info}</span>}
    </div>
  );
}
