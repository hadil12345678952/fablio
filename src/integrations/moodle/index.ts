import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { codesParrainage, eleves, liensMoodleUtilisateurs, type EnseignantRow } from "@/db/schema";
import { configMoodle } from "./config";
import { appelerMoodle, ErreurMoodle, MoodleIndisponible } from "./client";
import { journaliserMoodle, lireJournalMoodle } from "./journal";
import { assurerUtilisateurMoodle } from "./utilisateurs";
import { assurerCoursMoodle, assurerInscriptions, liensCoursDeEnseignant } from "./cours";
import type { InfoSiteMoodle } from "./types";

// ---------------------------------------------------------------------------
// Façade publique de l'intégration Moodle.
// Toutes les fonctions sont SAFE : elles ne lèvent jamais d'exception vers
// l'application — une indisponibilité Moodle se traduit par un état
// dégradé lisible (Phase 13 : la plateforme reste utilisable).
// ---------------------------------------------------------------------------

export function moodleConfigure(): boolean {
  return configMoodle().configure;
}

export type ResultatTest =
  | { ok: true; site: { nom: string; version: string; utilisateurToken: string } }
  | { ok: false; message: string };

export async function testerConnexionMoodle(): Promise<ResultatTest> {
  if (!configMoodle().configure) {
    const message =
      "Moodle n'est pas configuré : ajoutez MOODLE_URL et MOODLE_TOKEN dans les variables d'environnement du serveur.";
    await journaliserMoodle("tester", "info", message);
    return { ok: false, message };
  }
  try {
    const info = await appelerMoodle<InfoSiteMoodle>("core_webservice_get_site_info");
    const site = {
      nom: info.sitename ?? "Moodle",
      version: info.release ?? info.version ?? "version inconnue",
      utilisateurToken:
        [info.firstname, info.lastname].filter(Boolean).join(" ").trim() ||
        info.username ||
        "utilisateur du jeton",
    };
    await journaliserMoodle("tester", "ok", `Connexion établie avec « ${site.nom} » (${site.version}).`);
    return { ok: true, site };
  } catch (e) {
    const message = e instanceof ErreurMoodle ? e.message : "Connexion impossible.";
    await journaliserMoodle("tester", "erreur", message);
    return { ok: false, message };
  }
}

export interface ResumeSynchro {
  configure: boolean;
  utilisateurs: { lies: number; nouveaux: number; erreurs: string[] };
  cours: { synchronises: number; erreurs: string[] };
}

