// Logique PURE de conversion (aucun secret, aucun appel réseau) : utilisable
// côté serveur ET dans des composants clients (ex. estMappableMoodle).
import {
  ETIQUETTES_TYPES,
  type OuvertePayload,
  type PayloadExercice,
  type QcmPayload,
  type ReponseEleve,
  type TrousPayload,
  type TypeExercice,
  type VraiFauxPayload,
} from "@/lib/exercices";

// ---------------------------------------------------------------------------
// Conversion d'un exercice Fablio → questions/quiz Moodle (automate Phase 7).
// Fablio reste propriétaire des métadonnées (fable, niveau, compétence,
// objectif pédagogique) ; on ne transmet à Moodle que l'exécution.
// ---------------------------------------------------------------------------

export interface QuestionMoodle {
  qtype: "multichoice" | "truefalse" | "shortanswer" | "matching";
  name: string;
  questiontext: string;
  maxmark: number;
  /** Options propres au type — exactement ce que lit populate_qtype_fields. */
  data: Record<string, unknown>;
}

export interface ConversionResult {
  mappable: boolean;
  questions: QuestionMoodle[];
  /** Si false, indique pourquoi la conversion n'est pas possible. */
  raison?: string;
}

/** Types Fablio automatiquement convertibles en quiz Moodle. */
export const TYPES_MAPPABLES_MOODLE: TypeExercice[] = [
  "qcm",
  "vrai_faux",
  "question_ouverte",
  "texte_trous",
];

export function estMappableMoodle(type: TypeExercice): boolean {
  return TYPES_MAPPABLES_MOODLE.includes(type);
}

function nomCourt(titre: string, max = 60): string {
  return titre.length > max ? `${titre.slice(0, max - 1)}…` : titre;
}

/** Convertit un exercice Fablio en liste de questions Moodle. */
export function convertirVersMoodle(
  type: TypeExercice,
  payload: PayloadExercice,
  points: number,
  titreFable: string,
  consigne: string
): ConversionResult {
  const base = `${titreFable} — ${ETIQUETTES_TYPES[type]}`;
  const consigneTexte = consigne || ETIQUETTES_TYPES[type];

  switch (type) {
    case "qcm": {
      const p = payload as QcmPayload;
      return {
        mappable: true,
        questions: [
          {
            qtype: "multichoice",
            name: nomCourt(base),
            questiontext: p.question,
            maxmark: points,
            data: {
              options: p.options,
              corrects: p.corrects,
              multiple: p.multiple,
              correct_feedback: consigneTexte,
              incorrect_feedback: "",
            },
          },
        ],
      };
    }

    case "vrai_faux": {
      const p = payload as VraiFauxPayload;
      return {
        mappable: true,
        questions: [
          {
            qtype: "truefalse",
            name: nomCourt(base),
            questiontext: p.enonce,
            maxmark: points,
            data: {
              answer: p.reponse,
              correct_feedback: consigneTexte,
              incorrect_feedback: "",
            },
          },
        ],
      };
    }

    case "question_ouverte": {
      const p = payload as OuvertePayload;
      // La correction automatique nécessite des réponses acceptées.
      if (p.reponsesAcceptees.length === 0) {
        return {
          mappable: false,
          questions: [],
          raison:
            "Question ouverte sans correction automatique : ajoutez des réponses acceptées pour l'envoyer à Moodle.",
        };
      }
      return {
        mappable: true,
        questions: [
          {
            qtype: "shortanswer",
            name: nomCourt(base),
            questiontext: p.question,
            maxmark: points,
            data: { answer: p.reponsesAcceptees[0] },
          },
        ],
      };
    }

    case "texte_trous": {
      const p = payload as TrousPayload;
      // Chaque trou devient une question « réponse courte » avec son contexte.
      const questions: QuestionMoodle[] = [];
      for (let i = 0; i < p.reponses.length; i++) {
        const avant = (p.segments[i] ?? "").trim().slice(-80);
        const apres = (p.segments[i + 1] ?? "").trim().slice(0, 60);
        questions.push({
          qtype: "shortanswer",
          name: `${nomCourt(base)} — trou ${i + 1}`,
          questiontext: `Complète : ${avant} …… ${apres}`,
          maxmark: Math.max(1, Math.round((points / p.reponses.length) * 2) / 2),
          data: { answer: p.reponses[i][0] ?? "" },
        });
      }
      return { mappable: true, questions };
    }

    default:
      return {
        mappable: false,
        questions: [],
        raison:
          "Ce type n'a pas d'équivalent Moodle natif : il reste exécuté par la plateforme Fablio.",
      };
  }
}

// ---------------------------------------------------------------------------
// Réponse d'un élève (Fablio) → réponses attendues par le plugin, par slot.
// L'ordre des slots correspond à l'ordre des questions créées (conversion.ts).
// ---------------------------------------------------------------------------

export function reponsesPourMoodle(
  type: TypeExercice,
  payload: PayloadExercice,
  reponse: ReponseEleve
): Record<string, Record<string, unknown>> {
  const slot = (index: number) => String(index + 1); // slots Moodle commencent à 1

  switch (type) {
    case "qcm": {
      const sel = Array.isArray(reponse) ? reponse : [];
      return { [slot(0)]: { selected: (sel as number[]).map(Number) } };
    }
    case "vrai_faux":
      return { [slot(0)]: { value: reponse === true } };
    case "question_ouverte":
      return { [slot(0)]: { text: String(reponse ?? "") } };
    case "texte_trous": {
      const p = payload as TrousPayload;
      const liste = Array.isArray(reponse) ? (reponse as string[]) : [];
      const sortie: Record<string, Record<string, unknown>> = {};
      for (let i = 0; i < p.reponses.length; i++) {
        sortie[slot(i)] = { text: String(liste[i] ?? "") };
      }
      return sortie;
    }
    default:
      return {};
  }
}

export function resumerQuestions(questions: QuestionMoodle[]): string {
  const parType = new Map<string, number>();
  for (const q of questions) parType.set(q.qtype, (parType.get(q.qtype) ?? 0) + 1);
  return [...parType.entries()]
    .map(([qtype, n]) => `${n} × ${qtype}`)
    .join(", ");
}
