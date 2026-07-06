# API_ROUTES.md

# API Routes — UW Demo

## Auth

- POST `/api/signup` — create user + session cookie
- POST `/api/logout` — clear session
- GET `/api/me` — current user

## Settings

- PATCH `/api/settings` — update account-level settings, currently just `{ fixedAmountInvoices: boolean }`; returns the updated user (same shape as `GET /api/me`)

## Deposits

- POST `/api/deposit` — create or reuse deposit address for selected asset/network. Optional `amount`: when given, bypasses the `DepositAddress` reuse cache entirely and always creates a fresh, one-off invoice/address (stored as `Deposit.requestedAmount`, never cached) — when absent, unchanged reusable-address behavior
- GET `/api/deposits` — full deposit history for the current user

## Withdrawals

- POST `/api/withdraw` — request a withdrawal. Reserves balance atomically (serializable transaction) before contacting Uniwire, always takes a crypto `amount` (client-side USD→crypto conversion for the display toggle happens before this call, not inside it)
- GET `/api/withdrawals` — full withdrawal history for the current user, each row includes a live-computed `usdValue` (or `null` if the rate is unavailable)

## Dashboard

- GET `/api/dashboard` — credited per-asset balances (with live `usdValue`/`rateUsd`, `null` if unavailable), deposit/withdrawal/pending stats, recent activity (deposits + withdrawals merged), assigned addresses. Current balances and `totalWithdrawalsUsd` are valued live via `getRatesUsd()`; deposit-side USD figures still come from the stored historical `fiatAmount`.

## Uniwire Webhook

- POST `/api/uniwire/callback`

Processing (deposit / `transaction_*` callbacks):

- verify signature
- record callback delivery (UniwireCallback)
- process transaction callbacks (payload.transaction)
- resolve user via passthrough
- verify address ownership — if no `DepositAddress` matches (fixed-amount invoices never have one), fall back to checking for an owned `Deposit` row before rejecting; acknowledge (2xx, ignored) rather than reject if found, since `invoice_*` callbacks are the source of truth for those rows
- upsert Deposit by transaction id
- credit balance idempotently — done via live status-filtered aggregation in `getAvailableBalances()`, not a stored counter

Processing (payout / `payout_*` callbacks):

- verify signature (same scheme as deposit callbacks)
- match the Withdrawal by our own `referenceId` (generated before contacting Uniwire), falling back to `uniwirePayoutId` if needed
- map `payout_pending`/`payout_confirmed`/`payout_complete`/`payout_rejected`/`payout_failed` to our status values, backfill `uniwirePayoutId` if we didn't already know it

Processing (fixed-amount invoice / `invoice_*` callbacks — previously ignored entirely, now processed):

- verify signature (same scheme as deposit/payout callbacks)
- match the Deposit by `uniwireInvoiceId`, scoped to `requestedAmount IS NOT NULL` so this can never touch a reusable-address deposit row (`prisma.deposit.updateMany`)
- map `invoice_pending`/`invoice_confirmed`/`invoice_complete`/`invoice_incomplete` to our status values (`invoice_incomplete` → `"underpaid"`, not the raw string — it contains "complete" as a substring, which would collide with this app's substring-based status classifiers)
- update `amount` to the cumulative paid-so-far (`invoice.amount.paid.amount`) on every callback, regardless of status
- credit balance only on `invoice_complete` (stricter than the reusable flow's `transaction_confirmed` threshold) — via `COMPLETED_STATUSES` in `server/utils/balances.ts`, crediting the actual paid amount, never the requested amount
