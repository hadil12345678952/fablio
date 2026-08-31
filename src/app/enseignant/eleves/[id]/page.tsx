import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Trophy,
  BookCheck,
  Timer,
  CheckCircle2,
  XCircle,
  Hourglass,
} from "lucide-react";
import { lireSession } from "@/lib/auth";
import { detailEleveStats } from "@/lib/statistiques";
import { CourbeActivite } from "@/components/graphiques";
import { ReinitialiserPin } from "@/components/enseignant/reinitialiser-pin";
import { formatDuree, formatPct, formatScore, initiales } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fiche élève" };

export default async function PageDetailEleve({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const { id } = await params;
  const detail = await detailEleveStats(session.enseignant.id, id);
  if (!detail) notFound();

  const { eleve } = detail;

  return (
    <div className="space-y-7">
      <div>
        <Link href="/enseignant/eleves" className="btn-fantome -ml-3 mb-2">
          <ArrowLeft className="size-4" /> Retour aux élèves
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-titre grid size-14 place-items-center rounded-2xl bg-corail text-xl font-bold text-white">
              {initiales(eleve.pseudo)}
            </span>
            <div>
              <p className="etiquette text-corail">Fiche élève</p>
              <h1 className="font-titre text-3xl font-bold tracking-tight">{eleve.pseudo}</h1>
              <p className="text-sm font-semibold text-encre/50">
                Groupe : {eleve.codeEtiquette || "—"} · Inscrit le {eleve.creeLeEtiquette}
              </p>
            </div>
          </div>
          <span className="badge bg-ambre/15 px-4 py-2 text-sm text-ambre-fonce">
            <Trophy className="size-4" /> {formatScore(detail.pointsCumules)} points cumulés
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="carte p-6 lg:col-span-2">
          <h2 className="font-titre mb-4 text-lg font-bold">
            Progression (score moyen par jour, 14 jours)
          </h2>
          <CourbeActivite donnees={detail.serie14} />
        </div>
        <ReinitialiserPin eleveId={eleve.id} />
      </div>

      {/* Par fable */}
      <div className="carte overflow-x-auto">
        <h2 className="font-titre border-b-2 border-encre/8 px-6 py-4 text-lg font-bold">
          Résultats par fable
        </h2>
        <table className="entree-table min-w-[680px]">
          <thead>
            <tr className="border-b-2 border-encre/8 text-left">
              <th className="etiquette px-6 py-3">Fable</th>
              <th className="etiquette px-4 py-3 text-right">Exercices réussis</th>
              <th className="etiquette px-4 py-3 text-right">Meilleure note</th>
              <th className="etiquette px-4 py-3 text-right">Tentatives</th>
              <th className="etiquette px-4 py-3 text-right">Temps</th>
              <th className="etiquette px-4 py-3 text-right">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-encre/5">
            {detail.parFable.map((f) => (
              <tr key={f.fableId} className="transition-colors hover:bg-papier/60">
                <td className="px-6 py-3.5 font-extrabold">{f.titre}</td>
                <td className="px-4 py-3.5 text-right font-bold">
                  {f.reussis}/{f.exercices}
                </td>
                <td className="px-4 py-3.5 text-right font-bold">{formatPct(f.meilleureNotePct)}</td>
                <td className="px-4 py-3.5 text-right font-bold">{f.tentatives}</td>
                <td className="px-4 py-3.5 text-right font-semibold text-encre/60">
                  {formatDuree(f.tempsSecondes)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  {f.terminee ? (
                    <span className="badge bg-sarcelle/12 text-sarcelle">
                      <BookCheck className="size-3.5" /> Terminée
                    </span>
                  ) : f.tentatives > 0 ? (
                    <span className="badge bg-ambre/15 text-ambre-fonce">
                      <Timer className="size-3.5" /> En cours
                    </span>
                  ) : (
                    <span className="badge bg-encre/8 text-encre/45">Non commencée</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Historique */}
      <div className="carte overflow-hidden">
        <h2 className="font-titre border-b-2 border-encre/8 px-6 py-4 text-lg font-bold">
          Historique récent
        </h2>
        {detail.historique.length === 0 ? (
          <p className="px-6 py-8 text-center font-semibold text-encre/45">
            Aucune tentative enregistrée pour le moment.
          </p>
        ) : (
          <ul className="divide-y-2 divide-encre/5">
            {detail.historique.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-xl ${
                    h.estCorrect === true
                      ? "bg-sarcelle/12 text-sarcelle"
                      : h.estCorrect === null
                        ? "bg-ciel/12 text-ciel"
                        : "bg-corail/10 text-corail"
                  }`}
                >
                  {h.estCorrect === true ? (
                    <CheckCircle2 className="size-4.5" />
                  ) : h.estCorrect === null ? (
                    <Hourglass className="size-4.5" />
                  ) : (
                    <XCircle className="size-4.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">
                    {h.fableTitre} · {h.typeEtiquette}
                  </p>
                  <p className="text-xs font-semibold text-encre/45">
                    tentative n°{h.numero} · {h.dateEtiquette}
                  </p>
                </div>
                <span className="font-titre text-sm font-bold text-encre/60">
                  {h.estCorrect === null ? "à corriger" : `${formatScore(h.score)} / ${h.maxScore}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
