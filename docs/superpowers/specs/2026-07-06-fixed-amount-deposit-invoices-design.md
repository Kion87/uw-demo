# Fixed-Amount Deposit Invoices — Design

## Purpose

Today, every deposit address is reusable and amount-less: `POST /api/deposit` finds-or-creates one address per user+asset, and Uniwire credits whatever transaction amount arrives on it. Some clients instead want to request a specific amount up front (e.g. selling a product at a fixed price and releasing it once paid in full) and get a one-off invoice for that exact amount. This adds that as an opt-in, per-user, all-assets setting — with its own callback-driven lifecycle, since Uniwire tracks fixed-amount invoices differently from reusable addresses.

This touches: schema (2 new nullable/defaulted columns), the deposit-creation endpoint, the webhook callback handler (a currently-ignored callback type becomes live), balance crediting, and the Deposit page UI plus the Settings panel built in the prior "settings categories" design.

## 1. The Setting

- **Storage:** `User.fixedAmountInvoices Boolean @default(false)` — a real account-level column (not a client-only preference), since it's referenced from `requireUser()`.
- **Read path:** `requireUser()` (`server/utils/auth.ts`) adds `fixedAmountInvoices: true` to its Prisma `select`. This means it flows automatically into `GET /api/me`'s response, which `app.vue` already fetches on mount into a shared `useState<any|null>("user")` — no new fetch/endpoint needed to read it.
- **Write path:** new `PATCH /api/settings` endpoint — `requireUser()`, then `prisma.user.update({ where: { id: user.id }, data: { fixedAmountInvoices: body.fixedAmountInvoices } })`, returns the updated user. (Named generically, not `/deposit-mode`, so a future Payouts-category setting can reuse the same endpoint shape.)
- **Reactivity:** the "Deposits" section of `SettingsPanel.vue` (from the settings-categories design) reads/writes the same `useState<any|null>("user")` app.vue already populates — toggling calls `PATCH /api/settings` then updates `user.value.fixedAmountInvoices` from the response. Since `deposit.vue` will also read this shared state (see §5) rather than only its own independent `/api/me` call, flipping the toggle updates an already-open Deposit page immediately, consistent with how "Show crypto values" already behaves.
- Single global toggle, all assets — no per-asset variation.

## 2. Deposit Creation (`server/api/deposit.post.ts`)

Behavior forks purely on whether `amount` is present in the request body — the setting only controls whether the Deposit page *shows* the field; enforcement is unnecessary since presence of `amount` is unambiguous either way.

- **`amount` present:** skip the existing `DepositAddress` reuse lookup and skip writing a `DepositAddress` row entirely — always call Uniwire's `POST /v1/invoices/` fresh with `amount` set, and always create a new one-off `Deposit` row. `DepositAddress` keeps meaning exactly one thing ("the cached reusable address for this user+asset"); fixed invoices never touch it.
  - The requested amount is stored in the **new** `Deposit.requestedAmount` column, not `amount`. `Deposit.amount` is left null at creation — it keeps its existing meaning everywhere else in the codebase ("the actual amount involved"), populated later only once Uniwire reports real paid activity. This means `getAvailableBalances()` needs no changes to how it sums `amount`; a not-yet-paid fixed invoice simply contributes 0 until credited.
- **`amount` absent:** entirely unchanged — today's find-or-create-reusable-address behavior.

## 3. Schema Changes

```prisma
model User {
  // ...
  fixedAmountInvoices Boolean @default(false)
}

model Deposit {
  // ...
  requestedAmount Decimal? @db.Decimal(36, 18) // fixed-invoice ask; null for reusable-address deposits
}
```

Both nullable/defaulted — no backfill needed, no impact on existing rows.

## 4. Callback Processing — Invoice Callbacks

`server/api/uniwire/callback.post.ts` currently detects `callback_status.startsWith("invoice_")` and unconditionally ignores it (2xx, no processing). This adds real handling for that branch, while leaving the `transaction_*` and `payout_*` branches otherwise untouched.

