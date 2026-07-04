<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const displayMode = useDisplayMode();
const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);

function onDisplayModeToggle(checked: boolean) {
  displayMode.value = checked ? "crypto" : "usd";
}

function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onDocumentClick);
});
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-nuxt-border bg-nuxt-panel hover:opacity-90"
      title="Settings"
      @click="isOpen = !isOpen"
    >
      <span class="text-xl leading-none">⚙️</span>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 top-12 z-10 w-[280px] rounded-xl border border-nuxt-border bg-nuxt-panel p-3.5 shadow-lg"
    >
      <div class="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-nuxt-muted2">
        Settings
      </div>

      <div class="flex items-center justify-between py-2">
        <div>
          <div class="text-sm text-nuxt-text">Show crypto values</div>
          <div class="mt-0.5 text-[11px] text-nuxt-muted">
            Display amounts in crypto instead of USD
          </div>
        </div>
        <ToggleSwitch
          :model-value="displayMode === 'crypto'"
          @update:model-value="onDisplayModeToggle"
        />
      </div>

      <div class="my-1.5 border-t border-nuxt-border" />

      <div class="flex items-center justify-between py-2 opacity-45">
        <div class="text-sm text-nuxt-text">More settings soon</div>
      </div>
    </div>
  </div>
</template>
