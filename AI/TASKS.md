# TASKS.md

## Backlog

Ideas dropped here for planning/execution in a later session. No structure required — just add a line.

1. In case of fixed amount invoices let's change the information displayed in "How it works". We could say that with the invoice callbacks approach which is suitable for businesses selling products/services for a fixed amount, they should listen to invoice callbacks and credit on invoice_confirmed or invoice_complete callbacks are received. in case of underpayment, when invoice is not fully paid they will receive invoice_incomplete callback. If they want to allow some small underpayment and still credit the user they could enable the Acceptance Range in the configuration profile on Uniwire.
   From the invoice callbacks they could see the actual amount deposited and inform the client how more they need to deposit. (this is something we need to implement and demo too).

## Completed tasks

1. Check the withdrawal status, on Dashboard and Withdraw page. I think I noticed the payout was completed after only tx_confirmed callback. — `payout_confirmed`/`payout_complete` were both collapsed into the same `"confirmed"` withdrawal status, causing inconsistent labels between Dashboard and Withdraw page. Fixed to keep them distinct (`confirmed` vs `complete`) and shown consistently in both places (commit `5f95c6a`).

2. In the Settings (gear), we can split settings in 3 categories - Dashboard or General, Deposits and Payouts. Can be separated with a breaking line.. — Split the flat Settings dropdown into General/Deposits/Payouts sections via a new `SettingsSection.vue` component, separated by dividers (commit `bd6c408`).

3. Support fixed-amount deposit invoices as an alternative to the current always-reusable, no-amount address flow. Some clients want to create an invoice with a set amount; most want a reusable address that credits whatever amount/transaction comes in. Likely surfaced as a per-user or per-deposit setting. — Added as a per-user, all-assets Settings toggle. When on, the Deposit page shows an optional amount field; providing one creates a one-off invoice (bypassing the reusable-address cache) and Uniwire's `invoice_*` callbacks (previously ignored entirely) drive status and credit balance only once fully paid, using the actual amount paid (commits `8430050`..`84d2749`).

4. When new invoice is created, in Recent Deposits section a new entry is created, even though no deposit was made yet. That's wrong. It's shown also in Recent activity on Dashboad: Deposit ... Pending status. I think we should show on Dashboard something like New address created. — Root cause: a `Deposit` row was created immediately for the reusable (no fixed amount) address flow, before any money moved; the real transaction later landed in a *separate* row (upserted by transaction id), so the original row was never updated and lingered forever as a fake "Pending" deposit. Fixed by only creating the `Deposit` row upfront for fixed-amount invoices (which genuinely need it, since the `invoice_*` callback only updates existing rows); the reusable flow now relies solely on the `DepositAddress` cache until a real deposit callback creates its own row. Existing phantom rows in the DB were deleted as part of the fix.
