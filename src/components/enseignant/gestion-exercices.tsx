"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ListChecks,
  ToggleLeft,
  TextCursorInput,
  ArrowUpDown,
  Link2,
  PenLine,
  Plus,
  Pencil,
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown,
  LoaderCircle,
  Save,
  X,
  GripVertical,
  Clapperboard,
  PuzzleIcon,
  Clock,
  ExternalLink,
  Info,
  Check,
} from "lucide-react";
import {
  DESCRIPTIONS_TYPES,
  ETIQUETTES_TYPES,
  TYPES_EXERCICES,
  analyserTexteATrous,
  composerTexteATrous,
  fabriquerPresentation,
  validerPayload,
  type ArretVideo,
  type AssociationPayload,
  type H5pPayload,
  type OrdrePayload,
  type OuvertePayload,
  type PayloadExercice,
  type QcmPayload,
  type TrousPayload,
  type TypeExercice,
  type VideoInteractivePayload,
  type VraiFauxPayload,
} from "@/lib/exercices";
import {
  ETIQUETTES_FOURNISSEUR,
  normaliserUrlH5p,
  normaliserVideo,
  secondesEnTemps,
  tempsEnSecondes,
} from "@/lib/medias";
import { JoueurExercice } from "@/components/exercice/joueur-exercice";

export interface ExerciceEditable {
  id: string;
  fableId: string;
  type: TypeExercice;
  typeEtiquette: string;
  consigne: string;
  payload: PayloadExercice;
  points: number;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  ordre: number;
  publie: boolean;
  maxTentatives: number | null;
}

const ICONES_TYPES: Record<TypeExercice, typeof ListChecks> = {
  qcm: ListChecks,
  vrai_faux: ToggleLeft,
  texte_trous: TextCursorInput,
  ordre: ArrowUpDown,
  association: Link2,
  question_ouverte: PenLine,
  video_interactive: Clapperboard,
  h5p: PuzzleIcon,
};

