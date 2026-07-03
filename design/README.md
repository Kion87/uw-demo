# Handoff: Casino-Style Balances Dashboard

## Overview
Redesign of the app's Dashboard page, reframed around a casino/high-roller balance experience: a prominent total balance ("bankroll") card broken down by currency (Cash USD + crypto), key stats (deposits, withdrawals, pending, addresses), and a recent activity/transaction feed. Replaces the current plain dashboard shown at the existing `/` route.

## About the Design Files
The file in this bundle (`dashboard-final-reference.html`) is a **design reference built in static HTML/CSS** — it shows the intended look, layout, and content structure. It is NOT production code to drop into the app. The task is to **recreate this design inside the existing Nuxt/Vue codebase**, using its existing component patterns, styling approach (Tailwind/CSS modules/etc — whatever the app already uses), and data layer — not to embed this HTML directly.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final as shown. Numbers/amounts in the reference are placeholder sample data — wire to real API/store data with the same structure.

## Screens / Views

### Dashboard (single screen)
**Purpose:** Let a logged-in user see their current balances (cash + crypto), deposit/withdrawal totals, pending items, and recent transaction activity at a glance.

**Layout:** Single column, max content width ~1440px, generous padding (48px top/bottom, 56px sides). Vertical stack, top to bottom:
1. Page header (title + subtitle)
2. Total Balance hero card
3. 4-column stat grid
4. Recent Activity panel (full width)

No sidebar in this final version — top-level nav (Dashboard/Deposit/Withdraw) stays whatever the app currently uses in its header/nav.

### 1. Page header
- "Dashboard" — Space Grotesk 700, 34px, letter-spacing -0.02em, color `oklch(0.97 0.005 260)` (near-white)
- Subtitle below, 6px margin-top — Manrope 400, 15px, color `oklch(0.70 0.02 260)`: "Your balances, deposits, and activity at a glance."

### 2. Total Balance hero card
- Container: border-radius 18px, padding 36px 40px, `linear-gradient(135deg, oklch(0.23 0.03 260), oklch(0.13 0.02 260))` background, 1px border `oklch(0.78 0.13 85 / 30%)` (gold), margin-bottom 28px, `overflow:hidden`, `position:relative`.
- Decorative glow: absolutely positioned circle, 260×260px, top:-90px, right:-70px, `radial-gradient(circle, oklch(0.78 0.13 85 / 18%), transparent 70%)`.
- Eyebrow label "Total Balance" — Manrope 700, 12.5px, uppercase, letter-spacing 0.1em, color gold `oklch(0.78 0.13 85)`.
- Big number "$24,850.32" — Space Grotesk 700, 56px, margin-top 10px.
- Caption "Credited balances only, not raw deposit totals." — 13px, color `oklch(0.62 0.02 260)`, margin-top 6px.
- Row of currency chips (flex, gap 12px, wrap, margin-top 26px). Each chip: flex row, gap 10px, background `oklch(1 0 0/6%)`, border `oklch(1 0 0/10%)`, border-radius 12px, padding 10px 16px. Contains a 28px circular icon badge (solid color, centered glyph) + label (11px, color `oklch(0.68 0.02 260)`) + mono amount (IBM Plex Mono 600, 15px).
  - **Cash (USD)**: icon bg gold `oklch(0.78 0.13 85)`, glyph "$", amount "$12,400.00"
  - **BTC · 0.1840**: icon bg orange `oklch(0.75 0.13 55)`, glyph "₿", amount "$15,920.00"
  - **ETH · 2.4100**: icon bg violet/blue `oklch(0.75 0.13 265)`, glyph "Ξ", amount "$6,530.32"
  - **USDT**: icon bg emerald `oklch(0.75 0.13 155)`, glyph "₮", amount "$0.00" — this chip is dashed-border and 60% opacity to signal "not yet credited"

### 3. Stat grid (4 cards)
- `display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-bottom:28px`
- Each card: background `oklch(0.19 0.025 260)`, border `oklch(1 0 0/8%)` (gold border for the Pending card instead), border-radius 16px, padding 22px 24px.
- Card contents: label (12.5px, `oklch(0.68 0.02 260)`) → big number (Space Grotesk 700, 28px, margin-top 8px) → small annotation (12px, 600 weight, margin-top 8px).
  1. **Total deposits**: $32,180.00 / "↑ 13 transactions" in emerald `oklch(0.75 0.13 155)`
  2. **Total withdrawals**: $7,330.00 / "4 transactions" in secondary grey
  3. **Pending deposits**: 2 / "Awaiting confirmation" in gold — this card's border is gold-tinted `oklch(0.78 0.13 85 / 30%)` to draw the eye
  4. **Assigned addresses**: 2 / "BTC, ETH networks" in secondary grey

