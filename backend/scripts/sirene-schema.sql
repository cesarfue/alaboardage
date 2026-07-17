-- Schéma de la table SIRENE locale (cf. backend/scripts/import-sirene.sh).
-- Remplace les appels HTTP à recherche-entreprises.api.gouv.fr par une
-- recherche full-text française + trigramme dans Postgres (anti rate-limit).
--
-- La table vit dans le schéma `sirene`, hors du `public` géré par Prisma :
-- `prisma db push` au démarrage ne la voit pas et ne tente pas de la drop.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE SCHEMA IF NOT EXISTS sirene;

-- unaccent n'est pas IMMUTABLE par défaut : wrapper pour pouvoir l'indexer.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(public.unaccent('public.unaccent', $1)) $$;

CREATE TABLE IF NOT EXISTS sirene.etablissement (
  siret       text PRIMARY KEY,
  name        text NOT NULL,
  departement text NOT NULL,
  region      text,
  city        text,
  address     text,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL
);

-- Purge tranche d'effectifs: donnée trop bruitée (établissement != entreprise)
-- et couverture SIRENE trop faible (~30%). Idempotent.
ALTER TABLE sirene.etablissement DROP COLUMN IF EXISTS company_size;

-- Filtrage par scope géographique.
CREATE INDEX IF NOT EXISTS sirene_dept_idx ON sirene.etablissement (departement);
CREATE INDEX IF NOT EXISTS sirene_region_idx ON sirene.etablissement (region);

-- Recherche floue par nom : trigramme (fautes/partiel) + FTS français (tokens/stemming).
CREATE INDEX IF NOT EXISTS sirene_name_trgm_idx
  ON sirene.etablissement USING gin (f_unaccent(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sirene_name_fts_idx
  ON sirene.etablissement USING gin (to_tsvector('french', name));
