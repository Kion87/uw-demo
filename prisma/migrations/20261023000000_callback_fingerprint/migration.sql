-- AlterTable
ALTER TABLE "UniwireCallback" ADD COLUMN     "payload" JSONB,
ADD COLUMN     "bodyHash" TEXT,
ADD COLUMN     "deliveryCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastMismatchPayload" JSONB;
