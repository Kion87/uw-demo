<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-nuxt-muted">{{ subtitle }}</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <slot name="main" />
      </div>
      <div>
        <slot name="side" />
      </div>
    </div>
  </div>
</template>
