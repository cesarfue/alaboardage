/*
  Warnings:

  - You are about to alter the column `lat` on the `Establishment` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `lng` on the `Establishment` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to drop the column `establishmentSirect` on the `Job` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Establishment" (
    "siret" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL
);
INSERT INTO "new_Establishment" ("address", "city", "lat", "lng", "name", "siret") SELECT "address", "city", "lat", "lng", "name", "siret" FROM "Establishment";
DROP TABLE "Establishment";
ALTER TABLE "new_Establishment" RENAME TO "Establishment";
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "datePosted" DATETIME NOT NULL,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "establishmentId" TEXT,
    CONSTRAINT "Job_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment" ("siret") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("company", "datePosted", "description", "establishmentId", "externalId", "id", "location", "scrapedAt", "source", "title", "updatedAt", "url") SELECT "company", "datePosted", "description", "establishmentId", "externalId", "id", "location", "scrapedAt", "source", "title", "updatedAt", "url" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_datePosted_idx" ON "Job"("datePosted");
CREATE INDEX "Job_company_idx" ON "Job"("company");
CREATE INDEX "Job_source_idx" ON "Job"("source");
CREATE UNIQUE INDEX "Job_source_externalId_key" ON "Job"("source", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
