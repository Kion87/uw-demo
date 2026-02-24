/*
  Warnings:

  - You are about to alter the column `userId` on the `DepositAddress` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `User` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DepositAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepositAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DepositAddress" ("address", "asset", "createdAt", "id", "network", "userId") SELECT "address", "asset", "createdAt", "id", "network", "userId" FROM "DepositAddress";
DROP TABLE "DepositAddress";
ALTER TABLE "new_DepositAddress" RENAME TO "DepositAddress";
CREATE INDEX "DepositAddress_address_idx" ON "DepositAddress"("address");
CREATE UNIQUE INDEX "DepositAddress_userId_asset_network_key" ON "DepositAddress"("userId", "asset", "network");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "updatedAt") SELECT "createdAt", "email", "id", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