/** Synchronise le compte de l'enseignant, ses élèves, ses cours et les inscriptions. */
export async function synchroniserPourEnseignant(
  enseignant: EnseignantRow
): Promise<ResumeSynchro> {
  if (!configMoodle().configure) {
    await journaliserMoodle("utilisateurs", "info", "Synchronisation ignorée : Moodle non configuré.");
    return {
      configure: false,
      utilisateurs: { lies: 0, nouveaux: 0, erreurs: ["Moodle n'est pas configuré."] },
      cours: { synchronises: 0, erreurs: [] },
    };
  }

  const erreursU: string[] = [];
  const erreursC: string[] = [];
  let lies = 0;
  let nouveaux = 0;

  // 1. Le compte de l'enseignant
  let enseignantMoodleId: number | null = null;
  try {
    const [premier, ...reste] = enseignant.nom.trim().split(/\s+/);
    const r = await assurerUtilisateurMoodle({
      type: "enseignant",
      id: enseignant.id,
      prenom: premier ?? enseignant.nom,
      nom: reste.join(" ") || enseignant.nom,
      email: enseignant.email,
    });
    enseignantMoodleId = r.moodleUserId;
    lies++;
    if (r.nouveauCompte) nouveaux++;
  } catch (e) {
    erreursU.push(
      `Compte enseignant : ${e instanceof ErreurMoodle ? e.message : "erreur inconnue"}`
    );
  }

  // 2. Les élèves de l'enseignant
  const els = await db.select().from(eleves).where(eq(eleves.enseignantId, enseignant.id));
  const moodleParEleve = new Map<string, number>();
  for (const el of els) {
    try {
      const r = await assurerUtilisateurMoodle({
        type: "eleve",
        id: el.id,
        prenom: el.pseudo,
        nom: "Élève",
        email: el.pseudo,
      });
      moodleParEleve.set(el.id, r.moodleUserId);
      lies++;
      if (r.nouveauCompte) nouveaux++;
    } catch (e) {
      erreursU.push(`${el.pseudo} : ${e instanceof ErreurMoodle ? e.message : "erreur inconnue"}`);
    }
  }

  // 3. Les cours (un par code de classe actif) + inscriptions
  const lignes = await db
    .select()
    .from(codesParrainage)
    .where(eq(codesParrainage.enseignantId, enseignant.id));
  let coursSynchronises = 0;
  if (enseignantMoodleId !== null) {
    for (const code of lignes) {
      try {
        const courseId = await assurerCoursMoodle(code);
        const elevesDuCode = els
          .filter((e) => e.codeId === code.id)
          .map((e) => moodleParEleve.get(e.id))
          .filter((x): x is number => typeof x === "number");
        await assurerInscriptions(courseId, enseignantMoodleId, elevesDuCode);
        coursSynchronises++;
      } catch (e) {
        erreursC.push(
          `${code.etiquette || code.code} : ${
            e instanceof ErreurMoodle ? e.message : "erreur inconnue"
          }`
        );
      }
    }
  } else if (lignes.length > 0) {
    erreursC.push("Cours non synchronisés : le compte enseignant n'a pas pu être lié.");
  }

  const enEchec = erreursU.length + erreursC.length;
  await journaliserMoodle(
    "utilisateurs",
    enEchec > 0 ? "erreur" : "ok",
    `${lies} compte(s) vérifié(s) · ${nouveaux} créé(s) · ${coursSynchronises} cours synchronisé(s).`,
    [...erreursU, ...erreursC].join("\n")
  );

  return {
    configure: true,
    utilisateurs: { lies, nouveaux, erreurs: erreursU },
    cours: { synchronises: coursSynchronises, erreurs: erreursC },
  };
}

/** État complet affiché par la page « Intégration Moodle » de l'enseignant. */
export async function statutIntegrationMoodle(enseignantId: string) {
  const { configure, url, service } = configMoodle();
  const els = await db
    .select({ id: eleves.id })
    .from(eleves)
    .where(eq(eleves.enseignantId, enseignantId));
  const ids = new Set([enseignantId, ...els.map((e) => e.id)]);
  const liensU = await db.select().from(liensMoodleUtilisateurs);
  const coursLiens = await liensCoursDeEnseignant(enseignantId);
  const journal = await lireJournalMoodle(12);

  return {
    configure,
    url,
    service,
    utilisateursLies: liensU.filter((l) => ids.has(l.utilisateurId)).length,
    utilisateursTotal: ids.size,
    coursLiens,
    journal: journal.map((j) => ({
      id: j.id,
      operation: j.operation,
      statut: j.statut,
      message: j.message,
      details: j.details,
      dateISO: j.creeLe.toISOString(),
    })),
  };
}

// Résout le cours Moodle d'un quiz à partir des cours liés de l'enseignant.
export async function trouverCoursDuQuiz(
  enseignantId: string,
  quizId: number
): Promise<number | null> {
  const liens = await liensCoursDeEnseignant(enseignantId);
  const { listerQuizzes } = await import("./quiz");
  for (const lien of liens.slice(0, 6)) {
    try {
      const quizzes = await listerQuizzes(lien.moodleCourseId);
      if (quizzes.some((q) => q.id === quizId)) return lien.moodleCourseId;
    } catch (e) {
      if (e instanceof MoodleIndisponible) throw e;
    }
  }
  return null;
}

export { ErreurMoodle, MoodleIndisponible };
