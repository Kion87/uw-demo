# ARCHITECTURE_DECISIONS.md

# Architecture Decisions — UW Demo

## 1) Reuse Addresses Per Blockchain

Decision:

- Deposit addresses are reused per blockchain network (not per token).

Reason:

- Same address format per chain (EVM, TRON, etc.)
- Fewer invoices
- Realistic casino/exchange behavior

Implementation:

- reuseKey = assetConfig.kind
- DepositAddress unique by (userId, reuseKey)

## 2) Passthrough User Identification

Decision:

- Store user.publicId in Uniwire invoice passthrough.

Reason:

- Webhooks can map deposits back to users without complex joins.

## 3) Cookie Sessions

Decision:

- Cookie-based sessions (not JWT/OAuth).

Reason:

- Simple + fits Nitro server routes.

## 4) Transaction Callbacks (Not Invoice Callbacks)

Decision:

- Process Uniwire transaction callbacks (`transaction_*`) and ignore invoice callbacks.

Reason:

- Reusable addresses can receive multiple transactions
- Transaction callbacks represent actual deposits

## 5) Two-Layer Idempotency

Decision:

1. Log delivery attempts:

- UniwireCallback.callbackId unique
- duplicates do not block processing (resends happen)

2. Prevent duplicate deposits:

- Deposit keyed by transaction id (uniwireTransactionId unique)
- upsert Deposit on each callback so status can update (confirmed → complete)
