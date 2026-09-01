import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { codesParrainage, liensMoodleCours, type CodeRow } from "@/db/schema";
import { appelerMoodle, ErreurMoodle } from "./client";
import { configMoodle } from "./config";
import type { CoursMoodle } from "./types";

// ---------------------------------------------------------------------------
// Classe de la plateforme (code de parrainage)  ↔  Cours Moodle (Phase 6).
//
//   « CE2 · Groupe A »  →  Cours « Fables françaises — CE2 · Groupe A »
//                          shortname unique « fablio-<CODE> »
//
// Idempotent : mapping local, sinon recherche par shortname, sinon création.
// ---------------------------------------------------------------------------

const ROLE_ENSEIGNANT_MOODLE = 3; // editing teacher
const ROLE_ELEVE_MOODLE = 5; // student

export function slugCours(code: Pick<CodeRow, "code">): string {
  return `fablio-${code.code.toLowerCase().replace(/[^a-z0-9-]+/g, "")}`.slice(0, 90);
}

export async function assurerCoursMoodle(code: CodeRow): Promise<number> {
  const [lien] = await db
    .select()
    .from(liensMoodleCours)
    .where(eq(liensMoodleCours.codeId, code.id))
    .limit(1);
  if (lien) return lien.moodleCourseId;

  const shortname = slugCours(code);
  const fullname = `Fables françaises — ${code.etiquette || code.code}`;

  // Le cours existe-t-il déjà sur Moodle (créé à la main précédemment) ?
  try {
    const recherche = await appelerMoodle<CoursMoodle[]>(
      "core_course_get_courses_by_field",
      { field: "shortname", value: shortname }
    );
    // Moodle renvoie parfois un objet {courses:[…]}
    const liste = Array.isArray(recherche)
      ? recherche
      : ((recherche as unknown as { courses?: CoursMoodle[] }).courses ?? []);
    const existant = liste[0];
    if (existant?.id) {
      await db.insert(liensMoodleCours).values({
        codeId: code.id,
        moodleCourseId: existant.id,
        titreCours: existant.fullname ?? fullname,
        identifiantCours: shortname,
      });
      return existant.id;
    }
  } catch {
    // On tente la création.
  }

  const cree = await appelerMoodle<{ id: number; shortname: string }[]>(
    "core_course_create_courses",
    {
      courses: [
        {
          fullname,
          shortname,
          categoryid: configMoodle().categorieId,
          summary:
            "Cours synchronisé depuis la plateforme Fablio (généré automatiquement).",
          format: "topics",
          visible: 1,
        },
      ],
    }
  );
  const moodleCourseId = cree?.[0]?.id;
  if (!moodleCourseId)
    throw new ErreurMoodle("Moodle n'a pas renvoyé d'identifiant de cours.");

  await db.insert(liensMoodleCours).values({
    codeId: code.id,
    moodleCourseId,
    titreCours: fullname,
    identifiantCours: shortname,
  });
  return moodleCourseId;
}

/** Inscrit l'enseignant et les élèves (connus par leur mapping) au cours Moodle. */
export async function assurerInscriptions(
  moodleCourseId: number,
  enseignantMoodleId: number,
  elevesMoodleIds: number[]
): Promise<number> {
  const inscriptions = [
    ...elevesMoodleIds.map((userid) => ({
      roleid: ROLE_ELEVE_MOODLE,
      userid,
      courseid: moodleCourseId,
    })),
  ];
  if (elevesMoodleIds.length > 0) {
    await appelerMoodle<unknown>("enrol_manual_enrol_users", {
      enrolments: inscriptions,
    });
  }
  await appelerMoodle<unknown>("enrol_manual_enrol_users", {
    enrolments: [
      { roleid: ROLE_ENSEIGNANT_MOODLE, userid: enseignantMoodleId, courseid: moodleCourseId },
    ],
  });
  return inscriptions.length;
}

/** Codes (classes) d'un enseignant pour lesquels un cours Moodle est lié. */
export async function liensCoursDeEnseignant(enseignantId: string) {
  const lignes = await db
    .select({
      codeId: liensMoodleCours.codeId,
      moodleCourseId: liensMoodleCours.moodleCourseId,
      titreCours: liensMoodleCours.titreCours,
      identifiantCours: liensMoodleCours.identifiantCours,
      code: codesParrainage.code,
      etiquette: codesParrainage.etiquette,
    })
    .from(liensMoodleCours)
    .innerJoin(codesParrainage, eq(codesParrainage.id, liensMoodleCours.codeId))
    .where(eq(codesParrainage.enseignantId, enseignantId));
  return lignes;
}
