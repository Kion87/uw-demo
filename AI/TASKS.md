# TASKS.md

## Backlog

Ideas dropped here for planning/execution in a later session. No structure required — just add a line.

1. When new invoice is created, in Recent Deposits section a new entry is created, even though no deposit was made yet. That's wrong. It's shown also in Recent activity on Dashboad: Deposit ... Pending status. I think we should show on Dashboard something like New address created.

## Completed tasks

1. Check the withdrawal status, on Dashboard and Withdraw page. I think I noticed the payout was completed after only tx_confirmed callback. — `payout_confirmed`/`payout_complete` were both collapsed into the same `"confirmed"` withdrawal status, causing inconsistent labels between Dashboard and Withdraw page. Fixed to keep them distinct (`confirmed` vs `complete`) and shown consistently in both places (commit `5f95c6a`).

2. In the Settings (gear), we can split settings in 3 categories - Dashboard or General, Deposits and Payouts. Can be separated with a breaking line.. — Split the flat Settings dropdown into General/Deposits/Payouts sections via a new `SettingsSection.vue` component, separated by dividers (commit `bd6c408`).

3. Support fixed-amount deposit invoices as an alternative to the current always-reusable, no-amount address flow. Some clients want to create an invoice with a set amount; most want a reusable address that credits whatever amount/transaction comes in. Likely surfaced as a per-user or per-deposit setting. — Added as a per-user, all-assets Settings toggle. When on, the Deposit page shows an optional amount field; providing one creates a one-off invoice (bypassing the reusable-address cache) and Uniwire's `invoice_*` callbacks (previously ignored entirely) drive status and credit balance only once fully paid, using the actual amount paid (commits `8430050`..`84d2749`).