**Statuses** (per Uniwire's docs — not yet cross-checked against a captured real payload the way `transaction_*`/`payout_*` were; same "confirm against real deliveries and adjust" posture as the rest of this integration):

| `callback_status` | Meaning | Our handling |
|---|---|---|
| `invoice_pending` | sum of incoming tx = requested, 0 confirmations | store status, no credit |
| `invoice_confirmed` | sum = requested, 1+ confirmations | store status, no credit |
| `invoice_complete` | sum = requested (within Uniwire's account-level Acceptance Range tolerance), 6+ confirmations | **credit the user**, see below |
| `invoice_incomplete` | tx made, but sum < requested | store status (normalized, see below), no credit |

Only `invoice_complete` credits — deliberately stricter than the reusable-address flow (which credits starting at `transaction_confirmed`). This is intentional per product direction: fixed invoices are treated as "delivered" only at the same 6-confirmation bar as `transaction_complete`.

**Amount fields** (per Uniwire's invoice payload shape, shared with the "Get Invoice" endpoint, arriving in `payload.result` — already one of `callback.post.ts`'s existing `resultObj` fallbacks): `invoice.amount.requested.amount` and `invoice.amount.paid.amount`. On every `invoice_*` callback, update the matched `Deposit` row's `amount` field to `invoice.amount.paid.amount` (the cumulative paid-so-far) — this is safe to do unconditionally (regardless of status) because `getAvailableBalances()` only sums rows whose `status` is in `COMPLETED_STATUSES`, so setting `amount` on a not-yet-complete row has no crediting effect; it just keeps the figure current for display.

**Crediting the actual paid amount, not the requested amount:** confirmed with the user — if `invoice_complete` fires with `paid` slightly under `requested` (Acceptance Range tolerance), we credit the actual `paid` amount, not the full requested amount, for accounting accuracy.

**Status normalization (avoiding a substring landmine):** `depositActivityStatus()` (`server/api/dashboard.get.ts`) and `displayStatus()` (`app/pages/deposit.vue`) both classify status strings by substring match, e.g. `s.includes("complete")`. The string `"invoice_incomplete"` *contains* `"complete"` as a substring — a naive pass-through would misclassify an underpaid invoice as done. To avoid this, `invoice_incomplete` is stored as `"underpaid"` (not the raw callback string); the other three (`invoice_pending`/`invoice_confirmed`/`invoice_complete`) are stored as-is, since none of them collide. This is exactly the kind of divergence risk already flagged in `CURRENT_TASK.md`'s Known Gaps about these two independent classifiers — both need a new explicit branch (checked before their generic substring fallback):

- `displayStatus()`: `invoice_pending`/`invoice_confirmed` → "Pending"; `invoice_complete` → "Complete"; `underpaid` → "Underpaid".
- `depositActivityStatus()`: same three-way split, returning `"pending"` / `"complete"` / `"underpaid"`.
- `pillClass()` (`app/pages/index.vue`): add `"underpaid"` → amber/orange (`bg-nuxt-orange/15 text-nuxt-orange`, matching the app's existing accent-token palette), distinct from the default gold used for plain pending.

**Matching to a `Deposit` row:** by `invoice.id` → `Deposit.uniwireInvoiceId`, via `updateMany` (same pattern already used for payout callbacks) — safe because fixed-amount invoices are one-off and never shared across rows the way a reusable address's `uniwireInvoiceId` is.

**`COMPLETED_STATUSES`** (`server/utils/balances.ts`): add `"invoice_complete"` so `getAvailableBalances()` credits it. `"invoice_pending"`/`"invoice_confirmed"`/`"underpaid"` are deliberately excluded (exact-match list, so no collision risk here, unlike the substring classifiers above).

## 5. Fallback for Transaction Callbacks on Fixed-Invoice Addresses

Because fixed-amount invoices never get a `DepositAddress` row (§2), the existing ownership check in the `transaction_*` branch —

```ts
const userAddress = await prisma.depositAddress.findFirst({ where: { userId: user.id, OR: [...] } });
if (!userAddress) throw createError({ statusCode: 403, ... });
```

— would incorrectly 403 a legitimate `transaction_*` callback that Uniwire still sends for a fixed-invoice address (transaction callbacks fire on raw on-chain activity independent of invoice callbacks). Fix: if no `DepositAddress` match is found, also check for a matching `Deposit` row (`userId` + `uniwireInvoiceId` or `address`) before rejecting. If a `Deposit` row exists, acknowledge and ignore (2xx, `ignored: "fixed_amount_invoice_transaction"`) rather than processing it — `invoice_*` callbacks are the sole source of truth for that row's status/crediting. Only 403 if neither table has a match.

## 6. Deposit Page UI (`app/pages/deposit.vue`)

- Reads `fixedAmountInvoices` from the shared `useState<any|null>("user")` (§1) rather than only its own `loadMe()`-populated `me` ref, so the Settings toggle affects it live.
- When true: an optional amount input appears in the "Create Deposit" card, above the button. Left blank → today's exact reusable-address behavior (confirmed earlier). Filled in → sent as `amount` in the `POST /api/deposit` body, always producing a new one-off address (never reused, never shown again after this session beyond the Recent Deposits row).
- **Recent Deposits table:** rows where `requestedAmount` is non-null render the Amount cell as "Paid X of Y requested" (using `amount ?? 0` and `requestedAmount`), plus "Z still due" when `amount < requestedAmount`. Rows with `requestedAmount === null` (reusable-flow deposits) render exactly as today — no change.
- Status column uses the updated `displayStatus()` (§4).

## Non-Goals

- Invoice expiry is not handled — Uniwire's docs don't document an `invoice_expired` status, and none of the four documented statuses represent one. If one turns up in practice, treat it as an "acknowledge + ignore" fallback like any other unrecognized `invoice_*` status, same policy already used for unrecognized `payout_*` statuses.
- The Acceptance Range tolerance itself is a Uniwire-side account/profile setting — nothing in this app configures it; we only consume its effect (whether `invoice_complete` fires despite a slight shortfall).
- No per-asset toggle, no per-deposit choice UI — single global per-user setting only (confirmed earlier).
- Exact invoice callback JSON shape (top-level wrapper fields beyond `result`, e.g. the "three extra fields" Uniwire's docs mention without naming) is not yet confirmed against a real captured payload the way `transaction_*`/`payout_*` were in `WEBHOOK_PAYLOADS.MD`. Implementation should code defensively (as the rest of `callback.post.ts` already does) and capture a real example into `WEBHOOK_PAYLOADS.MD` once observed.

## Testing

No automated test suite in this project; manual verification:

- Toggle "Use fixed-amount invoices" on in Settings; confirm the Deposit page (if open) immediately shows the amount field without a reload.
- Create a fixed-amount deposit with an amount filled in: confirm a *new* address is returned (not a previously-cached reusable one), and a `Deposit` row appears in Recent Deposits with `requestedAmount` set and `amount` null/zero.
- Leave the amount field blank while the setting is on: confirm today's reusable-address behavior is unchanged (same address returned as before).
- Simulate/replay an `invoice_incomplete` callback: confirm the row shows "Underpaid", the amber pill, "paid X of Y, Z due," and that balance is **not** credited.
- Simulate/replay `invoice_pending` → `invoice_confirmed` → `invoice_complete`: confirm status shows "Pending" through the first two, flips to "Complete" only at the last, and balance is credited only at that point, using the actual `paid` amount.
- Confirm a `transaction_*` callback arriving for a fixed-invoice address is acknowledged (2xx) and does not throw a 403 or otherwise mutate that `Deposit` row.
- Confirm existing reusable-address deposits (`requestedAmount === null`) render and credit exactly as before — no regression.
