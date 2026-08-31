import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText } from "lucide-react";
import { lireSession } from "@/lib/auth";
import { NavEnseignant } from "@/components/enseignant/nav-enseignant";
import { BoutonDeconnexion } from "@/components/deconnexion";
import { initiales } from "@/lib/format";

export default async function LayoutEnseignant({ children }: { children: ReactNode }) {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Barre latérale */}
      <aside className="border-b-2 border-encre/8 bg-white/70 backdrop-blur lg:sticky lg:top-0 lg:h-dvh lg:border-r-2 lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:flex-col lg:items-stretch lg:gap-0 lg:px-4 lg:py-6">
          <Link href="/" className="flex items-center gap-2.5 lg:px-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-corail text-white shadow-carte">
              <BookOpenText className="size-5" strokeWidth={2.4} />
            </span>
            <span className="font-titre text-2xl font-bold">Fablio</span>
          </Link>
          <div className="lg:mt-6">
            <NavEnseignant />
          </div>
        </div>
        <div className="hidden px-4 pt-4 lg:absolute lg:inset-x-4 lg:bottom-5 lg:block">
          <div className="rounded-2xl border-2 border-encre/8 bg-papier p-4">
            <div className="flex items-center gap-3">
              <span className="font-titre grid size-10 place-items-center rounded-xl bg-sarcelle text-sm font-bold text-white">
                {initiales(session.enseignant.nom)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{session.enseignant.nom}</p>
                <p className="truncate text-xs font-semibold text-encre/45">
                  {session.enseignant.email}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <BoutonDeconnexion />
            </div>
          </div>
        </div>
      </aside>

      {/* Contenu */}
      <main className="min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
        <div className="fixed right-4 bottom-4 z-40 lg:hidden">
          <span className="carte block">
            <BoutonDeconnexion compact />
          </span>
        </div>
      </main>
    </div>
  );
}
