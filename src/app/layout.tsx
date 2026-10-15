import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

// ---------------------------------------------------------------------------
// Polices AUTO-HÉBERGÉES (audit 2026-10).
//
// Avant : `next/font/google` (Baloo 2, Nunito, Literata). Conséquences mesurées :
//   1. `next build` ÉCHOUAIT hors connexion (`Failed to fetch 'Nunito' from
//      Google Fonts`) — il fallait une ruse (NEXT_FONT_GOOGLE_MOCKED_RESPONSES)
//      pour builder en local ou en CI fermée ; un build dépendant d'un hôte tiers
//      est un build non reproductible ;
//   2. chaque visiteur faisait partir un requête vers Google au premier chargement :
//      pour un outil scolaire destiné à des enfants de 7-10 ans, on évite de
//      tracer l'IP de la classe chez un tiers (question de conformité aussi) ;
//   3. le poids réel chargé n'était pas verrouillé par le dépôt.
//
// Après : les MÊMES fichiers `.woff2` (sous-ensemble latin, mêmes graisses que la
// demande Google Fonts initiale, `display: swap`) sont servis par le site, avec
// empreinte immuable et `Cache-Control` longue durée gérés par Next.
// Aucune requête tierne, build possible hors ligne, rendu identique.
//
// Pour régénérer ces fichiers depuis les paquets Fontsource (miroir officiel des
// Google Fonts, licence OFL 1.1) : `node scripts/fonts-hors-ligne.mjs --verser`.
// ---------------------------------------------------------------------------

/** Baloo 2 — titres et gros caractères (5 graisses).
*  NOTE : le chargeur de polices de Next exige des LITTÉRAUX explicites
*  (`Font loader values must be explicitly written literals`) : pas de `.map()`
*  ici, même si la répétition est disgracieuse. */
const policeTitre = localFont({
  variable: "--font-titre",
  display: "swap",
  src: [
    { path: "./polices/baloo-2-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./polices/baloo-2-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./polices/baloo-2-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./polices/baloo-2-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./polices/baloo-2-latin-800-normal.woff2", weight: "800", style: "normal" }
  ],
});

const policeCorps = localFont({
  variable: "--font-corps",
  display: "swap",
  src: [
    { path: "./polices/nunito-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./polices/nunito-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./polices/nunito-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./polices/nunito-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./polices/nunito-latin-800-normal.woff2", weight: "800", style: "normal" },
    { path: "./polices/nunito-latin-900-normal.woff2", weight: "900", style: "normal" }
  ],
});

const policeLecture = localFont({
  variable: "--font-lecture",
  display: "swap",
  src: [
    { path: "./polices/literata-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./polices/literata-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./polices/literata-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./polices/literata-latin-700-normal.woff2", weight: "700", style: "normal" }
  ],
});

export const metadata: Metadata = {
  title: {
    default: "Fablio — Les fables prennent vie en classe",
    template: "%s · Fablio",
  },
  description:
    "Plateforme éducative pour l'apprentissage des fables à l'école primaire : création d'exercices par l'enseignant, suivi statistique des élèves.",
};

export const viewport: Viewport = {
  themeColor: "#FFF8EC",
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
