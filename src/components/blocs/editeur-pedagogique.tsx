"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Copy,
  ListChecks,
  CheckCircle2,
  LoaderCircle,
  CircleHelp,
} from "lucide-react";
import type { BlocVue, TypeBloc, TypeBlocFutur, ExerciceEditable, ContenuBloc } from "@/lib/blocs/types";
import { REGISTRE_BLOCS, ICONES_BLOCS, contenuParDefaut } from "@/lib/blocs/registre";
import { resumeBloc } from "@/lib/blocs/validation";
import { EDITEURS_TYPES } from "./editeurs-types";
import { JoueurExercice } from "@/components/exercice/joueur-exercice";
import { TexteRiche } from "@/components/texte-riche";
import Image from "next/image";
import { Volume2, Clapperboard, Image as ImgIcon } from "lucide-react";
import { normaliserVideo } from "@/lib/medias";

// Petit ensemble du type ExerciceEditable manquante pour JoueurExercice.
import type { TypeExercice } from "@/lib/exercices";

// ---------------------------------------------------------------------------
// Éditeur pédagogique modulaire : cartes ordonnées + modale « Ajouter un contenu ».
// Chaque bloc : modify / duplicate / move / hide / delete, aperçu élève.
// ---------------------------------------------------------------------------

type EtatSauvegarde = "repos" | "envoi" | "ok" | "erreur";

function Indicateur({ etat }: { etat: EtatSauvegarde }) {
  if (etat === "repos") return null;
  if (etat === "envoi") {
    return (
      <span className="badge inline-flex items-center gap-1.5 text-xs font-bold text-azur">
        <LoaderCircle className="size-3.5 animate-spin" /> Enregistrement…
      </span>
    );
  }
  if (etat === "ok") {
    return (
      <span className="badge inline-flex items-center gap-1.5 text-xs font-bold text-menthe-fonce">
        <CheckCircle2 className="size-3.5" /> Enregistré
      </span>
    );
  }
  return (
    <span className="badge inline-flex items-center gap-1.5 text-xs font-bold text-rose">
      Échec — réessayer
    </span>
  );
}

