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

## 14) Fixed-Amount Invoices Are a Fully Separate Lifecycle, Not a Variant of the Reusable Flow

Decision:

- fixed-amount deposit invoices (`POST /api/deposit` with an `amount`) never touch `DepositAddress` and are never reused — every request creates a brand-new, one-off invoice, tracked via the new `Deposit.requestedAmount` column
- their status/crediting is driven entirely by `invoice_*` webhook callbacks (previously ignored outright), not `transaction_*` — the two callback types are handled by fully separate code paths that happen to share the same endpoint
- crediting only fires on `invoice_complete`, using the actual paid amount — a stricter, later threshold than the reusable flow's `transaction_confirmed`
- the `invoice_*` → `Deposit` match (`prisma.deposit.updateMany`) is scoped with a `requestedAmount: { not: null }` guard, so it can never reach a reusable-address deposit row even under an unexpected `uniwireInvoiceId` collision

Reason:

- `DepositAddress`'s entire purpose is "the one reusable address for this user+asset" — letting a one-off, amount-specific invoice pass through that cache would either pollute it (confusing a later reusable request) or require carving out exceptions inside a table whose meaning is otherwise simple and singular
- the two flows have genuinely different correctness requirements: reusable addresses should credit as soon as a transaction is seen confirmed (any amount is valid, since none was requested), while a fixed-amount invoice's whole point is knowing whether the *requested* amount actually arrived — conflating them into one status vocabulary/threshold would either under-credit reusable deposits or over-credit incomplete fixed invoices
- the `requestedAmount` scope guard was added after a whole-branch review flagged that matching by `uniwireInvoiceId` alone was an unverified assumption resting entirely on Uniwire's real-world callback behavior (never confirmed against a captured payload — see Known Gaps in `CURRENT_TASK.md`); the guard converts that assumption into an enforced invariant at negligible cost

This is in the same spirit as Decision #13 (two different, both-correct questions get two different answers) rather than a contradiction of it.

## 15) No Deposit Row at Reusable-Address Creation Time

Decision:

- `POST /api/deposit` without an `amount` (reusable-address flow) only creates/looks up `DepositAddress` — it does **not** also create a `Deposit` row

Reason:

- it used to: a `Deposit` row was created immediately with `status: "new"`, `amount: null`, no `uniwireTransactionId`. When a real deposit later arrived, the `transaction_*` callback upserts by transaction id — keyed differently from the invoice-creation row — so it created a *second*, separate row rather than updating the first. The original row was never touched again and lingered forever as a fake "Pending" entry in Recent Deposits and Dashboard Recent Activity, and inflated the `totalDeposits`/`pendingDeposits` stat counts
- verified nothing else depends on that row existing: the `transaction_*` callback's ownership check matches against `DepositAddress`, not `Deposit` (see `UNIWIRE_INTEGRATION.md`), so removing the premature row creation is safe
- fixed-amount invoices are unaffected and still create their row upfront (Decision #14) — that flow genuinely needs it, since the `invoice_*` callback only updates an existing row, never creates one

## 16) Uniwire-Native USD Invoices Instead of Client-Side Rate Conversion

Decision:

- when the Deposit page's amount field is used in USD display mode, `POST /api/deposit` sends Uniwire `currency: "USD"` (with `kind` still the asset/network) rather than converting the USD figure to crypto itself via `getRatesUsd()`
- Uniwire's response's `amount.invoiced.amount` (always crypto) becomes `Deposit.requestedAmount` as before; `amount.requested.amount` (the USD ask, when that's what was sent) is additionally stored in the new `Deposit.requestedFiatAmount` column

Reason:

- Uniwire's own conversion is authoritative — it's the exact figure Uniwire itself uses to judge whether the invoice is fully paid (`invoice_complete`), so a self-computed rate could subtly mismatch by the time a real conversion-rate snapshot is taken, even if only by seconds
- verified live against the sandbox API before adopting this approach, rather than assumed from documentation
- storing `requestedFiatAmount` closes a real gap: without it, there was no persisted USD figure anywhere, so "Paid $X of $Y" could only ever render in crypto regardless of the user's display-mode preference

## 17) "New" vs "Pending" Are Distinct Deposit States, Not Two Rows

Decision:

- a fixed-amount invoice row whose `status` is still `"new"` (no `invoice_*` callback has fired yet) is displayed as type **"Invoice"**, status **"New"** — distinct from an in-flight payment, which displays as type **"Deposit"**, status **"Pending"** → **"Confirmed"/"Underpaid"** → **"Complete"**
- this is the **same single row** throughout its lifecycle, relabeled purely at the display layer as its `status` value changes over time — not two separate rows
- the Dashboard's `totalDeposits`/`pendingDeposits` stat counts explicitly exclude `status: "new"` rows for the same reason

Reason:

- per Uniwire's own docs, even `invoice_pending` implies a matching transaction sum already exists — so a row still at `"new"` reliably means zero transaction activity has happened at all, which is a meaningfully different, less-alarming state than "payment in flight, awaiting confirmation." Labeling both "Pending" made a freshly-created, untouched invoice look like money was already moving
- considered making this two separate rows (an "invoice created" event and a later "deposit" event, mirroring how the reusable-address flow's `DepositAddress`-creation event is conceptually separate from its eventual `Deposit` row) but rejected it: the `invoice_*` callback handler only updates an existing row by `uniwireInvoiceId` and would need new create-vs-update branching logic, and every dashboard stat that counts `Deposit` rows would double-count any invoice that ever gets paid — the same class of bug Decision #15 just fixed. A single relabeled row achieves the same visible behavior with no schema or callback changes
