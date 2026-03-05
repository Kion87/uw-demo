# DEPOSIT_FLOW.md

# Deposit Flow — UW Demo

## Overview

Users create/reuse a deposit address and then deposit funds. Uniwire monitors the chain and sends transaction callbacks to the app, which stores deposits.

## 1) Create/Get Deposit Address

Endpoint:

- POST `/api/deposit`
  Payload example:
- `{ "assetKey": "USDT_TRC20" }`

Server logic:

1. requireUser()
2. map assetKey → { currency, kind }
3. reuseKey = kind
4. lookup DepositAddress by (userId, reuseKey)
5. return existing address if found
6. else create Uniwire invoice (reusable)
7. store DepositAddress
8. return address

## 2) User Deposits Crypto

User sends funds on-chain to the returned address.

## 3) Uniwire Sends Callback

Endpoint:

- POST `/api/uniwire/callback`

We process **transaction callbacks only**:

- callback_status like `transaction_pending`, `transaction_confirmed`, `transaction_complete`
- payload includes `transaction: {...}`

Invoice callbacks are ignored (but return 2xx).

## 4) Callback Processing Summary

For `transaction_*` callbacks:

1. verify signature (HMAC of callback_id)
2. log callback_id in UniwireCallback (do not block on duplicates)
3. extract tx from `payload.transaction`
4. resolve user:
   - `publicId = transaction.invoice.passthrough`
5. verify address belongs to user:
   - `transaction.invoice.address` must match DepositAddress (by address or invoiceId)
6. upsert Deposit:
   - key: `uniwireTransactionId = transaction.id`
   - amount: `transaction.amount.paid.amount`
   - asset: `transaction.amount.paid.currency`
   - network: `transaction.invoice.kind` (chain); tx.kind may be token-specific
7. (future) credit user balance idempotently
