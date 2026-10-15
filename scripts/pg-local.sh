#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AJOUT DE LA REPRODUCTION (pas un fichier du projet d'origine).
#
# Démarre un PostgreSQL local SANS installation système (aucun paquet apt,
# aucun Docker disponible dans l'environnement d'exécution). Les binaires
# PostgreSQL 16 sont fournis par le paquet PyPI « pgserver » (wheel
# manylinux), extraits dans $PG_ROOT.
#
#   scripts/pg-local.sh init     # initdb (idempotent) + créé la base app_db
#   scripts/pg-local.sh start    # démarre le serveur (port 5432)
#   scripts/pg-local.sh stop     # arrête le serveur
#   scripts/pg-local.sh status   # état
#
# Variables : PG_ROOT (défaut /home/user/outils/pgserver/pgserver/pginstall)
#             PGDATA  (défaut /home/user/outils/pgdata)
#             PGPORT  (défaut 5432)
# ---------------------------------------------------------------------------
set -euo pipefail

PG_ROOT="${PG_ROOT:-/home/user/outils/pgserver/pgserver/pginstall}"
PGDATA="${PGDATA:-/home/user/outils/pgdata}"
PGPORT="${PGPORT:-5432}"
export LD_LIBRARY_PATH="$PG_ROOT/lib:${LD_LIBRARY_PATH:-}"

BIN="$PG_ROOT/bin"

verifier_binaires() {
  if [ ! -x "$BIN/postgres" ]; then
    echo "Binaires PostgreSQL absents ($BIN)." >&2
    echo "Installez-les :" >&2
    echo "  pip3 download pgserver --no-deps -d /tmp/pgwheel" >&2
    echo "  python3 -m zipfile -e /tmp/pgwheel/pgserver-*.whl $PG_ROOT/.." >&2
    echo "  chmod +x $BIN/* ; find $PG_ROOT/lib -name '*.so*' -exec chmod +x {} \\;" >&2
    exit 1
  fi
}

demarrer() {
  if "$BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "PostgreSQL déjà démarré (PGDATA=$PGDATA)."
    return 0
  fi
  "$BIN/pg_ctl" -D "$PGDATA" -l /tmp/fablio-postgres.log \
    -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" -w start
  echo "PostgreSQL démarré sur 127.0.0.1:$PGPORT"
}

initialiser() {
  verifier_binaires
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"
    "$BIN/initdb" -D "$PGDATA" -U postgres --auth=trust --encoding=UTF8 \
      --locale=C.UTF-8 >/dev/null
    echo "Cluster initialisé dans $PGDATA"
  fi
  demarrer
  if ! "$BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -lqt | cut -d'|' -f1 | grep -qw app_db; then
    "$BIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U postgres app_db
    echo "Base app_db créée."
  else
    echo "Base app_db déjà présente."
  fi
}

case "${1:-start}" in
  init) initialiser ;;
  start) verifier_binaires; demarrer ;;
  stop) "$BIN/pg_ctl" -D "$PGDATA" -m fast stop ;;
  status) "$BIN/pg_ctl" -D "$PGDATA" status ;;
  *) echo "Usage : $0 {init|start|stop|status}" >&2; exit 2 ;;
esac
