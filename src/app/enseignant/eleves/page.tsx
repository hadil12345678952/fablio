import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { lireSession } from "@/lib/auth";
import { statsEleves } from "@/lib/statistiques";
import { formatDuree, formatPct, initiales } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mes élèves" };

export default async function PageEleves() {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const lignes = await statsEleves(session.enseignant.id);

  return (
    <div className="space-y-7">
      <div>
        <p className="etiquette text-corail">Suivi individuel</p>
        <h1 className="font-titre mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Mes élèves
        </h1>
        <p className="mt-1.5 font-semibold text-encre-doux">
          {lignes.length} élève{lignes.length > 1 ? "s" : ""} rattaché
          {lignes.length > 1 ? "s" : ""} à votre compte.
        </p>
      </div>

      {lignes.length === 0 ? (
        <div className="carte bg-points flex flex-col items-center px-8 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-sarcelle/12 text-sarcelle">
            <Users className="size-8" />
          </span>
          <h2 className="font-titre mt-5 text-2xl font-bold">Aucun élève inscrit</h2>
          <p className="mt-2 max-w-sm font-semibold text-encre-doux">
            Partagez un code de parrainage à votre classe : les élèves apparaîtront ici dès leur
            inscription.
          </p>
          <Link href="/enseignant/codes" className="btn-primaire mt-6">
            Gérer mes codes
          </Link>
        </div>
      ) : (
        <div className="carte overflow-x-auto">
          <table className="entree-table min-w-[760px]">
            <thead>
              <tr className="border-b-2 border-encre/8 text-left">
                <th className="etiquette px-5 py-3.5">Élève</th>
                <th className="etiquette px-4 py-3.5">Groupe</th>
                <th className="etiquette px-4 py-3.5 text-right">Tentatives</th>
                <th className="etiquette px-4 py-3.5 text-right">Score moyen</th>
                <th className="etiquette px-4 py-3.5 text-right">Réussite</th>
                <th className="etiquette px-4 py-3.5 text-right">Temps</th>
                <th className="etiquette px-4 py-3.5">Dernière activité</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-encre/5">
              {lignes.map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-papier/60">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-3">
                      <span className="font-titre grid size-9 place-items-center rounded-xl bg-corail/12 text-xs font-bold text-corail">
                        {initiales(e.pseudo)}
                      </span>
                      <span className="font-extrabold">{e.pseudo}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-encre/60">{e.codeEtiquette || "—"}</td>
                  <td className="px-4 py-3.5 text-right font-bold">{e.tentatives}</td>
                  <td className="px-4 py-3.5 text-right font-bold">{formatPct(e.scoreMoyenPct)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span
                      className={`badge ${
                        e.tauxReussite >= 75
                          ? "bg-sarcelle/12 text-sarcelle"
                          : e.tauxReussite >= 50
                            ? "bg-ambre/15 text-ambre-fonce"
                            : "bg-corail/10 text-corail"
                      }`}
                    >
                      {e.tentatives ? formatPct(e.tauxReussite) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-encre/60">
                    {formatDuree(e.tempsSecondes)}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-encre/50">
                    {e.derniereActivite ?? "Jamais"}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/enseignant/eleves/${e.id}`}
                      className="btn-ligne px-3.5 py-1.5 text-xs"
                    >
                      Détail <ArrowRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
