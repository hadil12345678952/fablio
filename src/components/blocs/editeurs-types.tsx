"use client";

import { useState } from "react";
import {
  Bold,
  Italic,
  List,
  Link2,
  Image as ImageIcon,
  Volume2,
  Clapperboard,
  Link as LinkIcon,
  TriangleAlert,
  ListChecks,
} from "lucide-react";
import type {
  ContenuTexte,
  ContenuImage,
  ContenuAudio,
  ContenuVideo,
  ExerciceEditable,
} from "@/lib/blocs/types";
import { TexteRiche } from "@/components/texte-riche";
import { normaliserUrlImage, normaliserVideo, ETIQUETTES_FOURNISSEUR } from "@/lib/medias";
import { LecteurVocal } from "@/components/lecteur-vocal";

// ---------------------------------------------------------------------------
// Éditeurs par type de bloc. Chaque éditeur est INTRAFIF contrôlé par le parent.
// Usage : renderé dans la carte du bloc, remplit un `contenu` JSON propre.
// ---------------------------------------------------------------------------

function ChampImage({ c, onChange }: { c: ContenuImage; onChange: (c: ContenuImage) => void }) {
  const apercu = normaliserUrlImage(c.url);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette mb-1.5 block">Adresse de l'image</label>
          <input
            value={c.url}
            onChange={(e) => onChange({ ...c, url: e.target.value })}
            placeholder="https://… ou /images/illustration.png"
            className="champ"
          />
          <p className="mt-1.5 text-xs font-semibold text-encre/50">
            Upload automatique possible (lien Google Drive / Dropbox converti).
          </p>
        </div>
        <div>
          <label className="etiquette mb-1.5 block">
            Texte alternatif <span className="text-rose">*</span>
          </label>
          <input
            value={c.alt}
            onChange={(e) => onChange({ ...c, alt: e.target.value })}
            placeholder="Décrire l'image pour un lecteur d'écran"
            className="champ"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
        <div className="relative aspect-[5/3] overflow-hidden rounded-2xl border-2 border-encre/10 bg-papier">
          {apercu ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apercu} alt="Aperçu de l'illustration" className="size-full object-cover"
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          ) : (
            <span className="grid size-full place-items-center text-xs font-bold text-encre/30">
              Aperçu de l'image
            </span>
          )}
        </div>
        <div>
          <label className="etiquette mb-1.5 block">Légende affichée (facultatif)</label>
          <input
            value={c.legende}
            onChange={(e) => onChange({ ...c, legende: e.target.value })}
            placeholder="Une toute petite explication sous l'image"
            className="champ"
          />
        </div>
      </div>
    </div>
  );
}

function ChampAudio({ c, onChange }: { c: ContenuAudio; onChange: (c: ContenuAudio) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette mb-1.5 block">Adresse du fichier audio</label>
          <input
            value={c.url}
            onChange={(e) => onChange({ ...c, url: e.target.value })}
            placeholder="https://…/narration.mp3"
            className="champ"
          />
          <p className="mt-1.5 text-xs font-semibold text-encre/50">Formats : MP3, WAV, OGG.</p>
        </div>
        <div>
          <label className="etiquette mb-1.5 block">Titre (facultatif)</label>
          <input
            value={c.titre}
            onChange={(e) => onChange({ ...c, titre: e.target.value })}
            placeholder="Narration de Mme l'enseignante"
            className="champ"
          />
        </div>
      </div>
      <div>
        <label className="etiquette mb-1.5 block">Description (facultatif)</label>
        <input
          value={c.description}
          onChange={(e) => onChange({ ...c, description: e.target.value })}
          placeholder="Ce que contient la piste audio"
          className="champ"
        />
      </div>
    </div>
  );
}

