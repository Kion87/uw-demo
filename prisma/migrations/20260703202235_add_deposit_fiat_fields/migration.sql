-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "fiatAmount" DECIMAL(20,6),
ADD COLUMN     "fiatCurrency" TEXT;

-- CreateIndex
CREATE INDEX "Deposit_uniwireInvoiceId_idx" ON "Deposit"("uniwireInvoiceId");
