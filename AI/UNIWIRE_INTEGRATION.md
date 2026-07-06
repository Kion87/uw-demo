# UNIWIRE_INTEGRATION.md

# Uniwire Integration — UW Demo

## References

- https://docs.uniwire.com/api/quickstart :contentReference[oaicite:2]{index=2}

## What Uniwire Does Here

- Creates invoices and deposit addresses
- Monitors blockchain activity
- Detects inbound transactions
- Executes payouts (withdrawals) to a user-supplied address
- Reports live exchange rates
- Sends callbacks (webhooks) to your app for both transactions and payouts

## Invoice Creation

Endpoint:

- POST `/v1/invoices`

Required fields:

- profile_id
- currency
- kind
- passthrough

Passthrough rule:

- `passthrough = user.publicId` (e.g. `"0001"`)

## Callback Endpoint

Your app:

- POST `/api/uniwire/callback` (Netlify deployment URL)

### Callback Types

- Transaction callbacks: `transaction_*` → **processed** (reusable-address deposits)
- Payout callbacks: `payout_*` → **processed** (withdrawals, see Payouts section below)
- Invoice callbacks: `invoice_*` → **processed** (fixed-amount invoices only, see Invoice Callbacks section below). For a reusable-address deposit's invoice, or any other `invoice_*` we can't otherwise match, still acknowledged with 2xx and ignored

### Payload Shape (Transaction Callback)

Top-level fields:

- callback_id
- callback_status
- signature
- transaction: { ... }

(We parse transaction from `payload.transaction`.)

### Signature Verification

- signature is HMAC-SHA256 hex of callback_id using `UNIWIRE_CALLBACK_TOKEN`

### Idempotency

Two-layer approach:

1. Delivery log:

- insert callback_id into `UniwireCallback` (unique)
- if duplicate callback_id: do not fail; continue

2. Deposit rows:

- upsert by `transaction.id` → `Deposit.uniwireTransactionId` (unique)

### Field Mapping (From Real Payloads)

- amount: `transaction.amount.paid.amount`
- asset: `transaction.amount.paid.currency`
- fiat value: `transaction.amount.paid.quotes.USD` → `Deposit.fiatAmount` / `fiatCurrency` (nullable)
- chain/network: prefer `transaction.invoice.kind` (e.g. ETH)
- token-ish kind: `transaction.kind` may be `ETH_USDT`
- address: `transaction.invoice.address`
- txid: `transaction.txid`

## Payouts (Withdrawals)

### Creating a Payout

Endpoint:

- POST `/v1/payouts/`

Required fields:

- `kind` (e.g. `BTC`, `ETH_USDT`)
- `profile_id`
- `passthrough`
- `reference_id` — **our own** idempotency key, generated before this call, sent on every attempt/retry
- `recipients: [{ amount, currency, address }]`

Response handling:

