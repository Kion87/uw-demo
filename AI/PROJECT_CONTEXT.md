# UW Demo --- Project Context

## Project Overview

UW Demo is a crypto deposit demo system integrated with Uniwire. It
simulates the deposit flow used by casinos, brokers, or trading
platforms.

Users can: 1. Sign up 2. Generate deposit addresses 3. Deposit crypto 4.
Receive credited balance via callbacks

Deposits are processed through Uniwire invoices.

## Tech Stack

### Frontend

-   Nuxt 4
-   Vue 3
-   TailwindCSS

### Backend

-   Nuxt Server Routes (Nitro)

### Database

-   PostgreSQL
-   Prisma ORM

### Deployment

-   Netlify

### External Integration

-   Uniwire API

## Authentication

Cookie session authentication.

Endpoints:

POST /api/signup\
POST /api/logout\
GET /api/me

Frontend always loads user state via:

GET /api/me

## Database Models

### User

id (Int)\
publicId (String)\
email (String)

### Session

token\
userId\
expiresAt

### DepositAddress

userId\
assetKey\
invoiceId\
address

Unique constraint: (userId, assetKey)

### Deposit

userId\
asset\
network\
amount\
uniwireInvoiceId\
address\
status

## Important Design Rule

Deposit addresses are reused per blockchain network.

Examples:

ETH address → ETH, USDT ERC20, USDC ERC20\
TRX address → TRX, USDT TRC20\
SOL address → SOL, SPL tokens

Implementation rule:

reuseKey = assetConfig.kind

Examples: ETH\
TRX\
SOL\
BTC

## Deposit Flow

Frontend: POST /api/deposit { assetKey }

Server:

1.  requireUser()
2.  map assetKey → { currency, kind }
3.  reuseKey = kind
4.  lookup DepositAddress
5.  if exists → return address
6.  else → create Uniwire invoice
7.  save address
8.  return address

## Uniwire Invoice Request

POST /v1/invoices

Payload:

profile_id\
currency\
kind\
passthrough

Example passthrough:

"0001"

## Uniwire Response Handling

Responses may appear as:

{ result: {...} }

or

{ content: { result: {...} } }

Extraction logic:

const inv = response.result ?? response.content?.result

## Environment Variables

DATABASE_URL\
DIRECT_URL

UNIWIRE_API_KEY\
UNIWIRE_API_SECRET\
UNIWIRE_PROFILE_ID

## Current Development Phase

Implementing webhook endpoint:

POST /api/uniwire/callback

Responsibilities:

-   verify signature
-   ensure idempotency
-   identify user via passthrough
-   verify address ownership
-   credit balance
-   return HTTP 200