### 4. Recent Activity panel (full width)
- Container: background `oklch(0.19 0.025 260)`, border `oklch(1 0 0/8%)`, border-radius 16px, padding `8px 0` (rows control their own horizontal padding).
- Header row (padding 20px 26px 12px): title "Recent activity" (Space Grotesk 700, 19px) + subtitle "Latest deposits and withdrawals across all assets." (13px, `oklch(0.62 0.02 260)`) on the left; "View all →" link on the right, 13px 600 weight, gold color, no underline.
- Column header row: `grid-template-columns: 1.2fr 1fr 1fr 1fr auto`, padding 10px 26px, labels "Type / Amount / Asset / Date / Status" — 11.5px, 700 weight, uppercase, letter-spacing 0.05em, color `oklch(0.55 0.02 260)`, top border hairline.
- Transaction rows, same grid columns, padding 13px 26px, top border hairline `oklch(1 0 0/6%)` between rows:
  - Type: 13.5px, 600 weight (e.g. "Deposit", "Withdrawal")
  - Amount: IBM Plex Mono 13.5px — emerald `oklch(0.75 0.13 155)` for positive/deposit amounts, neutral grey for withdrawals
  - Asset: 13.5px, secondary grey (BTC/ETH/USD)
  - Date: 12.5px, `oklch(0.55 0.02 260)` — format `M/D/YY, h:mm AM/PM`
  - Status: pill badge, right-aligned, 11px 700 weight, border-radius 999px, padding 4px 10px. "Completed" = emerald bg/text @16% opacity tint; "Pending" = gold bg/text @16% opacity tint.
- Sample rows included: BTC deposit (completed), USD withdrawal (pending), ETH deposit (completed), USD deposit (completed) — replace with real transaction feed, newest first, capped to ~4–6 with "View all" leading to a full activity page/list.

## Interactions & Behavior
- **"View all →"** navigates to a full transactions/activity list (route TBD — likely a new `/activity` page or a modal).
- No hover/active states were explicitly designed beyond standard link/button affordances — apply the app's existing button/link interaction patterns.
- **Loading state**: while balances/stats are fetching, show skeleton placeholders in place of the big numbers (existing dashboard already has a "Loading dashboard..." state — reuse that pattern, styled to match this dark theme).
- **Empty states**: if a currency has no credited balance, render its chip in the dashed/60%-opacity treatment (see USDT example) rather than hiding it.
- Responsive behavior was not specified by the user — recommend collapsing the 4-column stat grid to 2 columns on tablet and 1 column on mobile, and stacking the activity table's columns into a card-per-row layout below ~640px.

## State Management
- `totalBalanceUsd: number` — sum of all credited balances converted to USD
- `balances: { symbol, label, amount, usdValue, credited: boolean }[]` — one entry per currency (Cash/USD, BTC, ETH, USDT, …)
- `stats: { totalDeposits, totalWithdrawals, pendingDeposits, assignedAddresses }`
- `recentActivity: { type: 'deposit'|'withdrawal', asset, amount, usdAmount, timestamp, status: 'completed'|'pending' }[]`
- All of the above should come from the same data sources currently feeding the existing dashboard's "Assigned addresses / Recent deposits / Completed deposits / Assets with credited balance" cards and the "Current balances" / "Assigned addresses" panels — this is a visual/structural reskin, not a new backend.

## Design Tokens

**Colors** (all defined in OKLCH — convert to hex/rgb as needed for the target stack):
- Background (page): `oklch(0.15 0.02 260)`
- Background (card): `oklch(0.19 0.025 260)`
- Border (hairline): `oklch(1 0 0 / 8%)` (cards), `oklch(1 0 0 / 6%)` (row dividers)
- Text primary: `oklch(0.97 0.005 260)`
- Text secondary: `oklch(0.70 0.02 260)` / `oklch(0.68 0.02 260)`
- Text tertiary: `oklch(0.55 0.02 260)` / `oklch(0.62 0.02 260)`
- Gold accent (primary — cash, pending, CTAs): `oklch(0.78 0.13 85)`
- Emerald accent (secondary — positive amounts, completed status, crypto): `oklch(0.75 0.13 155)`
- Orange (BTC identity): `oklch(0.75 0.13 55)`
- Violet/blue (ETH identity): `oklch(0.75 0.13 265)`
- Semantic tint pattern: any accent color used at `/16%` alpha as a badge background, full opacity as badge text

**Typography:**
- Headings/numbers: **Space Grotesk**, weights 500/600/700
- Body/UI text: **Manrope**, weights 400/500/600/700
- Monospace (amounts, wallet data): **IBM Plex Mono**, weights 500/600
- Scale used: 56px (hero number), 34px (page title), 28px (stat number), 26px, 19px (section titles), 15px, 14.5px, 13.5px, 13px, 12.5px, 12px, 11.5px, 11px

**Spacing / radius:**
- Page padding: 48px vertical, 56px horizontal
- Card radius: 16–18px; pill/badge radius: 999px; chip radius: 12px
- Grid gaps: 20px (stat grid), 12px (chip row)

## Assets
No image assets — all icon badges are CSS (solid circles with a centered glyph character, e.g. "$", "₿", "Ξ", "₮"). No external icon library required; can be swapped for the app's existing icon set if preferred.

## Files
- `dashboard-final-reference.html` — the approved final design, self-contained (loads Google Fonts via CDN link), open directly in a browser to inspect.
