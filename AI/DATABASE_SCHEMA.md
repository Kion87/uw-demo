# UW Demo — Database Schema (Conceptual)

## User

- `id` (Int, PK)
- `publicId` (String, unique in practice; used for passthrough lookup)
- `email` (String)
- optional future:
  - `balance` (Decimal)

## Session

- `token` (String)
- `userId` (Int)
- `expiresAt` (DateTime)

## DepositAddress (Reusable Addresses)

Purpose:

- stores reusable deposit addresses per user / supported asset flow

Fields:

- `id`
- `userId`
- `assetKey`
- `invoiceId`
- `address`
- `createdAt`
- `updatedAt`

Unique / indexes:

- unique: `(userId, assetKey)`
- index: `userId`

## Deposit (One Row Per Actual Transaction)

Key points:

- one reusable invoice/address can receive many transactions
- deposits must therefore be keyed by transaction id, not invoice id
- later callbacks update the same row

Fields:

- `id`
- `userId`
- `asset`
- `network`
- `amount`
- `fiatAmount` — USD-equivalent value at time of deposit (from Uniwire's `amount.paid.quotes.USD`)
- `fiatCurrency` — currently always `"USD"` when `fiatAmount` is set, nullable otherwise
- `uniwireInvoiceId` — **not unique**
- `address`
- `uniwireTransactionId` — unique idempotency key; nullable before transaction exists
- `txid`
- `status`
- `executedAt`
- `confirmedAt`
- `confirmations`
- `creditedAt`
- `createdAt`
- `updatedAt`

Notes:

- `status` should reflect transaction lifecycle such as pending / confirmed / complete
- `creditedAt` is reserved for idempotent balance crediting later
- `executedAt` / `confirmedAt` may be null on pending callbacks and filled later on confirmed callbacks
- `fiatAmount` may be null if Uniwire's payload doesn't include a `quotes.USD` value (not confirmed to be present on every callback) — the dashboard treats this as a normal, permanent possibility (defaults to 0), not an error

## UniwireCallback (Delivery Log)

Fields:

- `id` (Int, PK)
- `callbackId` (String, UNIQUE)
- `receivedAt` (DateTime)

Notes:

- prevents duplicate delivery logging
- duplicate callback ids must not prevent deposit upsert processing
