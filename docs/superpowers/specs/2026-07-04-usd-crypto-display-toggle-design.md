# USD/Crypto Display Toggle — Design

## Purpose

This is a demo of Uniwire's integration surface, and different prospective clients think in different units — some fiat-first, some crypto-native. Add a global display-mode toggle so the same demo can be shown either way: a "Show crypto values" checkbox in the nav that fully replaces every monetary figure across Dashboard, Deposit, and Withdraw with either USD or crypto, no mixed display.

## 1. Toggle Mechanism

- Global reactive state via Nuxt's `useState<'usd' | 'crypto'>('displayMode', () => 'usd')`, mirroring the existing theme-toggle pattern already in `app/app.vue`.
- Initialized from `localStorage` (`uw-display-mode`) on mount; written back on every change. No backend/session involvement — purely a client-side, per-browser preference.
- UI: a checkbox in the nav next to the existing theme toggle, labeled "Show crypto values". Unchecked (default) = USD everywhere. Checked = crypto everywhere.
- "Full replace" semantics: when a mode is active, only that unit is shown for any given figure — never both side by side.

## 2. Live Rate Fetching

- New shared server util `server/utils/rates.ts`, exporting `getRatesUsd(): Promise<Map<string, number>>`.
- Calls Uniwire's `GET /v1/exchange-rates/` (list-all endpoint, no params) once via the existing `uniwireRequest` helper, and returns a `Map` of `symbol -> rate_usd` for every currency Uniwire reports.
- One Uniwire call covers every use site in a given request — there's no per-symbol filtering on Uniwire's side, so the "only compute for non-zero balances" rule (see below) is applied by each *caller*, not by restricting the API call itself.
- No caching layer for now — fetched fresh per request. Acceptable at demo-scale traffic; can be revisited if needed later.

## 3. USD Calculation Strategy Per Surface

| Surface | Approach |
|---|---|
| Deposit history rows (Recent Deposits), lifetime "Total deposits" stat | **Unchanged.** Stored historical `Deposit.fiatAmount` — the actual quote Uniwire attached to that specific deposit at the time it happened. |
| Withdrawal history rows (Recent Withdrawals), lifetime "Total withdrawals" stat | **New.** Computed live as `amount × rateUsd` at read time. There is no historical per-withdrawal quote (and none is needed) — this also closes the pre-existing gap where `totalWithdrawalsUsd` always read `$0.00`, without depending on an unconfirmed field in Uniwire's payout callback payload. |
| Dashboard hero total balance, per-asset balance chips, Withdraw page "Available" balance | **Changed.** Recomputed live as `amount × rateUsd`, for assets where `amount > 0` only. This replaces the current approach of summing historical `Deposit.fiatAmount`, and incidentally fixes a latent bug: today's USD balance figure never subtracts withdrawals (only the crypto `amount` does in `getAvailableBalances`), so it's currently overstated for any user who has withdrawn anything. Assets with `amount === 0` get `usdValue: 0` directly, no rate lookup needed. |

Rationale: "current holdings" should reflect current market value (like a real exchange balance), while "lifetime totals" are a historical record of what actually happened at the time — two different, both-correct semantics.

`getAvailableBalances()` in `server/utils/balances.ts` is untouched — it keeps returning crypto-only amounts, which is what the serializable withdrawal-reservation transaction in `POST /api/withdraw` needs. USD valuation is layered on top only in read-only display endpoints (`GET /api/dashboard`, `GET /api/withdrawals`), never inside a DB transaction, so there's no external HTTP call on that hot/locking path.

## 4. Withdrawal Amount Input (USD mode)

- When `displayMode === "usd"`, the amount field on the Withdraw page accepts a USD figure instead of crypto.
- The page already has the selected asset's `rateUsd` (surfaced on the matching entry in `/api/dashboard`'s `balances` array — available precisely when the asset has a non-zero balance, which is a precondition for withdrawing anyway).
- Client-side conversion on input: `crypto = usd / rateUsd`, rounded to 8 decimal places. A live preview is shown beneath the field (e.g. "≈ 0.00523 BTC").
- The **converted crypto amount** is what's actually sent to `POST /api/withdraw`. That endpoint's contract is unchanged — it still receives and validates a crypto `amount` exactly as it does today. The serializable balance-reservation transaction and the Uniwire payout call are untouched.

## 5. Error Handling & Edge Cases

- If the Uniwire rate call fails inside `GET /api/dashboard` or `GET /api/withdrawals`, the request does not fail outright:
  - Deposit-side historical figures are unaffected (they don't depend on live rates).
  - Any figure that needs a live rate (current balances, withdrawal history/stats) returns `usdValue: null` rather than a misleading `0`. The UI renders `—` for a null value.
- Same `null`/`—` handling if a specific asset's rate is simply missing from Uniwire's response.
- On the Withdraw page, if the selected asset's rate is unavailable while in USD mode: disable the amount input and submit button, with a short inline message ("Live rate unavailable, try again") — never allow a submission built on a broken/absent conversion.

## Data Flow Summary

```
GET /api/dashboard
  ├─ getAvailableBalances(userId)          → crypto amounts (unchanged, no HTTP calls)
  ├─ getRatesUsd()                          → live Map<symbol, rateUsd> (one Uniwire call)
  ├─ balances[]: for amount > 0 assets → usdValue = amount * rateUsd; else usdValue = 0
  ├─ recentActivity (deposits): usdValue = stored Deposit.fiatAmount
  ├─ recentActivity (withdrawals): usdValue = amount * rateUsd (null if rate missing)
  ├─ stats.totalDepositsUsd: unchanged, sum of stored fiatAmount
  └─ stats.totalWithdrawalsUsd: sum of (amount * rateUsd) across withdrawals (null-safe)

GET /api/withdrawals
  └─ each row: usdValue = amount * rateUsd (same getRatesUsd() call)

POST /api/withdraw — unchanged contract, always receives a crypto amount
```

## Testing

No automated test suite exists in this project; verification is manual:
- Toggle both modes on Dashboard, Deposit, and Withdraw pages; confirm every figure fully replaces (no mixed units).
- Confirm Dashboard totals reconcile with Withdraw page's "Available" figure in both modes.
- Submit a real testnet withdrawal in USD mode and confirm the converted crypto amount matches the preview and is what's actually sent to Uniwire.
- Simulate a rate-fetch failure (e.g. temporarily break `getRatesUsd()`) and confirm `—` appears instead of `$0.00`, and the Withdraw form disables itself appropriately.
