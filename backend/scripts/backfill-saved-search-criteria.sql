UPDATE "SavedSearch"
SET queries = ARRAY[query], locations = ARRAY[location]
WHERE cardinality(queries) = 0;

SELECT id, name, queries, locations FROM "SavedSearch";
