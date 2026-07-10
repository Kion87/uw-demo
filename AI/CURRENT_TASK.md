# CURRENT_TASK.md

## Current Task — UW Demo

## Current State (Done)

- ✅ Reusable deposit addresses working
- ✅ Deposit creation endpoint working: `POST /api/deposit`
- ✅ User-specific deposit history endpoint working: `GET /api/deposits`
- ✅ Webhook endpoint deployed on Netlify: `POST /api/uniwire/callback`
- ✅ Signature verification working
- ✅ Transaction callbacks received from Uniwire
- ✅ Callback delivery logged in Neon (`UniwireCallback`)
- ✅ Deposit upsert working, keyed by `uniwireTransactionId`
- ✅ Deposit chronology fields working:
  - `status`
  - `executedAt`
  - `confirmedAt`
  - `confirmations`
  - `creditedAt` (reserved for next step)
- ✅ Pending → confirmed callback updates working on the same deposit row
- ✅ Recent Deposits UI added to Deposit page
- ✅ TxID copy action and explorer links added
- ✅ Asset icons added to Deposit page
- ✅ USDC added on Ethereum (`USDC_ERC20`) in addition to Solana (`USDC_SPL`)
- ✅ Cleaner deposit UI:
  - no internal asset keys shown to user
  - simplified Recent Deposits columns
  - show/hide toggle for Recent Deposits
- ✅ Dashboard redesigned (casino-style balances view, from `design/` Claude Design handoff):
  - hero total-balance card with per-currency chips (Cash/BTC/ETH/USDT)
  - stat grid: total deposits, total withdrawals (stubbed $0), pending deposits, assigned addresses
  - recent activity feed, compact assigned-addresses panel kept below
  - app-wide dark theme palette refresh + gold/emerald/orange/violet accent tokens
