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

- Process **transaction callbacks only**: `callback_status` starts with `transaction_`
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

### Idempotency (Two Layers)

1. Callback delivery log:

- Store `callback_id` into `UniwireCallback.callbackId` (unique)
- If duplicate callback_id occurs, do not fail; continue processing (resends happen)

2. Deposit idempotency:

- Deposits must be keyed by `uniwireTransactionId` (unique per transaction)
- Upsert deposit using `transaction.id`

### Credit Rules (When Implemented)

- Only credit on `transaction_confirmed` / `transaction_complete`
- Must never credit twice (even with resends)

## 4) Auth Rules

Cookie-session auth only.
Endpoints:

- POST `/api/signup`
- POST `/api/logout`
- GET `/api/me`

Do not introduce JWT/OAuth without explicit request.

## 5) Stack & Deployment Rules

- Nuxt 4 + Nitro server routes
- Postgres + Prisma
- Netlify deployment
  Avoid architecture incompatible with Netlify functions.

## 6) Coding Style

- step-by-step, beginner-friendly
- minimal refactors unless requested
