/*
  Warnings:

  - A unique constraint covering the columns `[uniwireTransactionId]` on the table `Deposit` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `uniwireTransactionId` to the `Deposit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "txid" TEXT,
ADD COLUMN     "uniwireTransactionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DepositAddress" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "UniwireCallback" (
    "id" SERIAL NOT NULL,
    "callbackId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniwireCallback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UniwireCallback_callbackId_key" ON "UniwireCallback"("callbackId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_uniwireTransactionId_key" ON "Deposit"("uniwireTransactionId");
