BEGIN;

CREATE TEMP TABLE purge ON COMMIT DROP AS
SELECT j.id
FROM "Job" j
WHERE j.source = 'HELLOWORK'
  AND j."datePosted" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "JobInteraction" i WHERE i."jobId" = j.id);

SELECT count(*) AS a_supprimer FROM purge;

DELETE FROM "JobScore" WHERE "jobId" IN (SELECT id FROM purge);
DELETE FROM "Job" WHERE id IN (SELECT id FROM purge);

SELECT count(*) AS hellowork_sans_date_restantes
FROM "Job"
WHERE source = 'HELLOWORK' AND "datePosted" IS NULL;

COMMIT;