- ✅ Callback now captures Uniwire's fiat quote (`amount.paid.quotes.USD`) into `Deposit.fiatAmount`/`fiatCurrency`, used for real (not fabricated) USD balances on the dashboard
- ✅ `Withdrawal` model added (mirrors `Deposit`'s shape: status lifecycle, amount, fiat value, txid), plus `referenceId`/`uniwirePayoutId` for payout idempotency
- ✅ `POST /api/withdraw` — reserves balance atomically inside a serializable transaction, generates `referenceId` before contacting Uniwire, retries once on ambiguous (timeout/network) responses without risking a duplicate payout
- ✅ Withdrawal history on the Withdraw page — `GET /api/withdrawals` + "Recent Withdrawals" panel (refresh, show/hide), same pattern as Deposit's Recent Deposits
- ✅ Payout callbacks (`payout_*`) handled in the same `POST /api/uniwire/callback` endpoint as deposit callbacks — matched by our own `referenceId` (falls back to `uniwirePayoutId` once known), status mapped to `initialized`/`confirmed`/`complete`/`rejected`/`failed`
- ✅ Balance crediting is safe against double-crediting: `getAvailableBalances()` (`server/utils/balances.ts`) recomputes available balance on every call from status-filtered aggregates (completed deposits minus non-rejected/non-failed withdrawals) rather than incrementing a stored total — nothing to double-apply
- ✅ Global "Show crypto values" display toggle — a gear-icon Settings panel in the nav (`app/components/SettingsPanel.vue` + reusable `ToggleSwitch.vue`) flips every monetary figure across Dashboard, Deposit, and Withdraw between USD and crypto units, backed by `useDisplayMode()` (persisted to `localStorage`)
- ✅ Live exchange-rate fetching (`server/utils/rates.ts`, wraps Uniwire's `GET /v1/exchange-rates/`) values **current balances and withdrawals** at today's rate; deposits keep using their stored historical `fiatAmount` quote (see Architecture Decision #13) — a live-rate failure surfaces as `null`/`—`, never a fabricated `$0.00`
- ✅ Withdraw page accepts a USD-denominated amount in USD mode and converts to crypto client-side before `POST /api/withdraw` (that endpoint's contract is unchanged, always crypto); amount field now clears when display mode toggles (previously a value typed in one unit could get silently resubmitted under the other unit — a real bug caught in self-review)
- ✅ Dashboard "Pending deposits" card no longer always says "Awaiting confirmation" regardless of the actual count — falls back to "No pending deposits" when the count is 0
- ✅ `payout_confirmed`/`payout_complete` no longer collapse into the same `Withdrawal.status` value — previously both mapped to `"confirmed"`, which the Dashboard then relabeled `"completed"` while the Withdraw page showed the raw status as `"Confirmed"`, so the same event read differently in each place and the two real Uniwire confirmation thresholds (e.g. 12 vs 35 on Ethereum) were indistinguishable. Now `payout_complete` maps to its own `complete` status, shown consistently as-is on both the Dashboard activity feed and the Withdraw page badge/label
- ✅ Settings panel split into three labeled, vertically-stacked categories (General / Deposits / Payouts) via a new `SettingsSection.vue` component, replacing the old flat single-list layout — General still holds "Show crypto values"; Deposits/Payouts were placeholders until the next item below filled in Deposits
- ✅ Fixed-amount deposit invoices — an opt-in, per-user, all-assets setting (`User.fixedAmountInvoices`, toggled in the Deposits settings section) that lets a user request a deposit invoice for a specific amount instead of the always-reusable, no-amount address flow:
  - `POST /api/deposit` with an `amount` skips the `DepositAddress` reuse cache entirely and always creates a fresh, one-off invoice — the new `Deposit.requestedAmount` column holds the ask, `amount` keeps its existing meaning ("actual amount paid so far") for both flows
  - Uniwire's `invoice_*` webhook callbacks — previously ignored entirely — are now processed: `invoice_pending`/`invoice_confirmed`/`invoice_complete`/`invoice_incomplete` update `Deposit.status`/`amount`, with `invoice_incomplete` stored as `"underpaid"` (not the raw string, which contains "complete" as a substring and would collide with this app's substring-based status classifiers)
  - only `invoice_complete` credits balance (via `COMPLETED_STATUSES`), crediting the actual paid amount, never the requested amount — deliberately stricter than the reusable flow's `transaction_confirmed` threshold
  - a `transaction_*` callback for a fixed-amount invoice's address (which has no `DepositAddress` row) is acknowledged and ignored rather than 403'd, via a fallback ownership check against `Deposit`
  - Deposit page shows the amount field (gated on the shared `useState("user")`, live-reactive to the Settings toggle) and a "Paid X of Y" breakdown in Recent Deposits; Dashboard pills show an amber "underpaid" state alongside the existing pending/complete/failed colors
- ✅ Fixed a phantom-row bug in the reusable-address flow: creating an address used to also create a `Deposit` row immediately (before any money moved), which never got updated once the real deposit landed in a separate row — permanently inflating "Pending" counts and Recent Activity with fake entries. Fixed by not creating that row at address-creation time at all (see Architecture Decision #15); existing bad rows were deleted from the database
- ✅ Fixed-amount invoices requested in USD now ask Uniwire for a USD-denominated invoice directly (`currency: "USD"`) instead of this app converting via its own `getRatesUsd()` call — Uniwire's own conversion is what it actually uses to judge the invoice paid (see Architecture Decision #16). New `Deposit.requestedFiatAmount` column stores Uniwire's own USD ask; "Paid X of Y" now renders in USD (converted via the invoice's own implied rate) when that data is available, in the Deposit page's Recent Deposits and the Dashboard's Recent Activity alike
- ✅ A fixed-amount invoice with no `invoice_*` activity yet (`status: "new"`) now displays as type "Invoice" / status "New" (violet pill), distinct from an in-flight "Deposit" / "Pending" — same row, relabeled as it progresses (see Architecture Decision #17). Dashboard's Total/Pending deposits stats exclude these untouched rows too
- ✅ Recent Deposits table polish: reordered columns (TxID before Status), shortened the TxID hash to `4...4` with smaller copy/explorer buttons, colored Status pill matching the Dashboard exactly, typography brought in line with the Dashboard's Recent Activity scale, and a right-edge scroll-fade + chevron hint for when the table overflows its container
- ✅ Fixed a Dashboard Recent Activity grid-alignment bug: the last column (Status) was `auto`-sized, so a wider pill vs. plain header text shifted every other column leftward by a growing amount per row — pinned to a fixed-width track instead (found via exact pixel measurement, not guesswork)
- ✅ Recent Withdrawals table polish, brought in line with Recent Deposits: reordered columns (TxID before Status), shortened the TxID hash to `4...4`, dropped the Destination column entirely (redundant with TxID for a demo, and was crowding the row), removed the now-unnecessary horizontal scrollbar, rebalanced the Amount column from right-aligned to left-aligned with `pl-6` (right-alignment was crushing it against TxID while leaving a gap after Asset), typography matched exactly to Deposit's scale (`text-[10.5px]` header, `text-[12.5px]` rows, `text-[11px]` status pill), and TxID now carries both a copy button and an explorer link side by side like Deposit's

## Known Gaps

- **`Withdrawal.fiatAmount` is dead, same as `Deposit.creditedAt`.** The column exists in the schema ("if a payout response ever includes a USD quote") but nothing ever populates it, and nothing needs to now — `totalWithdrawalsUsd` and withdrawal-row USD values are computed live via `getRatesUsd()` instead (see Architecture Decision #13). Consider dropping the column, or populating it anyway as a historical record independent of live-rate display.
- **`Deposit.creditedAt` is dead.** It's declared in the schema and typed in `deposit.vue`, but nothing reads or writes it — balance math ignores it entirely in favor of live status-filtered aggregation. Either wire it up for real or drop the column; leaving it gives a false impression that crediting is gated on it.
- **`GET /api/dashboard` and `GET /api/withdrawals` each independently call `getRatesUsd()` with no caching.** A single Withdraw page load fires both concurrently, so the same asset's USD value can legitimately differ between the "Available" balance and its own withdrawal-history row if Uniwire's rate ticks between the two calls — confirmed reachable, not just theoretical. No caching layer exists by design (see Architecture Decision #13) for demo-scale simplicity; revisit if this becomes visibly confusing.
- **`depositActivityStatus()` (`server/api/dashboard.get.ts`, substring match), `displayStatus()` (`app/pages/deposit.vue`, substring match), and `isCompletedStatus()` (`server/utils/balances.ts`, exact-match list) are three independent deposit-status classifiers.** Adding the four invoice statuses required an explicit early-return in each of the first two (to dodge `"invoice_incomplete"` containing `"complete"` as a substring) rather than consolidating them onto one canonical list — still a real duplication risk for the *next* new status value, just currently correct for all statuses this app produces today.
- **Architecture Decision #10 ("no custom price feed/exchange-rate table") is in real tension with `server/utils/rates.ts`.** Decision #13 documents the distinction (historical deposit quotes vs. live current-holdings valuation), but this is worth double-checking if either area changes again.
- **Invoice *callback* payload shape is not yet confirmed against a real captured delivery.** The invoice-creation *response* shape (`amount.requested`/`amount.invoiced`) is now confirmed live against the sandbox API (see `WEBHOOK_PAYLOADS.MD`), and the `invoice_*` callback is documented as sharing that same shape (per Uniwire's docs) — but that assumption itself is still unverified against a real webhook delivery, unlike `transaction_*`/`payout_*`. Code defensively as-is; capture a real example into `WEBHOOK_PAYLOADS.MD` once observed and reconcile if it differs.

## Next Task (When You Resume)

No specific task queued. Candidates, roughly in order of likely value: (1) decide whether to cache `getRatesUsd()` briefly to close the cross-endpoint rate-inconsistency gap above, (2) consolidate the three deposit-status classifiers onto one canonical list, (3) resolve the dead `fiatAmount`/`creditedAt` columns one way or the other, (4) add a monotonic status guard on invoice/transaction callbacks so an out-of-order or replayed callback can't revert a row out of a credited status.

## Webhook Requirements Checklist

### Deposit / Transaction Callbacks (`transaction_*`)

1. Verify signature
2. Accept callback delivery even on duplicate `callback_id`
3. Process `transaction_*` callbacks only
4. Identify user via passthrough (`publicId`)
5. Verify address ownership
6. Upsert deposit by transaction id
7. Update chronology fields on later callbacks
8. Return 2xx
9. Credit user balance idempotently — done via live status-filtered aggregation in `getAvailableBalances()`, not a stored counter

### Payout / Withdrawal Callbacks (`payout_*`)

1. Verify signature (same HMAC scheme as deposit callbacks)
2. Accept callback delivery even on duplicate `callback_id`
3. Match the withdrawal by our own `referenceId` first (generated before we ever contact Uniwire), falling back to `uniwirePayoutId` — `referenceId` is the reliable key since `uniwirePayoutId` may still be unknown to us if our original request was ambiguous (timeout/network error)
4. Map `payout_pending`/`payout_confirmed`/`payout_complete`/`payout_rejected`/`payout_failed` to our `initialized`/`confirmed`/`complete`/`rejected`/`failed` status values (confirmed and complete are both credited/non-reversible — complete just reflects Uniwire's higher confirmation threshold, e.g. 12 vs 35 on Ethereum)
5. Backfill `uniwirePayoutId` on the withdrawal row if we didn't already know it
6. Return 2xx; unknown payout statuses are acknowledged and ignored, not errored

### Fixed-Amount Invoice Callbacks (`invoice_*`)

1. Verify signature (same HMAC scheme as deposit/payout callbacks)
2. Accept callback delivery even on duplicate `callback_id`
3. Match the Deposit by `uniwireInvoiceId`, scoped to `requestedAmount IS NOT NULL` so a reusable-address deposit row can never be touched by this path
4. Map `invoice_pending`/`invoice_confirmed`/`invoice_complete`/`invoice_incomplete` to our `invoice_pending`/`invoice_confirmed`/`invoice_complete`/`underpaid` status values — `invoice_incomplete` is deliberately renamed (not stored as-is) to dodge a substring collision with this app's status classifiers
5. Update `amount` to the cumulative paid-so-far on every callback, regardless of status
6. Credit balance only on `invoice_complete`, using the actual paid amount (never the requested amount)
7. Return 2xx; unknown invoice statuses are acknowledged and ignored, not errored
8. A `transaction_*` callback for a fixed-amount invoice's address (no `DepositAddress` row) falls back to an owned-`Deposit` check before rejecting with 403 — acknowledged and ignored if found, since invoice callbacks are the sole source of truth for that row
