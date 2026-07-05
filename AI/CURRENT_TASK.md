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

## Known Gaps

- **`Withdrawal.fiatAmount` is dead, same as `Deposit.creditedAt`.** The column exists in the schema ("if a payout response ever includes a USD quote") but nothing ever populates it, and nothing needs to now — `totalWithdrawalsUsd` and withdrawal-row USD values are computed live via `getRatesUsd()` instead (see Architecture Decision #13). Consider dropping the column, or populating it anyway as a historical record independent of live-rate display.
- **`Deposit.creditedAt` is dead.** It's declared in the schema and typed in `deposit.vue`, but nothing reads or writes it — balance math ignores it entirely in favor of live status-filtered aggregation. Either wire it up for real or drop the column; leaving it gives a false impression that crediting is gated on it.
- **`GET /api/dashboard` and `GET /api/withdrawals` each independently call `getRatesUsd()` with no caching.** A single Withdraw page load fires both concurrently, so the same asset's USD value can legitimately differ between the "Available" balance and its own withdrawal-history row if Uniwire's rate ticks between the two calls — confirmed reachable, not just theoretical. No caching layer exists by design (see Architecture Decision #13) for demo-scale simplicity; revisit if this becomes visibly confusing.
- **`depositActivityStatus()` (`server/api/dashboard.get.ts`, substring match) and `isCompletedStatus()` (`server/utils/balances.ts`, exact-match list) are two independent deposit-status classifiers.** They happen to agree on every status string this app currently produces, but nothing keeps them in sync structurally — a new status value could make them diverge (one says "confirmed", the other says "not credited").
- **Architecture Decision #10 ("no custom price feed/exchange-rate table") is in real tension with `server/utils/rates.ts`.** Decision #13 documents the distinction (historical deposit quotes vs. live current-holdings valuation), but this is worth double-checking if either area changes again.

## Next Task (When You Resume)

No specific task queued. Candidates, roughly in order of likely value: (1) decide whether to cache `getRatesUsd()` briefly to close the cross-endpoint rate-inconsistency gap above, (2) consolidate the two deposit-status classifiers onto one canonical list, (3) resolve the dead `fiatAmount`/`creditedAt` columns one way or the other.

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
