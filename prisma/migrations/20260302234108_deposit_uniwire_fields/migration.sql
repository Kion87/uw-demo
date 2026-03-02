/*
  Warnings:

  - A unique constraint covering the columns `[uniwireInvoiceId]` on the table `Deposit` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `address` to the `Deposit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uniwireInvoiceId` to the `Deposit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "uniwireInvoiceId" TEXT NOT NULL,
ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'new';

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_uniwireInvoiceId_key" ON "Deposit"("uniwireInvoiceId");
