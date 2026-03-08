<script setup lang="ts">
import { DEPOSIT_ASSETS, type DepositAssetKey } from "~/shared/deposits";

type BaseAsset = "BTC" | "ETH" | "USDT" | "USDC" | "TRX" | "SOL";

type DepositHistoryItem = {
  id: number;
  userId: number;
  asset: string;
  network: string;
  amount: string | null;
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

const me = ref<any>(null);

const base = ref<BaseAsset>("BTC");
const selected = ref<DepositAssetKey>("BTC");

const loading = ref(false);
const refreshing = ref(false);
const historyLoading = ref(false);
const error = ref<string | null>(null);
const historyError = ref<string | null>(null);
const result = ref<any>(null);

const deposits = ref<DepositHistoryItem[]>([]);
const copied = ref(false);

const BASE_TO_KEYS: Record<BaseAsset, DepositAssetKey[]> = {
  BTC: ["BTC"],
  ETH: ["ETH"],
  USDT: ["USDT_ERC20", "USDT_TRC20", "USDT_BEP20"],
  USDC: ["USDC_SPL", "USDC_ERC20"],
  TRX: ["TRX"],
  SOL: ["SOL"],
};

const networkOptions = computed(() => {
  const allowed = new Set(BASE_TO_KEYS[base.value] || []);
  return DEPOSIT_ASSETS.filter((a) => allowed.has(a.key));
});

watch(
  base,
  () => {
    const first = BASE_TO_KEYS[base.value]?.[0];
    if (first) selected.value = first;
    result.value = null;
    error.value = null;
    copied.value = false;
  },
  { immediate: true },
);

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function shortHash(value: string | null, start = 10, end = 8) {
  if (!value) return "—";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}
function displayStatus(status: string | null) {
  const s = String(status || "").toLowerCase();

  if (s.includes("pending")) return "Pending";
  if (s.includes("confirm") || s.includes("complete")) return "Complete";

  return status || "—";
}

function explorerUrl(network: string, txid: string | null) {
  if (!txid) return null;

  const n = String(network || "").toUpperCase();

  if (n === "BTC") {
    return `https://mempool.space/testnet/tx/${txid}`;
  }

  if (
    n === "ETH" ||
    n === "ETH_USDT" ||
    n === "USDT_ERC20" ||
    n === "USDC_ERC20"
  ) {
    return `https://sepolia.etherscan.io/tx/${txid}`;
  }

  if (n === "TRX" || n === "USDT_TRC20") {
    return `https://nile.tronscan.org/#/transaction/${txid}`;
  }

  if (n === "SOL" || n === "USDC_SPL") {
    return `https://solscan.io/tx/${txid}`;
  }

  return null;
}

async function copyText(value: string | null) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
}
async function copyAddress() {
  const addr = result.value?.deposit?.address;
  if (!addr) return;

  await navigator.clipboard.writeText(String(addr));
  copied.value = true;
  setTimeout(() => (copied.value = false), 900);
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

async function loadDeposits() {
  historyError.value = null;
  historyLoading.value = true;

  try {
    const res: any = await $fetch("/api/deposits");
    deposits.value = Array.isArray(res?.deposits) ? res.deposits : [];
  } catch (e: any) {
    deposits.value = [];
    historyError.value =
      e?.data?.message ||
      e?.data?.statusMessage ||
      e?.message ||
      "Failed to load deposit history";
  } finally {
    historyLoading.value = false;
  }
}

async function createDeposit() {
  if (!me.value) return;

  loading.value = true;
  error.value = null;
  result.value = null;
  copied.value = false;

  try {
    result.value = await $fetch("/api/deposit", {
      method: "POST",
      body: { assetKey: selected.value },
    });

    await loadDeposits();
  } catch (e: any) {
    error.value =
      e?.data?.message ||
      e?.data?.statusMessage ||
      e?.message ||
      "Deposit failed";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadMe();
  if (me.value) {
    await loadDeposits();
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
              <h1 class="text-xl font-semibold">Deposit</h1>
              <p class="mt-1 text-sm text-nuxt-muted">
                Create a Uniwire invoice and get a deposit address.
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

        <!-- Create deposit -->
        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
          <h2 class="text-lg font-semibold">Create Deposit</h2>
          <p class="mt-1 text-sm text-nuxt-muted">
            Select asset and network, then click Create Deposit.
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
                <div class="text-sm font-semibold">{{ b }}</div>
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
                    copied = false;
                  "
                  class="rounded-xl border px-3 py-3 text-left transition"
                  :class="
                    selected === a.key
                      ? 'border-nuxt-green bg-nuxt-green/10'
                      : 'border-nuxt-border bg-nuxt-bg'
                  "
                >
                  <div class="text-sm font-semibold">{{ a.label }}</div>
                </button>
              </div>
            </div>

            <button
              class="w-full rounded-lg bg-nuxt-green px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
              :disabled="loading || !me"
              @click="createDeposit"
            >
              {{ loading ? "Creating..." : "Create Deposit" }}
            </button>

            <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

            <div v-if="result" class="mt-2 space-y-3">
              <div class="text-sm">
                <div class="font-medium">Address</div>
                <div
                  class="mt-2 break-all rounded-lg border border-nuxt-border bg-nuxt-bg p-3"
                >
                  {{ result?.deposit?.address || "(no address returned)" }}
                </div>

                <div class="mt-2 flex items-center gap-2">
                  <button
                    class="rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-xs hover:opacity-90"
                    @click="copyAddress"
                  >
                    Copy
                  </button>
                  <span v-if="copied" class="text-xs text-nuxt-muted">
                    Copied
                  </span>
                  <span
                    v-if="result?.deposit?.reused"
                    class="text-xs text-nuxt-muted"
                  >
                    • Reused
                  </span>
                </div>
              </div>

              <details
                class="rounded-lg border border-nuxt-border bg-nuxt-bg p-3"
              >
                <summary class="cursor-pointer text-sm font-medium">
                  Raw response
                </summary>
                <pre class="mt-2 overflow-auto text-xs">{{ result }}</pre>
              </details>
            </div>
          </div>
        </div>

        <!-- Recent Deposits -->
        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">Recent Deposits</h2>
              <p class="mt-1 text-sm text-nuxt-muted">
                Your latest deposits received on assigned addresses.
              </p>
            </div>

            <button
              class="rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm hover:opacity-90 disabled:opacity-60"
              :disabled="historyLoading || !me"
              @click="loadDeposits"
            >
              {{ historyLoading ? "Loading..." : "Refresh history" }}
            </button>
          </div>

          <p v-if="historyError" class="mt-4 text-sm text-red-400">
            {{ historyError }}
          </p>

          <div v-else-if="historyLoading" class="mt-4 text-sm text-nuxt-muted">
            Loading deposit history...
          </div>

          <div
            v-else-if="!deposits.length"
            class="mt-4 rounded-xl border border-nuxt-border bg-nuxt-bg p-4 text-sm text-nuxt-muted"
          >
            No deposits yet.
          </div>

          <div v-else class="mt-4 overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="text-nuxt-muted">
                <tr class="border-b border-nuxt-border">
                  <th class="px-3 py-3 font-medium">Created</th>
                  <th class="px-3 py-3 font-medium">Asset</th>
                  <th class="px-3 py-3 font-medium">Amount</th>
                  <th class="px-3 py-3 font-medium">Status</th>
                  <th class="px-3 py-3 font-medium">TxID</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="d in deposits"
                  :key="d.id"
                  class="border-b border-nuxt-border/60 align-top"
                >
                  <td class="whitespace-nowrap px-3 py-3">
                    {{ formatDate(d.createdAt) }}
                  </td>

                  <td class="whitespace-nowrap px-3 py-3">
                    <div class="font-medium">{{ d.asset }}</div>
                  </td>

                  <td class="whitespace-nowrap px-3 py-3">
                    {{ d.amount ?? "—" }}
                  </td>

                  <td class="whitespace-nowrap px-3 py-3">
                    {{ displayStatus(d.status) }}
                  </td>

                  <td class="px-3 py-3">
                    <div class="flex items-center gap-2">
                      <span :title="d.txid || ''">
                        {{ shortHash(d.txid, 12, 8) }}
                      </span>

                      <button
                        v-if="d.txid"
                        class="rounded-md border border-nuxt-border bg-nuxt-bg px-2 py-1 text-xs hover:opacity-90"
                        @click="copyText(d.txid)"
                      >
                        Copy
                      </button>

                      <a
                        v-if="explorerUrl(d.network, d.txid)"
                        :href="explorerUrl(d.network, d.txid) || undefined"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-nuxt-green underline underline-offset-2"
                      >
                        Explorer
                      </a>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- RIGHT -->
      <aside class="lg:col-span-1">
        <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
          <h3 class="text-lg font-semibold">How it works</h3>

          <ul class="mt-4 space-y-2 text-sm text-nuxt-muted">
            <li>1) Pick an asset.</li>
            <li>2) Pick a network.</li>
            <li>
              3) Click <span class="text-nuxt-text">Create Deposit</span>.
            </li>
            <li>
              4) Server reuses an address from DB or creates one at Uniwire.
            </li>
            <li>5) Transaction callbacks update the deposit chronology.</li>
          </ul>

          <div
            class="mt-5 border-t border-nuxt-border pt-4 text-xs text-nuxt-muted"
          >
            Tip: leaving amount empty enables reusable-address flows.
          </div>

          <div
            class="mt-4 rounded-xl border border-nuxt-border bg-nuxt-bg p-3 text-xs text-nuxt-muted"
          >
            Uses env vars:
            <div class="mt-2 space-y-1 font-mono">
              <div>UNIWIRE_API_KEY</div>
              <div>UNIWIRE_API_SECRET</div>
              <div>UNIWIRE_PROFILE_ID</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
