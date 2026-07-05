-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "requestedAmount" DECIMAL(36,18);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fixedAmountInvoices" BOOLEAN NOT NULL DEFAULT false;
