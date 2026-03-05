# UW Demo --- AI Rules

This file defines rules AI assistants must follow when modifying the
project.

## Core Architecture

### Address Reuse

Deposit addresses are reused per blockchain network.

Examples:

ETH address supports: - ETH - USDT ERC20 - USDC ERC20

TRX address supports: - TRX - USDT TRC20

Addresses must NOT be generated per token.

### Reuse Key

reuseKey = assetConfig.kind

Examples:

ETH TRX SOL BTC

Lookup order:

1.  (userId, reuseKey)
2.  fallback (userId, assetKey)

AI must not change this logic.

## Uniwire Integration

Invoices created with:

POST /v1/invoices

Payload:

profile_id currency kind passthrough

Passthrough must contain:

user.publicId

## Uniwire Response Parsing

Responses may be:

{ result: {...} }

or

{ content: { result: {...} } }

Always parse using:

const inv = response.result ?? response.content?.result

## Webhook Rules

Endpoint:

POST /api/uniwire/callback

Processing must include:

1.  signature verification
2.  idempotency
3.  user lookup via passthrough
4.  address ownership verification
5.  deposit record creation
6.  balance credit
7.  HTTP 200 response

Duplicate webhooks must never credit deposits twice.

## Authentication Rules

Cookie session auth only.

Endpoints:

POST /api/signup POST /api/logout GET /api/me

Do not introduce JWT or OAuth.

## Database Rules

Database:

PostgreSQL + Prisma

Existing models:

User Session DepositAddress Deposit

Do not redesign schema unless requested.

## Backend Rules

Use Nuxt server routes:

server/api/\*.ts

Examples:

server/api/deposit.post.ts server/api/me.get.ts

## Frontend Rules

Stack:

Nuxt 4 Vue 3 TailwindCSS

Do not introduce new frameworks.

## Deployment

Deployment target:

Netlify

Code must remain compatible with Netlify functions.

## Coding Style

Instructions should be:

- step-by-step
- beginner-friendly
- minimal refactors

## Callbacks processing

Only credit on transaction_confirmed / transaction_complete
Ignore invoice callbacks
