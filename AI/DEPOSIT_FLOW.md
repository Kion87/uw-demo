# Deposit Flow — UW Demo

## Overview

Users create or reuse a deposit address, send crypto on-chain, and Uniwire sends transaction callbacks that update one deposit row per actual blockchain transaction.

This is the **default (reusable, no-amount)** flow. There's also an opt-in **fixed-amount invoice** alternative — see "Fixed-Amount Invoices" below — that skips almost everything in this doc (no `DepositAddress` caching, no transaction-callback-driven crediting) in favor of its own one-off invoice + `invoice_*` callback lifecycle, documented in `AI/UNIWIRE_INTEGRATION.md`.

## 1) Create/Get Deposit Address

Endpoint:

- `POST /api/deposit`

Payload example:

- `{ "assetKey": "USDT_TRC20" }`

Server logic:

1. require authenticated user
2. map `assetKey` → `{ currency, kind }`
3. **if `amount` is present in the request body, skip steps 4–6 entirely and go straight to creating a fresh invoice at Uniwire — see "Fixed-Amount Invoices" below**
4. derive reusable chain key from `kind`
5. lookup `DepositAddress` by `(userId, assetKey/reuseKey logic)`
6. return existing address if found
7. else create invoice/address at Uniwire
8. store `DepositAddress` (reusable flow only — never for a fixed-amount invoice). **No `Deposit` row is created here** — only once an actual `transaction_*` callback arrives does a `Deposit` row get created (upserted by transaction id). Creating one at this step used to leave a permanent phantom "Pending" entry with no real money behind it, since the eventual real deposit lands in a separate row anyway
9. return address to frontend

## 2) User Deposits Crypto

User sends funds on-chain to the returned address.

Because addresses are reusable, the same invoice/address may receive multiple separate transactions over time.

## 3) Uniwire Sends Callback

Endpoint:

- `POST /api/uniwire/callback`

We process **transaction callbacks only**:

- `transaction_pending`
- `transaction_confirmed`
- `transaction_complete`

Non-transaction callbacks should be acknowledged with 2xx and ignored for deposit processing.

## 4) Callback Processing Summary

For `transaction_*` callbacks:

1. verify signature using HMAC of `callback_id`
2. log `callback_id` in `UniwireCallback`
3. allow duplicate `callback_id` without blocking processing
4. extract `tx` from `payload.transaction`
5. resolve user from `transaction.invoice.passthrough`
6. verify the receiving address belongs to the user
7. upsert `Deposit` by:
   - `uniwireTransactionId = transaction.id`
8. store / update:
   - `amount = transaction.amount.paid.amount`
   - `asset = transaction.amount.paid.currency`
   - `fiatAmount = transaction.amount.paid.quotes.USD` (nullable — not confirmed present on every callback)
   - `fiatCurrency = "USD"` when `fiatAmount` was found, else `null`
   - `network = transaction.kind`
   - `txid = transaction.txid`
   - `status = transaction.status` (fallback to callback status if needed)
   - `executedAt = transaction.executed_at`
   - `confirmedAt = transaction.confirmed_at`
   - `confirmations = transaction.confirmations`
9. future: credit user balance idempotently

## 5) Deposit History UI

Deposit page now shows **Recent Deposits**:

- Created
- Asset
- Amount
- TxID
- Status

Features:

- TxID shown as `4...4` truncated hash, alongside copy and explorer-link actions
- Status rendered as a colored pill, same color mapping as the Dashboard's Recent Activity (`pillClass()`, duplicated per-page like the other status classifiers)
- show/hide recent deposits section, with a right-edge scroll fade + chevron hint when the table overflows its container (cleared once scrolled to the end)
- asset icons in selection and history UI
- table typography matches the Dashboard's Recent Activity scale (small uppercase letter-spaced headers, compact row text) rather than the browser-default size

## 6) Fixed-Amount Invoices (Alternative Flow)

Opt-in per-user setting (`User.fixedAmountInvoices`, toggled in Settings → Deposits) that shows an optional amount field on the Deposit page. The field follows the page's USD/crypto display toggle — its label reads "Amount in USD" or "Amount in \<ASSET\>" accordingly. If the user fills it in, `POST /api/deposit` is called with `amount` (and `amountCurrency: "usd" | "crypto"`) set, which:

- skips the `DepositAddress` reuse cache entirely (never looked up, never written) — every fixed-amount request creates a brand-new, one-off invoice/address
- when the amount is USD, sends `currency: "USD"` to Uniwire (not the asset) — Uniwire computes and returns the actual crypto amount to invoice itself, rather than this app guessing a rate via its own `getRatesUsd()` call. Verified directly against the sandbox API: `{ currency: "USD", kind: "ETH", amount: "20" }` returns `amount: { requested: { amount: "20.00", currency: "USD" }, invoiced: { amount: "0.0111...", currency: "ETH" } }`
- stores the crypto figure (`amount.invoiced.amount`) in `Deposit.requestedAmount` (not `amount` — that field keeps meaning "actual amount paid so far" everywhere in this codebase) and, when requested in USD, the fiat figure (`amount.requested.amount`) in `Deposit.requestedFiatAmount`
- the Create Deposit result panel echoes back the actual crypto amount invoiced, with a copy button and (when applicable) the USD equivalent, so the conversion is visible and pasteable into a wallet

From there, the lifecycle is driven by `invoice_*` webhook callbacks (previously ignored entirely), not `transaction_*` — see the "Invoice Callbacks" section of `AI/UNIWIRE_INTEGRATION.md` for statuses, field mapping, and the crediting rule (only `invoice_complete` credits, using the actual paid amount). The Deposit page's Recent Deposits table and Dashboard's Recent Activity both show "Paid X of Y" for these rows instead of the plain amount — in USD when `requestedFiatAmount` is set and the display toggle is on USD (converted via the invoice's own implied rate, `requestedFiatAmount / requestedAmount`), otherwise in crypto.

A row that's still at status `"new"` (no `invoice_*` callback has fired yet — see Architecture Decision #17) displays as type **Invoice**, status **New**, distinct from an in-flight **Deposit** (Pending → Confirmed/Underpaid → Complete) — same row throughout, just relabeled as its status progresses.

## 7) Supported Deposit Assets (Current)

- BTC
- ETH
- USDT (ERC-20)
- USDT (TRC20)
- USDT (BEP20)
- TRX
- SOL
- USDC (SPL / Solana)
- USDC (ERC-20 / Ethereum)
