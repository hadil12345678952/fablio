import { CadreAuth } from "@/components/auth/formulaires-auth";
import { FormulaireMotDePasseOublie } from "@/components/auth/formulaires-mot-de-passe";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function PageMotDePasseOublie() {
  return (
    <CadreAuth
      titre="Mot de passe oublié ?"
      sousTitre="Pas de panique : choisissez votre profil, la marche à suivre s'affiche."
    >
      <FormulaireMotDePasseOublie />
    </CadreAuth>
  );
}
