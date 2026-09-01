import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { journalMoodle } from "@/db/schema";
import { sql } from "drizzle-orm";

export type StatutJournal = "ok" | "erreur" | "info";

/** Enregistre une opération de synchronisation (journal conservé : 200 lignes). */
export async function journaliserMoodle(
  operation: "tester" | "utilisateurs" | "cours" | "quiz",
  statut: StatutJournal,
  message: string,
  details = ""
): Promise<void> {
  try {
    await db.insert(journalMoodle).values({
      operation,
      statut,
      message: message.slice(0, 500),
      details: details.slice(0, 2000),
    });
    // Ne garder que les 200 entrées les plus récentes.
    await db.execute(sql`
      DELETE FROM journal_moodle
      WHERE id NOT IN (
        SELECT id FROM journal_moodle ORDER BY cree_le DESC LIMIT 200
      )
    `);
  } catch (e) {
    // Le journal ne doit jamais bloquer l'intégration.
    console.error("[moodle] journal indisponible :", e);
  }
}

export async function lireJournalMoodle(limite = 12) {
  return db
    .select()
    .from(journalMoodle)
    .orderBy(desc(journalMoodle.creeLe))
    .limit(limite);
}
