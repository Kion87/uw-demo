# UNIWIRE_INTEGRATION.md

# Uniwire Integration — UW Demo

## References

- https://docs.uniwire.com/api/quickstart :contentReference[oaicite:2]{index=2}

## What Uniwire Does Here

- Creates invoices and deposit addresses
- Monitors blockchain activity
- Detects inbound transactions
- Sends callbacks (webhooks) to your app

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

- Transaction callbacks: `transaction_*` → **processed**
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
