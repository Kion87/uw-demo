# Nav Settings Panel — Design

## Purpose

The nav currently exposes "Show crypto values" as a bare checkbox next to the theme toggle. As more display/behavior preferences get added over time, a flat row of checkboxes in the nav won't scale. Replace it with a gear-icon-triggered settings panel: a single, extensible location for this and future preferences, styled to match the app's existing dark-panel aesthetic.

This is a presentation-only change. The underlying `useDisplayMode()` composable, its `localStorage` persistence, and every page that reads `displayMode` are untouched — only how the toggle is exposed in the nav changes.

## 1. Nav Trigger

- In `app/app.vue`'s "Right controls" row, the existing `<label><input type="checkbox">Show crypto values</label>` markup is removed.
- Replaced with a gear icon button (⚙️), styled identically to the existing theme-toggle button (`h-10 w-10`, `rounded-lg border border-nuxt-border bg-nuxt-panel`, `hover:opacity-90`) so the two icon buttons read as a matched pair.
- No active-state indicator on the gear icon when crypto mode is on — the icon looks the same regardless of `displayMode`. (Confirmed with user: simplicity over an at-a-glance mode indicator.)
- Clicking the gear icon toggles a dropdown panel open/closed. Clicking anywhere outside the open panel (or clicking the gear icon again) closes it.

## 2. Panel Layout

Anchored below the gear icon, right-aligned, ~280px wide, matching the app's existing panel styling (`rounded-xl`/`rounded-2xl border border-nuxt-border bg-nuxt-panel`, drop shadow for elevation over page content).

Contents, top to bottom:
1. Header label: "Settings" — small, uppercase, muted (`text-[11px] uppercase tracking-[0.08em] text-nuxt-muted2 font-bold`), matching the stat-card label style already used on the Dashboard.
2. One row: label "Show crypto values" with subtext "Display amounts in crypto instead of USD" on the left, a toggle switch on the right.
3. A horizontal divider (`border-t border-nuxt-border`).
4. A second row, visually deemphasized (`opacity-45`, non-interactive, no click handler): label "More settings soon". This is a static placeholder signaling the panel is built to hold more than one item — no functionality behind it yet.

## 3. Components

Two new components under `app/components/` (new directory — none exists yet):

**`ToggleSwitch.vue`** — generic, reusable pill switch.
- Props: `modelValue: boolean`
- Emits: `update:modelValue: boolean`
- Visual: 40×22px pill, `bg-nuxt-border` when off, `bg-nuxt-green` when on, a white circular knob that slides left/right, 150ms transition — matches the mockup approved above.
- No knowledge of `displayMode` or any specific setting — purely a controlled boolean switch, so it can back any future settings row without modification.

**`SettingsPanel.vue`** — the gear button + dropdown + today's one real setting.
- Owns local `isOpen` state (`ref(false)`).
- Click-outside-to-close: a `mousedown` listener on `document` added in `onMounted` (removed in `onUnmounted`), checking whether the click target is outside the component's root element via a template ref.
- Reads/writes `useDisplayMode()` directly (same composable, same `"usd" | "crypto"` contract) — renders the "Show crypto values" row with a `ToggleSwitch` bound to `displayMode === "crypto"`, updating `displayMode.value` on change exactly as the old inline handler did.
- Renders the static "More settings soon" placeholder row.
- No props needed; no emits needed (it's fully self-contained against the global `displayMode` state).

**`app/app.vue` changes:** removes the inline checkbox markup, the `onDisplayModeToggle` function, and the `displayMode` ref/import (all move into `SettingsPanel.vue`); renders `<SettingsPanel />` in their place. The existing `watch(displayMode, ...)` → `localStorage.setItem` and the `onMounted` restore-from-`localStorage` logic **stay in `app.vue`** exactly as they are today, since they're app-wide bootstrapping concerns unrelated to how the toggle is presented, not something `SettingsPanel` should own.

## Testing

No automated test suite exists in this project; verification is manual, same as prior UI work:
- Click the gear icon: panel opens, showing "Show crypto values" (in whatever state `displayMode` currently holds) and the greyed-out placeholder row.
- Toggle the switch: `displayMode` flips, every page still fully replaces USD/crypto units exactly as before (no regression in existing toggle behavior).
- Click outside the panel: it closes. Click the gear icon again while open: it also closes.
- Reload the page: `displayMode` restores from `localStorage` exactly as before (unchanged persistence logic).
- Confirm the panel and toggle switch render correctly in both light and dark theme (the app's existing theme toggle).
