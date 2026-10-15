import { db } from "@/db";
import { sql } from "drizzle-orm";
import { etatCourriel } from "@/lib/courriel";
import { etatBornage } from "@/lib/securite";

export const dynamic = "force-dynamic";

// GET /api/health — sonde de santé + état des transports.
//
// `ok` reste le seul indicateur de panne (connexion SQL réelle). Les champs
// ajoutés sont des indicateurs d'EXPLOITATION, sans aucune donnée secrète ni
// personnelle :
//   • `courriel` : « resend » si RESEND_API_KEY est configurée, sinon
//     « journal » (les messages sont alors écrits dans les journaux du serveur).
//     C'est ce qui permet de vérifier en une requête pourquoi un enseignant ne
//     reçoit pas son lien de réinitialisation.
//   • `bornage` : état de l'anti-force-brute de la connexion (« actif », ou
//     « indisponible » si la table n'a pas encore été créée sur cette base —
//     cas typique d'un déploiement de prévisualisation).
//   • `schemaManquant` : liste des tables attendues et absentes. Un déploiement
//     dont le build n'a pas appliqué le schéma (drizzle-kit push) répond ainsi
//     « voilà ce qui manque » au lieu d'aligner des erreurs obscures.
const TABLES_ATTENDUES = [
  "enseignants",
  "codes_parrainage",
  "eleves",
  "fables",
  "exercices",
  "tentatives",
  "blocs_fable",
  "jetons_reinitialisation",
  "tentatives_connexion",
  "sessions",
];

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const { transport } = etatCourriel();

    let schemaManquant: string[] = [];
    try {
      const lignes = await db.execute<{ table_name: string }>(sql`
        SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
      `);
      const rangees = new Set(
        (Array.isArray(lignes) ? lignes : ((lignes as { rows?: { table_name: string }[] }).rows ?? []))
          .map((l) => l.table_name)
      );
      schemaManquant = TABLES_ATTENDUES.filter((t) => !rangees.has(t));
    } catch {
      /* information_schema inaccessible (rôles restreints) : on ne fait pas échouer la sonde */
    }

    return Response.json({
      ok: true,
      courriel: transport,
      bornage: await etatBornage(),
      schemaManquant,
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
