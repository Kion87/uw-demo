# Architecture Decisions — UW Demo

## 1) Reuse Addresses Per Supported Chain Flow

Decision:

- deposit addresses are reusable instead of creating a fresh invoice per every deposit

Reason:

- realistic exchange / casino behavior
- simpler repeat deposits
- multiple transactions can arrive on the same address

## 2) One Deposit Row Per Actual Transaction

Decision:

- `Deposit` records are keyed by `uniwireTransactionId`, not by invoice id

Reason:

- one invoice/address can receive multiple transactions
- transaction id is the correct idempotency key

## 3) Passthrough User Identification

Decision:

- store `user.publicId` in Uniwire invoice passthrough

Reason:

- webhook can resolve the correct user directly

## 4) Cookie Sessions

Decision:

- use cookie-based sessions

Reason:

- simple and fits Nitro server routes well

## 5) Process Transaction Callbacks Only

Decision:

- deposit logic processes `transaction_*` callbacks
- unsupported / non-transaction callbacks are acknowledged but ignored for deposit processing

Reason:

- transaction callbacks represent actual on-chain deposit lifecycle
- invoice callbacks are not enough for reusable address history

## 6) Two-Layer Idempotency

Decision:

1. log delivery attempts in `UniwireCallback`
2. upsert `Deposit` by `uniwireTransactionId`

Reason:

- protects against webhook retries / resends
- allows later callbacks to enrich the same deposit row

## 7) Chronology Fields Stored on Deposit

Decision:

- store transaction chronology directly on `Deposit`

Fields:

- `status`
- `executedAt`
- `confirmedAt`
- `confirmations`
- `creditedAt`

Reason:

- supports recent deposit history / chronology UI
- supports later balance credit logic

## 8) Recent Deposits on Deposit Page

Decision:

- show a compact **Recent Deposits** table on the Deposit page itself

Reason:

- user immediately sees newly received deposits without going to another page
- useful while testing callbacks and demoing the flow

## 9) Asset Icons in UI

Decision:

- use simple asset icons for base asset selection, network choices, and recent deposits

Reason:

- improves clarity and makes the demo feel more like a real exchange product
