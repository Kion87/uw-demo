<script setup lang="ts">
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

function formatStatus(status?: string | null) {
  if (!status) return "—";
  return status.replaceAll("_", " ");
}

function shortText(value?: string | null, start = 10, end = 8) {
  if (!value) return "—";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function copyText(value?: string | null) {
  if (!value) return;
  navigator.clipboard.writeText(value);
}

function statusBadgeClass(status?: string | null) {
  if (!status) return "bg-white/5 text-slate-300 ring-1 ring-white/10";

  const s = status.toLowerCase();

  if (s.includes("complete") || s.includes("confirmed")) {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
  }

  if (s.includes("pending") || s.includes("new")) {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
  }

  return "bg-white/5 text-slate-300 ring-1 ring-white/10";
}

function activityBadgeClass(type?: string | null) {
  if (!type) return "bg-white/5 text-slate-300 ring-1 ring-white/10";
  if (type === "deposit_completed") {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
  }
  if (type === "address_assigned") {
    return "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30";
  }
  return "bg-white/5 text-slate-300 ring-1 ring-white/10";
}

onMounted(loadDashboard);
</script>

<template>
  <div class="space-y-8">
    <section>
      <h1 class="text-4xl font-bold tracking-tight text-white">Dashboard</h1>
      <p class="mt-3 text-lg text-slate-400">
        Overview of assigned addresses, credited balances, deposits, and latest
        activity.
      </p>
    </section>

    <div
      v-if="loading"
      class="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-300"
    >
      Loading dashboard...
    </div>

    <div
      v-else-if="error"
      class="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-200"
    >
      {{ error }}
    </div>

    <template v-else>
      <!-- Welcome -->
      <section
        class="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/90 to-blue-950/90 p-8"
      >
        <h2 class="text-2xl font-semibold text-white">
          Welcome back, User {{ dashboard?.user?.publicId || "—" }}
        </h2>

        <p class="mt-3 text-slate-300">
          Track your assigned addresses, credited balances, recent deposits, and
          system activity.
        </p>

        <div class="mt-6 flex flex-wrap gap-3 text-sm">
          <div
            class="rounded-full bg-white/5 px-4 py-2 text-slate-300 ring-1 ring-white/10"
          >
            Email: {{ dashboard?.user?.email || "—" }}
          </div>
          <div
            class="rounded-full bg-white/5 px-4 py-2 text-slate-300 ring-1 ring-white/10"
          >
            Public ID: {{ dashboard?.user?.publicId || "—" }}
          </div>
          <div
            class="rounded-full bg-emerald-500/15 px-4 py-2 text-emerald-300 ring-1 ring-emerald-500/30"
          >
            Webhook connected
          </div>
          <div
            class="rounded-full bg-sky-500/15 px-4 py-2 text-sky-300 ring-1 ring-sky-500/30"
          >
            Address reuse enabled
          </div>
        </div>
      </section>

      <!-- Summary cards -->
      <section class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p class="text-sm text-slate-400">Assigned addresses</p>
          <p class="mt-3 text-4xl font-bold text-white">
            {{ dashboard?.summary?.assignedAddresses ?? 0 }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Current reusable deposit addresses
          </p>
        </div>

        <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p class="text-sm text-slate-400">Recent deposits</p>
          <p class="mt-3 text-4xl font-bold text-white">
            {{ dashboard?.summary?.totalDeposits ?? 0 }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Latest transaction rows stored in the system
          </p>
        </div>

        <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p class="text-sm text-slate-400">Completed deposits</p>
          <p class="mt-3 text-4xl font-bold text-white">
            {{ dashboard?.summary?.completedDeposits ?? 0 }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Deposits that reached confirmed or complete status
          </p>
        </div>

        <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p class="text-sm text-slate-400">Assets with credited balance</p>
          <p class="mt-3 text-4xl font-bold text-white">
            {{ dashboard?.summary?.activeBalances ?? 0 }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Will populate after balance crediting logic is added
          </p>
        </div>
      </section>

      <!-- Balances + Addresses -->
      <section class="grid gap-6 xl:grid-cols-2">
        <!-- Balances -->
        <div class="rounded-3xl border border-white/10 bg-white/5 p-7">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 class="text-2xl font-semibold text-white">
                Current balances
              </h3>
              <p class="mt-2 text-slate-400">
                Credited balances only, not raw deposit totals.
              </p>
            </div>

            <button
              class="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm text-white hover:bg-slate-900/60"
              @click="loadDashboard"
            >
              Refresh
            </button>
          </div>

          <div v-if="dashboard?.balances?.length" class="mt-6 space-y-3">
            <div
              v-for="balance in dashboard.balances"
              :key="balance.asset"
              class="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/30 p-4"
            >
              <div>
                <p class="text-sm text-slate-400">Asset</p>
                <p class="mt-1 text-lg font-semibold text-white">
                  {{ balance.asset }}
                </p>
              </div>

              <div class="text-right">
                <p class="text-sm text-slate-400">Balance</p>
                <p class="mt-1 text-lg font-semibold text-white">
                  {{ balance.amount }}
                </p>
              </div>
            </div>
          </div>

          <div
            v-else
            class="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-5 text-slate-400"
          >
            No credited balances yet. This section will populate after we add
            the deposit crediting logic.
          </div>
        </div>

        <!-- Assigned addresses -->
        <div class="rounded-3xl border border-white/10 bg-white/5 p-7">
          <h3 class="text-2xl font-semibold text-white">Assigned addresses</h3>
          <p class="mt-2 text-slate-400">
            Current reusable addresses assigned to your account.
          </p>

          <div v-if="dashboard?.addresses?.length" class="mt-6 space-y-3">
            <div
              v-for="row in dashboard.addresses"
              :key="row.assetKey + row.address"
              class="rounded-2xl border border-white/10 bg-slate-950/30 p-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-slate-400">Network</p>
                  <p class="mt-1 text-lg font-semibold text-white">
                    {{ row.networkLabel }}
                  </p>
                </div>

                <div class="text-right">
                  <p class="text-sm text-slate-400">Assigned</p>
                  <p class="mt-1 text-sm text-slate-300">
                    {{ formatDate(row.createdAt) }}
                  </p>
                </div>
              </div>

              <div class="mt-4 flex items-center gap-3">
                <code
                  class="flex-1 truncate rounded-xl bg-black/20 px-3 py-2 text-sm text-slate-200"
                >
                  {{ row.address }}
                </code>

                <button
                  class="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white hover:bg-slate-900/60"
                  @click="copyText(row.address)"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div
            v-else
            class="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-5 text-slate-400"
          >
            No assigned addresses yet. Create one from the Deposit tab.
          </div>
        </div>
      </section>

      <!-- Recent deposits -->
      <section class="rounded-3xl border border-white/10 bg-white/5 p-7">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-2xl font-semibold text-white">Recent deposits</h3>
            <p class="mt-2 text-slate-400">
              Your latest deposits received on assigned addresses.
            </p>
          </div>

          <button
            class="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm text-white hover:bg-slate-900/60"
            @click="loadDashboard"
          >
            Refresh
          </button>
        </div>

        <div
          v-if="dashboard?.recentDeposits?.length"
          class="mt-6 overflow-x-auto"
        >
          <table class="min-w-full text-left">
            <thead>
              <tr class="border-b border-white/10 text-slate-400">
                <th class="px-4 py-3 font-medium">Created</th>
                <th class="px-4 py-3 font-medium">Asset</th>
                <th class="px-4 py-3 font-medium text-right">Amount</th>
                <th class="px-4 py-3 font-medium">Status</th>
                <th class="px-4 py-3 font-medium">TxID</th>
                <th class="px-4 py-3 font-medium"></th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="row in dashboard.recentDeposits"
                :key="row.id"
                class="border-b border-white/5 text-white"
              >
                <td class="px-4 py-4 text-slate-300">
                  {{ formatDate(row.createdAt) }}
                </td>

                <td class="px-4 py-4 font-semibold">
                  {{ row.asset }}
                </td>

                <td class="px-4 py-4 text-right font-medium">
                  {{ row.amount ?? "—" }}
                </td>

                <td class="px-4 py-4">
                  <span
                    class="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                    :class="statusBadgeClass(row.status)"
                  >
                    {{ formatStatus(row.status) }}
                  </span>
                </td>

                <td class="px-4 py-4 text-slate-300">
                  {{ shortText(row.txid) }}
                </td>

                <td class="px-4 py-4 text-right">
                  <button
                    v-if="row.txid"
                    class="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white hover:bg-slate-900/60"
                    @click="copyText(row.txid)"
                  >
                    Copy
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-else
          class="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-5 text-slate-400"
        >
          No deposits recorded yet.
        </div>
      </section>

      <!-- Latest activity -->
      <section class="rounded-3xl border border-white/10 bg-white/5 p-7">
        <h3 class="text-2xl font-semibold text-white">Latest activity</h3>
        <p class="mt-2 text-slate-400">
          Recent address assignments and deposit updates.
        </p>

        <div v-if="dashboard?.latestActivity?.length" class="mt-6 space-y-3">
          <div
            v-for="(item, index) in dashboard.latestActivity"
            :key="index"
            class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4"
          >
            <div class="flex items-center gap-3">
              <span
                class="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                :class="activityBadgeClass(item.type)"
              >
                {{ item.type.replaceAll("_", " ") }}
              </span>

              <div>
                <p class="font-medium text-white">{{ item.label }}</p>
                <p class="text-sm text-slate-400">{{ item.meta }}</p>
              </div>
            </div>

            <div class="text-sm text-slate-400">
              {{ formatDate(item.timestamp) }}
            </div>
          </div>
        </div>

        <div
          v-else
          class="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-5 text-slate-400"
        >
          No activity yet.
        </div>
      </section>
    </template>
  </div>
</template>
