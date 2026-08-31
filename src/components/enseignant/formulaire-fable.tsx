"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  LoaderCircle,
  Bold,
  Italic,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Volume2,
  Rabbit,
  Turtle,
  Bird,
  Users,
} from "lucide-react";
import { TexteRiche } from "@/components/texte-riche";

export interface FableEditable {
  id: string;
  titre: string;
  texte: string;
  morale: string;
  imageUrl: string;
  audioUrl: string;
  difficulte: string;
  publie: boolean;
  cibleCodeIds: string[];
}

export interface CodeChoix {
  id: string;
  code: string;
  etiquette: string;
  nbEleves: number;
}

const DIFFICULTES = [
  { valeur: "facile", label: "Facile", icone: Rabbit, style: "border-sarcelle/40 bg-sarcelle/10 text-sarcelle-fonce" },
  { valeur: "moyen", label: "Moyen", icone: Bird, style: "border-ambre/50 bg-ambre/12 text-ambre-fonce" },
  { valeur: "difficile", label: "Difficile", icone: Turtle, style: "border-corail/40 bg-corail/10 text-corail-fonce" },
] as const;

export function FormulaireFable({
  fable,
  codes,
}: {
  fable: FableEditable | null;
  codes: CodeChoix[];
}) {
  const edition = fable !== null;
  const [titre, setTitre] = useState(fable?.titre ?? "");
  const [texte, setTexte] = useState(fable?.texte ?? "");
  const [morale, setMorale] = useState(fable?.morale ?? "");
  const [imageUrl, setImageUrl] = useState(fable?.imageUrl ?? "");
  const [audioUrl, setAudioUrl] = useState(fable?.audioUrl ?? "");
  const [difficulte, setDifficulte] = useState(fable?.difficulte ?? "facile");
  const [publie, setPublie] = useState(fable?.publie ?? false);
  const [cibles, setCibles] = useState<string[]>(fable?.cibleCodeIds ?? []);
  const [apercu, setApercu] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const zoneTexte = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  function insererMarqueur(avant: string, apres: string) {
    const zone = zoneTexte.current;
    if (!zone) return;
    const debut = zone.selectionStart;
    const fin = zone.selectionEnd;
    const selection = texte.slice(debut, fin);
    const nouveau = texte.slice(0, debut) + avant + (selection || "mot") + apres + texte.slice(fin);
    setTexte(nouveau);
    requestAnimationFrame(() => {
      zone.focus();
      zone.selectionStart = debut + avant.length;
      zone.selectionEnd = debut + avant.length + (selection || "mot").length;
    });
  }

  function basculerCible(id: string) {
    setCibles((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    const donnees = { titre, texte, morale, imageUrl, audioUrl, difficulte, publie, cibleCodeIds: cibles };
    try {
      const res = await fetch(
        edition ? `/api/enseignant/fables/${fable.id}` : "/api/enseignant/fables",
        {
          method: edition ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(donnees),
        }
      );
      const json = (await res.json()) as { erreur?: string; fable?: { id: string } };
      if (!res.ok || !json.fable) throw new Error(json.erreur ?? "Erreur inattendue.");
      router.push(`/enseignant/fables/${json.fable.id}`);
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inattendue.");
      setChargement(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-6">
      {/* Titre + difficulté */}
      <div className="carte space-y-5 p-6 sm:p-8">
        <div>
          <label htmlFor="titre" className="etiquette mb-1.5 block">
            Titre de la fable
          </label>
          <input
            id="titre"
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="La Cigale et la Fourmi"
            className="champ font-titre text-xl"
          />
        </div>

        <div>
          <span className="etiquette mb-2 block">Niveau de difficulté</span>
          <div className="flex flex-wrap gap-2.5">
            {DIFFICULTES.map(({ valeur, label, icone: Icone, style }) => (
              <button
                key={valeur}
                type="button"
                onClick={() => setDifficulte(valeur)}
                className={`flex items-center gap-2 rounded-2xl border-2 px-4 py-2.5 font-titre text-base font-bold transition-all ${
                  difficulte === valeur ? style : "border-encre/12 bg-white text-encre/45 hover:border-encre/30"
                }`}
              >
                <Icone className="size-5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Texte */}
      <div className="carte p-6 sm:p-8">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="texte" className="etiquette">
            Texte de la fable
          </label>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => insererMarqueur("**", "**")} className="btn-ligne px-2.5 py-1.5" title="Gras">
              <Bold className="size-4" />
            </button>
            <button type="button" onClick={() => insererMarqueur("*", "*")} className="btn-ligne px-2.5 py-1.5" title="Italique">
              <Italic className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setApercu((a) => !a)}
              className="btn-fantome px-2.5 py-1.5 text-xs"
            >
              {apercu ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {apercu ? "Masquer l'aperçu" : "Aperçu"}
            </button>
          </div>
        </div>
        <p className="mb-3 text-sm font-semibold text-encre/50">
          Rédigez ou collez le texte. Utilisez <code>**gras**</code>, <code>*italique*</code> et
          des lignes vides pour les paragraphes.
        </p>
        <textarea
          id="texte"
          ref={zoneTexte}
          required
          rows={12}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={"La Cigale, ayant chanté\nTout l'été,\nSe trouva fort dépourvue\nQuand la bise fut venue…"}
          className="champ font-lecture rounded-2xl text-lg leading-relaxed"
        />
        {apercu && (
          <div className="anim-apparition mt-4 rounded-2xl border-2 border-dashed border-encre/15 bg-papier px-6 py-5">
            <p className="etiquette mb-3">Aperçu pour l&apos;élève</p>
            <TexteRiche texte={texte || "…"} className="font-lecture text-lg leading-relaxed" />
          </div>
        )}
      </div>

      {/* Morale + médias */}
      <div className="carte space-y-5 p-6 sm:p-8">
        <div>
          <label htmlFor="morale" className="etiquette mb-1.5 block">
            Morale de la fable
          </label>
          <textarea
            id="morale"
            rows={2}
            value={morale}
            onChange={(e) => setMorale(e.target.value)}
            placeholder="Il faut travailler aujourd'hui pour ne manquer de rien demain."
            className="champ rounded-2xl"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="imageUrl" className="etiquette mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="size-3.5" /> Image d&apos;illustration (URL)
            </label>
            <input
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/images/fables/cigale-fourmi.jpg"
              className="champ"
            />
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Aperçu de l'illustration"
                className="mt-3 aspect-[5/3] w-56 rounded-2xl border-2 border-encre/10 object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            )}
          </div>
          <div>
            <label htmlFor="audioUrl" className="etiquette mb-1.5 flex items-center gap-1.5">
              <Volume2 className="size-3.5" /> Lecture audio (URL, optionnel)
            </label>
            <input
              id="audioUrl"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://…/lecture.mp3"
              className="champ"
            />
            <p className="mt-2 text-xs font-semibold text-encre/45">
              Si fournie, un lecteur audio s&apos;affichera sur la page de lecture de l&apos;élève.
            </p>
          </div>
        </div>
      </div>

      {/* Publication + affectation */}
      <div className="carte space-y-5 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-titre text-lg font-bold">Visible par les élèves</p>
            <p className="text-sm font-semibold text-encre/50">
              {publie
                ? "La fable et ses exercices publiés sont accessibles."
                : "Brouillon : invisible tant que vous ne publiez pas."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={publie}
            onClick={() => setPublie((p) => !p)}
            className={`relative h-9 w-16 shrink-0 rounded-full border-2 transition-colors ${
              publie ? "border-sarcelle bg-sarcelle" : "border-encre/20 bg-encre/10"
            }`}
          >
            <span
              className={`absolute top-0.5 size-7 rounded-full bg-white shadow-carte transition-all ${
                publie ? "left-8" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {codes.length > 0 && (
          <div className="border-t-2 border-dashed border-encre/10 pt-5">
            <p className="etiquette mb-1 flex items-center gap-1.5">
              <Users className="size-3.5" /> Affectation
            </p>
            <p className="mb-3 text-sm font-semibold text-encre/50">
              Sans sélection : tous vos élèves. Sinon, seuls les groupes cochés verront la fable.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {codes.map((c) => {
                const active = cibles.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => basculerCible(c.id)}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-extrabold transition-all ${
                      active
                        ? "border-sarcelle bg-sarcelle/10 text-sarcelle-fonce"
                        : "border-encre/12 bg-white text-encre/50 hover:border-encre/30"
                    }`}
                  >
                    {c.etiquette || c.code} · {c.nbEleves} élève(s)
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {erreur && (
        <p className="rounded-xl border-2 border-rose/30 bg-rose/10 px-4 py-2.5 text-sm font-bold text-rose">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={chargement} className="btn-primaire px-8 py-3.5 text-base">
          {chargement ? (
            <>
              <LoaderCircle className="size-5 animate-spin" /> Enregistrement…
            </>
          ) : (
            <>
              <Save className="size-5" /> {edition ? "Enregistrer la fable" : "Créer la fable"}
            </>
          )}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-ligne">
          Annuler
        </button>
      </div>
    </form>
  );
}