function resumeCourt(exo: ExerciceEditable): string {
  const p = exo.payload as unknown as Record<string, unknown>;
  switch (exo.type) {
    case "qcm":
    case "question_ouverte":
      return String(p.question ?? "");
    case "vrai_faux":
      return String(p.enonce ?? "");
    case "texte_trous":
      return ((p.segments as string[]) ?? []).join(" ____ ").slice(0, 120) || "—";
    case "ordre":
      return `${((p.elements as string[]) ?? []).length} éléments à classer`;
    case "association":
      return `${((p.paires as unknown[]) ?? []).length} paires à relier`;
    case "video_interactive":
      return `Vidéo · ${((p.arrets as unknown[]) ?? []).length} question(s) intégrée(s)`;
    case "h5p":
      return String(p.titre || p.embedUrl || "Activité H5P");
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Formulaire d'un exercice (création / édition)
// ---------------------------------------------------------------------------

function FormulaireExercice({
  fableId,
  type,
  initial,
  onTermine,
}: {
  fableId: string;
  type: TypeExercice;
  initial: ExerciceEditable | null;
  onTermine: () => void;
}) {
  const [consigne, setConsigne] = useState(initial?.consigne ?? "");
  const [points, setPoints] = useState(String(initial?.points ?? 10));
  const [feedbackCorrect, setFeedbackCorrect] = useState(initial?.feedbackCorrect ?? "");
  const [feedbackIncorrect, setFeedbackIncorrect] = useState(initial?.feedbackIncorrect ?? "");
  const [maxTentatives, setMaxTentatives] = useState(
    initial?.maxTentatives ? String(initial.maxTentatives) : ""
  );
  const [publie, setPublie] = useState(initial?.publie ?? true);

  const [qcm, setQcm] = useState<QcmPayload>(() =>
    initial && type === "qcm"
      ? (initial.payload as QcmPayload)
      : { question: "", options: ["", "", ""], corrects: [0], multiple: false }
  );
  const [vf, setVf] = useState<VraiFauxPayload>(() =>
    initial && type === "vrai_faux"
      ? (initial.payload as VraiFauxPayload)
      : { enonce: "", reponse: true }
  );
  const [trousTexte, setTrousTexte] = useState(() =>
    initial && type === "texte_trous"
      ? composerTexteATrous(initial.payload as TrousPayload)
      : ""
  );
  const [trousBanque, setTrousBanque] = useState(
    initial && type === "texte_trous" ? (initial.payload as TrousPayload).afficherBanque : false
  );
  const [trousExtras, setTrousExtras] = useState(() =>
    initial && type === "texte_trous"
      ? (initial.payload as TrousPayload).banque.join(", ")
      : ""
  );
  const [ordreElements, setOrdreElements] = useState<string[]>(() =>
    initial && type === "ordre" ? (initial.payload as OrdrePayload).elements : ["", ""]
  );
  const [paires, setPaires] = useState<{ gauche: string; droite: string }[]>(() =>
    initial && type === "association"
      ? (initial.payload as AssociationPayload).paires
      : [
          { gauche: "", droite: "" },
          { gauche: "", droite: "" },
        ]
  );
  const [ouverte, setOuverte] = useState(() =>
    initial && type === "question_ouverte"
      ? (initial.payload as OuvertePayload)
      : { question: "", corrigeType: "", reponsesAcceptees: [] as string[] }
  );
  const [ouverteAuto, setOuverteAuto] = useState(
    initial && type === "question_ouverte"
      ? (initial.payload as OuvertePayload).reponsesAcceptees.length > 0
      : false
  );
  const [ouverteReponses, setOuverteReponses] = useState(() =>
    initial && type === "question_ouverte"
      ? (initial.payload as OuvertePayload).reponsesAcceptees.join(", ")
      : ""
  );

  // --- Vidéo interactive ---------------------------------------------------
  const [videoUrl, setVideoUrl] = useState(() =>
    initial && type === "video_interactive"
      ? (initial.payload as VideoInteractivePayload).videoUrl
      : ""
  );
  const [arrets, setArrets] = useState<ArretVideo[]>(() =>
    initial && type === "video_interactive"
      ? (initial.payload as VideoInteractivePayload).arrets
      : [{ temps: 30, question: "", options: ["", ""], correct: 0, explication: "" }]
  );
  // Saisie du temps sous forme « 1:35 » (converti en secondes à la volée)
  const [tempsSaisis, setTempsSaisis] = useState<string[]>(() =>
    initial && type === "video_interactive"
      ? (initial.payload as VideoInteractivePayload).arrets.map((a) =>
          secondesEnTemps(a.temps)
        )
      : ["0:30"]
  );

  // --- H5P -----------------------------------------------------------------
  const [h5p, setH5p] = useState<H5pPayload>(() =>
    initial && type === "h5p"
      ? (initial.payload as H5pPayload)
      : {
          embedUrl: "",
          titre: "",
          hauteur: 500,
          validationAutomatique: false,
          demanderScore: true,
        }
  );

  function majArret(index: number, patch: Partial<ArretVideo>) {
    setArrets((liste) => liste.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [montreApercu, setMontreApercu] = useState(false);
  const graine = useRef(Math.random().toString(36).slice(2));
  const router = useRouter();

  function construirePayload(): PayloadExercice {
    switch (type) {
      case "qcm":
        return {
          ...qcm,
          options: qcm.options.map((o) => o.trim()),
          corrects: [...qcm.corrects].sort((a, b) => a - b),
        };
      case "vrai_faux":
        return vf;
      case "texte_trous": {
        const analyse = analyserTexteATrous(trousTexte);
        return {
          ...analyse,
          afficherBanque: trousBanque,
          banque: trousExtras
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        } satisfies TrousPayload;
      }
      case "ordre":
        return { elements: ordreElements.map((e) => e.trim()) } satisfies OrdrePayload;
      case "association":
        return {
          paires: paires.map((p) => ({ gauche: p.gauche.trim(), droite: p.droite.trim() })),
        } satisfies AssociationPayload;
      case "question_ouverte":
        return {
          question: ouverte.question,
          corrigeType: ouverte.corrigeType,
          reponsesAcceptees: ouverteAuto
            ? ouverteReponses
                .split(/[,;\n]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        } satisfies OuvertePayload;
      case "video_interactive":
        return {
          videoUrl: videoUrl.trim(),
          arrets: arrets.map((a) => ({
            ...a,
            question: a.question.trim(),
            options: a.options.map((o) => o.trim()),
            explication: a.explication.trim(),
          })),
        } satisfies VideoInteractivePayload;
      case "h5p":
        return {
          ...h5p,
          embedUrl: normaliserUrlH5p(h5p.embedUrl),
          titre: h5p.titre.trim(),
        } satisfies H5pPayload;
    }
  }

  const Icone = ICONES_TYPES[type];
  const payload = construirePayload();
  const erreurPayload = validerPayload(type, payload);

  async function sauvegarder() {
    setErreur(null);
    const pl = construirePayload();
    const pb = validerPayload(type, pl);
    if (pb) {
      setErreur(pb);
      return;
    }
    setChargement(true);
    const donnees = {
      fableId,
      type,
      consigne,
      payload: pl,
      points: Number(points) || 10,
      feedbackCorrect,
      feedbackIncorrect,
      publie,
      maxTentatives: maxTentatives === "" ? null : Number(maxTentatives),
    };
    try {
      const res = await fetch(
        initial
          ? `/api/enseignant/exercices/${initial.id}`
          : "/api/enseignant/exercices",
        {
          method: initial ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(donnees),
        }
      );
      const json = (await res.json()) as { erreur?: string };
      if (!res.ok) throw new Error(json.erreur ?? "Erreur inattendue.");
      router.refresh();
      onTermine();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inattendue.");
      setChargement(false);
    }
  }

  return (
    <div className="rounded-3xl border-2 border-dashed border-corail/40 bg-corail/[0.04] p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-corail/12 text-corail">
          <Icone className="size-5" />
        </span>
        <div>
          <p className="font-titre text-lg leading-tight font-bold">
            {initial ? "Modifier" : "Nouvel exercice"} · {ETIQUETTES_TYPES[type]}
          </p>
          <p className="text-sm font-semibold text-encre/50">{DESCRIPTIONS_TYPES[type]}</p>
        </div>
      </div>

      {/* Consigne */}
      <div className="mb-4">
        <label className="etiquette mb-1.5 block">Consigne pour l&apos;élève</label>
        <input
          value={consigne}
          onChange={(e) => setConsigne(e.target.value)}
          placeholder="Ex. Lis bien la fable puis réponds à la question."
          className="champ"
        />
      </div>

      {/* ----- Champs spécifiques ----- */}
      <div className="carte space-y-4 p-5">
        {type === "qcm" && (
          <>
            <div>
              <label className="etiquette mb-1.5 block">Question</label>
              <input
                value={qcm.question}
                onChange={(e) => setQcm({ ...qcm, question: e.target.value })}
                placeholder="Qui a chanté tout l'été ?"
                className="champ"
              />
            </div>
            <div>
              <label className="etiquette mb-1.5 block">
                Propositions (2 à 6) — coche la/les bonne(s) réponse(s)
              </label>
              <div className="space-y-2">
                {qcm.options.map((option, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Bonne réponse"
                      onClick={() =>
                        setQcm({
                          ...qcm,
                          corrects: qcm.multiple
                            ? qcm.corrects.includes(i)
                              ? qcm.corrects.filter((c) => c !== i)
                              : [...qcm.corrects, i]
                            : [i],
                        })
                      }
                      className={`grid size-9 shrink-0 place-items-center rounded-xl border-2 font-titre font-bold transition-colors ${
                        qcm.corrects.includes(i)
                          ? "border-sarcelle bg-sarcelle text-white"
                          : "border-encre/20 bg-white text-encre/40 hover:border-sarcelle"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                    <input
                      value={option}
                      onChange={(e) =>
                        setQcm({
                          ...qcm,
                          options: qcm.options.map((o, j) => (j === i ? e.target.value : o)),
                        })
                      }
                      placeholder={`Proposition ${i + 1}`}
                      className="champ"
                    />
                    {qcm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQcm({
                            ...qcm,
                            options: qcm.options.filter((_, j) => j !== i),
                            corrects: qcm.corrects
                              .filter((c) => c !== i)
                              .map((c) => (c > i ? c - 1 : c)),
                          })
                        }
                        className="btn-fantome px-2 py-1.5"
                        aria-label="Supprimer la proposition"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {qcm.options.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setQcm({ ...qcm, options: [...qcm.options, ""] })}
                    className="btn-ligne px-3.5 py-1.5 text-xs"
                  >
                    <Plus className="size-3.5" /> Ajouter une proposition
                  </button>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-encre-doux">
                  <input
                    type="checkbox"
                    checked={qcm.multiple}
                    onChange={(e) =>
                      setQcm({
                        ...qcm,
                        multiple: e.target.checked,
                        corrects: e.target.checked ? qcm.corrects : qcm.corrects.slice(0, 1),
                      })
                    }
                    className="size-4.5 accent-corail"
                  />
                  Plusieurs bonnes réponses possibles
                </label>
              </div>
            </div>
          </>
        )}

        {type === "vrai_faux" && (
          <>
            <div>
              <label className="etiquette mb-1.5 block">Affirmation</label>
              <input
                value={vf.enonce}
                onChange={(e) => setVf({ ...vf, enonce: e.target.value })}
                placeholder="La fourmi a prêté des grains à la cigale."
                className="champ"
              />
            </div>
            <div className="flex gap-2.5">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setVf({ ...vf, reponse: v })}
                  className={`flex-1 rounded-2xl border-2 px-4 py-3 font-titre text-lg font-bold transition-all ${
                    vf.reponse === v
                      ? v
                        ? "border-sarcelle bg-sarcelle/10 text-sarcelle"
                        : "border-rose bg-rose/10 text-rose"
                      : "border-encre/15 bg-white text-encre/45 hover:border-encre/35"
                  }`}
                >
                  La bonne réponse est : {v ? "VRAI" : "FAUX"}
                </button>
              ))}
            </div>
          </>
        )}

        {type === "texte_trous" && (
          <>
            <div>
              <label className="etiquette mb-1.5 block">
                Texte avec les trous entre {"{accolades}"}
              </label>
              <textarea
                rows={5}
                value={trousTexte}
                onChange={(e) => setTrousTexte(e.target.value)}
                placeholder="La Cigale, ayant {chanté} tout l'été, se trouva fort {dépourvue} quand la bise fut venue."
                className="champ font-lecture rounded-2xl text-base leading-relaxed"
              />
              <p className="mt-2 text-sm font-semibold text-encre/50">
                Écris le mot à cacher entre accolades : {"{mot}"}. Pour accepter plusieurs
                réponses : {"{dépourvue|depourvue}"}.
              </p>
            </div>
            {(() => {
              const analyse = analyserTexteATrous(trousTexte);
              if (analyse.reponses.length === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-papier px-4 py-3">
                  <span className="etiquette">Trous détectés :</span>
                  {analyse.reponses.map((r, i) => (
                    <span key={i} className="badge bg-ambre/20 text-ambre-fonce">
                      {i + 1}. {r.join(" / ")}
                    </span>
                  ))}
                </div>
              );
            })()}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-encre-doux">
              <input
                type="checkbox"
                checked={trousBanque}
                onChange={(e) => setTrousBanque(e.target.checked)}
                className="size-4.5 accent-corail"
              />
              Afficher une banque de mots aux élèves
            </label>
            {trousBanque && (
              <div>
                <label className="etiquette mb-1.5 block">
                  Mots leurres supplémentaires (séparés par des virgules)
                </label>
                <input
                  value={trousExtras}
                  onChange={(e) => setTrousExtras(e.target.value)}
                  placeholder="dormi, pleuré, dansé"
                  className="champ"
                />
              </div>
            )}
          </>
        )}

        {type === "ordre" && (
          <div>
            <label className="etiquette mb-1.5 block">
              Éléments <span className="text-corail">dans le bon ordre</span> (les élèves les
              verront mélangés)
            </label>
            <div className="space-y-2">
              {ordreElements.map((element, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-titre grid size-9 shrink-0 place-items-center rounded-xl bg-encre font-bold text-papier">
                    {i + 1}
                  </span>
                  <input
                    value={element}
                    onChange={(e) =>
                      setOrdreElements(ordreElements.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    placeholder={`Élément n°${i + 1}`}
                    className="champ"
                  />
                  {ordreElements.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOrdreElements(ordreElements.filter((_, j) => j !== i))}
                      className="btn-fantome px-2 py-1.5"
                      aria-label="Supprimer l'élément"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {ordreElements.length < 8 && (
              <button
                type="button"
                onClick={() => setOrdreElements([...ordreElements, ""])}
                className="btn-ligne mt-3 px-3.5 py-1.5 text-xs"
              >
                <Plus className="size-3.5" /> Ajouter un élément
              </button>
            )}
          </div>
        )}

        {type === "association" && (
          <div>
            <label className="etiquette mb-1.5 block">
              Paires à associer (colonne de gauche ↔ élément correspondant)
            </label>
            <div className="space-y-2">
              {paires.map((paire, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={paire.gauche}
                    onChange={(e) =>
                      setPaires(
                        paires.map((p, j) => (j === i ? { ...p, gauche: e.target.value } : p))
                      )
                    }
                    placeholder="La cigale"
                    className="champ"
                  />
                  <Link2 className="size-4 shrink-0 text-encre/35" />
                  <input
                    value={paire.droite}
                    onChange={(e) =>
                      setPaires(
                        paires.map((p, j) => (j === i ? { ...p, droite: e.target.value } : p))
                      )
                    }
                    placeholder="chante tout l'été"
                    className="champ"
                  />
                  {paires.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPaires(paires.filter((_, j) => j !== i))}
                      className="btn-fantome px-2 py-1.5"
                      aria-label="Supprimer la paire"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {paires.length < 8 && (
              <button
                type="button"
                onClick={() => setPaires([...paires, { gauche: "", droite: "" }])}
                className="btn-ligne mt-3 px-3.5 py-1.5 text-xs"
              >
                <Plus className="size-3.5" /> Ajouter une paire
              </button>
            )}
          </div>
        )}

        {type === "question_ouverte" && (
          <>
            <div>
              <label className="etiquette mb-1.5 block">Question</label>
              <input
                value={ouverte.question}
                onChange={(e) => setOuverte({ ...ouverte, question: e.target.value })}
                placeholder="Que faisait la cigale pendant l'été ?"
                className="champ"
              />
            </div>
            <div>
              <label className="etiquette mb-1.5 block">
                Corrigé type (affiché à l&apos;élève après son erreur)
              </label>
              <textarea
                rows={2}
                value={ouverte.corrigeType}
                onChange={(e) => setOuverte({ ...ouverte, corrigeType: e.target.value })}
                placeholder="Elle chantait et dansait au lieu de travailler."
                className="champ rounded-2xl"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-encre-doux">
              <input
                type="checkbox"
                checked={ouverteAuto}
                onChange={(e) => setOuverteAuto(e.target.checked)}
                className="size-4.5 accent-corail"
              />
              Correction automatique (sinon : vous corrigez vous-même les réponses)
            </label>
            {ouverteAuto && (
              <div>
                <label className="etiquette mb-1.5 block">
                  Réponses acceptées (séparées par des virgules)
                </label>
                <input
                  value={ouverteReponses}
                  onChange={(e) => setOuverteReponses(e.target.value)}
                  placeholder="elle chantait, elle chantait et dansait"
                  className="champ"
                />
                <p className="mt-2 text-sm font-semibold text-encre/50">
                  La comparaison ignore les majuscules et les accents.
                </p>
              </div>
            )}
          </>
        )}

        {type === "video_interactive" && (
          <>
            <div>
              <label className="etiquette mb-1.5 block">
                Adresse de la vidéo (YouTube, Vimeo, Google Drive ou fichier .mp4)
              </label>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="champ"
              />
              {videoUrl.trim() !== "" &&
                (() => {
                  const v = normaliserVideo(videoUrl);
                  if (v.fournisseur === "inconnu")
                    return (
                      <p className="mt-2 text-sm font-bold text-corail">
                        Lien non reconnu. Utilisez YouTube, Vimeo, Google Drive ou une
                        adresse se terminant par .mp4
                      </p>
                    );
                  return (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-menthe-fonce">
                      <Check className="size-4" strokeWidth={3} />
                      {ETIQUETTES_FOURNISSEUR[v.fournisseur]} détecté ·{" "}
                      {v.interactif ? (
                        "pause automatique disponible"
                      ) : (
                        <span className="text-ambre-fonce">
                          pause automatique impossible : les questions seront posées après
                          la vidéo
                        </span>
                      )}
                    </p>
                  );
                })()}
            </div>

            <div>
              <label className="etiquette mb-2 block">
                Questions posées pendant la vidéo
              </label>
              <div className="space-y-4">
                {arrets.map((arret, index) => (
                  <div key={index} className="rounded-2xl bg-papier px-4 py-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2.5">
                      <span className="font-titre grid size-8 place-items-center rounded-xl bg-encre text-sm font-bold text-papier">
                        {index + 1}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-4 text-azur" />
                        <input
                          value={tempsSaisis[index] ?? ""}
                          onChange={(e) => {
                            const valeur = e.target.value;
                            setTempsSaisis((t) =>
                              t.map((x, i) => (i === index ? valeur : x))
                            );
                            majArret(index, { temps: tempsEnSecondes(valeur) });
                          }}
                          placeholder="1:35"
                          className="champ w-24 text-center"
                          aria-label="Moment de la pause"
                        />
                        <span className="text-xs font-bold text-encre/45">
                          = {secondesEnTemps(arret.temps)}
                        </span>
                      </span>
                      {arrets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setArrets((l) => l.filter((_, i) => i !== index));
                            setTempsSaisis((t) => t.filter((_, i) => i !== index));
                          }}
                          className="btn-fantome ml-auto px-2 py-1.5"
                          aria-label="Supprimer cet arrêt"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>

                    <input
                      value={arret.question}
                      onChange={(e) => majArret(index, { question: e.target.value })}
                      placeholder="Question posée à ce moment de la vidéo"
                      className="champ mb-2.5"
                    />

                    <div className="space-y-2">
                      {arret.options.map((option, io) => (
                        <div key={io} className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Bonne réponse"
                            onClick={() => majArret(index, { correct: io })}
                            className={`grid size-8 shrink-0 place-items-center rounded-xl border-2 font-titre text-xs font-bold transition-colors ${
                              arret.correct === io
                                ? "border-menthe bg-menthe text-white"
                                : "border-encre/20 bg-white text-encre/40 hover:border-menthe"
                            }`}
                          >
                            {String.fromCharCode(65 + io)}
                          </button>
                          <input
                            value={option}
                            onChange={(e) =>
                              majArret(index, {
                                options: arret.options.map((o, j) =>
                                  j === io ? e.target.value : o
                                ),
                              })
                            }
                            placeholder={`Proposition ${io + 1}`}
                            className="champ"
                          />
                          {arret.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() =>
                                majArret(index, {
                                  options: arret.options.filter((_, j) => j !== io),
                                  correct:
                                    arret.correct >= io && arret.correct > 0
                                      ? arret.correct - 1
                                      : arret.correct,
                                })
                              }
                              className="btn-fantome px-2 py-1.5"
                              aria-label="Supprimer la proposition"
                            >
                              <X className="size-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {arret.options.length < 4 && (
                        <button
                          type="button"
                          onClick={() =>
                            majArret(index, { options: [...arret.options, ""] })
                          }
                          className="btn-ligne px-3 py-1.5 text-xs"
                        >
                          <Plus className="size-3.5" /> Proposition
                        </button>
                      )}
                      <input
                        value={arret.explication}
                        onChange={(e) => majArret(index, { explication: e.target.value })}
                        placeholder="Explication affichée après (facultatif)"
                        className="champ flex-1"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {arrets.length < 10 && (
                <button
                  type="button"
                  onClick={() => {
                    const dernier = arrets[arrets.length - 1]?.temps ?? 0;
                    setArrets([
                      ...arrets,
                      {
                        temps: dernier + 30,
                        question: "",
                        options: ["", ""],
                        correct: 0,
                        explication: "",
                      },
                    ]);
                    setTempsSaisis([...tempsSaisis, secondesEnTemps(dernier + 30)]);
                  }}
                  className="btn-ligne mt-3 px-3.5 py-1.5 text-xs"
                >
                  <Plus className="size-3.5" /> Ajouter un arrêt
                </button>
              )}
            </div>
          </>
        )}

        {type === "h5p" && (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-azur/8 px-4 py-3.5 text-sm font-semibold text-encre-doux">
              <Info className="mt-0.5 size-5 shrink-0 text-azur" />
              <span>
                Créez votre activité sur{" "}
                <a
                  href="https://h5p.org/content-types-and-applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-azur underline underline-offset-2"
                >
                  h5p.org <ExternalLink className="inline size-3" />
                </a>{" "}
                (gratuit), <strong>Lumi</strong> (logiciel libre) ou votre LMS, puis
                cliquez sur <strong>« Embed »</strong> et collez ici le code obtenu.
                Fablio en extrait automatiquement l&apos;adresse d&apos;intégration.
              </span>
            </div>

            <div>
              <label className="etiquette mb-1.5 block">
                Code d&apos;intégration ou adresse de l&apos;activité H5P
              </label>
              <textarea
                rows={3}
                value={h5p.embedUrl}
                onChange={(e) => setH5p({ ...h5p, embedUrl: e.target.value })}
                placeholder='<iframe src="https://h5p.org/h5p/embed/123456" …></iframe>  ou  https://votre-site.h5p.com/content/123/embed'
                className="champ rounded-2xl font-mono text-xs"
              />
              {h5p.embedUrl.trim() !== "" &&
                (normaliserUrlH5p(h5p.embedUrl) ? (
                  <p className="mt-2 flex items-start gap-1.5 text-sm font-bold break-all text-menthe-fonce">
                    <Check className="mt-0.5 size-4 shrink-0" strokeWidth={3} />
                    Adresse détectée : {normaliserUrlH5p(h5p.embedUrl)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-bold text-corail">
                    Impossible de trouver une adresse https:// dans ce texte.
                  </p>
                ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="etiquette mb-1.5 block">Titre affiché à l&apos;élève</label>
                <input
                  value={h5p.titre}
                  onChange={(e) => setH5p({ ...h5p, titre: e.target.value })}
                  placeholder="Retrouve les personnages de la fable"
                  className="champ"
                />
              </div>
              <div>
                <label className="etiquette mb-1.5 block">Hauteur d&apos;affichage (px)</label>
                <input
                  type="number"
                  min={200}
                  max={1400}
                  step={20}
                  value={h5p.hauteur}
                  onChange={(e) =>
                    setH5p({ ...h5p, hauteur: Number(e.target.value) || 500 })
                  }
                  className="champ"
                />
                <p className="mt-1.5 text-xs font-semibold text-encre/45">
                  Ajustée automatiquement ensuite par l&apos;activité.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 border-t-2 border-dashed border-encre/10 pt-4">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm font-bold text-encre-doux">
                <input
                  type="checkbox"
                  checked={h5p.validationAutomatique}
                  onChange={(e) =>
                    setH5p({ ...h5p, validationAutomatique: e.target.checked })
                  }
                  className="mt-0.5 size-4.5 accent-corail"
                />
                <span>
                  Valider automatiquement l&apos;exercice quand l&apos;élève déclare avoir
                  terminé
                  <span className="block text-xs font-semibold text-encre/45">
                    Décoché : la réponse vous est envoyée pour une correction manuelle
                    (recommandé — le score H5P ne peut pas être récupéré depuis un site
                    externe).
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-encre-doux">
                <input
                  type="checkbox"
                  checked={h5p.demanderScore}
                  onChange={(e) => setH5p({ ...h5p, demanderScore: e.target.checked })}
                  className="size-4.5 accent-corail"
                />
                Demander à l&apos;élève le score obtenu dans l&apos;activité
              </label>
            </div>
          </>
        )}
      </div>

      {/* ----- Paramètres communs ----- */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiquette mb-1.5 block">Points</label>
          <input
            type="number"
            min={1}
            max={100}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette mb-1.5 block">
            Tentatives max. (vide = illimité)
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={maxTentatives}
            onChange={(e) => setMaxTentatives(e.target.value)}
            placeholder="Illimité"
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette mb-1.5 block">Encouragement si bonne réponse</label>
          <input
            value={feedbackCorrect}
            onChange={(e) => setFeedbackCorrect(e.target.value)}
            placeholder="Bravo, tu as bien compris l'histoire !"
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette mb-1.5 block">Feedback en cas d&apos;erreur</label>
          <input
            value={feedbackIncorrect}
            onChange={(e) => setFeedbackIncorrect(e.target.value)}
            placeholder="Relis la fable : la réponse s'y trouve…"
            className="champ"
          />
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-encre-doux">
        <input
          type="checkbox"
          checked={publie}
          onChange={(e) => setPublie(e.target.checked)}
          className="size-4.5 accent-corail"
        />
        Exercice publié (visible par les élèves)
      </label>

      {erreur && (
        <p className="mt-4 rounded-xl border-2 border-rose/30 bg-rose/10 px-4 py-2.5 text-sm font-bold text-rose">
          {erreur}
        </p>
      )}
      {!erreur && erreurPayload && (
        <p className="mt-4 rounded-xl bg-ambre/12 px-4 py-2.5 text-sm font-bold text-ambre-fonce">
          À compléter : {erreurPayload}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sauvegarder}
          disabled={chargement || erreurPayload !== null}
          className="btn-primaire"
        >
          {chargement ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : (
            <Save className="size-4.5" />
          )}
          {initial ? "Enregistrer" : "Créer l'exercice"}
        </button>
        <button
          type="button"
          onClick={() => setMontreApercu((m) => !m)}
          disabled={erreurPayload !== null}
          className="btn-ligne"
        >
          <Eye className="size-4.5" /> {montreApercu ? "Masquer l'aperçu" : "Aperçu élève"}
        </button>
        <button type="button" onClick={onTermine} className="btn-fantome">
          Annuler
        </button>
      </div>

      {montreApercu && !erreurPayload && (
        <div className="anim-apparition mt-5 border-t-2 border-dashed border-encre/10 pt-5">
          <JoueurExercice
            mode="apercu"
            exercice={{
              id: initial?.id ?? "apercu",
              type,
              typeEtiquette: ETIQUETTES_TYPES[type],
              consigne,
              points: Number(points) || 10,
              feedbackCorrect,
              feedbackIncorrect,
              payload,
              presentation: fabriquerPresentation(type, payload, graine.current),
              maxTentatives: maxTentatives === "" ? null : Number(maxTentatives),
              tentativesUtilisees: 0,
              tentativesRestantes: null,
              meilleurScore: null,
              reussi: false,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gestionnaire principal
// ---------------------------------------------------------------------------

export function GestionExercices({
  fableId,
  exercices,
}: {
  fableId: string;
  exercices: ExerciceEditable[];
}) {
  const [editionId, setEditionId] = useState<string | null>(null);
  const [nouveauType, setNouveauType] = useState<TypeExercice | null>(null);
  const [apercuId, setApercuId] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();

  const tries = [...exercices].sort((a, b) => a.ordre - b.ordre);

  async function action(promesse: Promise<Response>) {
    setEnCours(true);
    try {
      const res = await promesse;
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { erreur?: string };
        alert(json.erreur ?? "Une erreur est survenue.");
      }
      router.refresh();
    } finally {
      setEnCours(false);
    }
  }

  const deplacer = (index: number, direction: -1 | 1) => {
    const j = index + direction;
    if (j < 0 || j >= tries.length) return;
    const ids = tries.map((e) => e.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void action(
      fetch(`/api/enseignant/fables/${fableId}/ordre-exercices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
    );
  };

  const basculerPublication = (exo: ExerciceEditable) =>
    void action(
      fetch(`/api/enseignant/exercices/${exo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publie: !exo.publie }),
      })
    );

  const supprimer = (exo: ExerciceEditable) => {
    if (!confirm("Supprimer définitivement cet exercice ? Les réponses des élèves liées seront aussi supprimées."))
      return;
    void action(fetch(`/api/enseignant/exercices/${exo.id}`, { method: "DELETE" }));
  };

  return (
    <div className="space-y-4">
      {tries.length === 0 && (
        <p className="carte border-dashed px-6 py-8 text-center font-semibold text-encre/50">
          Aucun exercice pour le moment. Choisissez un type ci-dessous pour commencer.
        </p>
      )}

      {tries.map((exo, index) => {
        const Icone = ICONES_TYPES[exo.type];
        if (editionId === exo.id) {
          return (
            <FormulaireExercice
              key={exo.id}
              fableId={fableId}
              type={exo.type}
              initial={exo}
              onTermine={() => setEditionId(null)}
            />
          );
        }
        return (
          <div key={exo.id} className="carte p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-titre grid size-9 place-items-center rounded-xl bg-encre font-bold text-papier">
                {index + 1}
              </span>
              <span className="grid size-9 place-items-center rounded-xl bg-lilas/12 text-lilas" title={exo.typeEtiquette}>
                <Icone className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-titre font-bold">
                  <span className="mr-2 text-encre/40">{exo.typeEtiquette}</span>
                  {resumeCourt(exo)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                    {exo.points} pts
                  </span>
                  <span className={`badge ${exo.publie ? "bg-sarcelle/12 text-sarcelle" : "bg-encre/8 text-encre/50"}`}>
                    {exo.publie ? "Publié" : "Brouillon"}
                  </span>
                  {exo.maxTentatives && (
                    <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                      {exo.maxTentatives} tentative(s) max.
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => deplacer(index, -1)} disabled={enCours || index === 0} className="btn-fantome px-2 py-1.5" title="Monter">
                  <ChevronUp className="size-4.5" />
                </button>
                <button type="button" onClick={() => deplacer(index, 1)} disabled={enCours || index === tries.length - 1} className="btn-fantome px-2 py-1.5" title="Descendre">
                  <ChevronDown className="size-4.5" />
                </button>
                <button type="button" onClick={() => basculerPublication(exo)} disabled={enCours} className="btn-fantome px-2.5 py-1.5 text-xs" title={exo.publie ? "Dépublier" : "Publier"}>
                  {exo.publie ? "Dépublier" : "Publier"}
                </button>
                <button
                  type="button"
                  onClick={() => setApercuId(apercuId === exo.id ? null : exo.id)}
                  className="btn-fantome px-2 py-1.5"
                  title="Aperçu élève"
                >
                  <Eye className="size-4.5" />
                </button>
                <button type="button" onClick={() => setEditionId(exo.id)} className="btn-ligne px-3 py-1.5 text-xs">
                  <Pencil className="size-3.5" /> Modifier
                </button>
                <button type="button" onClick={() => supprimer(exo)} disabled={enCours} className="btn-fantome px-2 py-1.5 text-corail hover:bg-corail/10" title="Supprimer">
                  <Trash2 className="size-4.5" />
                </button>
              </div>
            </div>
            {apercuId === exo.id && (
              <div className="anim-apparition mt-4 border-t-2 border-dashed border-encre/10 pt-4">
                <JoueurExercice
                  mode="apercu"
                  exercice={{
                    id: exo.id,
                    type: exo.type,
                    typeEtiquette: exo.typeEtiquette,
                    consigne: exo.consigne,
                    points: exo.points,
                    feedbackCorrect: exo.feedbackCorrect,
                    feedbackIncorrect: exo.feedbackIncorrect,
                    payload: exo.payload,
                    presentation: fabriquerPresentation(exo.type, exo.payload, exo.id),
                    maxTentatives: exo.maxTentatives,
                    tentativesUtilisees: 0,
                    tentativesRestantes: null,
                    meilleurScore: null,
                    reussi: false,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Ajout d'un nouvel exercice */}
      {nouveauType === null ? (
        <div className="carte border-dashed p-5">
          <p className="etiquette mb-3 flex items-center gap-2">
            <GripVertical className="size-4" /> Ajouter un exercice — choisissez un type
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {TYPES_EXERCICES.map((t) => {
              const Icone = ICONES_TYPES[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNouveauType(t)}
                  className="group flex items-center gap-3 rounded-2xl border-2 border-encre/10 bg-white px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-corail/50 hover:shadow-carte"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-corail/10 text-corail transition-transform group-hover:scale-110">
                    <Icone className="size-5" />
                  </span>
                  <span>
                    <span className="font-titre block text-sm font-bold">{ETIQUETTES_TYPES[t]}</span>
                    <span className="block text-xs font-semibold text-encre/45">
                      {DESCRIPTIONS_TYPES[t].split(".")[0]}.
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <FormulaireExercice
          key={`nouveau-${nouveauType}`}
          fableId={fableId}
          type={nouveauType}
          initial={null}
          onTermine={() => setNouveauType(null)}
        />
      )}
    </div>
  );
}
