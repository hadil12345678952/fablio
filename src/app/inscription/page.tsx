import { redirect } from "next/navigation";
import { lireSession } from "@/lib/auth";
import { CadreAuth, FormulaireInscription } from "@/components/auth/formulaires-auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inscription" };

export default async function PageInscription({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await lireSession();
  if (session?.type === "enseignant") redirect("/enseignant");
  if (session?.type === "eleve") redirect("/eleve");

  const params = await searchParams;
  const role = params.role === "eleve" ? "eleve" : "enseignant";

  return (
    <CadreAuth
      titre="Bienvenue sur Fablio"
      sousTitre="Enseignant : créez votre espace. Élève : rejoignez votre classe avec le code de votre enseignant."
    >
      <FormulaireInscription roleInitial={role} />
    </CadreAuth>
  );
}
