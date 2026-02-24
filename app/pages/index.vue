<template>
  <DemoShell
    title="Dashboard"
    subtitle="Overview of wallets, balances, deposits, and withdrawals."
  >
    <template #main>
      <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
        <h2 class="text-lg font-semibold">Welcome</h2>
        <p class="mt-2 text-sm text-nuxt-muted">
          Use the tabs above to open Deposit / Withdraw flows.
        </p>
      </div>
    </template>

    <template #side>
      <HowItWorksCard />
    </template>
  </DemoShell>
</template>
