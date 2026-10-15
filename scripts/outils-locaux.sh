#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AJOUT DE LA REPRODUCTION (fichier absent du projet d'origine).
#
# Provisionne TOUT ce qu'il faut pour exécuter Fablio dans un environnement
# vierge SANS accès administrateur (aucun apt, aucun Docker) :
#
#   1. binaires PostgreSQL 16 (paquet PyPI « pgserver », wheel manylinux) ;
#   2. cluster local + base app_db (délègue à scripts/pg-local.sh) ;
#   3. dépendances npm du projet (dossier node_modules, non versionné) ;
#   4. fontes TTF réelles (Baloo 2 / Nunito / Literata via Fontsource) pour que
#      `next build` fonctionne SANS accès à fonts.googleapis.com, avec la
#      variable officielle NEXT_FONT_GOOGLE_MOCKED_RESPONSES.
#
# Usage :
#   bash scripts/outils-locaux.sh            # tout provisionner (idempotent)
#   bash scripts/outils-locaux.sh pg         # seulement PostgreSQL
#   bash scripts/outils-locaux.sh npm        # seulement node_modules
#   bash scripts/outils-locaux.sh fonts      # seulement les fontes
#
# Après provisionnement :
#   node scripts/setup-db.mjs && node scripts/seed.mjs
#   npx tsc --noEmit && npm run lint
#   NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$FONTS_MOCK npx next build
#   npx next start -H 0.0.0.0 -p 3000 &
#   node tests/e2e-fablio.mjs
#
# (Cette étape n'est PAS nécessaire sur une machine disposant d'un PostgreSQL et
#  d'un accès Internet : `npm install` + une DATABASE_URL suffisent.)
# ---------------------------------------------------------------------------
set -euo pipefail

RACINE="${OUTILS_RACINE:-/home/user/outils}"
PG_VERSION_PAQUET="${PG_VERSION_PAQUET:-0.1.4}"
export PG_ROOT="${PG_ROOT:-$RACINE/pgserver/pgserver/pginstall}"
export PGDATA="${PGDATA:-$RACINE/pgdata}"
export FONTS_SOURCE="${FONTS_SOURCE:-$RACINE/fontsrc/node_modules/@fontsource}"
export FONTS_DEST="${FONTS_DEST:-$RACINE/fonts}"
export FONTS_MOCK="${FONTS_MOCK:-$RACINE/font-css-mock.cjs}"

provisionner_pg() {
  if [ ! -x "$PG_ROOT/bin/postgres" ]; then
    echo "── PostgreSQL : téléchargement de la wheel pgserver ──"
    mkdir -p "$RACINE/pgwheel" "$RACINE/pgserver"
    pip3 download "pgserver==$PG_VERSION_PAQUET" --no-deps -d "$RACINE/pgwheel"
    python3 -m zipfile -e "$RACINE"/pgwheel/pgserver-*.whl "$RACINE/pgserver/"
    chmod +x "$PG_ROOT"/bin/* 2>/dev/null || true
    find "$PG_ROOT/lib" -name '*.so*' -exec chmod +x {} \; 2>/dev/null || true
  fi
  echo "── PostgreSQL : cluster + base app_db ──"
  bash "$(dirname "$0")/pg-local.sh" init
}

provisionner_npm() {
  echo "── Dépendances npm ──"
  npm install --no-fund --no-audit
}

provisionner_fonts() {
  if [ ! -d "$FONTS_SOURCE/baloo-2" ]; then
    echo "── Fontes : paquets Fontsource (Baloo 2, Nunito, Literata) ──"
    mkdir -p "$RACINE/fontsrc"
    ( cd "$RACINE/fontsrc" &&
      [ -f package.json ] || npm init -y >/dev/null &&
      npm install --no-fund --no-audit @fontsource/baloo-2 @fontsource/nunito @fontsource/literata )
  fi
  echo "── Fontes : fichiers .woff2 + simulation Google Fonts ──"
  node scripts/fonts-hors-ligne.mjs
  echo "   NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$FONTS_MOCK"
}

cd "$(dirname "$0")/.."
case "${1:-tout}" in
  pg) provisionner_pg ;;
  npm) provisionner_npm ;;
  fonts) provisionner_fonts ;;
  tout) provisionner_pg; provisionner_npm; provisionner_fonts ;;
  *) echo "Usage : $0 {tout|pg|npm|fonts}" >&2; exit 2 ;;
esac
echo "✓ Provisionnement terminé."
