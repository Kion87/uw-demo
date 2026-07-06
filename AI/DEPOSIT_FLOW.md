# Deposit Flow — UW Demo

## Overview

Users create or reuse a deposit address, send crypto on-chain, and Uniwire sends transaction callbacks that update one deposit row per actual blockchain transaction.

This is the **default (reusable, no-amount)** flow. There's also an opt-in **fixed-amount invoice** alternative — see "Fixed-Amount Invoices" below — that skips almost everything in this doc (no `DepositAddress` caching, no transaction-callback-driven crediting) in favor of its own one-off invoice + `invoice_*` callback lifecycle, documented in `AI/UNIWIRE_INTEGRATION.md`.

## 1) Create/Get Deposit Address

Endpoint:

- `POST /api/deposit`

Payload example:

- `{ "assetKey": "USDT_TRC20" }`

Server logic:

1. require authenticated user
2. map `assetKey` → `{ currency, kind }`
3. **if `amount` is present in the request body, skip steps 4–6 entirely and go straight to creating a fresh invoice at Uniwire — see "Fixed-Amount Invoices" below**
4. derive reusable chain key from `kind`
5. lookup `DepositAddress` by `(userId, assetKey/reuseKey logic)`
6. return existing address if found
7. else create invoice/address at Uniwire
8. store `DepositAddress` (reusable flow only — never for a fixed-amount invoice)
9. return address to frontend

## 2) User Deposits Crypto

User sends funds on-chain to the returned address.

Because addresses are reusable, the same invoice/address may receive multiple separate transactions over time.

## 3) Uniwire Sends Callback

Endpoint:

- `POST /api/uniwire/callback`

We process **transaction callbacks only**:

- `transaction_pending`
- `transaction_confirmed`
- `transaction_complete`

Non-transaction callbacks should be acknowledged with 2xx and ignored for deposit processing.

## 4) Callback Processing Summary

For `transaction_*` callbacks:

1. verify signature using HMAC of `callback_id`
2. log `callback_id` in `UniwireCallback`
3. allow duplicate `callback_id` without blocking processing
4. extract `tx` from `payload.transaction`
5. resolve user from `transaction.invoice.passthrough`
6. verify the receiving address belongs to the user
7. upsert `Deposit` by:
   - `uniwireTransactionId = transaction.id`
8. store / update:
   - `amount = transaction.amount.paid.amount`
   - `asset = transaction.amount.paid.currency`
   - `fiatAmount = transaction.amount.paid.quotes.USD` (nullable — not confirmed present on every callback)
   - `fiatCurrency = "USD"` when `fiatAmount` was found, else `null`
   - `network = transaction.kind`
   - `txid = transaction.txid`
   - `status = transaction.status` (fallback to callback status if needed)
   - `executedAt = transaction.executed_at`
   - `confirmedAt = transaction.confirmed_at`
   - `confirmations = transaction.confirmations`
9. future: credit user balance idempotently

## 5) Deposit History UI

Deposit page now shows **Recent Deposits**:

- Created
- Asset
- Amount
- Status
- TxID

Features:

- TxID copy action
- explorer link based on network
- show/hide recent deposits section
- asset icons in selection and history UI

## 6) Fixed-Amount Invoices (Alternative Flow)

Opt-in per-user setting (`User.fixedAmountInvoices`, toggled in Settings → Deposits) that shows an optional amount field on the Deposit page. If the user fills it in, `POST /api/deposit` is called with `amount` set, which:

- skips the `DepositAddress` reuse cache entirely (never looked up, never written) — every fixed-amount request creates a brand-new, one-off invoice/address
- stores the ask in `Deposit.requestedAmount` (not `amount` — that field keeps meaning "actual amount paid so far" everywhere in this codebase)

From there, the lifecycle is driven by `invoice_*` webhook callbacks (previously ignored entirely), not `transaction_*` — see the "Invoice Callbacks" section of `AI/UNIWIRE_INTEGRATION.md` for statuses, field mapping, and the crediting rule (only `invoice_complete` credits, using the actual paid amount). The Deposit page's Recent Deposits table shows "Paid X of Y · Z due" for these rows instead of the plain amount.

## 7) Supported Deposit Assets (Current)

- BTC
- ETH
- USDT (ERC-20)
- USDT (TRC20)
- USDT (BEP20)
- TRX
- SOL
- USDC (SPL / Solana)
- USDC (ERC-20 / Ethereum)
