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

## 10) Capture Uniwire's Fiat Quote Instead of Building Our Own Conversion

Decision:

- store `transaction.amount.paid.quotes.USD` directly on `Deposit` as `fiatAmount`/`fiatCurrency`, rather than maintaining our own price feed/exchange-rate table

Reason:

- Uniwire already computes and sends this value per-transaction; duplicating it would mean a second source of truth that could drift from what the user actually paid
- keeps balance/total math (dashboard hero card, stat grid) tied to real data instead of a rebuilt-from-scratch pricing layer

## 11) Dashboard Redesign is a Reskin, Not a New Backend

Decision:

- the casino-style dashboard (design/ handoff) reuses existing deposit/address data plus the new `fiatAmount` field; "Total withdrawals" is hardcoded to `$0.00` since no `Withdrawal` model/endpoint exists yet
- the design's dark palette became the app-wide `html.theme-dark` token values (not scoped to just the dashboard) — header, modal, and other pages inherit the same refreshed dark theme

Reason:

- avoids fabricating numbers for a feature (withdrawals) that isn't built
- a single global theme is simpler than a per-page theme override, and the design's palette was explicitly "final/high-fidelity"

## 12) No Fiat "Cash (USD)" Balance — Project is Crypto-Only

Decision:

- the dashboard's balance chips only ever show real supported crypto assets (`BTC`/`ETH`/`USDT`/etc., driven directly by `Deposit.asset` groups). There is no "Cash (USD)" chip or any other fiat-deposit bucket.

Reason:

- there is no fiat deposit path in this app at all — `DEPOSIT_ASSET_BY_KEY` only defines crypto assets — and there never will be; the design's original "Cash (USD)" mockup chip doesn't apply here and was removed rather than left as a permanently-empty/dashed placeholder
