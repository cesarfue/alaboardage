#!/usr/bin/env bash
# Importe la base SIRENE des établissements géolocalisée (data.gouv.fr) dans
# Postgres pour remplacer les appels à recherche-entreprises.api.gouv.fr.
#
# Téléchargement (~928 Mo) + CSV intermédiaire : placés dans un workdir résolu
# automatiquement selon la machine (voir ci-dessous). La table finale vit dans
# le volume Docker Postgres, pas dans le workdir.
#
# Non commité côté données — relancer avec `make import-sirene` sur une machine.

set -euo pipefail

PARQUET_URL="https://www.data.gouv.fr/api/1/datasets/r/d20b0aed-e206-40cf-b301-04ca8e209de7"
case "$(uname -m)" in
  aarch64 | arm64) DUCKDB_ARCH="linux-aarch64" ;;
  *) DUCKDB_ARCH="linux-amd64" ;;
esac
DUCKDB_URL="https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-${DUCKDB_ARCH}.zip"
DEPT_REGION_URL="https://geo.api.gouv.fr/departements?fields=code,codeRegion"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_SQL="$SCRIPT_DIR/sirene-schema.sql"

# ── Workdir : sgoinfre à l'école (home minuscule), sinon repo-local ───────────
if [ -n "${ALA_SIRENE_WORKDIR:-}" ]; then
  WORKDIR="$ALA_SIRENE_WORKDIR"
elif [ -d "$HOME/sgoinfre" ]; then
  WORKDIR="$HOME/sgoinfre/alaboardage/sirene"
else
  WORKDIR="$SCRIPT_DIR/../data/sirene"
fi
mkdir -p "$WORKDIR/bin"
echo "→ workdir: $WORKDIR"

PARQUET="$WORKDIR/sirene.parquet"
CSV="$WORKDIR/sirene.csv"
DEPT_REGION="$WORKDIR/dept_region.json"

# ── duckdb : PATH, sinon bootstrap dans le workdir ────────────────────────────
if command -v duckdb >/dev/null 2>&1; then
  DUCKDB="$(command -v duckdb)"
else
  DUCKDB="$WORKDIR/bin/duckdb"
  if [ ! -x "$DUCKDB" ]; then
    echo "→ téléchargement de duckdb..."
    curl -fsSL "$DUCKDB_URL" -o "$WORKDIR/bin/duckdb.zip"
    unzip -o "$WORKDIR/bin/duckdb.zip" -d "$WORKDIR/bin" >/dev/null
    rm "$WORKDIR/bin/duckdb.zip"
  fi
fi
echo "→ duckdb: $("$DUCKDB" --version)"

# ── Téléchargements (skip si déjà présents) ───────────────────────────────────
if [ ! -f "$PARQUET" ]; then
  echo "→ téléchargement du parquet SIRENE (~928 Mo)..."
  curl -fL --progress-bar -o "$PARQUET" "$PARQUET_URL"
fi
if [ ! -f "$DEPT_REGION" ]; then
  echo "→ téléchargement du mapping département → région..."
  curl -fsSL "$DEPT_REGION_URL" -o "$DEPT_REGION"
fi

# ── Transformation parquet → CSV (filtre actifs, diffusibles, géolocalisés) ───
echo "→ extraction DuckDB → CSV..."
"$DUCKDB" -c "
INSTALL spatial; LOAD spatial;
COPY (
  WITH dr AS (SELECT code, codeRegion FROM read_json_auto('$DEPT_REGION'))
  SELECT
    e.siret,
    coalesce(e.denominationUniteLegale, e.nomUniteLegale,
             e.denominationUsuelleEtablissement, e.enseigne1Etablissement) AS name,
    d.dept AS departement,
    dr.codeRegion AS region,
    e.libelleCommuneEtablissement AS city,
    e.geo_adresse AS address,
    ST_Y(e.geometry) AS lat,
    ST_X(e.geometry) AS lng
  FROM read_parquet('$PARQUET') e,
  LATERAL (SELECT CASE
    WHEN e.codeCommuneEtablissement LIKE '97%' OR e.codeCommuneEtablissement LIKE '98%'
    THEN substr(e.codeCommuneEtablissement, 1, 3)
    ELSE substr(e.codeCommuneEtablissement, 1, 2) END AS dept) d
  LEFT JOIN dr ON dr.code = d.dept
  WHERE e.etatAdministratifEtablissement = 'A'
    AND e.statutDiffusionEtablissement = 'O'
    AND e.geometry IS NOT NULL
    AND e.codeCommuneEtablissement IS NOT NULL
    AND coalesce(e.denominationUniteLegale, e.nomUniteLegale,
                 e.denominationUsuelleEtablissement, e.enseigne1Etablissement) IS NOT NULL
) TO '$CSV' (FORMAT csv, HEADER, DELIMITER ',', QUOTE '\"');
"
echo "→ CSV: $(wc -l < "$CSV") lignes"

# ── Chargement dans Postgres (via le conteneur compose) ───────────────────────
DC="docker compose"
echo "→ création du schéma..."
$DC exec -T postgres psql -v ON_ERROR_STOP=1 -U alaboardage -d alaboardage < "$SCHEMA_SQL"

echo "→ chargement dans Postgres..."
$DC exec -T postgres psql -v ON_ERROR_STOP=1 -U alaboardage -d alaboardage \
  -c "TRUNCATE sirene.etablissement;"
$DC exec -T postgres psql -v ON_ERROR_STOP=1 -U alaboardage -d alaboardage \
  -c "\copy sirene.etablissement(siret,name,departement,region,city,address,lat,lng) FROM STDIN WITH (FORMAT csv, HEADER true)" \
  < "$CSV"

COUNT=$($DC exec -T postgres psql -tA -U alaboardage -d alaboardage \
  -c "SELECT count(*) FROM sirene.etablissement;")
echo "✓ $COUNT établissements chargés"
