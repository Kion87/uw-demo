-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN "referenceId" TEXT NOT NULL;
ALTER TABLE "Withdrawal" ALTER COLUMN "uniwirePayoutId" DROP NOT NULL;
ALTER TABLE "Withdrawal" ALTER COLUMN "status" SET DEFAULT 'reserved';

-- DropIndex
DROP INDEX "Withdrawal_uniwirePayoutId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_referenceId_key" ON "Withdrawal"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_uniwirePayoutId_key" ON "Withdrawal"("uniwirePayoutId");
