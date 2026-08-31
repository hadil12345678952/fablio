import { redirect } from "next/navigation";
import { lireSession } from "@/lib/auth";
import { codesDeEnseignant } from "@/lib/queries";
import { GestionCodes } from "@/components/enseignant/gestion-codes";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Codes de classe" };

export default async function PageCodes() {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const codes = await codesDeEnseignant(session.enseignant.id);

  return (
    <div className="space-y-7">
      <div>
        <p className="etiquette text-corail">Parrainage</p>
        <h1 className="font-titre mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Codes de classe
        </h1>
        <p className="mt-1.5 max-w-2xl font-semibold text-encre-doux">
          Chaque code rattache les élèves inscrits à votre compte. Créez-en un par classe ou par
          groupe : vous pourrez ensuite affecter certaines fables à un groupe précis.
        </p>
      </div>
      <GestionCodes codes={codes} />
    </div>
  );
}
