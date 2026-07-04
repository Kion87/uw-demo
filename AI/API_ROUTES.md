# API_ROUTES.md

# API Routes — UW Demo

## Auth

- POST `/api/signup` — create user + session cookie
- POST `/api/logout` — clear session
- GET `/api/me` — current user

## Deposits

- POST `/api/deposit` — create or reuse deposit address for selected asset/network
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
- ignore invoice callbacks (2xx)
- resolve user via passthrough
- verify address ownership
- upsert Deposit by transaction id
- credit balance idempotently — done via live status-filtered aggregation in `getAvailableBalances()`, not a stored counter

Processing (payout / `payout_*` callbacks):

- verify signature (same scheme as deposit callbacks)
- match the Withdrawal by our own `referenceId` (generated before contacting Uniwire), falling back to `uniwirePayoutId` if needed
- map `payout_pending`/`payout_confirmed`/`payout_complete`/`payout_rejected`/`payout_failed` to our status values, backfill `uniwirePayoutId` if we didn't already know it
