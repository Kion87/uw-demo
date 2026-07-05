# Settings Panel Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the gear-icon Settings panel into three labeled, vertically-stacked categories (General / Deposits / Payouts) so future settings have an obvious home, without changing any existing setting's behavior.

**Architecture:** One new tiny presentational component (`SettingsSection.vue`: label header + slot) used three times inside the existing `SettingsPanel.vue`, separated by the panel's existing divider style. Purely a template restructure — no new state, no backend changes.

**Tech Stack:** Vue 3 `<script setup>`, Nuxt 4, Tailwind utility classes (matching the app's existing dark-panel design tokens).

## Global Constraints

- No automated test suite exists in this project (confirmed: no `vitest`/`jest` in `package.json`, no `test` script). Every "verify" step below is manual: run `npm run dev` and check in the browser.
- Follow the existing panel visual style exactly: `rounded-xl border border-nuxt-border bg-nuxt-panel`, section headers `text-[11px] font-bold uppercase tracking-[0.08em] text-nuxt-muted2`, dividers `border-t border-nuxt-border`.
- Category order is fixed: **General**, then **Deposits**, then **Payouts**.
- Spec: `docs/superpowers/specs/2026-07-05-settings-panel-categories-design.md`.

---

### Task 1: `SettingsSection.vue` component + `SettingsPanel.vue` restructure

**Files:**
- Create: `app/components/SettingsSection.vue`
- Modify: `app/components/SettingsPanel.vue` (currently 67 lines — see below for full current content)

**Interfaces:**
- Produces: `SettingsSection` component, prop `label: string`, default slot for content. No emits. This is the only new public surface — later work (the fixed-amount-invoice toggle) will render its content inside `<SettingsSection label="Deposits">`'s slot, replacing the placeholder row added in this task.

- [ ] **Step 1: Create `SettingsSection.vue`**

```vue
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
```

- [ ] **Step 2: Restructure `SettingsPanel.vue` to use it**

Current file (`app/components/SettingsPanel.vue`):

```vue
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
```

Replace the `<div v-if="isOpen">...</div>` panel body (everything from the "Settings" header div through the closing `</div>` before `</div>` that closes the root) with:

```vue
    <div
      v-if="isOpen"
      class="absolute right-0 top-12 z-10 w-[280px] rounded-xl border border-nuxt-border bg-nuxt-panel p-3.5 shadow-lg"
    >
      <div class="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-nuxt-muted2">
        Settings
      </div>

      <SettingsSection label="General">
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
      </SettingsSection>

      <div class="my-1.5 border-t border-nuxt-border" />

      <SettingsSection label="Deposits">
        <div class="py-2 text-sm text-nuxt-text opacity-45">Coming soon</div>
      </SettingsSection>

      <div class="my-1.5 border-t border-nuxt-border" />

      <SettingsSection label="Payouts">
        <div class="py-2 text-sm text-nuxt-text opacity-45">Coming soon</div>
      </SettingsSection>
    </div>
```

The `<script setup>` block is unchanged — no new imports needed (Nuxt auto-imports components from `app/components/`).

- [ ] **Step 3: Manual verification**

Run: `npm run dev`

- Open the app in a browser, click the gear icon.
- Confirm three labeled sections appear in order: **General** (with the working "Show crypto values" toggle), **Deposits** ("Coming soon", dim), **Payouts** ("Coming soon", dim), each separated by a thin divider.
- Toggle "Show crypto values": confirm it still flips dashboard/deposit/withdraw figures between USD and crypto exactly as before (no regression).
- Click outside the panel, then click the gear again: confirm open/close behavior is unchanged.
- Toggle the app's theme button (moon/sun icon): confirm the panel renders correctly in both light and dark theme.

- [ ] **Step 4: Commit**

```bash
git add app/components/SettingsSection.vue app/components/SettingsPanel.vue
git commit -m "$(cat <<'EOF'
Split Settings panel into General/Deposits/Payouts categories

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** every element of `2026-07-05-settings-panel-categories-design.md` (§1 component, §2 restructure, §3 non-goals) is covered by Task 1 — this is a single-task plan because the spec itself describes one indivisible, small change.
- **Placeholder scan:** none — both files are shown in full, no "similar to above" references.
- **Type consistency:** N/A (no cross-task interfaces beyond the one component defined and consumed within this same task).
