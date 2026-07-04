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

- Transaction callbacks: `transaction_*` → **processed** (deposits)
- Payout callbacks: `payout_*` → **processed** (withdrawals, see Payouts section below)
- Invoice callbacks: `invoice_*` → **ignored** (but return 2xx)

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
- `payout_complete` → `confirmed`
- `payout_rejected` → `rejected`
- `payout_failed` → `failed`

An unrecognized `payout_*` status is acknowledged (2xx) and ignored, same policy as invoice callbacks.

## Exchange Rates (Live USD Valuation)

Endpoint:

- GET `/v1/exchange-rates/` (list-all, no params)

Used by `server/utils/rates.ts` (`getRatesUsd()`) to value **current balances and withdrawal history** live — never used for deposit-side figures, which keep their stored historical `fiatAmount` quote (see Architecture Decision #13). Never throws; a fetch failure or unexpected response shape returns an empty rate map, and callers must treat a missing symbol as "rate unavailable" (render `—`, never `$0.00`).
