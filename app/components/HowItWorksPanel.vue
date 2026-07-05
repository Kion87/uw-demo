<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), {
  title: "How it works",
});

defineSlots<{
  steps(): unknown;
  "under-the-hood"(): unknown;
  extra?(): unknown;
}>();
</script>

<template>
  <aside class="lg:col-span-1">
    <div class="rounded-2xl border border-nuxt-border bg-nuxt-panel p-6">
      <h3 class="font-display text-lg font-bold">{{ title }}</h3>

      <ul class="mt-4 space-y-2 text-sm text-nuxt-muted">
        <slot name="steps" />
      </ul>

      <div class="mt-5 border-t border-nuxt-border pt-4 text-xs text-nuxt-muted">
        <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-nuxt-muted2">
          Under the hood
        </p>
        <ul class="space-y-2">
          <slot name="under-the-hood" />
        </ul>
      </div>

      <slot name="extra" />
    </div>
  </aside>
</template>
