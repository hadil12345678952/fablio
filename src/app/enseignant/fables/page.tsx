import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { BookOpenText, Plus, Pencil, Users } from "lucide-react";
import { lireSession } from "@/lib/auth";
import { fablesDeEnseignant } from "@/lib/queries";
import { ActionsFable } from "@/components/enseignant/actions-fable";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mes fables" };

const STYLES_DIFFICULTE: Record<string, string> = {
  facile: "bg-sarcelle/12 text-sarcelle-fonce",
  moyen: "bg-ambre/15 text-ambre-fonce",
  difficile: "bg-corail/12 text-corail-fonce",
};

export default async function PageFables() {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const fables = await fablesDeEnseignant(session.enseignant.id);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiquette text-corail">Bibliothèque</p>
          <h1 className="font-titre mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Mes fables
          </h1>
          <p className="mt-1.5 font-semibold text-encre-doux">
            {fables.length} fable{fables.length > 1 ? "s" : ""} ·{" "}
            {fables.filter((f) => f.publie).length} publiée
            {fables.filter((f) => f.publie).length > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/enseignant/fables/nouvelle" className="btn-primaire">
          <Plus className="size-4.5" /> Nouvelle fable
        </Link>
      </div>

      {fables.length === 0 ? (
        <div className="carte bg-points flex flex-col items-center px-8 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-corail/12 text-corail">
            <BookOpenText className="size-8" />
          </span>
          <h2 className="font-titre mt-5 text-2xl font-bold">Votre bibliothèque est vide</h2>
          <p className="mt-2 max-w-sm font-semibold text-encre-doux">
            Créez votre première fable : le texte, la morale, une illustration, puis les exercices
            associés.
          </p>
          <Link href="/enseignant/fables/nouvelle" className="btn-primaire mt-6">
            <Plus className="size-4.5" /> Créer ma première fable
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {fables.map((f) => (
            <article key={f.id} className="carte group flex flex-col overflow-hidden">
              <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-corail/15 via-ambre/10 to-sarcelle/10">
                {f.imageUrl ? (
                  <Image
                    src={f.imageUrl}
                    alt={`Illustration de ${f.titre}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <span className="absolute inset-0 grid place-items-center">
                    <BookOpenText className="size-12 text-encre/15" />
                  </span>
                )}
                <span className={`badge absolute top-3 left-3 ${STYLES_DIFFICULTE[f.difficulte] ?? "bg-encre/10"}`}>
                  {f.difficulte}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-titre text-xl leading-snug font-bold">{f.titre}</h2>
                <p className="mt-1 line-clamp-2 flex-1 text-sm font-semibold text-encre/50">
                  {f.morale || "Pas de morale renseignée."}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                    {f.nbExercicesPublies}/{f.nbExercices} exercice(s) publié(s)
                  </span>
                  {f.nbCibles > 0 && (
                    <span className="badge bg-lilas/12 text-lilas">
                      <Users className="size-3" /> {f.nbCibles} groupe(s) ciblé(s)
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t-2 border-dashed border-encre/8 pt-4">
                  <Link href={`/enseignant/fables/${f.id}`} className="btn-encre px-4 py-2 text-xs">
                    <Pencil className="size-3.5" /> Gérer
                  </Link>
                  <ActionsFable fableId={f.id} publie={f.publie} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
