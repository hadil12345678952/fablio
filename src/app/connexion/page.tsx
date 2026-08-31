import { redirect } from "next/navigation";
import { lireSession } from "@/lib/auth";
import { CadreAuth, FormulaireConnexion } from "@/components/auth/formulaires-auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({
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
      titre="Bon retour parmi nous !"
      sousTitre="Connectez-vous pour retrouver vos fables, vos exercices et votre classe."
    >
      <FormulaireConnexion roleInitial={role} />
    </CadreAuth>
  );
}
