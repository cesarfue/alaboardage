-- Make googleId optional (email/password users won't have one)
ALTER TABLE "User" ALTER COLUMN "googleId" DROP NOT NULL;

-- Add passwordHash for email/password auth
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
