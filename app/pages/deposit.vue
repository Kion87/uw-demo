<script setup lang="ts">
import { DEPOSIT_ASSETS, type DepositAssetKey } from "~/shared/deposits";

const me = ref<any>(null);
const selected = ref<DepositAssetKey>("BTC");
const amount = ref<string>(""); // optional
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

async function loadMe() {
  error.value = null;
  try {
    const res: any = await $fetch("/api/me");
    me.value = res?.user ?? null; // /api/me returns { ok, user }
  } catch {
    me.value = null;
  }
}

async function createDeposit() {
  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const body: any = { assetKey: selected.value };
    if (amount.value.trim()) body.amount = amount.value.trim();

    result.value = await $fetch("/api/deposit", {
      method: "POST",
      body,
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
              class="rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-sm hover:opacity-90"
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
              <span class="font-semibold">{{ me.publicId }}</span>
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
            Select an asset/network combo supported in this demo.
          </p>

          <div class="mt-5 space-y-4">
            <div>
              <label class="block text-sm text-nuxt-muted">Asset</label>
              <select
                v-model="selected"
                class="mt-2 w-full rounded-lg border border-nuxt-border bg-nuxt-bg px-3 py-2 text-nuxt-text outline-none focus:ring-2 focus:ring-nuxt-green/50"
              >
                <option v-for="a in DEPOSIT_ASSETS" :key="a.key" :value="a.key">
                  {{ a.label }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm text-nuxt-muted">
                Amount (optional — leave empty for reusable address)
              </label>
              <input
                v-model="amount"
                placeholder="e.g. 0.01"
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
            <li>
              1) Pick an asset (BTC, ETH, USDT ERC20, TRX, SOL, USDC SPL).
            </li>
            <li>2) Optionally enter an amount.</li>
            <li>
              3) Click <span class="text-nuxt-text">Create Deposit</span>.
            </li>
            <li>4) Server calls Uniwire API to create an invoice.</li>
            <li>5) You receive a deposit address to pay.</li>
          </ul>

          <div
            class="mt-5 border-t border-nuxt-border pt-4 text-xs text-nuxt-muted"
          >
            Tip: leaving amount empty can be used for “reusable address” flows,
            depending on the asset/network behavior.
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
