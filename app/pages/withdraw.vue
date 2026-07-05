<script setup lang="ts">
import { DEPOSIT_ASSETS, type DepositAssetKey } from "~/shared/deposits";
import { formatUsd } from "~/shared/format";

type BaseAsset = "BTC" | "ETH" | "USDT" | "USDC" | "TRX" | "SOL";

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

const me = ref<any>(null);
const dashboard = ref<any>(null);

const base = ref<BaseAsset>("BTC");
const selected = ref<DepositAssetKey>("BTC");

const amount = ref("");
const address = ref("");

const loading = ref(false);
const refreshing = ref(false);
const historyLoading = ref(false);
const error = ref<string | null>(null);
const historyError = ref<string | null>(null);
const result = ref<any>(null);

const withdrawals = ref<WithdrawalHistoryItem[]>([]);
const showRecentWithdrawals = ref(true);

const BASE_TO_KEYS: Record<BaseAsset, DepositAssetKey[]> = {
  BTC: ["BTC"],
  ETH: ["ETH"],
  USDT: ["USDT_ERC20", "USDT_TRC20", "USDT_BEP20"],
  USDC: ["USDC_SPL", "USDC_ERC20"],
  TRX: ["TRX"],
  SOL: ["SOL"],
};

const ASSET_ICONS: Record<BaseAsset, string> = {
  BTC: "/coins/btc.png",
  ETH: "/coins/eth.png",
  USDT: "/coins/usdt.png",
  USDC: "/coins/usdc.png",
  TRX: "/coins/trx.png",
  SOL: "/coins/sol.png",
};

const networkOptions = computed(() => {
  const allowed = new Set(BASE_TO_KEYS[base.value] || []);
  return DEPOSIT_ASSETS.filter((a) => allowed.has(a.key));
});

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

watch(
  base,
  () => {
    const first = BASE_TO_KEYS[base.value]?.[0];
    if (first) selected.value = first;
    result.value = null;
    error.value = null;
  },
  { immediate: true },
);

watch(displayMode, () => {
  amount.value = "";
});

function assetIconForBase(asset: BaseAsset) {
  return ASSET_ICONS[asset];
}

