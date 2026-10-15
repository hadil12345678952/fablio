import { db } from "@/db";
import { sql } from "drizzle-orm";
import { etatCourriel } from "@/lib/courriel";

export const dynamic = "force-dynamic";

// GET /api/health — sonde de santé + état des transports.
//
// `ok` reste le seul indicateur de panne (connexion SQL réelle). Le champ ajouté
// est un indicateur d'EXPLOITATION, sans aucune donnée secrète :
//   • `courriel` : « resend » si RESEND_API_KEY est configurée, sinon
//     « journal » (les messages sont alors écrits dans les journaux du serveur).
//     C'est ce qui permet de vérifier en une requête pourquoi un enseignant ne
//     reçoit pas son lien de réinitialisation.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const { transport } = etatCourriel();
    return Response.json({ ok: true, courriel: transport });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
