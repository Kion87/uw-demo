# API_ROUTES.md

# API Routes — UW Demo

## Auth

- POST `/api/signup` — create user + session cookie
- POST `/api/logout` — clear session
- GET `/api/me` — current user

## Deposits

- POST `/api/deposit` — create or reuse deposit address for selected asset/network
- GET `/api/deposits` — full deposit history for the current user

## Dashboard

- GET `/api/dashboard` — credited per-asset balances, deposit/withdrawal/pending stats, recent activity, assigned addresses. Withdrawal stats are hardcoded to 0 until a `Withdrawal` model exists.

## Uniwire Webhook

- POST `/api/uniwire/callback`

Processing:

- verify signature
- record callback delivery (UniwireCallback)
- process transaction callbacks (payload.transaction)
- ignore invoice callbacks (2xx)
- resolve user via passthrough
- verify address ownership
- upsert Deposit by transaction id
- (future) credit balance safely