function assetIconForWithdrawal(asset: string) {
  const a = String(asset || "").toUpperCase();

  if (a === "BTC") return "/coins/btc.png";
  if (a === "ETH") return "/coins/eth.png";
  if (a === "USDT") return "/coins/usdt.png";
  if (a === "USDC") return "/coins/usdc.png";
  if (a === "TRX") return "/coins/trx.png";
  if (a === "SOL") return "/coins/sol.png";

  return null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function shortHash(value: string | null, start = 10, end = 8) {
  if (!value) return "—";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function statusLabel(status: string) {
  if (status === "reserved") return "Processing";
  if (status === "pending") return "Pending";
  if (status === "initialized") return "Initialized";
  if (status === "confirmed") return "Confirmed";
  if (status === "complete") return "Complete";
  if (status === "rejected") return "Rejected";
  if (status === "failed") return "Failed";
  return status;
}

function statusClass(status: string) {
  if (status === "confirmed" || status === "complete") {
    return "bg-nuxt-emerald/15 text-nuxt-emerald";
  }
  if (status === "rejected" || status === "failed") {
    return "bg-rose-500/15 text-rose-400";
  }
  return "bg-nuxt-gold/15 text-nuxt-gold";
}

async function copyText(value: string | null) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
}

async function loadMe() {
  error.value = null;
  refreshing.value = true;

  try {
    const res: any = await $fetch("/api/me");
    me.value = res?.user ?? null;
  } catch {
    me.value = null;
  } finally {
    setTimeout(() => {
      refreshing.value = false;
    }, 300);
  }
}

async function loadDashboard() {
  try {
    dashboard.value = await $fetch("/api/dashboard");
  } catch {
    dashboard.value = null;
  }
}

async function loadWithdrawals() {
  historyError.value = null;
  historyLoading.value = true;

  try {
    const res: any = await $fetch("/api/withdrawals");
    withdrawals.value = Array.isArray(res?.withdrawals) ? res.withdrawals : [];
  } catch (e: any) {
    withdrawals.value = [];
    historyError.value =
      e?.data?.message ||
      e?.data?.statusMessage ||
      e?.message ||
      "Failed to load withdrawal history";
  } finally {
    historyLoading.value = false;
  }
}

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

onMounted(async () => {
  await loadMe();
  if (me.value) {
    await Promise.all([loadDashboard(), loadWithdrawals()]);
  }
});
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-10">
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- LEFT -->
      <div class="space-y-6 lg:col-span-2">
        <!-- Session card -->
        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="font-display text-xl font-bold">Withdraw</h1>
              <p class="mt-1 text-sm text-nuxt-muted">
                Request a payout and track status updates.
              </p>
            </div>

            <button
              class="rounded-lg border border-nuxt-border px-3 py-2 text-sm transition-colors duration-100 hover:opacity-30 disabled:opacity-60"
              :class="refreshing ? 'bg-nuxt-green/20' : 'bg-nuxt-bg'"
              :disabled="refreshing"
              @click="loadMe"
            >
              Refresh
            </button>
          </div>

          <div class="mt-4 text-sm">
            <div v-if="me">
              Logged in as <span class="font-medium">{{ me.email }}</span>
              <span class="text-nuxt-muted"> • </span>
              <span class="text-nuxt-muted">ID</span>
              <span class="ml-1 font-semibold">{{ me.publicId }}</span>
            </div>
            <div v-else class="text-red-400">
              Not logged in (use the signup/login flow first).
            </div>
          </div>
        </div>

        <!-- Create withdrawal -->
        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
          <h2 class="font-display text-lg font-bold">Request Withdrawal</h2>
          <p class="mt-1 text-sm text-nuxt-muted">
            Select asset and network, enter amount and destination.
          </p>

          <div class="mt-5 space-y-4">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                v-for="b in ['BTC', 'ETH', 'USDT', 'USDC', 'TRX', 'SOL']"
                :key="b"
                type="button"
                @click="base = b as BaseAsset"
                class="rounded-xl border px-3 py-3 text-left transition"
                :class="
                  base === b
                    ? 'border-nuxt-green bg-nuxt-green/10'
                    : 'border-nuxt-border bg-nuxt-bg'
                "
              >
                <div class="flex items-center gap-3">
                  <img
                    :src="assetIconForBase(b as BaseAsset)"
                    :alt="`${b} logo`"
                    class="h-7 w-7 rounded-full object-contain"
                  />
                  <div class="text-sm font-semibold">{{ b }}</div>
                </div>
              </button>
            </div>

            <div>
              <div class="text-sm text-nuxt-muted">Network</div>

              <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  v-for="a in networkOptions"
                  :key="a.key"
                  type="button"
                  @click="
                    selected = a.key;
                    result = null;
                    error = null;
                  "
                  class="rounded-xl border px-3 py-3 text-left transition"
                  :class="
                    selected === a.key
                      ? 'border-nuxt-green bg-nuxt-green/10'
                      : 'border-nuxt-border bg-nuxt-bg'
                  "
                >
                  <div class="flex items-center gap-3">
                    <img
                      :src="assetIconForBase(base)"
                      :alt="`${base} logo`"
                      class="h-7 w-7 rounded-full object-contain"
                    />
                    <div class="text-sm font-semibold">{{ a.label }}</div>
                  </div>
                </button>
              </div>
            </div>

            <div class="text-sm text-nuxt-muted">
              Available:
              <span class="font-mono text-nuxt-text">
                {{ displayMode === "usd" ? formatUsd(availableUsdForBase) : `${availableForBase} ${base}` }}
              </span>
            </div>

            <div>
              <label class="text-sm text-nuxt-muted">
                {{ displayMode === "usd" ? "Amount (USD)" : "Amount" }}
              </label>
              <input
                v-model="amount"
                type="text"
                inputmode="decimal"
                :placeholder="displayMode === 'usd' ? '$0.00' : '0.00'"
                :disabled="displayMode === 'usd' && !rateUsdForBase"
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

            <div>
              <label class="text-sm text-nuxt-muted">Destination address</label>
              <input
                v-model="address"
                type="text"
                placeholder="Recipient address"
                class="mt-2 w-full rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm text-nuxt-text outline-none focus:ring-2 focus:ring-nuxt-green/50"
              />
            </div>

            <button
              class="w-full rounded-lg bg-nuxt-green px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
              :disabled="loading || !me || !amount || !address || (displayMode === 'usd' && !rateUsdForBase)"
              @click="submitWithdraw"
            >
              {{ loading ? "Submitting..." : "Request Withdrawal" }}
            </button>

            <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

            <div v-if="result" class="mt-2 space-y-3">
              <div class="text-sm">
                <div class="font-medium">Withdrawal submitted</div>
                <div
                  class="mt-2 break-all rounded-lg border border-nuxt-border bg-nuxt-bg p-3"
                >
                  Status: {{ statusLabel(result?.withdrawal?.status) }}
                </div>
              </div>

              <details class="rounded-lg border border-nuxt-border bg-nuxt-bg p-3">
                <summary class="cursor-pointer text-sm font-medium">
                  Raw response
                </summary>
                <pre class="mt-2 overflow-auto text-xs">{{ result }}</pre>
              </details>
            </div>
          </div>
        </div>

        <!-- Recent Withdrawals -->
        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-display text-lg font-bold">Recent Withdrawals</h2>
              <p class="mt-1 text-sm text-nuxt-muted">
                Your latest payout requests and their status.
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                class="rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm hover:opacity-90 disabled:opacity-60"
                :disabled="historyLoading || !me"
                @click="loadWithdrawals"
              >
                {{ historyLoading ? "Loading..." : "Refresh" }}
              </button>

              <button
                class="rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm hover:opacity-90"
                @click="showRecentWithdrawals = !showRecentWithdrawals"
              >
                {{ showRecentWithdrawals ? "Hide" : "Show" }}
              </button>
            </div>
          </div>

          <div v-if="showRecentWithdrawals">
            <p v-if="historyError" class="mt-4 text-sm text-red-400">
              {{ historyError }}
            </p>

            <div
              v-else-if="historyLoading"
              class="mt-4 text-sm text-nuxt-muted"
            >
              Loading withdrawal history...
            </div>

            <div
              v-else-if="!withdrawals.length"
              class="mt-4 rounded-xl border border-nuxt-border bg-nuxt-bg p-4 text-sm text-nuxt-muted"
            >
              No withdrawals yet.
            </div>

            <div v-else class="mt-4 overflow-x-auto">
              <table class="min-w-full table-fixed text-left text-sm">
                <thead class="text-nuxt-muted">
                  <tr class="border-b border-nuxt-border">
                    <th class="w-[20%] px-3 py-3 font-medium">Created</th>
                    <th class="w-[14%] px-3 py-3 font-medium">Asset</th>
                    <th class="w-[12%] px-3 py-3 text-right font-medium">
                      Amount
                    </th>
                    <th class="w-[24%] px-3 py-3 font-medium">Destination</th>
                    <th class="w-[12%] px-3 py-3 font-medium">Status</th>
                    <th class="w-[18%] px-3 py-3 font-medium">TxID</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="w in withdrawals"
                    :key="w.id"
                    class="border-b border-nuxt-border/60 align-top"
                  >
                    <td class="whitespace-nowrap px-3 py-3">
                      {{ formatDate(w.createdAt) }}
                    </td>

                    <td class="whitespace-nowrap px-3 py-3">
                      <div class="flex items-center gap-3">
                        <img
                          v-if="assetIconForWithdrawal(w.asset)"
                          :src="assetIconForWithdrawal(w.asset) || undefined"
                          :alt="`${w.asset} logo`"
                          class="h-5 w-5 rounded-full object-contain"
                        />
                        <div class="font-medium">{{ w.asset }}</div>
                      </div>
                    </td>

                    <td class="whitespace-nowrap px-3 py-3 text-right font-medium">
                      {{ displayMode === "usd" ? formatUsd(w.usdValue) : w.amount }}
                    </td>

                    <td class="px-3 py-3">
                      <span class="truncate" :title="w.destinationAddress">
                        {{ shortHash(w.destinationAddress, 10, 6) }}
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-3">
                      <span
                        class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        :class="statusClass(w.status)"
                      >
                        {{ statusLabel(w.status) }}
                      </span>
                    </td>

                    <td class="px-3 py-3">
                      <div class="flex items-center justify-between gap-3">
                        <span class="truncate" :title="w.txid || ''">
                          {{ shortHash(w.txid, 10, 6) }}
                        </span>

                        <button
                          v-if="w.txid"
                          type="button"
                          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-nuxt-border bg-nuxt-bg text-nuxt-muted transition hover:text-nuxt-text hover:opacity-90"
                          :title="`Copy ${w.txid}`"
                          @click="copyText(w.txid)"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="h-4 w-4"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path
                              d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT -->
      <HowItWorksPanel>
        <template #steps>
          <li>
            1) Pick an asset, network, and amount (checked against your
            available balance).
          </li>
          <li>
            2) Click <span class="text-nuxt-text">Request Withdrawal</span> —
            the server reserves the balance atomically and generates its own
            reference id before contacting Uniwire.
          </li>
          <li>
            3) A timeout or network error from Uniwire is treated as
            ambiguous, not failed — the reservation is kept and one retry is
            attempted with the same reference id.
          </li>
          <li>
            4) Uniwire sends payout callbacks, matched back to this
            withdrawal by that reference id.
          </li>
          <li>
            5) Status moves from pending to confirmed and then complete as
            on-chain confirmations accumulate, or to rejected/failed if
            Uniwire declines the payout outright.
          </li>
        </template>

        <template #under-the-hood>
          <li>
            Status lifecycle: Pending → Initialized → Confirmed → Complete
            (or Rejected / Failed).
          </li>
          <li>
            Available balance is recomputed live from completed deposits
            minus non-rejected/non-failed withdrawals on every request —
            never a stored counter, so nothing can double-apply a credit.
          </li>
          <li>
            USD values here use today's live exchange rate, unlike deposit
            history's frozen quote — a rate-fetch failure shows "—", never
            $0.00.
          </li>
        </template>
      </HowItWorksPanel>
    </div>
  </div>
</template>
