# USD/Crypto Display Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global "Show crypto values" toggle that fully replaces every monetary figure across Dashboard, Deposit, and Withdraw with either USD or crypto units, backed by Uniwire's live exchange-rate API.

**Architecture:** A `useState`-backed `displayMode` ref (persisted to `localStorage`), toggled from a nav checkbox in `app.vue`. Deposits keep using their stored historical `fiatAmount` for USD figures; withdrawals and current balances compute USD live via `amount × rateUsd`, sourced from a new `server/utils/rates.ts` wrapping Uniwire's `GET /v1/exchange-rates/`. Cross-asset aggregates (Dashboard hero total, "Total deposits"/"Total withdrawals" stat cards) have no meaningful single crypto value, so in crypto mode they drop the summed figure in favor of a per-asset or count-based view instead of showing something misleading.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Prisma, Nitro server routes, Uniwire API.

## Global Constraints

- This project has **no automated test suite** (confirmed: no `vitest`/`jest` config, no `*.test.*` files, no `test` script in `package.json`). Every task's verification step is manual: backend tasks are verified with `curl` against the running dev server; frontend tasks are verified by hand in the browser at `http://localhost:3000`. Do not introduce a test framework as part of this plan — out of scope.
- The dev server may already be running on port 3000. Check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` before starting a new one; if it returns `200`, reuse it. If not, start it with `npm run dev` (background) from the repo root.
- Asset symbols used throughout this app are always one of: `BTC`, `ETH`, `USDT`, `USDC`, `TRX`, `SOL` (see `BASE_TO_KEYS` in `app/pages/withdraw.vue` and `app/pages/deposit.vue`). Uniwire's rate `symbol` field is expected to match these uppercase strings exactly.
- Follow the existing codebase convention of **explicit imports** from `~/shared/*` (see `app/shared/deposits.ts` and its usages) rather than introducing new auto-import directories beyond Nuxt's default `app/composables/` (which is already auto-imported Nuxt behavior, not a new configuration).
- Never show a fabricated `$0.00`/`0` when a live rate is genuinely unavailable — always surface `null` end-to-end and render it as `—`.

---

### Task 1: Live rate-fetching util

**Files:**
- Create: `server/utils/rates.ts`

**Interfaces:**
- Consumes: `uniwireRequest` from `server/utils/uniwire.ts` (signature: `uniwireRequest<T>(endpoint: string, payload?: Record<string, any>, method?: UniwireMethod): Promise<T>`)
- Produces: `getRatesUsd(): Promise<Map<string, number>>` — a map of uppercase asset symbol (e.g. `"BTC"`) to its current USD rate. Never throws; returns an empty `Map` on any failure (network error, unexpected shape, missing env vars). Callers must treat "symbol not in the map" as "rate unavailable."

- [ ] **Step 1: Write `server/utils/rates.ts`**

```ts
// server/utils/rates.ts
import { uniwireRequest } from "./uniwire";

type UniwireRateEntry = {
  id?: string;
  kind?: string;
  symbol?: string;
  rate_usd?: number | string;
  rate_btc?: number | string;
  sign?: string;
};

function extractRateList(res: any): UniwireRateEntry[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.result)) return res.result;
  if (Array.isArray(res?.content?.result)) return res.content.result;

  console.error(
    "Unexpected Uniwire exchange-rates response shape:",
    JSON.stringify(res, null, 2),
  );
  return [];
}

export async function getRatesUsd(): Promise<Map<string, number>> {
  const rates = new Map<string, number>();

  try {
    const res = await uniwireRequest<any>("/v1/exchange-rates/", {}, "GET");
    const list = extractRateList(res);

    for (const entry of list) {
      const symbol = entry?.symbol ? String(entry.symbol).toUpperCase() : null;
      const rateUsd = Number(entry?.rate_usd);
      if (symbol && Number.isFinite(rateUsd)) {
        rates.set(symbol, rateUsd);
      }
    }
  } catch (e) {
    console.error("Failed to fetch Uniwire exchange rates:", e);
  }

  return rates;
}
```

- [ ] **Step 2: Verify it compiles**

This util has no standalone entrypoint of its own — it's exercised end-to-end via HTTP in Task 2 and Task 3's verification steps. For now, confirm Nitro picked up the new file without a TypeScript error: check the running dev server's terminal output shows no new error after saving, then confirm the server is still responding:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add server/utils/rates.ts
git commit -m "$(cat <<'EOF'
Add live Uniwire exchange-rate fetching util

New getRatesUsd() wraps Uniwire's GET /v1/exchange-rates/ (list-all
endpoint) and returns a symbol -> rate_usd map. Never throws - swallows
fetch/shape errors and returns an empty map, so callers can treat
"missing from the map" as the single "rate unavailable" signal.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire live rates into `GET /api/dashboard`

**Files:**
- Modify: `server/api/dashboard.get.ts`

**Interfaces:**
- Consumes: `getRatesUsd()` from Task 1 (`server/utils/rates.ts`); `getAvailableBalances(userId)` from `server/utils/balances.ts` (unchanged, still returns `Map<string, { amount: number; fiatValue: number }>` — `fiatValue` is no longer read by this file)
- Produces: `GET /api/dashboard` response shape changes:
  - `balances[]` items gain `rateUsd: number | null` and `usdValue` becomes `number | null` (was always `number`)
  - `totalBalanceUsd` becomes `number | null`
  - `recentActivity[]` items gain `usdValue: number | null`
  - `stats.totalWithdrawalsUsd` becomes `number | null` (previously always `0`)

- [ ] **Step 1: Replace the full file content**

```ts
// server/api/dashboard.get.ts
import type { Deposit, DepositAddress, Withdrawal } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";
import { createError } from "h3";
import { DEPOSIT_ASSET_BY_KEY, type DepositAssetKey } from "~/shared/deposits";
import {
  COMPLETED_STATUSES,
  isCompletedStatus,
  getAvailableBalances,
} from "../utils/balances";
import { getRatesUsd } from "../utils/rates";

function toDisplayNetwork(assetKey: string) {
  if (assetKey === "BTC") return "BTC (Bitcoin)";
  if (assetKey === "ETH") return "ETH (Ethereum)";
  if (assetKey === "USDT_ERC20") return "USDT (ERC-20)";
  if (assetKey === "USDT_TRC20") return "USDT (TRC20)";
  if (assetKey === "USDT_BEP20") return "USDT (BEP20)";
  if (assetKey === "TRX") return "TRX (Tron)";
  if (assetKey === "SOL") return "SOL (Solana)";
  if (assetKey === "USDC_SPL") return "USDC (SPL / Solana)";
  if (assetKey === "USDC_ERC20") return "USDC (ERC-20)";
  return assetKey;
}

function withdrawalActivityStatus(status: string) {
  if (status === "confirmed") return "completed";
  if (status === "rejected" || status === "failed") return "failed";
  return "pending";
}

function depositActivityStatus(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s.includes("confirm")) return "confirmed";
  if (s.includes("complete")) return "complete";
  return "pending";
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const [
    addresses,
    recentDeposits,
    recentWithdrawals,
    totalDeposits,
    completedDeposits,
    totalWithdrawals,
    grossFiatDeposits,
    withdrawalAssetTotals,
    availableBalances,
    rates,
  ] = await Promise.all([
    prisma.depositAddress.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" as any },
    }),
    prisma.deposit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.withdrawal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.deposit.count({
      where: { userId: user.id },
    }),
    prisma.deposit.count({
      where: {
        userId: user.id,
        status: { in: COMPLETED_STATUSES, mode: "insensitive" },
      },
    }),
    prisma.withdrawal.count({
      where: { userId: user.id },
    }),
    prisma.deposit.aggregate({
      where: { userId: user.id },
      _sum: { fiatAmount: true },
    }),
    prisma.withdrawal.groupBy({
      by: ["asset"],
      where: { userId: user.id },
      _sum: { amount: true },
    }),
    getAvailableBalances(user.id),
    getRatesUsd(),
  ]);

  const balances = [...availableBalances.entries()].map(([asset, bal]) => {
    if (bal.amount <= 0) {
      return {
        asset,
        label: asset,
        amount: bal.amount.toString(),
        usdValue: 0,
        rateUsd: null as number | null,
        credited: false,
      };
    }

    const rateUsd = rates.get(asset) ?? null;
    const usdValue = rateUsd !== null ? bal.amount * rateUsd : null;

    return {
      asset,
      label: asset,
      amount: bal.amount.toString(),
      usdValue,
      rateUsd,
      credited: true,
    };
  });

  const totalBalanceUsd = balances.some((b) => b.usdValue === null)
    ? null
    : balances.reduce((sum, b) => sum + (b.usdValue ?? 0), 0);

  const assignedAssetKeys = new Set(
    addresses.map(
      (a: DepositAddress) =>
        DEPOSIT_ASSET_BY_KEY[a.assetKey as DepositAssetKey]?.currency ??
        a.assetKey,
    ),
  );

  const activity = [
    ...recentDeposits.map((d: Deposit) => ({
      id: `deposit-${d.id}`,
      type: "deposit" as const,
      asset: d.asset,
      amount: d.amount?.toString() ?? null,
      usdValue:
        d.fiatAmount !== null && d.fiatAmount !== undefined
          ? Number(d.fiatAmount)
          : null,
      status: depositActivityStatus(d.status),
      createdAt: d.createdAt,
      txid: d.txid,
    })),
    ...recentWithdrawals.map((w: Withdrawal) => {
      const rateUsd = rates.get(w.asset) ?? null;
      const usdValue = rateUsd !== null ? Number(w.amount) * rateUsd : null;
      return {
        id: `withdrawal-${w.id}`,
        type: "withdrawal" as const,
        asset: w.asset,
        amount: w.amount.toString(),
        usdValue,
        status: withdrawalActivityStatus(w.status),
        createdAt: w.createdAt,
        txid: w.txid,
      };
    }),
  ]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6);

  let totalWithdrawalsUsd: number | null = 0;
  for (const row of withdrawalAssetTotals) {
    const sumAmount = Number(row._sum.amount ?? 0);
    if (sumAmount === 0) continue;

    const rateUsd = rates.get(row.asset) ?? null;
    if (rateUsd === null) {
      totalWithdrawalsUsd = null;
      break;
    }
    totalWithdrawalsUsd = (totalWithdrawalsUsd ?? 0) + sumAmount * rateUsd;
  }

  return {
    ok: true,
    user: {
      publicId: user.publicId,
      email: user.email,
    },
    totalBalanceUsd,
    balances,
    stats: {
      totalDepositsUsd: Number(grossFiatDeposits._sum.fiatAmount ?? 0),
      totalDepositsCount: totalDeposits,
      totalWithdrawalsUsd,
      totalWithdrawalsCount: totalWithdrawals,
      pendingDepositsCount: totalDeposits - completedDeposits,
      assignedAddressesCount: addresses.length,
      assignedAddressesNetworks: [...assignedAssetKeys].join(", ") || "—",
    },
    recentActivity: activity,
    addresses: addresses.map((a: DepositAddress) => ({
      assetKey: a.assetKey,
      networkLabel: toDisplayNetwork(a.assetKey),
      address: a.address,
      invoiceId: a.invoiceId,
      createdAt: a.createdAt,
    })),
  };
});
```

- [ ] **Step 2: Verify against the running dev server**

```bash
COOKIE_JAR=$(mktemp)
curl -s -c "$COOKIE_JAR" -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"planverify@example.com"}' > /dev/null

curl -s -b "$COOKIE_JAR" http://localhost:3000/api/dashboard | python3 -m json.tool
rm -f "$COOKIE_JAR"
```

Expected: valid JSON, `ok: true`, a `balances` array (empty is fine for a fresh user), `totalBalanceUsd` is either a number or `null` (never a string, never `undefined`), and `stats.totalWithdrawalsUsd` is present (number or `null`, not always `0` anymore unless the user genuinely has no withdrawals).

- [ ] **Step 3: Commit**

```bash
git add server/api/dashboard.get.ts
git commit -m "$(cat <<'EOF'
Compute dashboard USD figures from live Uniwire rates

Current balances (hero total, per-asset chips, Withdraw page's
Available figure) now value holdings at the current live rate instead
of summing historical deposit quotes - this also fixes a latent bug
where withdrawals were never subtracted from the USD balance total
(only the crypto amount was). Withdrawal-side USD figures
(recentActivity rows, totalWithdrawalsUsd stat) are computed live too,
closing the previous "$0.00 forever" gap without depending on an
unconfirmed field in Uniwire's payout callback. Deposit-side USD
figures are untouched, still from the stored historical fiatAmount.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire live rates into `GET /api/withdrawals`

**Files:**
- Modify: `server/api/withdrawals.get.ts`

**Interfaces:**
- Consumes: `getRatesUsd()` from Task 1
- Produces: each item in `GET /api/withdrawals`'s `withdrawals[]` array gains `usdValue: number | null`

- [ ] **Step 1: Replace the full file content**

```ts
// server/api/withdrawals.get.ts
import { createError } from "h3";
import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";
import { getRatesUsd } from "../utils/rates";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const rates = await getRatesUsd();

  const withdrawalsWithUsd = withdrawals.map((w) => {
    const rateUsd = rates.get(w.asset) ?? null;
    const usdValue = rateUsd !== null ? Number(w.amount) * rateUsd : null;
    return { ...w, usdValue };
  });

  return {
    ok: true,
    withdrawals: withdrawalsWithUsd,
  };
});
```

- [ ] **Step 2: Verify against the running dev server**

```bash
COOKIE_JAR=$(mktemp)
curl -s -c "$COOKIE_JAR" -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"planverify@example.com"}' > /dev/null

curl -s -b "$COOKIE_JAR" http://localhost:3000/api/withdrawals | python3 -m json.tool
rm -f "$COOKIE_JAR"
```

Expected: `ok: true`, `withdrawals` is an array (empty is fine for a fresh user); if non-empty, each item has a `usdValue` field (number or `null`) alongside the existing fields.

- [ ] **Step 3: Commit**

```bash
git add server/api/withdrawals.get.ts
git commit -m "$(cat <<'EOF'
Add live USD valuation to withdrawal history rows

Each row in GET /api/withdrawals now carries usdValue (amount x
current rate, or null if the rate is unavailable), so the Withdraw
page's history table can show USD figures for past withdrawals, which
never had a historical quote to begin with.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Shared formatting utilities

**Files:**
- Create: `app/shared/format.ts`

**Interfaces:**
- Produces: `formatUsd(value?: number | null): string` — `"—"` for `null`/`undefined`, otherwise `Intl.NumberFormat` USD currency string (e.g. `"$1,234.56"`). `formatCrypto(value?: string | number | null): string` — `"—"` for `null`/`undefined`, otherwise a locale-formatted number string with up to 4 fraction digits.

- [ ] **Step 1: Write `app/shared/format.ts`**

```ts
// app/shared/format.ts
export function formatUsd(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatCrypto(value?: string | number | null): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
```

- [ ] **Step 2: Verify with a quick Node check**

```bash
node -e '
function formatUsd(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
function formatCrypto(value) {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
console.log(formatUsd(1234.5));   // expect $1,234.50
console.log(formatUsd(null));     // expect —
console.log(formatCrypto("0.012345678")); // expect 0.0123
console.log(formatCrypto(null));  // expect —
'
```

Expected output:
```
$1,234.50
—
0.0123
—
```

- [ ] **Step 3: Commit**

```bash
git add app/shared/format.ts
git commit -m "$(cat <<'EOF'
Extract shared USD/crypto formatting helpers

formatUsd and formatCrypto were previously defined only inside
index.vue. Pulling them into app/shared/format.ts (matching the
existing ~/shared/deposits.ts convention) so Deposit and Withdraw pages
can reuse the exact same formatting instead of duplicating it, ahead
of wiring in the USD/crypto display toggle.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `useDisplayMode` composable

**Files:**
- Create: `app/composables/useDisplayMode.ts`

**Interfaces:**
- Produces: `DisplayMode = "usd" | "crypto"` type; `useDisplayMode(): Ref<DisplayMode>` — a Nuxt `useState`-backed ref shared across every component that calls it (key: `"displayMode"`), defaulting to `"usd"`. Auto-imported by Nuxt from `app/composables/` — no explicit import needed in `.vue` files.

- [ ] **Step 1: Write `app/composables/useDisplayMode.ts`**

```ts
// app/composables/useDisplayMode.ts
export type DisplayMode = "usd" | "crypto";

export function useDisplayMode() {
  return useState<DisplayMode>("displayMode", () => "usd");
}
```

- [ ] **Step 2: Verify Nuxt picks it up**

With the dev server running, confirm no build error appears in its terminal output after saving this file (Nuxt's dev server hot-reloads and would print a TypeScript/Vite error if the composable had a syntax problem). Then confirm the endpoint is reachable, proving the app still boots:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add app/composables/useDisplayMode.ts
git commit -m "$(cat <<'EOF'
Add useDisplayMode composable for the USD/crypto toggle

Shared useState-backed ref (key "displayMode", default "usd") so
app.vue's nav checkbox and every page can read/write the same global
display-mode preference.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Nav checkbox + persistence in `app.vue`

**Files:**
- Modify: `app/app.vue`

**Interfaces:**
- Consumes: `useDisplayMode()` from Task 5

- [ ] **Step 1: Add the displayMode ref, persistence, and handler in `<script setup>`**

In `app/app.vue`, right after the existing `const theme = ref<ThemeMode>("light");` line, add:

```ts
const displayMode = useDisplayMode();

function onDisplayModeToggle(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  displayMode.value = checked ? "crypto" : "usd";
}
```

Then, right after the existing `watch(theme, (v) => { ... });` block, add:

```ts
watch(displayMode, (v) => {
  localStorage.setItem("uw-display-mode", v);
});
```

Then, inside the existing `onMounted(() => { ... })` block, right after the `savedTheme` handling and before the `// sync user from server` comment, add:

```ts
const savedDisplayMode = localStorage.getItem("uw-display-mode");
if (savedDisplayMode === "usd" || savedDisplayMode === "crypto") {
  displayMode.value = savedDisplayMode;
}
```

- [ ] **Step 2: Add the checkbox to the template**

In the `<!-- Right controls -->` div, immediately before the existing theme-toggle `<button>`, add:

```html
<label
  class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-nuxt-border bg-nuxt-panel px-3 text-sm hover:opacity-90"
>
  <input
    type="checkbox"
    :checked="displayMode === 'crypto'"
    @change="onDisplayModeToggle"
  />
  Show crypto values
</label>
```

- [ ] **Step 3: Verify in the browser**

Open `http://localhost:3000/` and confirm:
1. A "Show crypto values" checkbox appears in the top-right nav, unchecked by default.
2. Checking it, then reloading the page, keeps it checked (persisted via `localStorage`).
3. Open browser devtools → Application → Local Storage → confirm a `uw-display-mode` key with value `"crypto"` or `"usd"` matching the checkbox state.

- [ ] **Step 4: Commit**

```bash
git add app/app.vue
git commit -m "$(cat <<'EOF'
Add USD/crypto display toggle checkbox to nav

Checkbox persists to localStorage (uw-display-mode) the same way the
existing theme toggle does, and drives the shared useDisplayMode()
state that pages will read from next.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Dashboard page (`index.vue`) full-replace rendering

**Files:**
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `formatUsd`, `formatCrypto` from `~/shared/format` (Task 4); `useDisplayMode()` (Task 5); `GET /api/dashboard`'s new response shape (Task 2) — `balances[].usdValue: number|null`, `balances[].rateUsd: number|null`, `totalBalanceUsd: number|null`, `recentActivity[].usdValue: number|null`

- [ ] **Step 1: Replace the local formatUsd/formatCrypto with the shared import**

At the top of `<script setup>` in `app/pages/index.vue`, add:

```ts
import { formatUsd, formatCrypto } from "~/shared/format";

const displayMode = useDisplayMode();
```

Delete the existing local `function formatUsd(...)` and `function formatCrypto(...)` definitions (lines 35-47 in the current file) — they're now provided by the import.

- [ ] **Step 2: Hero section — conditional title, conditional total, per-asset chip rendering**

Replace:

```html
<div class="relative text-[12.5px] font-bold uppercase tracking-[0.1em] text-nuxt-gold">
  Total Balance
</div>
<div class="relative mt-2.5 font-display text-[34px] font-bold leading-none text-nuxt-text sm:text-[56px]">
  {{ formatUsd(dashboard?.totalBalanceUsd) }}
</div>
<div class="relative mt-1.5 text-[13px] text-nuxt-muted2">
  Credited balances only, not raw deposit totals.
</div>
```

with:

```html
<div class="relative text-[12.5px] font-bold uppercase tracking-[0.1em] text-nuxt-gold">
  {{ displayMode === "usd" ? "Total Balance" : "Your Balances" }}
</div>
<template v-if="displayMode === 'usd'">
  <div class="relative mt-2.5 font-display text-[34px] font-bold leading-none text-nuxt-text sm:text-[56px]">
    {{ formatUsd(dashboard?.totalBalanceUsd) }}
  </div>
  <div class="relative mt-1.5 text-[13px] text-nuxt-muted2">
    Credited balances only, not raw deposit totals.
  </div>
</template>
<div v-else class="relative mt-1.5 text-[13px] text-nuxt-muted2">
  Your balance in each asset you hold.
</div>
```

Then replace the chip's inner content:

```html
<div class="text-[11px] text-nuxt-muted2">
  {{ balance.label }}{{ balance.amount ? ` · ${formatCrypto(balance.amount)}` : "" }}
</div>
<div class="font-mono text-[15px] font-semibold text-nuxt-text">
  {{ formatUsd(balance.usdValue) }}
</div>
```

with:

```html
<div class="text-[11px] text-nuxt-muted2">
  {{ balance.label }}
</div>
<div class="font-mono text-[15px] font-semibold text-nuxt-text">
  {{ displayMode === "usd" ? formatUsd(balance.usdValue) : `${formatCrypto(balance.amount)} ${balance.asset}` }}
</div>
```

- [ ] **Step 3: Stat cards — "Total deposits" and "Total withdrawals" swap primary figure in crypto mode**

Replace the "Total deposits" card body:

```html
<p class="mt-2 font-display text-[28px] font-bold text-nuxt-text">
  {{ formatUsd(dashboard?.stats?.totalDepositsUsd) }}
</p>
<p class="mt-2 text-xs font-semibold text-nuxt-emerald">
  ↑ {{ dashboard?.stats?.totalDepositsCount ?? 0 }} transactions
</p>
```

with:

```html
<p class="mt-2 font-display text-[28px] font-bold text-nuxt-text">
  {{ displayMode === "usd" ? formatUsd(dashboard?.stats?.totalDepositsUsd) : (dashboard?.stats?.totalDepositsCount ?? 0) }}
</p>
<p class="mt-2 text-xs font-semibold text-nuxt-emerald">
  {{ displayMode === "usd" ? `↑ ${dashboard?.stats?.totalDepositsCount ?? 0} transactions` : "deposits" }}
</p>
```

Replace the "Total withdrawals" card body:

```html
<p class="mt-2 font-display text-[28px] font-bold text-nuxt-text">
  {{ formatUsd(dashboard?.stats?.totalWithdrawalsUsd) }}
</p>
<p class="mt-2 text-xs font-semibold text-nuxt-muted2">
  {{ dashboard?.stats?.totalWithdrawalsCount ?? 0 }} transactions
</p>
```

with:

```html
<p class="mt-2 font-display text-[28px] font-bold text-nuxt-text">
  {{ displayMode === "usd" ? formatUsd(dashboard?.stats?.totalWithdrawalsUsd) : (dashboard?.stats?.totalWithdrawalsCount ?? 0) }}
</p>
<p class="mt-2 text-xs font-semibold text-nuxt-muted2">
  {{ displayMode === "usd" ? `${dashboard?.stats?.totalWithdrawalsCount ?? 0} transactions` : "withdrawals" }}
</p>
```

- [ ] **Step 4: Recent activity amount column — toggle between USD and crypto**

There are two occurrences of this pattern (desktop table and mobile stacked cards). Replace both:

```html
{{ activityAmountSign(row.type) }}{{ formatCrypto(row.amount) }}
```

with:

```html
{{ activityAmountSign(row.type) }}{{ displayMode === "usd" ? formatUsd(row.usdValue) : formatCrypto(row.amount) }}
```

(The mobile card variant additionally appends `{{ row.asset }}` right after — leave that part untouched, it's the asset identifier, not a value.)

- [ ] **Step 5: Update `pillClass` for the new deposit statuses (already partially done, verify no regression)**

Confirm `pillClass` in this file already treats `"confirmed"` and `"complete"` (not just `"completed"`) as the green/done style — this was done in a prior change. If it's missing, add it:

```ts
function pillClass(status?: string | null) {
  if (status === "completed" || status === "confirmed" || status === "complete") {
    return "bg-nuxt-emerald/15 text-nuxt-emerald";
  }
  if (status === "failed") {
    return "bg-rose-500/15 text-rose-400";
  }
  return "bg-nuxt-gold/15 text-nuxt-gold";
}
```

- [ ] **Step 6: Verify in the browser**

Open `http://localhost:3000/` logged in as a user with at least one deposit and one withdrawal (use the existing signup flow, then use Deposit/Withdraw pages, or reuse an existing test account). With the nav checkbox **unchecked** (USD mode):
1. Hero shows "Total Balance" and a dollar figure.
2. Balance chips show dollar amounts.
3. "Total deposits"/"Total withdrawals" stat cards show dollar figures with transaction-count subtext.
4. Recent activity amounts are dollar figures.

Check the checkbox (crypto mode) and confirm:
1. Hero title changes to "Your Balances", no big dollar figure.
2. Balance chips show `<amount> <ASSET>` (e.g. `0.0123 BTC`).
3. Stat cards show the transaction count as the primary number, with "deposits"/"withdrawals" as the subtext.
4. Recent activity amounts show crypto amounts.

- [ ] **Step 7: Commit**

```bash
git add app/pages/index.vue
git commit -m "$(cat <<'EOF'
Wire USD/crypto toggle into Dashboard

Hero total, balance chips, stat cards, and recent activity all fully
switch units based on displayMode. Cross-asset aggregates (hero total,
stat card dollar figures) have no meaningful single crypto value, so
crypto mode replaces them with a per-asset chip breakdown and
transaction counts instead of a fabricated combined number.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Deposit page (`deposit.vue`) full-replace rendering

**Files:**
- Modify: `app/pages/deposit.vue`

**Interfaces:**
- Consumes: `formatUsd` from `~/shared/format` (Task 4); `useDisplayMode()` (Task 5); `GET /api/deposits` already returns `fiatAmount` (unchanged, no server-side work needed here)

- [ ] **Step 1: Add `fiatAmount` to the `DepositHistoryItem` type**

In `app/pages/deposit.vue`, add a field to the existing type:

```ts
type DepositHistoryItem = {
  id: number;
  userId: number;
  asset: string;
  network: string;
  amount: string | null;
  fiatAmount: string | null;
  uniwireInvoiceId: string;
  address: string;
  uniwireTransactionId: string | null;
  txid: string | null;
  status: string;
  executedAt: string | null;
  confirmedAt: string | null;
  confirmations: number | null;
  creditedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Import the composable and formatter**

At the top of `<script setup>`, add:

```ts
import { formatUsd } from "~/shared/format";

const displayMode = useDisplayMode();
```

- [ ] **Step 3: Toggle the amount column in the Recent Deposits table**

Replace:

```html
<td
  class="whitespace-nowrap px-3 py-3 text-right font-medium"
>
  {{ d.amount ?? "—" }}
</td>
```

with:

```html
<td
  class="whitespace-nowrap px-3 py-3 text-right font-medium"
>
  {{ displayMode === "usd" ? formatUsd(d.fiatAmount !== null ? Number(d.fiatAmount) : null) : (d.amount ?? "—") }}
</td>
```

- [ ] **Step 4: Verify in the browser**

Open `http://localhost:3000/deposit` for a user with at least one confirmed deposit. With the nav checkbox unchecked (USD mode), confirm the Recent Deposits "Amount" column shows a dollar figure (or `—` if that deposit never got a fiat quote from Uniwire). Check the checkbox (crypto mode) and confirm the same column now shows the raw crypto amount as before.

- [ ] **Step 5: Commit**

```bash
git add app/pages/deposit.vue
git commit -m "$(cat <<'EOF'
Wire USD/crypto toggle into Deposit page history table

Recent Deposits' Amount column now toggles between the stored
historical fiatAmount (USD mode) and the raw crypto amount (crypto
mode), matching the toggle behavior on Dashboard and Withdraw.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Withdraw page (`withdraw.vue`) — available balance, USD input conversion, history table

**Files:**
- Modify: `app/pages/withdraw.vue`

**Interfaces:**
- Consumes: `formatUsd` from `~/shared/format` (Task 4); `useDisplayMode()` (Task 5); `GET /api/dashboard`'s `balances[].usdValue`/`rateUsd` (Task 2); `GET /api/withdrawals`'s `usdValue` per row (Task 3)
- Produces: `POST /api/withdraw` is called with a crypto `amount` exactly as before — this task performs USD→crypto conversion entirely client-side before that call, so the server contract is unchanged.

- [ ] **Step 1: Add `usdValue` to the `WithdrawalHistoryItem` type and import the composable/formatter**

```ts
import { formatUsd } from "~/shared/format";

type WithdrawalHistoryItem = {
  id: number;
  asset: string;
  network: string;
  amount: string;
  usdValue: number | null;
  destinationAddress: string;
  txid: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

const displayMode = useDisplayMode();
```

- [ ] **Step 2: Replace `availableForBase` with balance-row-aware computeds**

Replace:

```ts
const availableForBase = computed(() => {
  const row = dashboard.value?.balances?.find((b: any) => b.asset === base.value);
  return row ? Number(row.amount ?? 0) : 0;
});
```

with:

```ts
const balanceRowForBase = computed(() => {
  return dashboard.value?.balances?.find((b: any) => b.asset === base.value) ?? null;
});

const availableForBase = computed(() => {
  return balanceRowForBase.value ? Number(balanceRowForBase.value.amount ?? 0) : 0;
});

const availableUsdForBase = computed<number | null>(() => {
  return balanceRowForBase.value?.usdValue ?? null;
});

const rateUsdForBase = computed<number | null>(() => {
  return balanceRowForBase.value?.rateUsd ?? null;
});

const cryptoAmountFromUsdInput = computed(() => {
  if (displayMode.value === "crypto") return amount.value;

  const usd = Number(amount.value);
  const rate = rateUsdForBase.value;
  if (!amount.value || !Number.isFinite(usd) || !rate) return "";

  return (usd / rate).toFixed(8);
});
```

- [ ] **Step 3: Toggle the "Available" line**

Replace:

```html
<div class="text-sm text-nuxt-muted">
  Available: <span class="font-mono text-nuxt-text">{{ availableForBase }}</span>
  {{ base }}
</div>
```

with:

```html
<div class="text-sm text-nuxt-muted">
  Available:
  <span class="font-mono text-nuxt-text">
    {{ displayMode === "usd" ? formatUsd(availableUsdForBase) : `${availableForBase} ${base}` }}
  </span>
</div>
```

- [ ] **Step 4: Toggle the amount input label/placeholder and add a conversion preview**

Replace:

```html
<div>
  <label class="text-sm text-nuxt-muted">Amount</label>
  <input
    v-model="amount"
    type="text"
    inputmode="decimal"
    placeholder="0.00"
    class="mt-2 w-full rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm text-nuxt-text outline-none focus:ring-2 focus:ring-nuxt-green/50"
  />
</div>
```

with:

```html
<div>
  <label class="text-sm text-nuxt-muted">
    {{ displayMode === "usd" ? "Amount (USD)" : "Amount" }}
  </label>
  <input
    v-model="amount"
    type="text"
    inputmode="decimal"
    :placeholder="displayMode === 'usd' ? '$0.00' : '0.00'"
    class="mt-2 w-full rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm text-nuxt-text outline-none focus:ring-2 focus:ring-nuxt-green/50"
  />
  <p v-if="displayMode === 'usd' && amount" class="mt-1.5 text-xs text-nuxt-muted">
    <template v-if="rateUsdForBase">
      ≈ {{ cryptoAmountFromUsdInput || "0" }} {{ base }}
    </template>
    <template v-else>
      Live rate unavailable, try again
    </template>
  </p>
</div>
```

- [ ] **Step 5: Disable submit when USD mode has no usable rate**

Replace:

```html
<button
  class="w-full rounded-lg bg-nuxt-green px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
  :disabled="loading || !me || !amount || !address"
  @click="submitWithdraw"
>
```

with:

```html
<button
  class="w-full rounded-lg bg-nuxt-green px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
  :disabled="loading || !me || !amount || !address || (displayMode === 'usd' && !rateUsdForBase)"
  @click="submitWithdraw"
>
```

- [ ] **Step 6: Submit the converted crypto amount, not the raw input**

Replace:

```ts
async function submitWithdraw() {
  if (!me.value) return;

  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    result.value = await $fetch("/api/withdraw", {
      method: "POST",
      body: { assetKey: selected.value, amount: amount.value, address: address.value },
    });

    amount.value = "";
    address.value = "";

    await Promise.all([loadWithdrawals(), loadDashboard()]);
  } catch (e: any) {
    error.value =
      e?.data?.message ||
      e?.data?.statusMessage ||
      e?.message ||
      "Withdrawal failed";
  } finally {
    loading.value = false;
  }
}
```

with:

```ts
async function submitWithdraw() {
  if (!me.value) return;

  const amountToSend =
    displayMode.value === "usd" ? cryptoAmountFromUsdInput.value : amount.value;

  if (!amountToSend) {
    error.value = "Unable to determine withdrawal amount.";
    return;
  }

  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    result.value = await $fetch("/api/withdraw", {
      method: "POST",
      body: { assetKey: selected.value, amount: amountToSend, address: address.value },
    });

    amount.value = "";
    address.value = "";

    await Promise.all([loadWithdrawals(), loadDashboard()]);
  } catch (e: any) {
    error.value =
      e?.data?.message ||
      e?.data?.statusMessage ||
      e?.message ||
      "Withdrawal failed";
  } finally {
    loading.value = false;
  }
}
```

- [ ] **Step 7: Toggle the Recent Withdrawals amount column**

Replace:

```html
<td class="whitespace-nowrap px-3 py-3 text-right font-medium">
  {{ w.amount }}
</td>
```

with:

```html
<td class="whitespace-nowrap px-3 py-3 text-right font-medium">
  {{ displayMode === "usd" ? formatUsd(w.usdValue) : w.amount }}
</td>
```

- [ ] **Step 8: Verify in the browser**

Open `http://localhost:3000/withdraw` for a user with a non-zero balance in at least one asset. With the checkbox unchecked (USD mode):
1. "Available" shows a dollar figure.
2. Amount field label reads "Amount (USD)" with a `$0.00` placeholder.
3. Typing a number shows a "≈ X.XXXXXXXX ASSET" preview beneath the field.
4. Recent Withdrawals "Amount" column shows dollar figures.
5. Submit a small test withdrawal and confirm in the "Raw response" `<details>` block that the amount actually sent to the API matches the previewed crypto conversion (compare against the preview shown just before submitting).

Check the checkbox (crypto mode) and confirm:
1. "Available" shows `<amount> <ASSET>`.
2. Amount field label reverts to "Amount" with `0.00` placeholder, no conversion preview shown.
3. Recent Withdrawals "Amount" column shows crypto amounts as before.

- [ ] **Step 9: Commit**

```bash
git add app/pages/withdraw.vue
git commit -m "$(cat <<'EOF'
Wire USD/crypto toggle into Withdraw page

Available balance and history table toggle between USD and crypto. In
USD mode the amount field accepts a dollar figure, converts to crypto
client-side via the live rate already returned on the matching balance
entry, and shows a live conversion preview; the converted crypto
amount is what's actually sent to POST /api/withdraw, so that
endpoint's contract is unchanged. Submission is disabled if the live
rate is unavailable in USD mode, rather than allowing a broken
conversion through.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (toggle mechanism) → Tasks 5, 6. Section 2 (rate fetching) → Task 1. Section 3 (per-surface USD strategy) → Tasks 2, 3, 7, 8. Section 4 (USD withdrawal input) → Task 9. Section 5 (error handling) → built into Tasks 1 (never-throws util), 2/3 (null propagation), 9 (disabled submit on missing rate). The hero-total/stat-card crypto-mode resolution (per-asset chips, transaction counts instead of a summed crypto figure) is covered in Task 7.
- **Type consistency check:** `usdValue: number | null` and `rateUsd: number | null` are used identically in Tasks 2, 3, 7, 8, 9. `getRatesUsd()`'s return type (`Map<string, number>`) matches its usage (`rates.get(asset) ?? null`) in every consuming task. `WithdrawalHistoryItem.usdValue` (Task 9) matches the field added server-side in Task 3.
- **No placeholders:** every step has complete, concrete code — no TBD/TODO/"add error handling" left in.
