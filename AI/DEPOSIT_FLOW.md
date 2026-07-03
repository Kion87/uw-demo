# Deposit Flow — UW Demo

## Overview

Users create or reuse a deposit address, send crypto on-chain, and Uniwire sends transaction callbacks that update one deposit row per actual blockchain transaction.

## 1) Create/Get Deposit Address

Endpoint:

- `POST /api/deposit`

Payload example:

- `{ "assetKey": "USDT_TRC20" }`

Server logic:

1. require authenticated user
2. map `assetKey` → `{ currency, kind }`
3. derive reusable chain key from `kind`
4. lookup `DepositAddress` by `(userId, assetKey/reuseKey logic)`
5. return existing address if found
6. else create reusable invoice/address at Uniwire
7. store `DepositAddress`
8. return address to frontend

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

## 6) Supported Deposit Assets (Current)

- BTC
- ETH
- USDT (ERC-20)
- USDT (TRC20)
- USDT (BEP20)
- TRX
- SOL
- USDC (SPL / Solana)
- USDC (ERC-20 / Ethereum)
