# UW Demo — Database Schema (Conceptual)

## User

- `id` (Int, PK)
- `publicId` (String, unique in practice; used for passthrough lookup)
- `email` (String)
- `fixedAmountInvoices` (Boolean, default `false`) — per-user, all-assets setting; when on, the Deposit page shows an optional amount field. Purely a UI-visibility switch — `POST /api/deposit`'s actual behavior is driven by whether `amount` is present in the request, not by this column, so nothing server-side enforces it
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
- **reusable-address flow: no row exists until a real transaction arrives.** `POST /api/deposit` without an `amount` only touches `DepositAddress` — it used to also create a `Deposit` row immediately (status `"new"`, no txid), which lingered forever as a phantom "Pending" entry once the real deposit landed in a *separate* row upserted by transaction id. Fixed by not creating that row at all for this flow; the first (and only) row is created by the `transaction_*` callback upsert
- **fixed-amount invoice flow: the row is created upfront and updated in place.** It has to be — the `invoice_*` callback only `updateMany`s an existing row by `uniwireInvoiceId`, never creates one

Fields:

- `id`
- `userId`
- `asset`
- `network`
- `amount` — actual amount involved: set from `transaction.amount.paid.amount` for reusable-address deposits, or from `invoice.amount.paid.amount` (cumulative paid-so-far) for fixed-amount invoices. Null until real payment activity is reported either way
- `requestedAmount` — fixed-amount invoice ask, set once at creation (`POST /api/deposit` with an `amount`), always the **crypto** amount — Uniwire's `amount.invoiced.amount` from the invoice-creation response, regardless of which currency the request itself used. **Null for reusable-address deposits**, which have no "requested" concept — this is the field that distinguishes the two deposit flows on a given row
- `requestedFiatAmount` — set only when the fixed-amount invoice was requested in USD (Deposit page's amount field in USD display mode): Uniwire's own `amount.requested.amount` from the invoice-creation response. Null when the invoice was requested directly in crypto, or for reusable-address deposits
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

- `status` should reflect transaction lifecycle such as pending / confirmed / complete for reusable-address deposits (`requestedAmount` null), or `invoice_pending` / `invoice_confirmed` / `invoice_complete` / `underpaid` for fixed-amount invoices (`requestedAmount` set) — only `invoice_complete`/`complete`/`confirmed` are in `COMPLETED_STATUSES` (`server/utils/balances.ts`) and count toward available balance
- a fixed-amount invoice row's `status` stays literally `"new"` (its value straight from Uniwire at creation) until the *first* `invoice_*` callback fires — since even `invoice_pending` implies a matching transaction sum already exists per Uniwire's docs, `"new"` reliably means zero transaction activity has happened at all. The UI treats this as its own category (type "Invoice", status "New") rather than lumping it into "pending" — see `depositActivityStatus()`/`displayStatus()`. Dashboard's `totalDeposits`/`pendingDeposits` stat counts also explicitly exclude `status: "new"` rows for the same reason
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
- `status` — `reserved | pending | initialized | confirmed | complete | rejected | failed` (`confirmed`/`complete` are both terminal/credited — they reflect Uniwire's two confirmation thresholds, e.g. 12 vs 35 on Ethereum)
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
