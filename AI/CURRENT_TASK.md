# CURRENT_TASK.md

# Current Task — UW Demo

## Current State (Done)

- ✅ Webhook endpoint deployed on Netlify: POST `/api/uniwire/callback`
- ✅ Signature verification working
- ✅ Transaction callbacks received from Uniwire
- ✅ Callback delivery logged in Neon (UniwireCallback)
- ✅ Deposit upsert working (keyed by transaction id)
- ✅ Amount extraction using transaction.amount.paid.amount

## Next Task (When You Resume)

Credit user balance safely:

- credit only on transaction_confirmed / transaction_complete
- never credit twice (even with resends)
- recommended: store `Deposit.creditedAt` or use a LedgerEntry table

## Webhook Requirements Checklist

1. Verify signature
2. Parse payload.transaction
3. Handle resends (duplicate callback_id should not break)
4. Identify user via passthrough
5. Verify address ownership
6. Upsert deposit by transaction id
7. Credit balance idempotently (next)
8. Return 2xx
