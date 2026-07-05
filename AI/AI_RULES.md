# AI_RULES.md

# UW Demo — AI Rules

This file defines constraints AI assistants must follow when working on this project.

## 1) Address Reuse (Do Not Break)

Deposit addresses are reused per blockchain network (not per token).

- reuseKey = assetConfig.kind (ETH/TRX/SOL/BTC)
- lookup order:
  1. (userId, reuseKey)
  2. fallback (userId, assetKey)

Do not implement token-specific address generation.

## 2) Uniwire Invoices (Do Not Change)

Invoices are created via:

- POST `/v1/invoices`

Payload must include:

- `profile_id`
- `currency`
- `kind`
- `passthrough = user.publicId`

## 3) Webhooks (Current Architecture)

Webhook endpoint:

- POST `/api/uniwire/callback`

### Callback Types

- Process **transaction callbacks** (`callback_status` starts with `transaction_`) → deposits
- Process **payout callbacks** (`callback_status` starts with `payout_`) → withdrawals (see Section 4)
- Invoice callbacks must be **ignored** but still return **2xx** (so Uniwire doesn’t retry forever)

### Payload Shape (Transaction Callbacks)

Uniwire transaction callbacks arrive with fields:

- `callback_id`
- `callback_status`
- `signature`
- `transaction: { ... }`

Code must accept transaction data from `payload.transaction` (primary), not only `payload.result`.

### Signature Verification

Signature check:

- `signature = hex(HMAC_SHA256(callback_id, key=UNIWIRE_CALLBACK_TOKEN))`

Same scheme for both transaction and payout callbacks.

### Idempotency (Two Layers)

1. Callback delivery log:

- Store `callback_id` into `UniwireCallback.callbackId` (unique)
- If duplicate callback_id occurs, do not fail; continue processing (resends happen)

2. Deposit idempotency:

- Deposits must be keyed by `uniwireTransactionId` (unique per transaction)
- Upsert deposit using `transaction.id`

### Credit Rules

- Only credit on `transaction_confirmed` / `transaction_complete`
- Must never credit twice (even with resends) — implemented by recomputing available balance live from status-filtered aggregates (`getAvailableBalances()` in `server/utils/balances.ts`) rather than incrementing a stored counter. Do not reintroduce a stored/incrementable balance field without preserving this "never double-apply" property.

## 4) Withdrawals (Do Not Break)

`POST /api/withdraw` and its payout callback counterpart have invariants that must not be relaxed:

- **Reserve before contacting Uniwire.** Balance is checked and the `Withdrawal` row (`status: "reserved"`) is created inside one serializable transaction, before any HTTP call to Uniwire. This prevents two concurrent requests from both reading the same available balance and both reserving against it.
- **`referenceId` is our idempotency key, not Uniwire's.** It's generated before the first Uniwire call and resent unchanged on every retry, so a retry after an ambiguous failure can't create a duplicate payout on Uniwire's side. Payout callbacks match on `referenceId` first, falling back to `uniwirePayoutId` only if the callback lacks a `reference_id`.
- **Never release a reservation on an ambiguous response.** A network/timeout error or a payout response with no `id` means the payout might have gone through — treat it as ambiguous, retry once with the same `referenceId`, and if still ambiguous leave the withdrawal in `reserved` status for a later callback to resolve. Only a structured rejection (a response with a `reason` field) releases the reservation immediately (`status: "rejected"`).
- **`Withdrawal.fiatAmount` is currently dead** (always null) — do not build features that assume it's populated. Withdrawal USD figures come from `getRatesUsd()` (live rate) instead; see Architecture Decision #13.

## 5) Auth Rules

Cookie-session auth only.
Endpoints:

- POST `/api/signup`
- POST `/api/logout`
- GET `/api/me`

Do not introduce JWT/OAuth without explicit request.

## 6) Stack & Deployment Rules

- Nuxt 4 + Nitro server routes
- Postgres + Prisma
- Netlify deployment
  Avoid architecture incompatible with Netlify functions.

## 7) Coding Style

- step-by-step, beginner-friendly
- minimal refactors unless requested
