import { enseignantConnecte } from "@/lib/api";
import { donneesExportCsv } from "@/lib/statistiques";

// GET /api/enseignant/export/resultats.csv — export CSV (compatible Excel)
export async function GET() {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const csv = await donneesExportCsv(auth.enseignant.id);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="resultats-fablio.csv"',
    },
  });
}
