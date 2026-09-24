"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert, RotateCcw, House } from "lucide-react";

/** Écran d'erreur global — message rassurant, jamais de détail technique. */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[fablio]", error);
  }, [error]);

  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="carte max-w-md p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-ambre/15 text-ambre-fonce">
          <TriangleAlert className="size-8" />
        </span>
        <h1 className="font-titre mt-4 text-2xl font-bold">Oups, un petit souci</h1>
        <p className="mt-2 font-semibold text-encre-doux">
          La page n&apos;a pas pu s&apos;afficher correctement. Tes données sont bien
          conservées : tu peux réessayer.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primaire">
            <RotateCcw className="size-4.5" /> Réessayer
          </button>
          <Link href="/" className="btn-ligne">
            <House className="size-4.5" /> Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