export function EditeurPedagogique({
  fableId,
  blocsInitiaux,
  exercicesDisponibles,
  fablePubliee,
}: {
  fableId: string;
  blocsInitiaux: BlocVue[];
  exercicesDisponibles: ExerciceEditable[];
  fablePubliee: boolean;
}) {
  const [blocs, setBlocs] = useState<BlocVue[]>(blocsInitiaux);
  const [modale, setModale] = useState<{ ouverte: boolean; position: number } | null>(null);
  const [edition, setEdition] = useState<string | null>(null);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [apercuGlobal, setApercuGlobal] = useState(false);
  const [apercuBloc, setApercuBloc] = useState<string | null>(null);
  const [sauvegarde, setSauvegarde] = useState<EtatSauvegarde>("repos");
  const [enCours, setEnCours] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const tries = [...blocs].sort((a, b) => a.ordre - b.ordre);

  // Recharge depuis le serveur (après action exécutée par route API)
  const rafraicher = useCallback(async () => {
    const res = await fetch(`/api/enseignant/fables/${fableId}/blocs`);
    if (res.ok) {
      const json = await res.json();
      setBlocs(json.blocs);
    }
  }, [fableId]);

  /** Action API générique puis rechargement — robuste : ignore les 4xx métier
   *  sans boucle sans fin (affiche une erreur lisible une seule fois). */
  async function action(
    promesse: Promise<Response>,
    options?: { silent?: boolean; sauvegarde?: boolean }
  ) {
    if (!options?.silent) setEnCours(true);
    if (options?.sauvegarde) setSauvegarde("envoi");
    try {
      const res = await promesse;
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          erreur?: string;
          detailsValidation?: string[];
        };
        const message = json.erreur ?? `Erreur ${res.status}`;
        if (options?.sauvegarde) {
          setSauvegarde("erreur");
          console.warn("[éditeur-blocs sauvegarde auto]", message);
        } else {
          alert(
            Array.isArray(json.detailsValidation) && json.detailsValidation.length
              ? message + "\n\n" + json.detailsValidation.slice(0, 6).join("\n")
              : message
          );
        }
        return;
      }
      await rafraicher();
      if (options?.sauvegarde) {
        setSauvegarde("ok");
        setTimeout(() => setSauvegarde("repos"), 1800);
      }
    } finally {
      if (!options?.silent) setEnCours(false);
    }
  }

  function ouvrirModale(position: number) {
    setModale({ ouverte: true, position });
  }

  async function ajouter(type: TypeBloc) {
    if (!modale) return;
    const pos = modale.position;
    setModale(null);
    const contenu = contenuParDefaut(type);
    await action(
      fetch(`/api/enseignant/fables/${fableId}/blocs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, contenu, position: pos >= 0 ? pos : null }),
      })
    );
  }

  async function changerContenu(id: string, type: TypeBloc, contenu: ContenuBloc) {
    setBlocs((liste) =>
      liste.map((b) => (b.id === id ? { ...b, contenu } : b))
    );
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      void action(
        fetch(`/api/enseignant/blocs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenu }),
        }),
        { silent: true, sauvegarde: true }
      );
    }, 700);
  }

  async function basculerVisible(id: string) {
    const b = blocs.find((x) => x.id === id);
    if (!b) return;
    await action(
      fetch(`/api/enseignant/blocs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: !b.visible }),
      })
    );
  }

  async function deplacer(id: string, delta: 1 | -1) {
    await action(
      fetch(`/api/enseignant/blocs/${id}/deplacer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      })
    );
  }

  async function dupliquer(id: string) {
    await action(fetch(`/api/enseignant/blocs/${id}/dupliquer`, { method: "POST" }));
  }

  async function supprimer(id: string) {
    setSuppression(null);
    await action(fetch(`/api/enseignant/blocs/${id}`, { method: "DELETE" }));
  }

  const IconeAjout = ICONES_BLOCS.exercice;

  // ---- Rendu -------------------------------------------------------------

  if (apercuGlobal) {
    // Mode aperçu élève : même renderer enrichi que la page, sans aucune commande.
    const visibles = tries.filter((b) => b.visible);
    let compteurExo = 0;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="badge bg-ciel/12 text-ciel">
            <Eye className="size-3.5" /> Aperçu élève (fidèle, sans boutons d'édition)
          </p>
          <button type="button" className="btn-ligne" onClick={() => setApercuGlobal(false)}>
            <Pencil className="size-4" /> Revenir à l'édition
          </button>
        </div>
        {visibles.length === 0 ? (
          <p className="carte px-8 py-14 text-center font-semibold text-encre/45">
            Aucun contenu visible pour l'élève.
          </p>
        ) : (
          visibles.map((b) => (
            <ApercuBlocElement
              key={b.id}
              bloc={b}
              numeroExercice={b.type === "exercice" ? ++compteurExo : undefined}
              exercicesDisponibles={exercicesDisponibles}
              mode="apercu"
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Entête éditeur */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="badge bg-lilas/12 text-lilas">
            Éditeur par blocs · {tries.length} bloc(s)
          </span>
          <span className={`badge ${fablePubliee ? "bg-menthe/12 text-menthe-fonce" : "bg-ambre/12 text-ambre-fonce"}`}>
            {fablePubliee ? "Publiée" : "Brouillon"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Indicateur etat={sauvegarde} />
          <button type="button" className="btn-ligne" onClick={() => setApercuGlobal(true)}>
            <Eye className="size-4" /> Aperçu élève
          </button>
        </div>
      </div>

      {tries.length === 0 ? (
        <div className="carte bg-points flex flex-col items-center px-8 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-rose/12 text-rose">
            <Plus className="size-8" />
          </span>
          <h2 className="font-titre mt-4 text-2xl font-bold">Commencez votre parcours pédagogique</h2>
          <p className="mt-2 max-w-sm font-semibold text-encre-doux">
            Ajoutez du texte, des images, de l'audio, de la vidéo et vos exercices — dans l'ordre
            que vous choisissez.
          </p>
          <BoutonAjouter position={0} onOuvrir={ouvrirModale} />
        </div>
      ) : (
        <>
          {tries.map((b, index) => (
            <div key={b.id}>
              <CarteBloc
                bloc={b}
                index={index}
                total={tries.length}
                enCours={enCours}
                edition={edition}
                exercicesDisponibles={exercicesDisponibles}
                apercuOuvert={apercuBloc === b.id}
                onBasculerApercu={() => setApercuBloc(apercuBloc === b.id ? null : b.id)}
                onEdit={() => setEdition(edition === b.id ? null : b.id)}
                onDupliquer={() => dupliquer(b.id)}
                onMonter={() => deplacer(b.id, -1)}
                onDescendre={() => deplacer(b.id, 1)}
                onMasquer={() => basculerVisible(b.id)}
                onSupprimer={() => setSuppression(b.id)}
                onChangerContenu={(contenu) => changerContenu(b.id, b.type, contenu)}
                onChoisirExercice={(id) => changerContenu(b.id, b.type, { exerciceId: id } as ContenuBloc)}
              />
              <BoutonAjouter position={index + 1} onOuvrir={ouvrirModale} />
            </div>
          ))}
        </>
      )}

      {/* ===== Modale d'ajout ===== */}
      {modale?.ouverte && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-encre/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Ajouter un contenu"
        >
          <div className="anim-apparition carte w-full max-w-2xl p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-titre text-2xl font-bold">Ajouter un contenu</h2>
                <p className="text-sm font-semibold text-encre/50">
                  {modale.position === 0 ? "Au tout début" : `À la position ${modale.position + 1}`}
                </p>
              </div>
              <button type="button" onClick={() => setModale(null)} className="btn-fantome px-2.5 py-2" aria-label="Fermer">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {REGISTRE_BLOCS.map((meta) => {
                const Icone = ICONES_BLOCS[meta.type];
                const actif = meta.actif;
                return (
                  <button
                    key={meta.type}
                    type="button"
                    disabled={!actif}
                    onClick={() => actif && ajouter(meta.type as TypeBloc)}
                    className={`flex flex-col gap-2 rounded-3xl border-2 px-4 py-4 text-left transition-all ${
                      actif
                        ? "border-encre/12 bg-white hover:-translate-y-1 hover:border-rose/50 hover:shadow-carte"
                        : "cursor-not-allowed border-dashed border-encre/10 bg-encre/[0.03] opacity-60"
                    }`}
                  >
                    <span
                      className={`grid size-11 place-items-center rounded-2xl ${
                        actif ? "bg-rose/12 text-rose" : "bg-encre/10 text-encre/35"
                      }`}
                    >
                      <Icone className="size-5.5" />
                    </span>
                    <span>
                      <span className="font-titre block text-base font-bold">{meta.nom}</span>
                      <span className="mt-0.5 block text-xs leading-tight font-semibold text-encre/50">
                        {meta.description}
                      </span>
                    </span>
                    {!actif && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold text-encre/40">
                        <CircleHelp className="size-3" /> bientôt
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== Confirmation suppression ===== */}
      {suppression && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-encre/60 p-4 backdrop-blur-sm">
          <div className="anim-apparition carte w-full max-w-md p-6">
            <p className="font-titre text-xl font-bold">Supprimer ce contenu ?</p>
            <p className="mt-2 mb-5 font-semibold text-encre-doux">
              Cette action supprimera définitivement le bloc de la fable.
              {blocs.find((b) => b.id === suppression)?.type === "exercice"
                ? " L'exercice et ses résultats ne seront pas supprimés."
                : ""}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSuppression(null)} className="btn-ligne flex-1">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => supprimer(suppression)}
                className="btn flex-1 bg-rose text-white hover:bg-rose-fonce"
              >
                <Trash2 className="size-4" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Bouton « + Ajouter un contenu » ---------------------------------------

function BoutonAjouter({
  position,
  onOuvrir,
}: {
  position: number;
  onOuvrir: (position: number) => void;
}) {
  const Icone = Plus;
  return (
    <button
      type="button"
      onClick={() => onOuvrir(position)}
      className="group -mx-4 my-1 flex w-[calc(100%+2rem)] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-encre/15 py-3.5 text-sm font-bold text-encre/40 transition-all hover:border-rose/60 hover:text-rose"
    >
      <span className="grid size-7 place-items-center rounded-full border-2 border-current transition-transform group-hover:rotate-90 group-hover:scale-110">
        <Icone className="size-4" />
      </span>
      Ajouter un contenu
    </button>
  );
}

// --- Carte d'un bloc (édition) -----------------------------------------------

function CarteBloc({
  bloc, index, total, enCours, edition, exercicesDisponibles,
  apercuOuvert, onBasculerApercu, onEdit, onDupliquer, onMonter,
  onDescendre, onMasquer, onSupprimer, onChangerContenu, onChoisirExercice,
}: {
  bloc: BlocVue;
  index: number;
  total: number;
  enCours: boolean;
  edition: string | null;
  exercicesDisponibles: ExerciceEditable[];
  apercuOuvert: boolean;
  onBasculerApercu: () => void;
  onEdit: () => void;
  onDupliquer: () => void;
  onMonter: () => void;
  onDescendre: () => void;
  onMasquer: () => void;
  onSupprimer: () => void;
  onChangerContenu: (c: ContenuBloc) => void;
  onChoisirExercice: (id: string) => void;
}) {
  const meta = REGISTRE_BLOCS.find((m) => m.type === bloc.type);
  const Icone = ICONES_BLOCS[bloc.type] ?? ListChecks;
  const enEdition = edition === bloc.id;

  return (
    <article className={`carte overflow-hidden transition-opacity ${bloc.visible ? "" : "opacity-60"}`}>
      {/* Barre du bloc */}
      <header className="flex flex-wrap items-center gap-2.5 border-b-2 border-encre/8 bg-papier px-4 py-3">
        <span className={`grid size-9 place-items-center rounded-xl bg-white border-2 border-encre/10 ${bloc.type === "exercice" ? "text-corail" : "text-azur"}`}>
          <Icone className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-titre text-sm font-bold">{meta?.nom ?? bloc.type}</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-encre/40">
              #{bloc.ordre + 1}
            </span>
            {!bloc.visible && (
              <span className="badge bg-encre/10 text-encre-doux text-[10px]">
                Masqué
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-encre/50">
            {resumeBloc(bloc.type, bloc.contenu, {
              titreExercice: exercicesDisponibles.find((e) => e.id === bloc.exerciceId)?.consigne,
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onEdit} className={`btn-fantome px-2 py-1.5 text-xs ${enEdition ? "bg-azur/10 text-azur" : ""}`} title={enEdition ? "Fermer" : "Modifier"}>
            <Pencil className="size-4" />
          </button>
          <button type="button" onClick={onBasculerApercu} className={`btn-fantome px-2 py-1.5 text-xs ${apercuOuvert ? "bg-ciel/10 text-ciel" : ""}`} title="Aperçu élève">
            <Eye className="size-4" />
          </button>
          <button type="button" onClick={onDupliquer} disabled={enCours} className="btn-fantome px-2 py-1.5" title="Dupliquer">
            <Copy className="size-4" />
          </button>
          <button type="button" onClick={onMonter} disabled={index === 0 || enCours} className="btn-fantome px-2 py-1.5" title="Monter">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" onClick={onDescendre} disabled={index === total - 1 || enCours} className="btn-fantome px-2 py-1.5" title="Descendre">
            <ArrowDown className="size-4" />
          </button>
          <button type="button" onClick={onMasquer} disabled={enCours} className="btn-fantome px-2 py-1.5" title={bloc.visible ? "Masquer" : "Afficher"}>
            {bloc.visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button type="button" onClick={onSupprimer} disabled={enCours} className="btn-fantome px-2 py-1.5 text-corail hover:bg-corail/10" title="Supprimer">
            <Trash2 className="size-4" />
          </button>
        </div>
      </header>

      {/* Corps éditable ou aperçu */}
      {(enEdition || apercuOuvert) && (
        <div className="px-5 py-4">
          {enEdition ? (
            <CorpsEdition
              bloc={bloc}
              exercicesDisponibles={exercicesDisponibles}
              onChangerContenu={onChangerContenu}
              onChoisirExercice={onChoisirExercice}
            />
          ) : (
            <ApercuBlocElement bloc={bloc} exercicesDisponibles={exercicesDisponibles} mode="apercu" />
          )}
        </div>
      )}
    </article>
  );
}

// Corps d'édition d'un bloc ----------------

function CorpsEdition({
  bloc,
  exercicesDisponibles,
  onChangerContenu,
  onChoisirExercice,
}: {
  bloc: BlocVue;
  exercicesDisponibles: ExerciceEditable[];
  onChangerContenu: (c: ContenuBloc) => void;
  onChoisirExercice: (id: string) => void;
}) {
  const editeur = EDITEURS_TYPES[bloc.type as keyof typeof EDITEURS_TYPES];
  if (!editeur) return <p className="font-semibold text-encre/50">Type non configurable en V1.</p>;
  const Champ = editeur.champ as (props: {
    c: ContenuBloc;
    onChange: (c: ContenuBloc) => void;
    exercicesDisponibles?: ExerciceEditable[];
    exerciceId?: string | null;
    onChangeExercice?: (id: string) => void;
  }) => React.JSX.Element;

  if (bloc.type === "exercice") {
    return (
      <ChampExerciceConfirm
        bloc={bloc}
        exercicesDisponibles={exercicesDisponibles}
        onChoisirExercice={onChoisirExercice}
      />
    );
  }
  if (bloc.type === "texte") {
    const c = bloc.contenu as import("@/lib/blocs/types").ContenuTexte;
    return (
      <EDITEURS_TYPES.texte.champ c={c} onChange={onChangerContenu as (x: unknown) => void} />
    );
  }
  if (bloc.type === "image") {
    const c = bloc.contenu as import("@/lib/blocs/types").ContenuImage;
    return (
      <EDITEURS_TYPES.image.champ c={c} onChange={onChangerContenu as (x: unknown) => void} />
    );
  }
  if (bloc.type === "audio") {
    const c = bloc.contenu as import("@/lib/blocs/types").ContenuAudio;
    return (
      <EDITEURS_TYPES.audio.champ c={c} onChange={onChangerContenu as (x: unknown) => void} />
    );
  }
  if (bloc.type === "video") {
    const c = bloc.contenu as import("@/lib/blocs/types").ContenuVideo;
    return (
      <EDITEURS_TYPES.video.champ c={c} onChange={onChangerContenu as (x: unknown) => void} />
    );
  }
  return null;
}

function ChampExerciceConfirm({
  bloc,
  exercicesDisponibles,
  onChoisirExercice,
}: {
  bloc: BlocVue;
  exercicesDisponibles: ExerciceEditable[];
  onChoisirExercice: (id: string) => void;
}) {
  return (
    <EDITEURS_TYPES.exercice.champ
      exercicesDisponibles={exercicesDisponibles}
      exerciceId={bloc.exerciceId}
      onChange={onChoisirExercice}
    />
  );
}

// Aperçu fidèle d'un bloc (élément) ----------------

export function ApercuBlocElement({
  bloc,
  exercicesDisponibles,
  numeroExercice,
  mode,
}: {
  bloc: BlocVue;
  exercicesDisponibles: ExerciceEditable[];
  numeroExercice?: number;
  mode?: "apercu";
}) {
  switch (bloc.type) {
    case "texte": {
      const c = bloc.contenu as { markdown: string };
      return (
        <article className="carte px-6 py-5 sm:px-8">
          {bloc.titre && <h3 className="font-titre mb-3 text-xl font-bold">{bloc.titre}</h3>}
          <TexteRiche texte={c.markdown} className="font-lecture text-lg leading-relaxed" />
        </article>
      );
    }
    case "image": {
      const c = bloc.contenu as { url: string; alt: string; legende?: string };
      return (
        <figure className="carte overflow-hidden">
          <div className="relative aspect-[16/8] overflow-hidden bg-papier">
            {c.url ? (
              <Image src={c.url} alt={c.alt} fill className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center">
                <ImgIcon className="size-12 text-encre/12" />
              </span>
            )}
          </div>
          {(c.legende || bloc.titre) && (
            <figcaption className="px-6 py-2.5 text-center text-sm font-semibold text-encre/60">
              {c.legende || bloc.titre}
            </figcaption>
          )}
        </figure>
      );
    }
    case "audio": {
      const c = bloc.contenu as { url: string; titre?: string; description?: string };
      return (
        <section className="carte flex items-center gap-3 px-5 py-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-menthe/15 text-menthe-fonce">
            <Volume2 className="size-5.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-titre font-bold">{c.titre || bloc.titre || "Piste audio"}</p>
            {c.description && <p className="text-sm font-semibold text-encre/55">{c.description}</p>}
            <audio controls src={c.url} className="mt-1 w-full max-w-md">
              Ton navigateur ne supporte pas la lecture audio.
            </audio>
          </div>
        </section>
      );
    }
    case "video": {
      const c = bloc.contenu as { url: string; titre?: string; description?: string };
      const v = normaliserVideo(c.url);
      if (v.fournisseur === "inconnu") return null;
      return (
        <section className="carte overflow-hidden">
          {(c.titre || bloc.titre) && (
            <p className="font-titre flex items-center gap-2 px-5 pt-4 pb-2 font-bold">
              <Clapperboard className="size-4.5 text-rose" /> {c.titre || bloc.titre}
            </p>
          )}
          <div className="aspect-video w-full overflow-hidden rounded-b-3xl border-t border-encre/10 bg-encre">
            {v.fournisseur === "fichier" ? (
              <video controls playsInline src={v.urlFichier} className="size-full" />
            ) : (
              <iframe src={v.urlIframe} title={c.titre || "Vidéo"} allowFullScreen className="size-full"
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture" />
            )}
          </div>
          {c.description && <p className="px-5 py-3 text-sm font-semibold text-encre/60">{c.description}</p>}
        </section>
      );
    }
    case "exercice": {
      const exo = exercicesDisponibles.find((e) => e.id === bloc.exerciceId);
      if (!exo) return null;
      return (
        <section className="carte px-4 py-5 sm:px-7">
          {bloc.titre && <p className="font-titre mb-3 text-lg font-bold">{bloc.titre}</p>}
          <JoueurExercice
            exercice={{
              id: exo.id,
              type: exo.type as TypeExercice,
              typeEtiquette: exo.typeEtiquette,
              consigne: exo.consigne,
              points: exo.points,
              feedbackCorrect: exo.feedbackCorrect,
              feedbackIncorrect: exo.feedbackIncorrect,
              payload: exo.payload as never,
              presentation: {},
              maxTentatives: exo.maxTentatives,
              tentativesUtilisees: 0,
              tentativesRestantes: null,
              meilleurScore: null,
              reussi: false,
            }}
            numero={numeroExercice}
            mode="apercu"
          />
        </section>
      );
    }
    default:
      return null;
  }
}
