# TASKS.md

## Backlog

Ideas dropped here for planning/execution in a later session. No structure required — just add a line.

1. In the Settings (gear), we can split settings in 3 categories - Dashboard or General, Deposits and Payouts. Can be separated with a breaking line..

2. Support fixed-amount deposit invoices as an alternative to the current always-reusable, no-amount address flow. Some clients want to create an invoice with a set amount; most want a reusable address that credits whatever amount/transaction comes in. Likely surfaced as a per-user or per-deposit setting.

## Completed tasks

1. Check the withdrawal status, on Dashboard and Withdraw page. I think I noticed the payout was completed after only tx_confirmed callback. — `payout_confirmed`/`payout_complete` were both collapsed into the same `"confirmed"` withdrawal status, causing inconsistent labels between Dashboard and Withdraw page. Fixed to keep them distinct (`confirmed` vs `complete`) and shown consistently in both places (commit `5f95c6a`).
