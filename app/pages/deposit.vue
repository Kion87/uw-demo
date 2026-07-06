<script setup lang="ts">
import { DEPOSIT_ASSETS, type DepositAssetKey } from "~/shared/deposits";
import { formatCrypto, formatDepositProgress, formatUsd } from "~/shared/format";

const displayMode = useDisplayMode();

type BaseAsset = "BTC" | "ETH" | "USDT" | "USDC" | "TRX" | "SOL";

type DepositHistoryItem = {
  id: number;
  userId: number;
  asset: string;
  network: string;
  amount: string | null;
  requestedAmount: string | null;
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

const me = ref<any>(null);
const user = useState<any | null>("user");
const depositAmount = ref("");

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
const showRecentDeposits = ref(true);

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

function assetIconForBase(asset: BaseAsset) {
  return ASSET_ICONS[asset];
}

function assetIconForDeposit(asset: string) {
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

function displayStatus(status: string | null) {
  if (status === "invoice_pending" || status === "invoice_confirmed") return "Pending";
  if (status === "invoice_complete") return "Complete";
  if (status === "underpaid") return "Underpaid";

  const s = String(status || "").toLowerCase();

  if (s.includes("pending")) return "Pending";
  if (s.includes("confirm") || s.includes("complete")) return "Complete";

  return status || "—";
}

function amountCellText(d: DepositHistoryItem) {
  if (d.requestedAmount === null) {
    return displayMode.value === "usd"
      ? formatUsd(d.fiatAmount !== null ? Number(d.fiatAmount) : null)
      : (d.amount ?? "—");
  }

  return formatDepositProgress(d.amount, d.requestedAmount);
}

function explorerUrl(network: string, txid: string | null) {
  if (!txid) return null;

  const n = String(network || "").toUpperCase();

  if (n.includes("BTC")) {
    return `https://mempool.space/testnet/tx/${txid}`;
  }

  if (n.includes("ETH")) {
    return `https://sepolia.etherscan.io/tx/${txid}`;
  }

  if (n.includes("TRX") || n.includes("TRON")) {
    return `https://nile.tronscan.org/#/transaction/${txid}`;
  }

  if (n.includes("SOL")) {
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
      body: {
        assetKey: selected.value,
        ...(depositAmount.value ? { amount: depositAmount.value } : {}),
      },
    });

    depositAmount.value = "";
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
              <h1 class="font-display text-xl font-bold">Deposit</h1>
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
          <h2 class="font-display text-lg font-bold">Create Deposit</h2>
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
                    copied = false;
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

            <div v-if="user?.fixedAmountInvoices">
              <label class="text-sm text-nuxt-muted" for="deposit-amount">
                Amount (optional — leave blank for a reusable address)
              </label>
              <input
                id="deposit-amount"
                v-model="depositAmount"
                type="text"
                inputmode="decimal"
                placeholder="e.g. 0.05"
                class="mt-2 w-full rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-nuxt-text outline-none focus:ring-2 focus:ring-nuxt-green/50"
              />
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
              <h2 class="font-display text-lg font-bold">Recent Deposits</h2>
              <p class="mt-1 text-sm text-nuxt-muted">
                Your latest deposits received on assigned addresses.
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                class="rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm hover:opacity-90 disabled:opacity-60"
                :disabled="historyLoading || !me"
                @click="loadDeposits"
              >
                {{ historyLoading ? "Loading..." : "Refresh" }}
              </button>

              <button
                class="rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm hover:opacity-90"
                @click="showRecentDeposits = !showRecentDeposits"
              >
                {{ showRecentDeposits ? "Hide" : "Show" }}
              </button>
            </div>
          </div>

          <div v-if="showRecentDeposits">
            <p v-if="historyError" class="mt-4 text-sm text-red-400">
              {{ historyError }}
            </p>

            <div
              v-else-if="historyLoading"
              class="mt-4 text-sm text-nuxt-muted"
            >
              Loading deposit history...
            </div>

            <div
              v-else-if="!deposits.length"
              class="mt-4 rounded-xl border border-nuxt-border bg-nuxt-bg p-4 text-sm text-nuxt-muted"
            >
              No deposits yet.
            </div>

            <div v-else class="mt-4 overflow-x-auto">
              <table class="min-w-full table-fixed text-left text-sm">
                <thead class="text-nuxt-muted">
                  <tr class="border-b border-nuxt-border">
                    <th class="w-[26%] px-3 py-3 font-medium">Created</th>
                    <th class="w-[20%] px-3 py-3 font-medium">Asset</th>
                    <th class="w-[12%] px-3 py-3 text-right font-medium">
                      Amount
                    </th>
                    <th class="w-[14%] px-3 py-3 font-medium">Status</th>
                    <th class="w-[28%] px-3 py-3 font-medium">TxID</th>
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
                      <div class="flex items-center gap-3">
                        <img
                          v-if="assetIconForDeposit(d.asset)"
                          :src="assetIconForDeposit(d.asset) || undefined"
                          :alt="`${d.asset} logo`"
                          class="h-5 w-5 rounded-full object-contain"
                        />
                        <div class="font-medium">{{ d.asset }}</div>
                      </div>
                    </td>

                    <td
                      class="whitespace-nowrap px-3 py-3 text-right font-medium"
                    >
                      {{ amountCellText(d) }}
                    </td>

                    <td class="whitespace-nowrap px-3 py-3">
                      {{ displayStatus(d.status) }}
                    </td>

                    <td class="px-3 py-3">
                      <div class="flex items-center justify-between gap-3">
                        <span class="truncate" :title="d.txid || ''">
                          {{ shortHash(d.txid, 12, 8) }}
                        </span>

                        <div class="flex items-center gap-2 shrink-0">
                          <button
                            v-if="d.txid"
                            type="button"
                            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-nuxt-border bg-nuxt-bg text-nuxt-muted transition hover:text-nuxt-text hover:opacity-90"
                            :title="`Copy ${d.txid}`"
                            @click="copyText(d.txid)"
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
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path
                                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                              />
                            </svg>
                          </button>

                          <a
                            v-if="explorerUrl(d.network, d.txid)"
                            :href="explorerUrl(d.network, d.txid) || undefined"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-nuxt-border bg-nuxt-bg text-nuxt-muted transition hover:text-nuxt-green hover:opacity-90"
                            :title="`Open transaction in explorer`"
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
                              <path d="M14 3h7v7" />
                              <path d="M10 14L21 3" />
                              <path
                                d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"
                              />
                            </svg>
                          </a>
                        </div>
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
          <template v-if="user?.fixedAmountInvoices">
            <li>1) Pick an asset and network, and enter the amount you're requesting.</li>
            <li>
              2) The server creates a one-off Uniwire invoice for that exact
              amount and returns a deposit address for it.
            </li>
            <li>
              3) Uniwire sends invoice callbacks as the invoice is paid.
              <span class="text-nuxt-text">invoice_confirmed</span> or
              <span class="text-nuxt-text">invoice_complete</span> means it's
              fully paid — credit the client then.
            </li>
            <li>
              4) If less than the requested amount arrives, you'll get
              <span class="text-nuxt-text">invoice_incomplete</span> instead.
              The requested vs. paid amounts shown here tell you exactly how
              much more the client still owes.
            </li>
            <li>
              5) To tolerate small underpayments (e.g. network fee slippage)
              as if fully paid, enable an
              <span class="text-nuxt-text">Acceptance Range</span> on your
              Uniwire configuration profile.
            </li>
          </template>
          <template v-else>
            <li>1) Pick an asset and network.</li>
            <li>
              2) Click <span class="text-nuxt-text">Create Deposit</span> —
              the server returns your existing address for this asset, or
              creates a new one at Uniwire.
            </li>
            <li>
              3) Send crypto on-chain to that address. It stays reusable, so
              the same address can receive multiple deposits over time.
            </li>
            <li>
              4) Uniwire sends transaction callbacks as the deposit moves from
              pending to confirmed.
            </li>
            <li>
              5) Each callback is signature-verified and matched by Uniwire's
              transaction id — not the invoice — so it's safe against webhook
              retries.
            </li>
          </template>
        </template>

        <template #under-the-hood>
          <template v-if="user?.fixedAmountInvoices">
            <li>
              Each invoice callback carries the amount actually paid so far,
              which is stored alongside the requested amount — so "paid vs.
              due" always matches what Uniwire itself confirmed, without
              needing to check the Uniwire dashboard.
            </li>
            <li>
              <span class="text-nuxt-text">invoice_incomplete</span> is stored
              as <span class="text-nuxt-text">underpaid</span> here, since
              "incomplete" would otherwise collide with our substring-based
              status matching for "complete".
            </li>
          </template>
          <template v-else>
            <li>
              Two-layer idempotency: the callback delivery is logged first
              (dedupes retries), then the deposit row is upserted by
              transaction id.
            </li>
            <li>
              The USD value shown is Uniwire's own quote for that specific
              transaction, captured at callback time — not a live rate — so it
              always matches what was actually quoted.
            </li>
          </template>
        </template>

        <template #extra>
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
        </template>
      </HowItWorksPanel>
    </div>
  </div>
</template>
