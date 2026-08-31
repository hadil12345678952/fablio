import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, BarChart3, ListChecks } from "lucide-react";
import { db } from "@/db";
import { fables } from "@/db/schema";
import { lireSession } from "@/lib/auth";
import { codesDeEnseignant, exercicesDeFable } from "@/lib/queries";
import { FormulaireFable } from "@/components/enseignant/formulaire-fable";
import { GestionExercices } from "@/components/enseignant/gestion-exercices";
import { ActionsFable } from "@/components/enseignant/actions-fable";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gérer la fable" };

export default async function PageDetailFable({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const { id } = await params;

  const [fable] = await db
    .select()
    .from(fables)
    .where(and(eq(fables.id, id), eq(fables.enseignantId, session.enseignant.id)))
    .limit(1);
  if (!fable) notFound();

  const [exercices, codes] = await Promise.all([
    exercicesDeFable(fable.id),
    codesDeEnseignant(session.enseignant.id),
  ]);

  return (
    <div className="space-y-10">
      {/* En-tête */}
      <div>
        <Link href="/enseignant/fables" className="btn-fantome -ml-3 mb-2">
          <ArrowLeft className="size-4" /> Retour aux fables
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="etiquette text-corail">Fable · {fable.difficulte}</p>
            <h1 className="font-titre mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {fable.titre}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`badge ${fable.publie ? "bg-sarcelle/12 text-sarcelle" : "bg-encre/8 text-encre/50"}`}>
                {fable.publie ? "Publiée" : "Brouillon"}
              </span>
              <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                {exercices.length} exercice(s)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/enseignant/statistiques?fable=${fable.id}`} className="btn-ligne">
              <BarChart3 className="size-4.5" /> Statistiques
            </Link>
            <ActionsFable fableId={fable.id} publie={fable.publie} suppressionDansDetail />
          </div>
        </div>
      </div>

      {/* Informations de la fable */}
      <section>
        <h2 className="font-titre mb-4 text-2xl font-bold">Informations de la fable</h2>
        <FormulaireFable
          fable={{
            id: fable.id,
            titre: fable.titre,
            texte: fable.texte,
            morale: fable.morale,
            imageUrl: fable.imageUrl,
            audioUrl: fable.audioUrl,
            difficulte: fable.difficulte,
            publie: fable.publie,
            cibleCodeIds: fable.cibleCodeIds ?? [],
          }}
          codes={codes}
        />
      </section>

      {/* Exercices */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-lilas/12 text-lilas">
            <ListChecks className="size-5" />
          </span>
          <div>
            <h2 className="font-titre text-2xl font-bold">Exercices associés</h2>
            <p className="text-sm font-semibold text-encre/50">
              Les élèves les résoudront dans l&apos;ordre affiché ici (flèches pour réordonner).
            </p>
          </div>
        </div>
        <GestionExercices fableId={fable.id} exercices={exercices} />
      </section>
    </div>
  );
}
