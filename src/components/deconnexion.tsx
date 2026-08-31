"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle } from "lucide-react";

export function BoutonDeconnexion({ compact = false }: { compact?: boolean }) {
  const [chargement, setChargement] = useState(false);
  const router = useRouter();

  async function deconnecter() {
    setChargement(true);
    try {
      await fetch("/api/auth/deconnexion", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      setChargement(false);
    }
  }

  return (
    <button
      onClick={deconnecter}
      disabled={chargement}
      className={
        compact
          ? "btn-fantome px-3 py-2"
          : "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold text-encre-doux transition-colors hover:bg-encre/5"
      }
      title="Se déconnecter"
    >
      {chargement ? (
        <LoaderCircle className="size-4.5 animate-spin" />
      ) : (
        <LogOut className="size-4.5" />
      )}
      {!compact && <span>Se déconnecter</span>}
    </button>
  );
}
