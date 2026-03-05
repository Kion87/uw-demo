# PROJECT_CONTEXT.md

# UW Demo — Project Context

## References

- Uniwire Quickstart: https://docs.uniwire.com/api/quickstart :contentReference[oaicite:1]{index=1}

## Goal

UW Demo is a crypto deposit demo system integrated with Uniwire. It simulates a casino/broker-style deposit flow:

- users sign up / log in
- users generate deposit addresses (reusable per chain)
- users deposit crypto to those addresses
- Uniwire sends transaction callbacks
- the app records deposits in the database (and later credits balance)

## Tech Stack

- Frontend: Nuxt 4, Vue 3, TailwindCSS
- Backend: Nuxt Server Routes (Nitro)
- Database: PostgreSQL (Neon), Prisma ORM
- Deployment: Netlify
- External: Uniwire API

## Auth (Cookie Sessions)

Endpoints:

- POST `/api/signup`
- POST `/api/logout`
- GET `/api/me`

Frontend loads logged-in state via `GET /api/me`.

## Key Models (High Level)

- User: `id`, `publicId` (e.g. `"0001"`), `email`
- Session: `token`, `userId`, `expiresAt`
- DepositAddress: reusable blockchain address per user+chain key
- Deposit: one row per actual blockchain transaction (keyed by `uniwireTransactionId`)
- UniwireCallback: callback delivery log (keyed by `callbackId`)

## Core Design Rule — Reuse Addresses Per Blockchain (Not Per Token)

Addresses are reused per **chain**:

- ETH address: ETH + ERC20 tokens (USDT ERC20, USDC ERC20)
- TRX address: TRX + TRC20 tokens (USDT TRC20)
- SOL address: SOL + SPL tokens

Implementation:

- `reuseKey = assetConfig.kind` (e.g. ETH/TRX/SOL/BTC)
- Lookup DepositAddress by `(userId, reuseKey)` (fallback to `(userId, assetKey)` if needed)

## Deposit Address Creation Flow

Frontend:

- POST `/api/deposit` with `{ assetKey }`

Backend:

1. requireUser()
2. map `assetKey → { currency, kind }`
3. `reuseKey = kind`
4. lookup DepositAddress (userId, reuseKey)
5. if exists → return saved address
6. else → create Uniwire invoice (reusable address invoice)
7. store DepositAddress
8. return address

## Uniwire Invoices

Invoice creation:

- POST `/v1/invoices` with:
  - `profile_id`
  - `currency`
  - `kind`
  - `passthrough = user.publicId`

Uniwire responses may be:

- `{ result: {...} }`
- `{ content: { result: {...} } }`

## Webhooks

Endpoint:

- POST `/api/uniwire/callback`

Important:

- We process **transaction callbacks** (`transaction_*`) to record deposits.
- Invoice callbacks are **acknowledged (2xx) but ignored**.
