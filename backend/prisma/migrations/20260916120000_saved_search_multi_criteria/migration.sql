-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN "queries" TEXT[];
ALTER TABLE "SavedSearch" ADD COLUMN "locations" TEXT[];

-- Backfill
UPDATE "SavedSearch"
SET queries = ARRAY[query], locations = ARRAY[location]
WHERE cardinality(queries) = 0;