- extract `id` (Uniwire's payout id) from `res.result ?? res.content.result`
- a network/timeout error or a response with no `id` is treated as **ambiguous** — the payout might have gone through, so the reservation is never released speculatively; one retry is attempted (same `reference_id`), and if still ambiguous the withdrawal stays in `reserved` status until a payout callback resolves it
- a structured error response with a `reason` field (e.g. `InvalidAddress`, `InsufficientFunds`) is a clear rejection — the reservation is released (`status: "rejected"`) immediately, no retry

### Payout Callback

Same endpoint as deposit callbacks (`POST /api/uniwire/callback`), disambiguated by `callback_status` starting with `payout_` instead of `transaction_`. The payout object is read from `payload.payout` (also falls back to `payload.result`/`payload.content.result` for either callback type).

Matching a callback to a withdrawal:

- prefer `payout.reference_id` → `Withdrawal.referenceId` (always known, since we generate it before ever contacting Uniwire)
- fall back to `payout.id` → `Withdrawal.uniwirePayoutId` if `reference_id` is missing from the callback

Status mapping (`callback_status` → `Withdrawal.status`):

- `payout_pending` → `initialized`
- `payout_confirmed` → `confirmed`
- `payout_complete` → `complete`
- `payout_rejected` → `rejected`
- `payout_failed` → `failed`

`confirmed` and `complete` are both terminal/credited states — Uniwire fires `confirmed` once the payout has enough on-chain confirmations to be considered settled (e.g. 12 on Ethereum) and `complete` once it clears a higher threshold (e.g. 35). Kept as distinct statuses (rather than collapsed into one) so the UI can show which stage a payout is in, consistently across the Dashboard and Withdraw page.

An unrecognized `payout_*` status is acknowledged (2xx) and ignored, same policy used for unrecognized `invoice_*` statuses below.

## Invoice Callbacks (Fixed-Amount Deposits)

An opt-in alternative to the always-reusable, no-amount deposit flow: `POST /api/deposit` with an `amount` creates a one-off, fixed-amount invoice — never cached in `DepositAddress`, never reused. Gated by the per-user `User.fixedAmountInvoices` setting, which only controls whether the Deposit page shows the amount field; the server fork is driven purely by whether `amount` is present in the request.

### Statuses

Per Uniwire's docs (not yet cross-checked against a captured real payload the way `transaction_*`/`payout_*` were — code defensively and add a real example to `WEBHOOK_PAYLOADS.MD` once observed):

- `invoice_pending` — sum of incoming transactions matches requested amount, 0 confirmations
- `invoice_confirmed` — sum matches requested amount, 1+ confirmations
- `invoice_complete` — sum matches requested amount (within Uniwire's account-level Acceptance Range tolerance for underpayment, if enabled), 6+ confirmations
- `invoice_incomplete` — transaction(s) made, but sum is less than requested

### Field Mapping

The invoice callback shares its shape with the "Get Invoice" endpoint response, arriving in `payload.result`:

- invoice id: `invoice.id` → matched to `Deposit.uniwireInvoiceId`
- requested amount: `invoice.amount.requested.amount`
- paid amount (cumulative so far): `invoice.amount.paid.amount` → written to `Deposit.amount` on every callback, regardless of status

### Status Mapping (`callback_status` → `Deposit.status`)

- `invoice_pending` → `invoice_pending`
- `invoice_confirmed` → `invoice_confirmed`
- `invoice_complete` → `invoice_complete`
- `invoice_incomplete` → `underpaid` (**not** the raw string — `"invoice_incomplete"` contains `"complete"` as a substring, which would collide with this app's substring-based status classifiers, e.g. `depositActivityStatus()`/`displayStatus()`, and make an underpaid invoice look done)

### Crediting

Only `invoice_complete` credits balance (via `COMPLETED_STATUSES` in `server/utils/balances.ts`) — deliberately stricter than the reusable flow's `transaction_confirmed` threshold. Credits the **actual paid amount**, never the requested amount, even under Acceptance Range tolerance (accounting accuracy over convenience).

### Matching and Scope

`prisma.deposit.updateMany({ where: { uniwireInvoiceId, requestedAmount: { not: null } } })` — the `requestedAmount: { not: null }` guard ensures an invoice callback can never touch a reusable-address deposit row, even if a `uniwireInvoiceId` collision were ever possible (that id is not unique across reusable-flow rows, unlike fixed-amount ones).

### Interaction with Transaction Callbacks

Fixed-amount invoices have no `DepositAddress` row, but Uniwire still sends `transaction_*` callbacks for their on-chain activity (independent of invoice callbacks). The transaction-callback ownership check falls back to checking for an owned `Deposit` row (by `uniwireInvoiceId` or address) before rejecting with 403 — if found, it's acknowledged (2xx, `ignored: "fixed_amount_invoice_transaction"`) and not processed, since `invoice_*` callbacks are the sole source of truth for that row.

An unrecognized `invoice_*` status is acknowledged (2xx) and ignored, same policy as unrecognized `payout_*` statuses above.

## Exchange Rates (Live USD Valuation)

Endpoint:

- GET `/v1/exchange-rates/` (list-all, no params)

Used by `server/utils/rates.ts` (`getRatesUsd()`) to value **current balances and withdrawal history** live — never used for deposit-side figures, which keep their stored historical `fiatAmount` quote (see Architecture Decision #13). Never throws; a fetch failure or unexpected response shape returns an empty rate map, and callers must treat a missing symbol as "rate unavailable" (render `—`, never `$0.00`).
