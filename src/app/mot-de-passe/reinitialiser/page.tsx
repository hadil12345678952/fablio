import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";
import { CadreAuth } from "@/components/auth/formulaires-auth";
import { FormulaireReinitialisation } from "@/components/auth/formulaires-mot-de-passe";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function PageReinitialisation() {
  return (
    <CadreAuth
      titre="Choisir un nouveau mot de passe"
      sousTitre="Ce lien est valable une heure et ne peut servir qu'une seule fois."
    >
      <Suspense
        fallback={
          <div className="carte w-full max-w-md p-9 text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-rose" />
          </div>
        }
      >
        <FormulaireReinitialisation />
      </Suspense>
    </CadreAuth>
  );
}
