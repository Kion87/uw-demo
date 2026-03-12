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

function formatStatus(status?: string | null) {
  if (!status) return "No activity";
  return status.replaceAll("_", " ");
}

function statusBadgeClass(status?: string | null) {
  if (!status) {
    return "bg-white/5 text-slate-300 ring-1 ring-white/10";
  }

  const s = status.toLowerCase();

  if (s.includes("complete") || s.includes("confirmed")) {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
  }

  if (s.includes("pending")) {
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
  }

  return "bg-white/5 text-slate-300 ring-1 ring-white/10";
}

onMounted(loadDashboard);
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <section>
      <h1 class="text-4xl font-bold tracking-tight text-white">Dashboard</h1>
      <p class="mt-3 text-lg text-slate-400">
        Overview of your account, deposit activity, and integration status.
      </p>
    </section>

    <!-- Loading / Error -->
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
      <!-- Welcome card -->
      <section
        class="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/90 to-blue-950/90 p-8 shadow-[0_0_40px_rgba(0,0,0,0.25)]"
      >
        <h2 class="text-2xl font-semibold text-white">
          Welcome back{{
            dashboard?.user?.publicId ? `, User ${dashboard.user.publicId}` : ""
          }}
        </h2>
        <p class="mt-3 text-slate-300">
          Use the tabs above to create deposit addresses, monitor incoming
          transactions, and later test withdrawals.
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

      <!-- Stats -->
      <section class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p class="text-sm text-slate-400">Total deposits</p>
          <p class="mt-3 text-4xl font-bold text-white">
            {{ dashboard?.stats?.depositCount ?? 0 }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            All transaction records received from callbacks
          </p>
        </div>

        <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p class="text-sm text-slate-400">Confirmed / complete</p>
          <p class="mt-3 text-4xl font-bold text-white">
            {{ dashboard?.stats?.confirmedCount ?? 0 }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Deposits that reached confirmed or complete status
          </p>
        </div>

        <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p class="text-sm text-slate-400">Reusable addresses</p>
          <p class="mt-3 text-4xl font-bold text-white">
            {{ dashboard?.stats?.addressCount ?? 0 }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            One address reused per blockchain network
          </p>
        </div>

        <div class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p class="text-sm text-slate-400">Latest deposit</p>
          <p class="mt-3 text-2xl font-bold text-white">
            <template v-if="dashboard?.stats?.latestDeposit">
              {{ dashboard.stats.latestDeposit.amount }}
              {{ dashboard.stats.latestDeposit.asset }}
            </template>
            <template v-else> — </template>
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Most recent transaction seen by the system
          </p>
        </div>
      </section>

      <!-- Lower cards -->
      <section class="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div class="rounded-3xl border border-white/10 bg-white/5 p-7">
          <h3 class="text-2xl font-semibold text-white">Latest activity</h3>

          <div
            v-if="dashboard?.stats?.latestDeposit"
            class="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-5"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-sm text-slate-400">Asset</p>
                <p class="mt-1 text-xl font-semibold text-white">
                  {{ dashboard.stats.latestDeposit.asset }}
                </p>
              </div>

              <div class="text-right">
                <p class="text-sm text-slate-400">Amount</p>
                <p class="mt-1 text-xl font-semibold text-white">
                  {{ dashboard.stats.latestDeposit.amount }}
                </p>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-3">
              <span
                class="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                :class="statusBadgeClass(dashboard.stats.latestDeposit.status)"
              >
                {{ formatStatus(dashboard.stats.latestDeposit.status) }}
              </span>

              <span class="text-sm text-slate-500">
                TXID:
                {{
                  dashboard.stats.latestDeposit.txid
                    ? dashboard.stats.latestDeposit.txid.slice(0, 14) + "..."
                    : "—"
                }}
              </span>
            </div>
          </div>

          <div
            v-else
            class="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-5 text-slate-400"
          >
            No deposits yet. Go to the Deposit tab to create an address and test
            the flow.
          </div>
        </div>

        <div class="rounded-3xl border border-white/10 bg-white/5 p-7">
          <h3 class="text-2xl font-semibold text-white">How it works</h3>

          <div class="mt-6 space-y-4 text-slate-300">
            <div class="rounded-2xl bg-slate-950/30 p-4 ring-1 ring-white/5">
              Browser calls Nuxt server routes
            </div>
            <div class="rounded-2xl bg-slate-950/30 p-4 ring-1 ring-white/5">
              Server stores data in PostgreSQL via Prisma
            </div>
            <div class="rounded-2xl bg-slate-950/30 p-4 ring-1 ring-white/5">
              Uniwire sends transaction callbacks to your app
            </div>
            <div class="rounded-2xl bg-slate-950/30 p-4 ring-1 ring-white/5">
              Deposits are tracked per blockchain transaction
            </div>
          </div>

          <div
            class="mt-6 border-t border-white/10 pt-5 text-sm text-slate-400"
          >
            Next step: credit user balances safely after confirmed / complete
            callbacks.
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
