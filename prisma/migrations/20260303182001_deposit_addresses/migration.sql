/*
  Notes:
  - Backfills `assetKey` from old (`asset`, `network`) fields to keep existing rows usable.
  - Adds `updatedAt` with a default so migration works on non-empty tables.
  - Deduplicates potential collisions before creating unique(userId, assetKey).
*/

-- Drop old indexes tied to legacy shape
DROP INDEX IF EXISTS "DepositAddress_address_idx";
DROP INDEX IF EXISTS "DepositAddress_userId_asset_network_key";

-- Add new columns in a backward-compatible way first
ALTER TABLE "DepositAddress"
ADD COLUMN "assetKey" TEXT,
ADD COLUMN "invoiceId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill assetKey from old asset/network values
UPDATE "DepositAddress"
SET "assetKey" = CASE
  WHEN "asset" = 'BTC' AND "network" = 'BTC' THEN 'BTC'
  WHEN "asset" = 'ETH' AND "network" = 'ETH' THEN 'ETH'
  WHEN "asset" = 'USDT' AND "network" = 'ETH' THEN 'USDT_ERC20'
  WHEN "asset" = 'USDT' AND "network" IN ('TRX', 'TRC20') THEN 'USDT_TRC20'
  WHEN "asset" = 'TRX' AND "network" = 'TRX' THEN 'TRX'
  WHEN "asset" = 'SOL' AND "network" = 'SOL' THEN 'SOL'
  WHEN "asset" = 'USDC' AND "network" = 'SOL' THEN 'USDC_SPL'
  ELSE "asset"
END;

-- Enforce required new key
ALTER TABLE "DepositAddress"
ALTER COLUMN "assetKey" SET NOT NULL;

-- If legacy data maps to duplicates, keep the newest per user+assetKey
DELETE FROM "DepositAddress" d
USING (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "assetKey"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "DepositAddress"
) ranked
WHERE d."id" = ranked."id"
  AND ranked.rn > 1;

-- Remove legacy columns after successful backfill
ALTER TABLE "DepositAddress"
DROP COLUMN "asset",
DROP COLUMN "network";

-- Create new indexes
CREATE INDEX "DepositAddress_userId_idx" ON "DepositAddress"("userId");
CREATE UNIQUE INDEX "DepositAddress_userId_assetKey_key" ON "DepositAddress"("userId", "assetKey");
