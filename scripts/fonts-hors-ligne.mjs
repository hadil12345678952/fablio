// ---------------------------------------------------------------------------
// AJOUT DE LA REPRODUCTION (fichier absent du projet d'origine).
//
// But : permettre `next build` DANS UN ENVIRONNEMENT SANS ACCÈS À INTERNET
// (l'allowlist réseau du bac à sable ne contient ni fonts.googleapis.com ni
// fonts.gstatic.com). Le code source n'est PAS modifié : on exploite la
// variable officielle de Next.js `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`, qui
// remplace la réponse de l'API Google Fonts par des réponses locales.
//
// Les fichiers .woff2 utilisés sont les fichiers RÉELS des trois familles
// (Baloo 2, Nunito, Literata) récupérés depuis les paquets npm Fontsource
// (@fontsource/baloo-2, @fontsource/nunito, @fontsource/literata — miroir
// officiel des Google Fonts) : rendu typographique identique.
//
// Prérequis (hors dépôt, pour ne pas toucher package.json) :
//   mkdir -p /home/user/outils/fontsrc && cd /home/user/outils/fontsrc
//   npm init -y && npm i @fontsource/baloo-2 @fontsource/nunito @fontsource/literata
//
// Usage :
//   node scripts/fonts-hors-ligne.mjs --serve   # prépare ET sert les fontes (port 8099)
//   NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/home/user/outils/font-css-mock.cjs npm run build
// ---------------------------------------------------------------------------

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const SOURCE = process.env.FONTS_SOURCE ?? "/home/user/outils/fontsrc/node_modules/@fontsource";
const DEST = process.env.FONTS_DEST ?? "/home/user/outils/fonts";
const SORTIE = process.env.FONTS_MOCK ?? "/home/user/outils/font-css-mock.cjs";
const PORT = Number(process.env.FONTS_PORT ?? 8099);

// Doit correspondre EXACTEMENT à src/app/layout.tsx (familles, poids, display).
const POLICES = [
  { paquet: "baloo-2", famille: "Baloo 2", fichier: "baloo-2", poids: [400, 500, 600, 700, 800] },
  { paquet: "nunito", famille: "Nunito", fichier: "nunito", poids: [400, 500, 600, 700, 800, 900] },
  { paquet: "literata", famille: "Literata", fichier: "literata", poids: [400, 500, 600, 700] },
];

// Plage latine renvoyée par l'API Google Fonts pour le sous-ensemble « latin ».
const UNICODE_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC," +
  "U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193," +
  "U+2212,U+2215,U+FEFF,U+FFFD";

fs.mkdirSync(DEST, { recursive: true });

/** Reproduit getGoogleFontsUrl() de @next/font : l'URL réellement demandée. */
function urlGoogle(famille, poids) {
  return (
    `https://fonts.googleapis.com/css2?family=${famille.replace(/ /g, "+")}` +
    `:wght@${poids.join(";")}&display=swap`
  );
}

const reponses = {};
let copies = 0;

for (const p of POLICES) {
  const blocs = [];
  for (const poids of p.poids) {
    const nom = `${p.fichier}-latin-${poids}-normal.woff2`;
    const src = path.join(SOURCE, p.paquet, "files", nom);
    if (!fs.existsSync(src)) {
      throw new Error(
        `Police introuvable : ${src}\n` +
          "Installez les paquets Fontsource (voir l'en-tête de ce script)."
      );
    }
    const cible = path.join(DEST, nom);
    if (!fs.existsSync(cible)) {
      fs.copyFileSync(src, cible);
      copies++;
    }
    // Turbopack résout les url() du CSS simulé comme des ressources distantes :
    // on sert donc les fontes en HTTP local pendant le build.
    blocs.push(
      `/* latin */\n` +
        `@font-face {\n` +
        `  font-family: '${p.famille}';\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${poids};\n` +
        `  font-display: swap;\n` +
        `  src: url(http://127.0.0.1:${PORT}/${nom}) format('woff2');\n` +
        `  unicode-range: ${UNICODE_LATIN};\n` +
        `}\n`
    );
  }
  reponses[urlGoogle(p.famille, p.poids)] = blocs.join("\n");
}

fs.writeFileSync(
  SORTIE,
  "// Généré par scripts/fonts-hors-ligne.mjs — ne pas éditer à la main.\n" +
    "module.exports = " +
    JSON.stringify(reponses, null, 2) +
    ";\n"
);

console.log(`✓ ${Object.keys(reponses).length} famille(s) préparée(s), ${copies} fichier(s) copié(s).`);
console.log(`  Fontes            : ${DEST}`);
console.log(`  Réponses simulées : ${SORTIE}`);
for (const u of Object.keys(reponses)) console.log(`    · ${u}`);

if (process.argv.includes("--serve")) {
  const serveur = http.createServer((req, res) => {
    const nom = path.basename(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const fichier = path.join(DEST, nom);
    if (!nom.endsWith(".woff2") || !fs.existsSync(fichier)) {
      res.writeHead(404).end("introuvable");
      return;
    }
    res.writeHead(200, { "Content-Type": "font/woff2" });
    fs.createReadStream(fichier).pipe(res);
  });
  serveur.listen(PORT, "127.0.0.1", () =>
    console.log(`→ Fontes servies sur http://127.0.0.1:${PORT} (Ctrl-C pour arrêter)`)
  );
}
