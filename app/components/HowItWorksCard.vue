<template>
  <aside class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
    <h2 class="text-lg font-semibold">How it works</h2>

    <div class="mt-3 space-y-2 text-sm text-nuxt-muted">
      <p>
        • Browser calls Nuxt server routes (e.g.
        <code class="text-nuxt-text">/api/*</code>)
      </p>
      <p>• Server talks to DB via Prisma (SQLite)</p>
      <p>• Later: server calls Uniwire testnet for invoices/payouts</p>
    </div>

    <div class="mt-5 border-t border-nuxt-border pt-4 text-xs text-nuxt-muted">
      Tip: we’ll add “Copy address” + QR codes in the Deposit flow.
    </div>
  </aside>
</template>