function ChampVideo({ c, onChange }: { c: ContenuVideo; onChange: (c: ContenuVideo) => void }) {
  const info = c.url ? normaliserVideo(c.url) : null;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette mb-1.5 block">Source de la vidéo</label>
          <select
            value={c.source}
            onChange={(e) => onChange({ ...c, source: e.target.value as ContenuVideo["source"] })}
            className="champ"
          >
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="fichier">Fichier vidéo local (MP4/WebM)</option>
            <option value="drive">Google Drive</option>
          </select>
        </div>
        <div>
          <label className="etiquette mb-1.5 block">Adresse de la vidéo</label>
          <input
            value={c.url}
            onChange={(e) => onChange({ ...c, url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
            className="champ"
          />
        </div>
      </div>
      {c.url &&
        (info && info.fournisseur !== "inconnu" ? (
          <p className="text-sm font-bold text-menthe-fonce">
            ✓ {ETIQUETTES_FOURNISSEUR[info.fournisseur]} détecté
          </p>
        ) : (
          <p className="text-sm font-bold text-corail">
            Source non autorisée : utilisez YouTube, Vimeo, Google Drive ou un fichier .mp4.
          </p>
        ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette mb-1.5 block">Titre (facultatif)</label>
          <input
            value={c.titre}
            onChange={(e) => onChange({ ...c, titre: e.target.value })}
            placeholder="Regardez ici 👇"
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette mb-1.5 block">Description (facultatif)</label>
          <input
            value={c.description}
            onChange={(e) => onChange({ ...c, description: e.target.value })}
            placeholder=""
            className="champ"
          />
        </div>
      </div>
    </div>
  );
}

function ChampTexte({
  c,
  onChange,
}: {
  c: ContenuTexte;
  onChange: (c: ContenuTexte) => void;
}) {
  const [apercu, setApercu] = useState(false);

  function inserer(avant: string, apres: string, defaut: string) {
    const zone = document.getElementById("bloc-texte-edit") as HTMLTextAreaElement | null;
    if (!zone) {
      onChange({ ...c, markdown: c.markdown + avant + defaut + apres });
      return;
    }
    const debut = zone.selectionStart;
    const fin = zone.selectionEnd;
    const selection = c.markdown.slice(debut, fin);
    const nouveau =
      c.markdown.slice(0, debut) + avant + (selection || defaut) + apres + c.markdown.slice(fin);
    onChange({ ...c, markdown: nouveau });
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className="btn-ligne px-2.5 py-1.5" title="Gras"
          onClick={() => inserer("**", "**", "mot")}>
          <Bold className="size-4" />
        </button>
        <button type="button" className="btn-ligne px-2.5 py-1.5" title="Italique"
          onClick={() => inserer("*", "*", "mot")}>
          <Italic className="size-4" />
        </button>
        <button type="button" className="btn-ligne px-2.5 py-1.5" title="Liste à puces"
          onClick={() => inserer("\n- ", "\n", "élément")}>
          <List className="size-4" />
        </button>
        <button type="button" className="btn-ligne px-2.5 py-1.5" title="Lien"
          onClick={() => inserer("[", "](https://…)", "texte du lien")}>
          <Link2 className="size-4" />
        </button>
        <button type="button" onClick={() => setApercu((a) => !a)} className="btn-fantome px-2.5 py-1.5 text-xs">
          {apercu ? "Masquer l'aperçu" : "Aperçu"}
        </button>
      </div>
      <textarea
        id="bloc-texte-edit"
        rows={10}
        value={c.markdown}
        onChange={(e) => onChange({ ...c, markdown: e.target.value })}
        placeholder={"Le texte de la fable…\n\n**Gras**, *italique*, - listes, [liens](url)"}
        className="champ font-lecture rounded-2xl text-lg leading-relaxed"
      />
      {apercu && (
        <div className="rounded-2xl border-2 border-dashed border-encre/15 bg-papier px-6 py-4">
          <p className="etiquette mb-2">Aperçu élève</p>
          <TexteRiche texte={c.markdown || "…"} className="font-lecture text-lg leading-relaxed" />
        </div>
      )}
      <div className="rounded-2xl bg-azur/8 px-4 py-3">
        <p className="font-titre flex items-center gap-2 text-sm font-bold">
          <Volume2 className="size-4 text-azur" /> Lecture à voix haute
        </p>
        <p className="mt-0.5 mb-2 text-xs font-semibold text-encre/55">
          L'élève pourra écouter la fable lue à voix haute. Testez ici :
        </p>
        <LecteurVocal texte={c.markdown.slice(0, 600) || "« Écrivez d'abord du texte. »"} compact etiquette="Tester la voix" />
      </div>
    </div>
  );
}

function ChampExercice({
  exercicesDisponibles,
  exerciceId,
  onChange,
}: {
  exercicesDisponibles: ExerciceEditable[];
  exerciceId: string | null;
  onChange: (id: string) => void;
}) {
  const chosir = exercicesDisponibles.find((e) => e.id === exerciceId) ?? null;
  return (
    <div>
      <label className="etiquette mb-2 block">Sélectionnez l'exercice à inclure</label>
      {exercicesDisponibles.length === 0 ? (
        <div className="flex items-start gap-2 rounded-2xl bg-ambre/12 px-4 py-3.5 text-sm font-bold text-ambre-fonce">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Aucun exercice dans cette fable. Créez-le d'abord dans « Gestion des exercices »,
          puis revenez l'insérer ici.
        </div>
      ) : (
        <select
          value={exerciceId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="champ cursor-pointer"
        >
          <option value="">— Choisir un exercice … —</option>
          {exercicesDisponibles.map((e) => (
            <option key={e.id} value={e.id}>
              [{e.typeEtiquette}] {e.consigne || "Exercice"} · {e.points} pts
            </option>
          ))}
        </select>
      )}
      {chosir && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-menthe/30 bg-menthe/8 px-4 py-3">
          <span className="grid size-9 place-items-center rounded-xl bg-menthe/15 text-menthe-fonce">
            <ListChecks className="size-4.5" />
          </span>
          <div>
            <p className="font-titre font-bold">{chosir.typeEtiquette}</p>
            <p className="text-sm font-semibold text-encre/55">
              {chosir.consigne || "Exercice"} · {chosir.points} points ·{" "}
              {chosir.publie ? "publié" : "brouillon"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export const EDITEURS_TYPES = {
  texte: { champ: ChampTexte, icone: LinkIcon },
  image: { champ: ChampImage, icone: ImageIcon },
  audio: { champ: ChampAudio, icone: Volume2 },
  video: { champ: ChampVideo, icone: Clapperboard },
  exercice: { champ: ChampExercice, icone: ListChecks },
} as const;
