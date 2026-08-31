"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, Check } from "lucide-react";

export function ReinitialiserPin({ eleveId }: { eleveId: string }) {
  const [pin, setPin] = useState("");
  const [etat, setEtat] = useState<"repos" | "envoi" | "fait" | "erreur">("repos");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function envoyer() {
    setEtat("envoi");
    setMessage(null);
    try {
      const res = await fetch(`/api/enseignant/stats/eleves/${eleveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = (await res.json()) as { erreur?: string };
      if (!res.ok) throw new Error(json.erreur ?? "Erreur inattendue.");
      setEtat("fait");
      setPin("");
      router.refresh();
    } catch (err) {
      setEtat("erreur");
      setMessage(err instanceof Error ? err.message : "Erreur inattendue.");
    }
  }

  return (
    <div className="carte p-5">
      <p className="font-titre flex items-center gap-2 font-bold">
        <KeyRound className="size-4.5 text-corail" /> Réinitialiser le code secret
      </p>
      <p className="mt-1 text-sm font-semibold text-encre/50">
        Si l&apos;élève a oublié son code secret, attribuez-lui un nouveau (4 à 12 caractères).
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setEtat("repos");
          }}
          placeholder="Nouveau code"
          className="champ flex-1"
          minLength={4}
          maxLength={12}
        />
        <button
          type="button"
          onClick={envoyer}
          disabled={pin.length < 4 || etat === "envoi"}
          className="btn-encre px-4"
        >
          {etat === "envoi" ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : etat === "fait" ? (
            <Check className="size-4.5" />
          ) : (
            "Valider"
          )}
        </button>
      </div>
      {etat === "erreur" && message && (
        <p className="mt-2 text-sm font-bold text-rose">{message}</p>
      )}
      {etat === "fait" && (
        <p className="mt-2 text-sm font-bold text-sarcelle">Code secret mis à jour !</p>
      )}
    </div>
  );
}
