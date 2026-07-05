<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <div>
    <div class="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-nuxt-muted2">
      {{ label }}
    </div>
    <slot />
  </div>
</template>
