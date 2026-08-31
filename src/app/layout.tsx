import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Baloo_2, Nunito, Literata } from "next/font/google";
import "./globals.css";

const policeTitre = Baloo_2({
  subsets: ["latin"],
  variable: "--font-titre",
  weight: ["400", "500", "600", "700", "800"],
});

const policeCorps = Nunito({
  subsets: ["latin"],
  variable: "--font-corps",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const policeLecture = Literata({
  subsets: ["latin"],
  variable: "--font-lecture",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Fablio — Les fables prennent vie en classe",
    template: "%s · Fablio",
  },
  description:
    "Plateforme éducative pour l'apprentissage des fables à l'école primaire : création d'exercices par l'enseignant, suivi statistique des élèves.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body
        className={`${policeTitre.variable} ${policeCorps.variable} ${policeLecture.variable} bg-papier text-encre antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
