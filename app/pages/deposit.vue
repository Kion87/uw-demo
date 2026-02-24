<template>
  <DemoShell
    title="Deposit"
    subtitle="Wallets per network, balances, and creating new deposit addresses."
  >
    <template #main>
      <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
        <h2 class="text-lg font-semibold">Wallets (placeholder)</h2>
        <p class="mt-2 text-sm text-nuxt-muted">
          Next step: list wallets by network + balances, and a Deposit button
          that opens a modal.
        </p>
      </div>
    </template>

    <template #side>
      <HowItWorksCard />
    </template>
  </DemoShell>
</template>
