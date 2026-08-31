"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Star,
  Sparkles,
  Heart,
  Hourglass,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SendHorizonal,
  Trophy,
  Eye,
  ThumbsUp,
  ThumbsDown,
  LoaderCircle,
} from "lucide-react";
import {
  corrigeExercice,
  noterExercice,
  type AssociationPayload,
  type OrdrePayload,
  type OuvertePayload,
  type PayloadExercice,
  type PresentationExercice,
  type QcmPayload,
  type ReponseEleve,
  type TrousPayload,
  type TypeExercice,
  type VraiFauxPayload,
} from "@/lib/exercices";
import { formatScore } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export interface ExerciceJoueur {
  id: string;
  type: TypeExercice;
  typeEtiquette: string;
  consigne: string;
  points: number;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  payload: PayloadExercice;
  presentation: PresentationExercice;
  maxTentatives?: number | null;
  tentativesUtilisees?: number;
  tentativesRestantes?: number | null;
  meilleurScore?: number | null;
  reussi?: boolean;
}

interface ResultatVue {
  score: number | null;
  maxScore: number;
  estCorrect: boolean | null;
  feedback: string;
  correction: string[];
  tentativesRestantes: number | null;
}

// ---------------------------------------------------------------------------
// Sous-composants par type (remplissent la réponse via onChangement)
// ---------------------------------------------------------------------------

type PropsZone = {
  verrouille: boolean;
  onChangement: (reponse: ReponseEleve, valide: boolean) => void;
};

