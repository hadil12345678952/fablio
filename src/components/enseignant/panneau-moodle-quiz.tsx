"use client";

import { useState } from "react";
import { Plug, LoaderCircle, RefreshCw, TriangleAlert, CheckCircle2 } from "lucide-react";
import type { PanierTentativesQuiz } from "@/integrations/moodle/quiz";

/** Panneau des tentatives d'un quiz Moodle lié (chargé à la demande). */
export function PanneauMoodleQuiz({ quizId }: { quizId: number }) {
  const [etat, setEtat] = useState<"repos" | "chargement" | "ok" | "erreur">("repos");
  const [panier, setPanier] = useState<PanierTentativesQuiz | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function charger() {
    setEtat("chargement");
    setErreur(null);
    try {
      const res = await fetch(`/api/integrations/moodle/quiz/${quizId}/tentatives`);
      const json = (await res.json()) as { erreur?: string; panier?: PanierTentativesQuiz };
      if (!res.ok || !json.panier) throw new Error(json.erreur ?? "Erreur inattendue.");
      setPanier(json.panier);
      setEtat("ok");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
      setEtat("erreur");
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-lilas/40 bg-lilas/[0.05] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-titre flex items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-xl bg-lilas/15 text-lilas">
            <Plug className="size-4.5" />
          </span>
          Tentatives du quiz Moodle n°{quizId}
          <span className="text-xs font-semibold text-encre/45">— réalisées sur Moodle</span>
        </p>
        <button
          type="button"
          onClick={charger}
          disabled={etat === "chargement"}
          className="btn-ligne px-3.5 py-1.5 text-xs"
        >
          {etat === "chargement" ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {panier ? "Actualiser" : "Charger les tentatives Moodle"}
        </button>
      </div>

      {etat === "erreur" && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-ambre/12 px-4 py-2.5 text-sm font-bold text-ambre-fonce">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {erreur}
        </p>
      )}

      {etat === "ok" && panier && (
        <div className="anim-apparition mt-4">
          <p className="mb-2 text-sm font-bold text-encre-doux">
            <CheckCircle2 className="mr-1 inline size-4 text-menthe-fonce" />
            Quiz Moodle : « {panier.quiz.nom} » · {panier.tentatives.length} tentative(s)
            trouvée(s)
          </p>
          {panier.tentatives.length === 0 ? (
            <p className="text-sm font-semibold text-encre/45">
              Aucune tentative sur ce quiz pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="entree-table min-w-[520px]">
                <thead>
                  <tr className="border-b-2 border-encre/8 text-left">
                    <th className="etiquette px-2 py-2">Utilisateur Moodle</th>
                    <th className="etiquette px-2 py-2 text-right">Tentative</th>
                    <th className="etiquette px-2 py-2 text-right">Note</th>
                    <th className="etiquette px-2 py-2">Début</th>
                    <th className="etiquette px-2 py-2">Fin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-encre/5">
                  {panier.tentatives.map((t) => (
                    <tr key={t.tentativeId}>
                      <td className="px-2 py-2 font-bold">{t.utilisateur}</td>
                      <td className="px-2 py-2 text-right font-semibold text-encre/60">
                        n°{t.numero}
                      </td>
                      <td className="px-2 py-2 text-right font-bold">
                        {t.note === null ? "—" : `${t.note} / ${t.noteSur ?? "?"}`}
                      </td>
                      <td className="px-2 py-2 font-semibold text-encre/50">{t.debutLe ?? "—"}</td>
                      <td className="px-2 py-2 font-semibold text-encre/50">{t.finLe ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
