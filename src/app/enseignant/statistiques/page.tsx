import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileDown,
  MousePointerClick,
  Users,
  Target,
  Gauge,
  Timer,
  BookOpenText,
} from "lucide-react";
import { lireSession } from "@/lib/auth";
import { fablesDeEnseignant } from "@/lib/queries";
import { statsFable } from "@/lib/statistiques";
import { BarresTaux, BarresChoix } from "@/components/graphiques";
import { BoutonImprimer, CorrectionsOuvertes } from "@/components/enseignant/statistiques-clients";
import { PanneauMoodleQuiz } from "@/components/enseignant/panneau-moodle-quiz";
import { formatDuree, formatPct } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Statistiques" };

export default async function PageStatistiques({
  searchParams,
}: {
  searchParams: Promise<{ fable?: string }>;
}) {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const parametres = await searchParams;

  const fables = await fablesDeEnseignant(session.enseignant.id);
  const activeId =
    parametres.fable && fables.some((f) => f.id === parametres.fable)
      ? parametres.fable
      : fables[0]?.id;
  const stats = activeId ? await statsFable(session.enseignant.id, activeId) : null;

  return (
    <div className="space-y-7">
      {/* En-tête + exports */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiquette text-corail">Analyse</p>
          <h1 className="font-titre mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Statistiques par fable
          </h1>
          <p className="mt-1.5 font-semibold text-encre-doux">
            Taux de réussite, erreurs fréquentes et répartition des réponses.
          </p>
        </div>
        <div className="pas-impression flex flex-wrap gap-2.5">
          <a href="/api/enseignant/export/resultats.csv" className="btn-ligne" download>
            <FileDown className="size-4.5" /> Export CSV
          </a>
          <BoutonImprimer />
        </div>
      </div>

      {/* Sélecteur de fable */}
      {fables.length === 0 ? (
        <div className="carte bg-points flex flex-col items-center px-8 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-corail/12 text-corail">
            <BookOpenText className="size-8" />
          </span>
          <h2 className="font-titre mt-5 text-2xl font-bold">Rien à analyser pour l&apos;instant</h2>
          <p className="mt-2 max-w-sm font-semibold text-encre-doux">
            Créez une fable avec des exercices, partagez votre code… puis revenez consulter les
            statistiques de votre classe.
          </p>
          <Link href="/enseignant/fables/nouvelle" className="btn-primaire mt-6">
            Créer une fable
          </Link>
        </div>
      ) : (
        <>
          <div className="pas-impression flex flex-wrap gap-2">
            {fables.map((f) => (
              <Link
                key={f.id}
                href={`/enseignant/statistiques?fable=${f.id}`}
                className={`rounded-full border-2 px-4 py-2 text-sm font-extrabold transition-all ${
                  f.id === activeId
                    ? "border-encre bg-encre text-papier"
                    : "border-encre/12 bg-white text-encre/55 hover:border-encre/40"
                }`}
              >
                {f.titre}
              </Link>
            ))}
          </div>

          {stats && (
            <div className="space-y-7">
              {/* Indicateurs clés */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                {[
                  { label: "Tentatives", valeur: String(stats.nbTentatives), icone: MousePointerClick, style: "bg-ambre/15 text-ambre-fonce" },
                  { label: "Élèves actifs", valeur: String(stats.nbElevesActifs), icone: Users, style: "bg-sarcelle/12 text-sarcelle" },
                  { label: "Taux de réussite", valeur: formatPct(stats.tauxReussiteGlobal), icone: Target, style: "bg-corail/12 text-corail" },
                  { label: "Note moyenne", valeur: formatPct(stats.noteMoyennePct), icone: Gauge, style: "bg-lilas/12 text-lilas" },
                  { label: "Temps moyen", valeur: formatDuree(stats.tempsMoyenSecondes), icone: Timer, style: "bg-ciel/12 text-ciel" },
                ].map((c) => (
                  <div key={c.label} className="carte p-4.5">
                    <span className={`grid size-9 place-items-center rounded-xl ${c.style}`}>
                      <c.icone className="size-4.5" />
                    </span>
                    <p className="font-titre mt-2.5 text-2xl font-bold">{c.valeur}</p>
                    <p className="text-xs font-bold text-encre/50">{c.label}</p>
                  </div>
                ))}
              </div>

              {/* Taux par exercice */}
              {stats.exercices.some((e) => e.tentatives > 0) && (
                <div className="carte p-6">
                  <h2 className="font-titre mb-1 text-lg font-bold">Taux de réussite par exercice</h2>
                  <p className="mb-4 text-sm font-semibold text-encre/50">
                    Part des tentatives entièrement réussies — vert ≥ 75 %, orange ≥ 50 %.
                  </p>
                  <BarresTaux
                    donnees={stats.exercices.map((e, i) => ({
                      nom: `n°${i + 1} · ${e.typeEtiquette}`,
                      taux: e.tauxReussite,
                    }))}
                  />
                </div>
              )}

              {/* Détail par exercice */}
              {stats.exercices.map((e, i) => (
                <section key={e.id} className="carte overflow-hidden">
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-encre/8 bg-papier px-6 py-4">
                    <div className="min-w-0">
                      <p className="font-titre font-bold">
                        <span className="mr-2 text-encre/40">n°{i + 1}</span>
                        {e.typeEtiquette}
                      </p>
                      <p className="truncate text-sm font-semibold text-encre/50">{e.resume}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                        {e.tentatives} tentative(s)
                      </span>
                      <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                        {e.elevesDistincts} élève(s)
                      </span>
                      <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                        note moy. {formatPct(e.noteMoyennePct)}
                      </span>
                      <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                        {formatDuree(e.tempsMoyenSecondes)} en moyenne
                      </span>
                    </div>
                  </header>

                  <div className="space-y-5 px-6 py-5">
                    {e.tentatives === 0 && (
                      <p className="font-semibold text-encre/45">
                        Aucun élève n&apos;a encore tenté cet exercice.
                      </p>
                    )}

                    {e.distribution && e.distribution.length > 0 && (
                      <div>
                        <p className="etiquette mb-2">Répartition des réponses (vert = bonne réponse)</p>
                        <BarresChoix donnees={e.distribution} />
                      </div>
                    )}

                    {e.erreursTrous && (
                      <div>
                        <p className="etiquette mb-2">Erreurs fréquentes par trou</p>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {e.erreursTrous.map((t) => (
                            <div key={t.trou} className="rounded-2xl bg-papier px-4 py-3.5">
                              <p className="text-sm font-extrabold">
                                Trou n°{t.trou} : attendu «{" "}
                                <span className="text-sarcelle">{t.reference}</span> »
                              </p>
                              <p className="text-xs font-bold text-encre/45">
                                Erreur dans {t.tauxErreur} % des tentatives
                              </p>
                              {t.erreurs.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {t.erreurs.map((er) => (
                                    <span key={er.mot} className="badge bg-corail/10 text-corail">
                                      « {er.mot} » ×{er.nombre}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-xs font-bold text-sarcelle">
                                  Aucune erreur fréquente.
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {e.enAttente && <CorrectionsOuvertes enAttente={e.enAttente} points={e.points} />}

                    {e.moodleQuizId !== null && <PanneauMoodleQuiz quizId={e.moodleQuizId} />}
                  </div>
                </section>
              ))}

              {/* Résultats par élève */}
              {stats.parEleve.length > 0 && (
                <div className="carte overflow-x-auto">
                  <h2 className="font-titre border-b-2 border-encre/8 px-6 py-4 text-lg font-bold">
                    Résultats par élève — {stats.fable.titre}
                  </h2>
                  <table className="entree-table min-w-[560px]">
                    <thead>
                      <tr className="border-b-2 border-encre/8 text-left">
                        <th className="etiquette px-6 py-3">Élève</th>
                        <th className="etiquette px-4 py-3 text-right">Tentatives</th>
                        <th className="etiquette px-4 py-3 text-right">Meilleure note</th>
                        <th className="etiquette px-4 py-3 text-right">Réussite</th>
                        <th className="etiquette px-4 py-3 text-right">Temps total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-encre/5">
                      {stats.parEleve.map((e) => (
                        <tr key={e.id} className="transition-colors hover:bg-papier/60">
                          <td className="px-6 py-3 font-extrabold">
                            <Link href={`/enseignant/eleves/${e.id}`} className="underline decoration-corail/40 decoration-2 underline-offset-4 hover:text-corail">
                              {e.pseudo}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{e.tentatives}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatPct(e.meilleureNotePct)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatPct(e.tauxReussite)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-encre/60">
                            {formatDuree(e.tempsSecondes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
