-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN "emailAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SavedSearch" ADD COLUMN "lastCheckedAt" TIMESTAMP(3);
ALTER TABLE "SavedSearch" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
