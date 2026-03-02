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
    me.value = await $fetch("/api/me");
  } catch (e: any) {
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
      e?.data?.message || e?.statusMessage || e?.message || "Deposit failed";
  } finally {
    loading.value = false;
  }
}

onMounted(loadMe);
</script>

<template>
  <div class="max-w-xl mx-auto p-6 space-y-6">
    <div class="rounded-xl border p-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">UW Demo</h1>
        <button class="text-sm underline" @click="loadMe">Refresh</button>
      </div>

      <div class="mt-3 text-sm">
        <div v-if="me">
          Logged in as <span class="font-medium">{{ me.email }}</span>
        </div>
        <div v-else class="text-red-600">
          Not logged in (use your signup flow first).
        </div>
      </div>
    </div>

    <div class="rounded-xl border p-4 space-y-4">
      <h2 class="text-lg font-semibold">Create Deposit (Uniwire Invoice)</h2>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Asset</label>
        <select v-model="selected" class="w-full rounded-lg border px-3 py-2">
          <option v-for="a in DEPOSIT_ASSETS" :key="a.key" :value="a.key">
            {{ a.label }}
          </option>
        </select>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">
          Amount (optional — leave empty for reusable address)
        </label>
        <input
          v-model="amount"
          placeholder="e.g. 0.01"
          class="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <button
        class="w-full rounded-lg border px-3 py-2 font-medium disabled:opacity-50"
        :disabled="loading || !me"
        @click="createDeposit"
      >
        {{ loading ? "Creating..." : "Create Deposit" }}
      </button>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div v-if="result" class="space-y-2">
        <div class="text-sm">
          <div class="font-medium">Address</div>
          <div class="break-all rounded-lg bg-gray-50 p-2 border">
            {{ result.deposit?.address || "(no address returned)" }}
          </div>
        </div>

        <details class="rounded-lg border bg-gray-50 p-3">
          <summary class="cursor-pointer text-sm font-medium">
            Raw response
          </summary>
          <pre class="mt-2 text-xs overflow-auto">{{ result }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>