function ZoneQcm({ payload, verrouille, onChangement }: PropsZone & { payload: QcmPayload }) {
  const [selection, setSelection] = useState<number[]>([]);

  function basculer(i: number) {
    if (verrouille) return;
    let prochaine: number[];
    if (payload.multiple) {
      prochaine = selection.includes(i)
        ? selection.filter((s) => s !== i)
        : [...selection, i].sort((a, b) => a - b);
    } else {
      prochaine = [i];
    }
    setSelection(prochaine);
    onChangement(prochaine, prochaine.length > 0);
  }

  return (
    <div>
      <p className="font-titre text-xl leading-snug font-bold">{payload.question}</p>
      <p className="mt-1 text-sm font-bold text-encre/45">
        {payload.multiple ? "Plusieurs réponses possibles" : "Une seule bonne réponse"}
      </p>
      <div className="mt-4 grid gap-2.5">
        {payload.options.map((option, i) => {
          const active = selection.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={verrouille}
              onClick={() => basculer(i)}
              className={`flex items-center gap-3.5 rounded-2xl border-3 px-5 py-4 text-left text-lg font-bold transition-all ${
                active
                  ? "border-corail bg-corail/10 text-encre"
                  : "border-encre/15 bg-white hover:border-encre/40"
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full border-3 transition-colors ${
                  active ? "border-corail bg-corail text-white" : "border-encre/25 text-transparent"
                }`}
              >
                <Check className="size-4" strokeWidth={3.5} />
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ZoneVraiFaux({
  payload,
  verrouille,
  onChangement,
}: PropsZone & { payload: VraiFauxPayload }) {
  const [choix, setChoix] = useState<boolean | null>(null);

  function choisir(v: boolean) {
    if (verrouille) return;
    setChoix(v);
    onChangement(v, true);
  }

  return (
    <div>
      <p className="font-titre text-xl leading-snug font-bold">{payload.enonce}</p>
      <div className="mt-5 grid grid-cols-2 gap-3.5">
        <button
          type="button"
          disabled={verrouille}
          onClick={() => choisir(true)}
          className={`btn-gomme flex flex-col items-center gap-2 rounded-3xl px-4 py-6 font-titre text-2xl font-bold transition-colors ${
            choix === true ? "bg-sarcelle text-white" : "bg-white text-sarcelle"
          }`}
        >
          <ThumbsUp className="size-9" strokeWidth={2.4} />
          VRAI
        </button>
        <button
          type="button"
          disabled={verrouille}
          onClick={() => choisir(false)}
          className={`btn-gomme flex flex-col items-center gap-2 rounded-3xl px-4 py-6 font-titre text-2xl font-bold transition-colors ${
            choix === false ? "bg-rose text-white" : "bg-white text-rose"
          }`}
        >
          <ThumbsDown className="size-9" strokeWidth={2.4} />
          FAUX
        </button>
      </div>
    </div>
  );
}

function ZoneTrous({ payload, presentation, verrouille, onChangement }: PropsZone & {
  payload: TrousPayload;
  presentation: PresentationExercice;
}) {
  const [valeurs, setValeurs] = useState<string[]>(() =>
    payload.reponses.map(() => "")
  );
  const focusIndex = useRef(0);

  function maj(i: number, v: string) {
    const prochaines = valeurs.map((x, j) => (j === i ? v : x));
    setValeurs(prochaines);
    onChangement(prochaines, prochaines.every((x) => x.trim() !== ""));
  }

  function remplirDepuisBanque(mot: string) {
    if (verrouille) return;
    let cible = focusIndex.current;
    if (valeurs[cible]?.trim() !== "") {
      const premierVide = valeurs.findIndex((v) => v.trim() === "");
      if (premierVide >= 0) cible = premierVide;
    }
    maj(cible, mot);
    focusIndex.current = Math.min(cible + 1, valeurs.length - 1);
  }

  return (
    <div>
      {presentation.banque && presentation.banque.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {presentation.banque.map((mot) => (
            <button
              key={mot}
              type="button"
              disabled={verrouille}
              onClick={() => remplirDepuisBanque(mot)}
              className="btn-gomme rounded-full bg-ambre/25 px-4 py-1.5 font-titre text-base font-bold text-encre hover:bg-ambre/40"
            >
              {mot}
            </button>
          ))}
        </div>
      )}
      <p className="font-lecture text-xl leading-[2.75rem] font-medium">
        {payload.segments.map((segment, i) => (
          <span key={i}>
            {segment}
            {i < payload.reponses.length && (
              <input
                value={valeurs[i]}
                disabled={verrouille}
                onFocus={() => (focusIndex.current = i)}
                onChange={(e) => maj(i, e.target.value)}
                aria-label={`Trou numéro ${i + 1}`}
                className="mx-1.5 inline-block rounded-xl border-3 border-encre/25 bg-white px-2 py-1 text-center font-titre text-lg font-bold text-corail transition-colors outline-none focus:border-corail"
                style={{
                  width: `${Math.max(5, (payload.reponses[i]?.[0] ?? "mot").length + 3)}ch`,
                }}
              />
            )}
          </span>
        ))}
      </p>
      {presentation.banque && presentation.banque.length > 0 && (
        <p className="mt-3 text-sm font-bold text-encre/45">
          Astuce : touche un mot jaune pour remplir le trou, ou écris toi-même la réponse.
        </p>
      )}
    </div>
  );
}

function ZoneOrdre({ presentation, verrouille, onChangement }: PropsZone & {
  presentation: PresentationExercice;
}) {
  const [elements, setElements] = useState<{ texte: string; origine: number }[]>(
    () => presentation.elementsOrdre ?? []
  );

  // L'ordre initial (mélangé) est déjà une réponse valide.
  useEffect(() => {
    onChangement(
      (presentation.elementsOrdre ?? []).map((e) => e.origine),
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function deplacer(i: number, direction: -1 | 1) {
    const j = i + direction;
    if (j < 0 || j >= elements.length) return;
    const copie = [...elements];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    setElements(copie);
    onChangement(
      copie.map((e) => e.origine),
      true
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm font-bold text-encre/45">
        Replace les éléments dans le bon ordre à l&apos;aide des flèches.
      </p>
      <ol className="space-y-2.5">
        {elements.map((element, i) => (
          <li
            key={element.origine}
            className="flex items-center gap-3 rounded-2xl border-3 border-encre/15 bg-white px-4 py-3"
          >
            <span className="font-titre grid size-9 shrink-0 place-items-center rounded-full bg-encre text-lg font-bold text-papier">
              {i + 1}
            </span>
            <span className="flex-1 text-base leading-snug font-bold">{element.texte}</span>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                aria-label="Monter"
                disabled={verrouille || i === 0}
                onClick={() => deplacer(i, -1)}
                className="grid size-8 place-items-center rounded-lg border-2 border-encre/20 bg-papier text-encre transition-colors hover:bg-encre hover:text-papier disabled:opacity-25"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Descendre"
                disabled={verrouille || i === elements.length - 1}
                onClick={() => deplacer(i, 1)}
                className="grid size-8 place-items-center rounded-lg border-2 border-encre/20 bg-papier text-encre transition-colors hover:bg-encre hover:text-papier disabled:opacity-25"
              >
                <ArrowDown className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ZoneAssociation({ payload, presentation, verrouille, onChangement }: PropsZone & {
  payload: AssociationPayload;
  presentation: PresentationExercice;
}) {
  const droites = presentation.droitesAssociation ?? [];
  const [choix, setChoix] = useState<(number | null)[]>(() =>
    payload.paires.map(() => null)
  );

  function choisir(i: number, valeur: number | null) {
    if (verrouille) return;
    const copie = choix.map((c, j) => {
      if (j === i) return valeur;
      if (valeur !== null && c === valeur) return null; // unicité d'une association
      return c;
    });
    setChoix(copie);
    onChangement(
      copie,
      copie.every((c) => c !== null)
    );
  }

  return (
    <div className="space-y-3">
      <p className="mb-1 text-sm font-bold text-encre/45">
        Pour chaque élément de gauche, choisis ce qui lui correspond à droite.
      </p>
      {payload.paires.map((paire, i) => (
        <div
          key={i}
          className="flex flex-col gap-2.5 rounded-2xl border-3 border-encre/15 bg-white px-4 py-3.5 sm:flex-row sm:items-center"
        >
          <span className="flex-1 font-titre text-lg font-bold">{paire.gauche}</span>
          <select
            value={choix[i] === null ? "" : String(choix[i])}
            disabled={verrouille}
            onChange={(e) =>
              choisir(i, e.target.value === "" ? null : Number(e.target.value))
            }
            aria-label={`Association pour ${paire.gauche}`}
            className="champ cursor-pointer sm:w-64"
          >
            <option value="">— Choisir… —</option>
            {droites.map((d) => (
              <option key={d.origine} value={d.origine}>
                {d.texte}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function ZoneOuverte({ payload, verrouille, onChangement }: PropsZone & {
  payload: OuvertePayload;
}) {
  return (
    <div>
      <p className="font-titre text-xl leading-snug font-bold">{payload.question}</p>
      <textarea
        rows={4}
        disabled={verrouille}
        onChange={(e) => onChangement(e.target.value, e.target.value.trim().length > 0)}
        placeholder="Écris ta réponse ici, avec tes propres mots…"
        className="champ mt-4 min-h-28 resize-y rounded-2xl text-base"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function JoueurExercice({
  exercice,
  numero,
  mode = "jeu",
}: {
  exercice: ExerciceJoueur;
  numero?: number;
  mode?: "jeu" | "apercu";
}) {
  const [phase, setPhase] = useState<"jeu" | "resultat">("jeu");
  const [reponse, setReponse] = useState<ReponseEleve | null>(null);
  const [valide, setValide] = useState(false);
  const [resultat, setResultat] = useState<ResultatVue | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const debut = useRef(Date.now());
  const router = useRouter();

  const epuise =
    mode === "jeu" && exercice.tentativesRestantes === 0 && phase === "jeu";
  const verrouille = phase === "resultat" || enCours;

  async function validerReponse() {
    if (!valide || reponse === null) return;
    setErreur(null);
    const dureeSecondes = Math.round((Date.now() - debut.current) / 1000);

    if (mode === "apercu") {
      const note = noterExercice(exercice.type, exercice.payload, reponse, exercice.points);
      const feedback =
        note.estCorrect === null
          ? "Ta réponse a bien été enregistrée : ton enseignant va la corriger."
          : note.estCorrect
            ? exercice.feedbackCorrect || "Bravo, c'est exactement ça !"
            : exercice.feedbackIncorrect ||
              "Ce n'est pas tout à fait ça… Relis bien la fable et réessaie !";
      setResultat({
        score: note.score,
        maxScore: note.maxScore,
        estCorrect: note.estCorrect,
        feedback,
        correction: note.estCorrect === false ? corrigeExercice(exercice.type, exercice.payload) : [],
        tentativesRestantes: null,
      });
      setPhase("resultat");
      return;
    }

    setEnCours(true);
    try {
      const res = await fetch(`/api/exercices/${exercice.id}/soumettre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reponse, dureeSecondes }),
      });
      const json = (await res.json()) as {
        erreur?: string;
        resultat?: ResultatVue;
      };
      if (!res.ok || !json.resultat) throw new Error(json.erreur ?? "Erreur inattendue.");
      setResultat(json.resultat);
      setPhase("resultat");
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setEnCours(false);
    }
  }

  function recommencer() {
    setPhase("jeu");
    setResultat(null);
    debut.current = Date.now();
    router.refresh();
  }

  const zoneProps = {
    verrouille,
    onChangement: (r: ReponseEleve, v: boolean) => {
      setReponse(r);
      setValide(v);
    },
  };

  return (
    <article
      className={`carte relative overflow-hidden p-6 sm:p-8 ${
        phase === "resultat" && resultat?.estCorrect === true ? "ring-4 ring-sarcelle/25" : ""
      }`}
    >
      {/* En-tête de l'exercice */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        {numero !== undefined && (
          <span className="font-titre grid size-10 place-items-center rounded-2xl bg-encre text-lg font-bold text-papier">
            {numero}
          </span>
        )}
        <span className="badge bg-lilas/12 text-lilas">{exercice.typeEtiquette}</span>
        <span className="badge border-2 border-encre/10 bg-white text-encre-doux">
          <Trophy className="size-3.5 text-ambre-fonce" /> {exercice.points} pts
        </span>
        {mode === "apercu" && (
          <span className="badge bg-ciel/12 text-ciel">
            <Eye className="size-3.5" /> Aperçu enseignant
          </span>
        )}
        {mode === "jeu" && exercice.reussi && (
          <span className="badge bg-sarcelle/12 text-sarcelle">
            <Check className="size-3.5" strokeWidth={3.5} /> Réussi
            {exercice.meilleurScore !== null &&
              exercice.meilleurScore !== undefined &&
              ` · ${formatScore(exercice.meilleurScore)}/${exercice.points}`}
          </span>
        )}
        {mode === "jeu" && exercice.maxTentatives != null && (
          <span className="badge border-2 border-encre/10 bg-white text-encre/55">
            {exercice.tentativesUtilisees ?? 0}/{exercice.maxTentatives} tentative(s)
          </span>
        )}
      </div>

      {exercice.consigne && (
        <p className="mb-5 rounded-2xl bg-papier px-5 py-3.5 font-bold text-encre-doux">
          {exercice.consigne}
        </p>
      )}

      {/* Zone de jeu */}
      {exercice.type === "qcm" && (
        <ZoneQcm payload={exercice.payload as QcmPayload} {...zoneProps} />
      )}
      {exercice.type === "vrai_faux" && (
        <ZoneVraiFaux payload={exercice.payload as VraiFauxPayload} {...zoneProps} />
      )}
      {exercice.type === "texte_trous" && (
        <ZoneTrous
          payload={exercice.payload as TrousPayload}
          presentation={exercice.presentation}
          {...zoneProps}
        />
      )}
      {exercice.type === "ordre" && (
        <ZoneOrdre presentation={exercice.presentation} {...zoneProps} />
      )}
      {exercice.type === "association" && (
        <ZoneAssociation
          payload={exercice.payload as AssociationPayload}
          presentation={exercice.presentation}
          {...zoneProps}
        />
      )}
      {exercice.type === "question_ouverte" && (
        <ZoneOuverte payload={exercice.payload as OuvertePayload} {...zoneProps} />
      )}

      {erreur && (
        <p className="mt-4 rounded-xl border-2 border-rose/30 bg-rose/10 px-4 py-2.5 text-sm font-bold text-rose">
          {erreur}
        </p>
      )}

      {/* Pied : boutons d'action */}
      {phase === "jeu" && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {epuise ? (
            <p className="w-full rounded-2xl bg-encre/6 px-5 py-3.5 text-center font-bold text-encre/55">
              Tu as utilisé toutes tes tentatives pour cet exercice.
            </p>
          ) : (
            <button
              type="button"
              onClick={validerReponse}
              disabled={!valide || enCours}
              className="btn-gomme rounded-full bg-corail px-8 py-3.5 font-titre text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enCours ? (
                <LoaderCircle className="mr-2 inline size-5 animate-spin" />
              ) : (
                <SendHorizonal className="mr-2 inline size-5" />
              )}
              Valider ma réponse
            </button>
          )}
        </div>
      )}

      {/* Panneau résultat */}
      {phase === "resultat" && resultat && (
        <div
          className={`anim-apparition mt-6 rounded-3xl border-2 px-6 py-5 ${
            resultat.estCorrect === true
              ? "border-sarcelle/30 bg-sarcelle/10"
              : resultat.estCorrect === null
                ? "border-ciel/30 bg-ciel/10"
                : "border-ambre/35 bg-ambre/12"
          }`}
        >
          <div className="flex items-start gap-4">
            <span
              className={`anim-etoile grid size-12 shrink-0 place-items-center rounded-2xl ${
                resultat.estCorrect === true
                  ? "bg-sarcelle text-white"
                  : resultat.estCorrect === null
                    ? "bg-ciel text-white"
                    : "bg-ambre text-white"
              }`}
            >
              {resultat.estCorrect === true ? (
                <Star className="size-6 fill-current" />
              ) : resultat.estCorrect === null ? (
                <Hourglass className="size-6" />
              ) : (
                <Heart className="size-6" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-titre text-xl font-bold">
                {resultat.estCorrect === true
                  ? "Bravo, excellent travail !"
                  : resultat.estCorrect === null
                    ? "Réponse envoyée !"
                    : "Presque ! Courage…"}
              </p>
              <p className="mt-1 font-semibold text-encre-doux">{resultat.feedback}</p>

              {resultat.score !== null && (
                <p className="font-titre mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1 text-sm font-bold">
                  {resultat.estCorrect ? (
                    <Sparkles className="size-4 text-ambre-fonce" />
                  ) : (
                    <X className="size-4 text-corail" />
                  )}
                  Score : {formatScore(resultat.score)} / {resultat.maxScore} points
                </p>
              )}

              {resultat.correction.length > 0 && resultat.estCorrect === false && (
                <div className="mt-4 rounded-2xl bg-white/80 px-5 py-4">
                  <p className="etiquette mb-2">La correction</p>
                  <ul className="space-y-1">
                    {resultat.correction.map((ligne, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm font-bold text-encre-doux">
                        <Check className="mt-0.5 size-4 shrink-0 text-sarcelle" strokeWidth={3} />
                        {ligne}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {resultat.estCorrect !== null &&
                  (resultat.tentativesRestantes === null ||
                    resultat.tentativesRestantes > 0 ||
                    mode === "apercu") && (
                    <button type="button" onClick={recommencer} className="btn-ligne">
                      <RotateCcw className="size-4" />
                      {resultat.estCorrect ? "Refaire pour le plaisir" : "Réessayer"}
                    </button>
                  )}
                {resultat.estCorrect === false &&
                  resultat.tentativesRestantes !== null &&
                  resultat.tentativesRestantes === 0 && (
                    <p className="text-sm font-bold text-encre/50">
                      Plus de tentative disponible — regarde bien la correction !
                    </p>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
