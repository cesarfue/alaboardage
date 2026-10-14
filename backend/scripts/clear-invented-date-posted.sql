SELECT count(*) AS suspect
FROM "Job"
WHERE "datePosted" IS NOT NULL
  AND abs(extract(epoch FROM ("datePosted" - "updatedAt"))) < 300;

UPDATE "Job"
SET "datePosted" = NULL
WHERE "datePosted" IS NOT NULL
  AND abs(extract(epoch FROM ("datePosted" - "updatedAt"))) < 300;

SELECT count(*) FILTER (WHERE "datePosted" IS NULL) AS sans_date,
       count(*) AS total
FROM "Job";
