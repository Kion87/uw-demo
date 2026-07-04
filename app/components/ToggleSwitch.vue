<script setup lang="ts">
defineProps<{ modelValue: boolean }>();
defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="relative h-[22px] w-10 shrink-0 rounded-full transition-colors"
    :class="modelValue ? 'bg-nuxt-green' : 'bg-nuxt-border'"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span
      class="absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all"
      :class="modelValue ? 'left-[20px]' : 'left-0.5'"
    />
  </button>
</template>
