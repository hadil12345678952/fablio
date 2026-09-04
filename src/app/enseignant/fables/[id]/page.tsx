import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { db } from "@/db";
import { fables } from "@/db/schema";
import { lireSession } from "@/lib/auth";
import { codesDeEnseignant, exercicesDeFable } from "@/lib/queries";
import { FormulaireFable } from "@/components/enseignant/formulaire-fable";
import { GestionExercices } from "@/components/enseignant/gestion-exercices";
import { ActionsFable } from "@/components/enseignant/actions-fable";
import { blocsEnrichisPourEnseignant } from "@/lib/blocs/queries";
import { EditeurPedagogique } from "@/components/blocs/editeur-pedagogique";
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

  const [exercices, codes, blocs] = await Promise.all([
    exercicesDeFable(fable.id),
    codesDeEnseignant(session.enseignant.id),
    blocsEnrichisPourEnseignant(fable.id),
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
              <span className="badge bg-lilas/12 text-lilas">
                {blocs.length} bloc(s)
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

      {/* Éditeur pédagogique modulaire (nouveau cœur) */}
      <section>
        <h2 className="font-titre mb-4 text-2xl font-bold">Parcours pédagogique</h2>
        <EditeurPedagogique
          fableId={fable.id}
          blocsInitiaux={blocs}
          exercicesDisponibles={exercices}
          fablePubliee={fable.publie}
        />
      </section>

      {/* Informations de la fable (métadonnées + ciblage) */}
      <details className="carte overflow-hidden">
        <summary className="cursor-pointer border-b-2 border-encre/8 bg-papier px-6 py-4 font-titre text-lg font-bold transition-colors hover:bg-papier-fonce">
          Informations de la fable (titre, moral, difficulté, ciblage…)
        </summary>
        <div className="p-6">
          <FormulaireFable
            fable={{
              id: fable.id,
              titre: fable.titre,
              texte: fable.texte,
              morale: fable.morale,
              imageUrl: fable.imageUrl,
              audioUrl: fable.audioUrl,
              videoUrl: fable.videoUrl,
              difficulte: fable.difficulte,
              publie: fable.publie,
              cibleCodeIds: fable.cibleCodeIds ?? [],
            }}
            codes={codes}
          />
        </div>
      </details>

      {/* Gestion technique des exercices (création des exercices référençables) */}
      <details className="carte overflow-hidden">
        <summary className="cursor-pointer border-b-2 border-encre/8 bg-papier px-6 py-4 font-titre text-lg font-bold transition-colors hover:bg-papier-fonce">
          Créer ou modifier les exercices du moteur (8 types)
        </summary>
        <div className="p-6">
          <p className="mb-4 text-sm font-semibold text-encre/50">
            Les exercices créés ici deviennent proposables comme blocs « Exercice » dans le parcours.
          </p>
          <GestionExercices fableId={fable.id} exercices={exercices} />
        </div>
      </details>
    </div>
  );
}
