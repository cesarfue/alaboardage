-- Schéma de la table SIRENE locale (cf. backend/scripts/import-sirene.sh).
-- Remplace les appels HTTP à recherche-entreprises.api.gouv.fr par une
-- recherche full-text française + trigramme dans Postgres (anti rate-limit).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent n'est pas IMMUTABLE par défaut : wrapper pour pouvoir l'indexer.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(public.unaccent('public.unaccent', $1)) $$;

CREATE TABLE IF NOT EXISTS sirene_etablissement (
  siret       text PRIMARY KEY,
  name        text NOT NULL,
  departement text NOT NULL,
  region      text,
  city        text,
  address     text,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL
);

-- Filtrage par scope géographique.
CREATE INDEX IF NOT EXISTS sirene_dept_idx ON sirene_etablissement (departement);
CREATE INDEX IF NOT EXISTS sirene_region_idx ON sirene_etablissement (region);

-- Recherche floue par nom : trigramme (fautes/partiel) + FTS français (tokens/stemming).
CREATE INDEX IF NOT EXISTS sirene_name_trgm_idx
  ON sirene_etablissement USING gin (f_unaccent(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sirene_name_fts_idx
  ON sirene_etablissement USING gin (to_tsvector('french', name));
