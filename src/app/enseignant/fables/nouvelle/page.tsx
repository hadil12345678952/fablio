import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { lireSession } from "@/lib/auth";
import { codesDeEnseignant } from "@/lib/queries";
import { FormulaireFable } from "@/components/enseignant/formulaire-fable";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouvelle fable" };

export default async function PageNouvelleFable() {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const codes = await codesDeEnseignant(session.enseignant.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/enseignant/fables" className="btn-fantome -ml-3 mb-2">
          <ArrowLeft className="size-4" /> Retour aux fables
        </Link>
        <p className="etiquette text-corail">Création</p>
        <h1 className="font-titre mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Nouvelle fable
        </h1>
        <p className="mt-1.5 font-semibold text-encre-doux">
          Rédigez le texte et la morale ; vous ajouterez les exercices juste après.
        </p>
      </div>
      <FormulaireFable fable={null} codes={codes} />
    </div>
  );
}
