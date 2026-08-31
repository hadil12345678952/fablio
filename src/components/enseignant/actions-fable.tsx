"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

/** Bascule de publication + suppression d'une fable (depuis les listes). */
export function ActionsFable({
  fableId,
  publie,
  suppressionDansDetail = false,
}: {
  fableId: string;
  publie: boolean;
  suppressionDansDetail?: boolean;
}) {
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();

  async function maj(promesse: Promise<Response>) {
    setEnCours(true);
    try {
      const res = await promesse;
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { erreur?: string };
        alert(json.erreur ?? "Une erreur est survenue.");
      }
      router.refresh();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={enCours}
        onClick={() =>
          maj(
            fetch(`/api/enseignant/fables/${fableId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publie: !publie }),
            })
          )
        }
        className={`btn px-3.5 py-1.5 text-xs ${
          publie
            ? "bg-sarcelle/12 text-sarcelle hover:bg-sarcelle/20"
            : "border-2 border-encre/15 bg-white text-encre/60 hover:border-encre/35"
        }`}
      >
        {enCours ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
        {publie ? "Publiée" : "Publier"}
      </button>
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          if (
            !confirm(
              "Supprimer cette fable et tous ses exercices ? Les réponses des élèves associées seront perdues."
            )
          )
            return;
          void maj(
            fetch(`/api/enseignant/fables/${fableId}`, { method: "DELETE" })
          ).then(() => {
            if (suppressionDansDetail) router.push("/enseignant/fables");
          });
        }}
        className="btn-fantome px-2 py-1.5 text-corail hover:bg-corail/10"
        title="Supprimer la fable"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
