"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Copy,
  Check,
  Trash2,
  Plus,
  LoaderCircle,
  Users,
  Power,
} from "lucide-react";
import type { CodeAvecEffectif } from "@/lib/queries";

export function GestionCodes({ codes }: { codes: CodeAvecEffectif[] }) {
  const [etiquette, setEtiquette] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [copieId, setCopieId] = useState<string | null>(null);
  const router = useRouter();

  async function generer(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    try {
      await fetch("/api/enseignant/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiquette }),
      });
      setEtiquette("");
      router.refresh();
    } finally {
      setEnCours(false);
    }
  }

  async function patch(id: string, donnees: Record<string, unknown>) {
    await fetch(`/api/enseignant/codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donnees),
    });
    router.refresh();
  }

  async function supprimer(id: string, avecEleves: number) {
    const message =
      avecEleves > 0
        ? `Ce code est utilisé par ${avecEleves} élève(s). Le supprimer les détachera du groupe (leur compte reste actif). Continuer ?`
        : "Supprimer ce code de parrainage ?";
    if (!confirm(message)) return;
    await fetch(`/api/enseignant/codes/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function copier(code: CodeAvecEffectif) {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopieId(code.id);
      setTimeout(() => setCopieId(null), 1500);
    } catch {
      prompt("Copiez ce code :", code.code);
    }
  }

  return (
    <div className="space-y-6">
      {/* Génération */}
      <form onSubmit={generer} className="carte flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-56 flex-1">
          <label htmlFor="etiquette" className="etiquette mb-1.5 block">
            Nom du groupe / de la classe
          </label>
          <input
            id="etiquette"
            value={etiquette}
            onChange={(e) => setEtiquette(e.target.value)}
            placeholder="CE2 · Groupe A"
            className="champ"
            maxLength={40}
          />
        </div>
        <button type="submit" disabled={enCours} className="btn-primaire">
          {enCours ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : (
            <Plus className="size-4.5" />
          )}
          Générer un code
        </button>
      </form>

      {/* Liste */}
      {codes.length === 0 ? (
        <div className="carte bg-points flex flex-col items-center px-8 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-ambre/15 text-ambre-fonce">
            <Ticket className="size-8" />
          </span>
          <h2 className="font-titre mt-5 text-2xl font-bold">Aucun code pour le moment</h2>
          <p className="mt-2 max-w-sm font-semibold text-encre-doux">
            Générez un code de parrainage et notez-le au tableau : vos élèves l&apos;utiliseront
            pour créer leur compte et rejoindre votre classe.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {codes.map((c) => (
            <article key={c.id} className="carte p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-titre text-lg font-bold">
                    {c.etiquette || "Groupe sans nom"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-encre/45">
                    <Users className="size-3.5" /> {c.nbEleves} élève(s) inscrit(s)
                  </p>
                </div>
                <span
                  className={`badge ${c.actif ? "bg-sarcelle/12 text-sarcelle" : "bg-rose/10 text-rose"}`}
                >
                  {c.actif ? "Actif" : "Désactivé"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copier(c)}
                className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl border-3 border-dashed border-encre/20 bg-papier px-4 py-3.5 font-titre text-2xl font-bold tracking-[0.18em] transition-colors hover:border-corail hover:text-corail"
                title="Cliquer pour copier"
              >
                {c.code}
                {copieId === c.id ? (
                  <Check className="size-5 text-sarcelle" strokeWidth={3} />
                ) : (
                  <Copy className="size-5 opacity-50" />
                )}
              </button>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patch(c.id, { actif: !c.actif })}
                  className="btn-ligne flex-1 px-3 py-2 text-xs"
                >
                  <Power className="size-3.5" />
                  {c.actif ? "Désactiver" : "Réactiver"}
                </button>
                <button
                  type="button"
                  onClick={() => supprimer(c.id, c.nbEleves)}
                  className="btn-fantome px-2.5 py-2 text-corail hover:bg-corail/10"
                  title="Supprimer le code"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
