# Settings Panel Categories — Design

## Purpose

The gear-icon Settings panel (`app/components/SettingsPanel.vue`) currently renders one flat list: the "Show crypto values" toggle, a divider, and a static "More settings soon" placeholder. Two upcoming settings — a fixed-amount deposit invoice toggle (Deposits) and future payout preferences (Payouts) — need a home that doesn't just grow the flat list. Split the panel into three labeled categories — **General**, **Deposits**, **Payouts** — stacked vertically in a single column, separated by the existing divider style, so each future setting has an obvious, scoped section to land in.

This is a presentation-only change. No new state, no backend/schema changes, no change to `useDisplayMode()` or any other existing behavior — only how settings are grouped and labeled in the panel.

## 1. New Component: `SettingsSection.vue`

A small, reusable wrapper under `app/components/`:

- **Props:** `label: string`
- **Slots:** default slot for the section's content (setting rows, or a placeholder row)
- **Renders:** a small uppercase header (`text-[11px] font-bold uppercase tracking-[0.08em] text-nuxt-muted2`, matching the panel's existing "Settings" header style) followed by the slotted content.
- No "empty state" logic inside the component itself — if a section has nothing real yet, the placeholder content is just written directly in the slot by the caller (see below). This keeps the component to header+slot only, reusable for any future category without modification.

## 2. `SettingsPanel.vue` Restructure

Layout, top to bottom, unchanged panel chrome (280px wide, `rounded-xl border border-nuxt-border bg-nuxt-panel`, drop shadow):

1. Existing panel-level "Settings" header — unchanged.
2. `<SettingsSection label="General">` containing today's single row: "Show crypto values" / "Display amounts in crypto instead of USD" subtext, with the existing `ToggleSwitch` bound to `useDisplayMode()`. Behavior identical to today.
3. Divider (`border-t border-nuxt-border`).
4. `<SettingsSection label="Deposits">` containing a dim placeholder row: "Coming soon" (`opacity-45`, non-interactive, same visual treatment as today's single placeholder). This section gets real content in a follow-up (the fixed-amount deposit invoice toggle).
5. Divider.
6. `<SettingsSection label="Payouts">` containing the same "Coming soon" placeholder row. No payout settings exist yet; this section stays a placeholder until a future task adds one.

Sections stack vertically in a single column (no side-by-side/tab layout) — matches the panel's existing single-column shape.

## 3. Non-Goals

- No settings persistence changes — `useDisplayMode()` and its `localStorage` behavior are untouched.
- No new settings are added in this change — Deposits and Payouts are empty placeholders. The fixed-amount deposit invoice toggle is a separate follow-up design or that section.
- No change to the gear button, panel open/close behavior, or click-outside-to-close logic.

## Testing

No automated test suite exists in this project; verification is manual:

- Click the gear icon: panel opens showing three labeled sections in order — General, Deposits, Payouts — each separated by a divider.
- General still shows the working "Show crypto values" toggle; toggling it behaves exactly as before (verified against existing pages).
- Deposits and Payouts each show a dim "Coming soon" row.
- Click outside / click the gear again: panel closes, same as before.
- Confirm rendering in both light and dark theme.
