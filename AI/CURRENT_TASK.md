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

## Next Task (When You Resume)

Work on **Withdrawals** — currently `app/pages/withdraw.vue` is a static placeholder and the dashboard's "Total withdrawals" stat is hardcoded to `$0.00` / `0 transactions`.

Suggested Withdrawal goals:

1. Add a `Withdrawal` model (mirrors `Deposit`'s shape: status lifecycle, amount, fiat value, txid)
2. `POST /api/withdraw` — request a withdrawal
3. Withdrawal history on the Withdraw page (same pattern as Deposit's Recent Deposits)
4. Wire real `totalWithdrawalsUsd`/`totalWithdrawalsCount` into `GET /api/dashboard` and the recent-activity feed once the model exists
5. Later: credit user balance safely
   - credit only on confirmed/complete deposit states
   - never credit twice
   - use `Deposit.creditedAt` or introduce a ledger table

## Webhook Requirements Checklist

1. Verify signature
2. Accept callback delivery even on duplicate `callback_id`
3. Process `transaction_*` callbacks only
4. Identify user via passthrough (`publicId`)
5. Verify address ownership
6. Upsert deposit by transaction id
7. Update chronology fields on later callbacks
8. Return 2xx
9. Credit user balance idempotently (future)
