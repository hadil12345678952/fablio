"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, LoaderCircle, Check, Hourglass } from "lucide-react";
import type { ReponseEnAttente } from "@/lib/statistiques";

export function BoutonImprimer() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ligne">
      <Printer className="size-4.5" /> Exporter en PDF
    </button>
  );
}

/** Correction manuelle des réponses aux questions ouvertes. */
export function CorrectionsOuvertes({
  enAttente,
  points,
}: {
  enAttente: ReponseEnAttente[];
  points: number;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [faits, setFaits] = useState<Set<string>>(new Set());
  const router = useRouter();

  async function corriger(tentativeId: string) {
    const score = Number(notes[tentativeId]);
    if (!Number.isFinite(score)) return;
    setEnCours(tentativeId);
    try {
      const res = await fetch(`/api/enseignant/reponses/${tentativeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { erreur?: string };
        alert(json.erreur ?? "Erreur.");
        return;
      }
      setFaits((f) => new Set(f).add(tentativeId));
      router.refresh();
    } finally {
      setEnCours(null);
    }
  }

  const restantes = enAttente.filter((a) => !faits.has(a.tentativeId));
  if (restantes.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-sarcelle/10 px-5 py-4 font-bold text-sarcelle">
        <Check className="size-5" /> Toutes les réponses ont été corrigées.
      </p>
    );

  return (
    <div>
      <p className="mb-3 flex items-center gap-2 font-titre font-bold">
        <Hourglass className="size-4.5 text-ciel" />
        {restantes.length} réponse(s) en attente de correction
      </p>
      <ul className="space-y-3">
        {restantes.map((a) => (
          <li
            key={a.tentativeId}
            className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ciel/25 bg-ciel/6 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">
                {a.pseudo} <span className="font-semibold text-encre/40">· {a.dateEtiquette}</span>
              </p>
              <blockquote className="mt-1 border-l-3 border-ciel/40 pl-3 font-lecture text-base text-encre-doux italic">
                « {a.reponse} »
              </blockquote>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={points}
                step={0.5}
                value={notes[a.tentativeId] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [a.tentativeId]: e.target.value }))}
                placeholder={`0–${points}`}
                className="champ w-24 text-center"
                aria-label={`Note sur ${points} pour ${a.pseudo}`}
              />
              <span className="text-sm font-bold text-encre/45">/ {points}</span>
              <button
                type="button"
                disabled={enCours === a.tentativeId || (notes[a.tentativeId] ?? "") === ""}
                onClick={() => corriger(a.tentativeId)}
                className="btn-encre px-4 py-2 text-xs"
              >
                {enCours === a.tentativeId ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  "Noter"
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
