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

## Next Task (When You Resume)

Work on the **Dashboard**.

Suggested Dashboard goals:

1. Show user summary cards
   - total deposits
   - latest deposit
   - recent activity
2. Reuse deposit history data on dashboard
3. Optionally show quick actions:
   - Deposit
   - Payout (future)
4. Later: credit user balance safely
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
