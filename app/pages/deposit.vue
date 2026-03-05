<script setup lang="ts">
import { DEPOSIT_ASSETS, type DepositAssetKey } from "~/shared/deposits";

type BaseAsset = "BTC" | "ETH" | "USDT" | "USDC" | "TRX" | "SOL";

const me = ref<any>(null);

const base = ref<BaseAsset>("BTC");
const selected = ref<DepositAssetKey>("BTC");

const loading = ref(false);
const refreshing = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

const copied = ref(false);

const BASE_TO_KEYS: Record<BaseAsset, DepositAssetKey[]> = {
  BTC: ["BTC"], // later you can add "BTC_LN"
  ETH: ["ETH"],
  USDT: ["USDT_ERC20", "USDT_TRC20", "USDT_BEP20"], // add "USDT_TRC20", "USDT_BEP20", "USDT_SPL" when you have them
  USDC: ["USDC_SPL"],
  TRX: ["TRX"],
  SOL: ["SOL"],
};

const networkOptions = computed(() => {
  const allowed = new Set(BASE_TO_KEYS[base.value] || []);
  return DEPOSIT_ASSETS.filter((a) => allowed.has(a.key));
});

// When user clicks a base asset, automatically select the first available network for it
watch(
  base,
  () => {
    const first = BASE_TO_KEYS[base.value]?.[0];
    if (first) selected.value = first;
    // clear old result so user doesn't see wrong-chain address
    result.value = null;
    error.value = null;
    copied.value = false;
  },
  { immediate: true },
);

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

async function createDeposit() {
  if (!me.value) return;

  loading.value = true;
  error.value = null;
  result.value = null;
  copied.value = false;

  try {
    // Amount intentionally omitted (reusable address flow)
    result.value = await $fetch("/api/deposit", {
      method: "POST",
      body: { assetKey: selected.value },
    });
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

onMounted(loadMe);
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-10">
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- LEFT -->
      <div class="lg:col-span-2 space-y-6">
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
            <!-- Base asset tiles -->
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                v-for="b in [
                  'BTC',
                  'ETH',
                  'USDT',
                  'USDC',
                  'TRX',
                  'SOL',
                ] as const"
                :key="b"
                type="button"
                @click="base = b"
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

            <!-- Network tiles -->
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
                  "
                  class="rounded-xl border px-3 py-3 text-left transition"
                  :class="
                    selected === a.key
                      ? 'border-nuxt-green bg-nuxt-green/10'
                      : 'border-nuxt-border bg-nuxt-bg'
                  "
                >
                  <div class="text-sm font-semibold">{{ a.label }}</div>
                  <div class="text-xs text-nuxt-muted">{{ a.key }}</div>
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
                  <span v-if="copied" class="text-xs text-nuxt-muted"
                    >Copied</span
                  >
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
