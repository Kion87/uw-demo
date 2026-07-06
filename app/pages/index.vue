<script setup lang="ts">
import {
  formatUsd,
  formatCrypto,
  formatDepositProgress,
  estimateRequestedFiatPaid,
} from "~/shared/format";

const displayMode = useDisplayMode();

const loading = ref(true);
const error = ref<string | null>(null);
const dashboard = ref<any>(null);

async function loadDashboard() {
  loading.value = true;
  error.value = null;

  try {
    dashboard.value = await $fetch("/api/dashboard");
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Failed to load dashboard";
  } finally {
    loading.value = false;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function copyText(value?: string | null) {
  if (!value) return;
  navigator.clipboard.writeText(value);
}

const ASSET_BADGE: Record<string, { bg: string; glyph: string; fg: string }> = {
  BTC: { bg: "bg-nuxt-orange", glyph: "₿", fg: "text-black" },
  ETH: { bg: "bg-nuxt-violet", glyph: "Ξ", fg: "text-black" },
  USDT: { bg: "bg-nuxt-emerald", glyph: "₮", fg: "text-black" },
};

function assetBadge(asset: string) {
  return (
    ASSET_BADGE[asset] ?? {
      bg: "bg-nuxt-muted",
      glyph: asset.slice(0, 1),
      fg: "text-black",
    }
  );
}

function pillClass(status?: string | null) {
  if (status === "completed" || status === "confirmed" || status === "complete") {
    return "bg-nuxt-emerald/15 text-nuxt-emerald";
  }
  if (status === "failed") {
    return "bg-rose-500/15 text-rose-400";
  }
  if (status === "underpaid") {
    return "bg-nuxt-orange/15 text-nuxt-orange";
  }
  if (status === "new") {
    return "bg-nuxt-violet/15 text-nuxt-violet";
  }
  return "bg-nuxt-gold/15 text-nuxt-gold";
}

function activityAmountClass(row: any) {
  if (row?.requestedAmount !== null && row?.requestedAmount !== undefined) {
    return "text-nuxt-muted2";
  }
  return row?.type === "withdrawal" ? "text-nuxt-muted2" : "text-nuxt-emerald";
}

function activityAmountSign(type?: string | null) {
  return type === "withdrawal" ? "−" : "+";
}

function activityAmountText(row: any) {
  if (row?.requestedAmount !== null && row?.requestedAmount !== undefined) {
    if (displayMode.value === "usd" && row.requestedFiatAmount != null) {
      const paidUsd = estimateRequestedFiatPaid(
        row.amount,
        row.requestedAmount,
        row.requestedFiatAmount,
      );
      return formatDepositProgress(
        paidUsd,
        Number(row.requestedFiatAmount),
        formatUsd,
      );
    }

    return formatDepositProgress(row.amount, row.requestedAmount);
  }

  const value =
    displayMode.value === "usd"
      ? formatUsd(row?.usdValue)
      : formatCrypto(row?.amount);

  return `${activityAmountSign(row?.type)}${value}`;
}

onMounted(loadDashboard);
</script>

<template>
  <div class="space-y-8">
    <section>
      <h1 class="font-display text-[34px] font-bold tracking-tight text-nuxt-text">
        Dashboard
      </h1>
      <p class="mt-1.5 text-[15px] text-nuxt-muted">
        Your balances, deposits, and activity at a glance.
      </p>
    </section>

    <div
      v-if="loading"
      class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6 text-nuxt-muted"
    >
      Loading dashboard...
    </div>

    <div
      v-else-if="error"
      class="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300"
    >
      {{ error }}
    </div>

    <template v-else>
      <!-- Total Balance hero -->
      <section
        class="relative overflow-hidden rounded-[18px] border border-nuxt-gold/30 bg-gradient-to-br from-nuxt-heroFrom to-nuxt-heroTo p-6 sm:p-9 sm:px-10"
      >
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

        <div class="relative mt-6 flex flex-wrap gap-3">
          <div
            v-for="balance in dashboard?.balances"
            :key="balance.asset"
            class="flex items-center gap-2.5 rounded-xl border px-4 py-2.5"
            :class="
              balance.credited && (displayMode !== 'usd' || balance.usdValue !== null)
                ? 'border-white/10 bg-white/[0.06]'
                : 'border-dashed border-white/10 bg-white/[0.03] opacity-60'
            "
          >
            <div
              class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              :class="[assetBadge(balance.asset).bg, assetBadge(balance.asset).fg]"
            >
              {{ assetBadge(balance.asset).glyph }}
            </div>
            <div>
              <div class="text-[11px] text-nuxt-muted2">
                {{ balance.label }}
              </div>
              <div class="font-mono text-[15px] font-semibold text-nuxt-text">
                {{ displayMode === "usd" ? formatUsd(balance.usdValue) : `${formatCrypto(balance.amount)} ${balance.asset}` }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Stat grid -->
      <section class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-5 px-6">
          <p class="text-[12.5px] text-nuxt-muted2">Total deposits</p>
          <p class="mt-2 font-display text-[28px] font-bold text-nuxt-text">
            {{ displayMode === "usd" ? formatUsd(dashboard?.stats?.totalDepositsUsd) : (dashboard?.stats?.totalDepositsCount ?? 0) }}
          </p>
          <p class="mt-2 text-xs font-semibold text-nuxt-emerald">
            {{ displayMode === "usd" ? `↑ ${dashboard?.stats?.totalDepositsCount ?? 0} transactions` : "deposits" }}
          </p>
        </div>

        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-5 px-6">
          <p class="text-[12.5px] text-nuxt-muted2">Total withdrawals</p>
          <p class="mt-2 font-display text-[28px] font-bold text-nuxt-text">
            {{ displayMode === "usd" ? formatUsd(dashboard?.stats?.totalWithdrawalsUsd) : (dashboard?.stats?.totalWithdrawalsCount ?? 0) }}
          </p>
          <p class="mt-2 text-xs font-semibold text-nuxt-muted2">
            {{ displayMode === "usd" ? `${dashboard?.stats?.totalWithdrawalsCount ?? 0} transactions` : "withdrawals" }}
          </p>
        </div>

        <div class="rounded-2xl border border-nuxt-gold/30 bg-nuxt-panel p-5 px-6">
          <p class="text-[12.5px] text-nuxt-muted2">Pending deposits</p>
          <p class="mt-2 font-display text-[28px] font-bold text-nuxt-text">
            {{ dashboard?.stats?.pendingDepositsCount ?? 0 }}
          </p>
          <p class="mt-2 text-xs font-semibold text-nuxt-gold">
            {{ (dashboard?.stats?.pendingDepositsCount ?? 0) > 0 ? "Awaiting confirmation" : "No pending deposits" }}
          </p>
        </div>

        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-5 px-6">
          <p class="text-[12.5px] text-nuxt-muted2">Assigned addresses</p>
          <p class="mt-2 font-display text-[28px] font-bold text-nuxt-text">
            {{ dashboard?.stats?.assignedAddressesCount ?? 0 }}
          </p>
          <p class="mt-2 text-xs font-semibold text-nuxt-muted2">
            {{ dashboard?.stats?.assignedAddressesNetworks }}
          </p>
        </div>
      </section>

      <!-- Recent activity -->
      <section class="rounded-2xl border border-nuxt-border bg-nuxt-panel py-2">
        <div class="flex items-baseline justify-between gap-4 px-6 pb-3 pt-5">
          <div>
            <h3 class="font-display text-[19px] font-bold text-nuxt-text">
              Recent activity
            </h3>
            <p class="mt-1 text-[13px] text-nuxt-muted2">
              Latest deposits and withdrawals across all assets.
            </p>
          </div>
        </div>

        <div v-if="dashboard?.recentActivity?.length">
          <!-- Table (sm and up) -->
          <div class="hidden sm:block">
            <div
              class="grid grid-cols-[1.2fr_1fr_1fr_1fr_100px] border-t border-white/[0.06] px-6 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.05em] text-nuxt-muted2"
            >
              <span>Type</span>
              <span>Amount</span>
              <span>Asset</span>
              <span>Date</span>
              <span class="justify-self-end">Status</span>
            </div>

            <div
              v-for="row in dashboard.recentActivity"
              :key="row.id"
              class="grid grid-cols-[1.2fr_1fr_1fr_1fr_100px] items-center border-t border-white/[0.06] px-6 py-3.5"
            >
              <span class="text-[13.5px] font-semibold capitalize text-nuxt-text">
                {{ row.type }}
              </span>
              <span class="text-[13.5px]" :class="activityAmountClass(row)">
                {{ activityAmountText(row) }}
              </span>
              <span class="text-[13.5px] text-nuxt-muted2">{{ row.asset }}</span>
              <span class="text-[12.5px] text-nuxt-muted2">
                {{ formatShortDate(row.createdAt) }}
              </span>
              <span
                class="justify-self-end rounded-full px-2.5 py-1 text-[11px] font-bold capitalize"
                :class="pillClass(row.status)"
              >
                {{ row.status }}
              </span>
            </div>
          </div>

          <!-- Stacked cards (below sm) -->
          <div class="space-y-2 px-4 py-2 sm:hidden">
            <div
              v-for="row in dashboard.recentActivity"
              :key="row.id"
              class="rounded-xl border border-nuxt-border bg-nuxt-bg/40 p-4"
            >
              <div class="flex items-center justify-between">
                <span class="text-[13.5px] font-semibold capitalize text-nuxt-text">
                  {{ row.type }}
                </span>
                <span
                  class="rounded-full px-2.5 py-1 text-[11px] font-bold capitalize"
                  :class="pillClass(row.status)"
                >
                  {{ row.status }}
                </span>
              </div>
              <div class="mt-2 flex items-center justify-between text-[13.5px]">
                <span :class="activityAmountClass(row)">
                  {{ activityAmountText(row) }} {{ row.asset }}
                </span>
                <span class="text-[12.5px] text-nuxt-muted2">
                  {{ formatShortDate(row.createdAt) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="px-6 py-6 text-nuxt-muted2">
          No activity yet.
        </div>
      </section>

      <!-- Assigned addresses (compact) -->
      <section class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
        <h3 class="font-display text-lg font-bold text-nuxt-text">
          Assigned addresses
        </h3>
        <p class="mt-1 text-sm text-nuxt-muted2">
          Current reusable addresses assigned to your account.
        </p>

        <div v-if="dashboard?.addresses?.length" class="mt-4 space-y-2">
          <div
            v-for="row in dashboard.addresses"
            :key="row.assetKey + row.address"
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-nuxt-border bg-nuxt-bg/40 p-3"
          >
            <div class="min-w-0">
              <p class="text-xs text-nuxt-muted2">
                {{ row.networkLabel }} · assigned {{ formatDate(row.createdAt) }}
              </p>
              <code class="block truncate text-sm text-nuxt-text">
                {{ row.address }}
              </code>
            </div>

            <button
              class="shrink-0 rounded-lg border border-nuxt-border bg-nuxt-panel px-3 py-1.5 text-xs font-semibold text-nuxt-text hover:opacity-90"
              @click="copyText(row.address)"
            >
              Copy
            </button>
          </div>
        </div>

        <div
          v-else
          class="mt-4 rounded-xl border border-dashed border-nuxt-border p-4 text-sm text-nuxt-muted2"
        >
          No assigned addresses yet. Create one from the Deposit tab.
        </div>
      </section>
    </template>
  </div>
</template>
