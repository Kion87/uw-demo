# DATABASE_SCHEMA.md

# UW Demo — Database Schema (Conceptual)

## User

- id (Int, PK)
- publicId (String, unique-ish in practice; used for passthrough lookup)
- email (String)
  (Optional future)
- balance (Decimal) — if you implement direct balance crediting

## Session

- token (String)
- userId (Int)
- expiresAt (DateTime)

## DepositAddress (Reusable Addresses)

- userId (Int)
- assetKey (String) — used as the chain reuseKey (ETH/TRX/SOL/BTC)
- invoiceId (String)
- address (String)

Unique:

- (userId, assetKey)

## Deposit (One Row Per Actual Transaction)

Key points:

- A reusable invoice/address can receive multiple transactions
- Therefore: deposits must be keyed by transaction id

Fields (typical):

- userId (Int)
- asset (String) — should map to paid currency (e.g. USDT)
- network (String) — chain (e.g. ETH/TRX); note tx.kind may be token-specific like ETH_USDT
- amount (Decimal?)
- uniwireInvoiceId (String) — NOT unique
- uniwireTransactionId (String) — UNIQUE (idempotency key)
- txid (String?)
- address (String)
- status (String) — callback_status or tx.status
- createdAt/updatedAt

## UniwireCallback (Delivery Log)

- id (Int, PK)
- callbackId (String, UNIQUE)
- receivedAt (DateTime)

Notes:

- callbackId uniqueness prevents duplicate delivery logging
- resends may reuse callbackId; do not break processing if callbackId already exists
