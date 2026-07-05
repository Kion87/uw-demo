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

- the casino-style dashboard (design/ handoff) reuses existing deposit/address data plus the new `fiatAmount` field; "Total withdrawals" was hardcoded to `$0.00` since no `Withdrawal` model/endpoint existed yet **(superseded — see Decision #13; a `Withdrawal` model and live withdrawal stats now exist)**
- the design's dark palette became the app-wide `html.theme-dark` token values (not scoped to just the dashboard) — header, modal, and other pages inherit the same refreshed dark theme

Reason:

- avoided fabricating numbers for a feature (withdrawals) that wasn't built yet
- a single global theme is simpler than a per-page theme override, and the design's palette was explicitly "final/high-fidelity"

## 12) No Fiat "Cash (USD)" Balance — Project is Crypto-Only

Decision:

- the dashboard's balance chips only ever show real supported crypto assets (`BTC`/`ETH`/`USDT`/etc., driven directly by `Deposit.asset` groups). There is no "Cash (USD)" chip or any other fiat-deposit bucket.

Reason:

- there is no fiat deposit path in this app at all — `DEPOSIT_ASSET_BY_KEY` only defines crypto assets — and there never will be; the design's original "Cash (USD)" mockup chip doesn't apply here and was removed rather than left as a permanently-empty/dashed placeholder

## 13) Live-Rate Valuation for Current Holdings, Historical Quote for Past Transactions

Decision:

- `server/utils/rates.ts` (`getRatesUsd()`) fetches Uniwire's live exchange rates and values **current balances and withdrawal history** at today's rate
- `Deposit.fiatAmount` (Decision #10) is untouched and still used for deposit-side USD figures — the historical quote Uniwire attached to that specific transaction at the time it happened

Reason:

- these are two different, both-correct questions: "what is this holding worth right now" (current balances) needs a live rate, while "what did this specific past transaction actually settle at" (deposit history, lifetime deposit total) needs the frozen historical quote — using a live rate for the latter would show a number that doesn't match what Uniwire actually quoted the user at the time
- withdrawals have no equivalent historical quote worth preserving (`Withdrawal.fiatAmount` exists in the schema but nothing populates it — Uniwire's payout callback doesn't reliably include one), so live valuation is the only option there, not a compromise
- **This appears to conflict with Decision #10's "rather than maintaining our own price feed/exchange-rate table."** The distinction: Decision #10 is about not re-deriving what a *specific past transaction* was quoted at (where a live feed could drift from the real historical quote); this decision is about valuing *current, unrealized* holdings, where "drift from what the user actually paid" doesn't apply. Decision #10 still governs deposit-side figures unchanged. If this reasoning stops holding up, revisit both decisions together rather than patching one in isolation.
- a live-rate failure (network error, missing symbol) surfaces as `usdValue: null` end-to-end, rendered as `—` — never a fabricated `$0.00`, consistent with Decision #10's original spirit of not showing invented numbers
- no caching layer on `getRatesUsd()` — acceptable at demo-scale traffic, but means `GET /api/dashboard` and `GET /api/withdrawals` can each fetch a slightly different rate snapshot within the same page load (see Known Gaps in `CURRENT_TASK.md`)
