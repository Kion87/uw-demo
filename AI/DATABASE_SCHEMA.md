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
- `fiatAmount` may be null if Uniwire's payload doesn't include a `quotes.USD` value (not confirmed to be present on every callback) — the dashboard treats this as a normal, permanent possibility, rendering `—` (never a fabricated `$0.00`), not an error

## Withdrawal (One Row Per Payout Request)

Key points:

- created up front (`status: "reserved"`) inside the same serializable transaction that reserves the user's balance, before Uniwire is ever contacted
- `referenceId` is generated before the Uniwire call and sent as `reference_id` on every attempt/retry, so a retry after an ambiguous (timeout/network) failure can't create a duplicate payout on Uniwire's side
- `uniwirePayoutId` may be null until a callback arrives, if the original create-payout request was itself ambiguous

Fields:

- `id`
- `userId`
- `asset` — currency sent to Uniwire, e.g. `"BTC"`, `"ETH"`, `"USDT"`
- `network` — `"kind"` sent to Uniwire, e.g. `"BTC"`, `"ETH_USDT"`
- `amount`
- `fiatAmount` — reserved for a USD quote from the payout response; **currently always null**, nothing populates it (the dashboard values withdrawals live via `getRatesUsd()` instead — see Architecture Decision #13)
- `fiatCurrency`
- `destinationAddress`
- `referenceId` — **unique**, our own idempotency key
- `uniwirePayoutId` — unique, nullable until backfilled by a callback
- `txid`
- `status` — `reserved | pending | initialized | confirmed | rejected | failed`
- `errorMessage`
- `executedAt`
- `confirmedAt`
- `confirmations`
- `createdAt`
- `updatedAt`

Notes:

- `getAvailableBalances()` treats only non-`rejected`/non-`failed` withdrawals as reducing available balance — a `reserved` or `pending` withdrawal still counts against the balance even before a callback confirms it, since the reservation already happened at request time

## UniwireCallback (Delivery Log)

Fields:

- `id` (Int, PK)
- `callbackId` (String, UNIQUE)
- `receivedAt` (DateTime)

Notes:

- prevents duplicate delivery logging
- duplicate callback ids must not prevent deposit upsert processing
