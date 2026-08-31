import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText } from "lucide-react";
import { lireSession } from "@/lib/auth";
import { NavEleve } from "@/components/eleve/nav-eleve";
import { BoutonDeconnexion } from "@/components/deconnexion";
import { initiales } from "@/lib/format";

export default async function LayoutEleve({ children }: { children: ReactNode }) {
  const session = await lireSession();
  if (!session || session.type !== "eleve") redirect("/connexion?role=eleve");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b-3 border-encre/8 bg-papier/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/eleve" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-corail text-white shadow-carte">
              <BookOpenText className="size-5" strokeWidth={2.4} />
            </span>
            <span className="font-titre hidden text-2xl font-bold sm:inline">Fablio</span>
          </Link>
          <NavEleve />
          <div className="flex items-center gap-2">
            <span className="font-titre grid size-10 place-items-center rounded-2xl bg-sarcelle text-base font-bold text-white" title={session.eleve.pseudo}>
              {initiales(session.eleve.pseudo)}
            </span>
            <BoutonDeconnexion compact />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">{children}</main>
    </div>
  );
}
