# MechOneHub — Design System (Navy & Orange)

Version 1.0 · 21 Nov 2026
Applies to: buyer web app, vendor portal, raw-material marketplace, and the mobile app (iOS/Android).

---

## 1. Principles

1. **One action colour.** Orange is only for the single main action on a screen (Get quote, Confirm order, Upload drawing, Move to QC). Never use it for decoration.
2. **Navy is structure.** Navy carries headings, borders, selection and the dark-mode background.
3. **Drawings read true.** The drawing viewer is always a neutral grid, whatever the theme. Only dimension lines may use orange.
4. **Engineering data in mono.** Part numbers, tolerances, quantities, file names and prices use Geist Mono with tabular numerals.
5. **Quiet surfaces.** 1px borders, 6–10px radius, almost no shadows. No gradients, glassmorphism, glowing blobs or emoji icons.
6. **Accessible by default.** All text and button labels meet WCAG AA (≥ 4.5:1).

---

## 2. Brand colours

| Token | Hex | Use |
|---|---|---|
| `brand.navy` | `#102D52` | Logo, headings, borders, selected states |
| `brand.orange` | `#FF7900` | Logo accent, primary action buttons, active indicators |
| `brand.navy-deep` | `#0B2140` | **Label text on orange buttons** |

> ⚠️ **Never put white text on #FF7900.** Contrast is 2.6:1 and fails WCAG. Use `#0B2140` instead (6.1:1). If white text on orange is ever needed, the orange must darken to about `#C25400`.

---

## 3. Theme colours

### 3.1 Surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F5F7FA` | `#07152A` | Page background |
| `surface` | `#FFFFFF` | `#0D1F3B` | Cards, header, sheets, inputs |
| `raised` | `#EEF2F7` | `#13284A` | Stepper buttons, table headers, wells |
| `border` | `#D8DFE8` | `#1F3657` | All 1px borders and dividers |
| `text.heading` | `#102D52` | `#E7EDF5` | Headings, values, primary text |
| `text.body` | `#23324A` | `#C9D4E3` | Paragraphs, unselected options |
| `text.muted` | `#56677E` | `#93A4BC` | Labels, metadata, helper text |
| `link` | `#B34F00` | `#FFA45C` | Inline text links |

### 3.2 Drawing viewer

| Token | Light | Dark |
|---|---|---|
| `viewer.bg` | `#EEF2F7` | `#0A1A31` |
| `viewer.grid` | `#DCE3EC` (20px grid) | `#15294A` (20px grid) |
| `viewer.line` | `#102D52` | `#C9D6E8` |
| `viewer.dimension` | `#FF7900` | `#FF7900` |

### 3.3 Machining status (shared by buyer and vendor)

| Status | Light bg / text | Dark bg / text |
|---|---|---|
| Queued / Draft | `#EEF1F5` / `#4A5A70` | `#16263F` / `#A9B6C8` |
| In machining | `#E4ECF6` / `#1D4E89` | `#183459` / `#9EC1F0` |
| QC inspection / Warning | `#FDF3E1` / `#8A5300` | `#2A2214` / `#F5C451` |
| Dispatched / Success | `#E6F4EA` / `#166534` | `#12261A` / `#6BD58E` |
| On hold / Error | `#FBE9E9` / `#991B1B` | `#2C1515` / `#F28B8B` |

Status tags are pills: 24px tall, 10px horizontal padding, a 6px dot in the text colour, 12px/500 text. Never show status by colour alone; always include the label.

---

## 4. Buttons

Height 40px (48px for main mobile and price-panel CTAs) · radius 6px · padding 0 16px · Archivo 14px/600 · optional 16px icon with an 8px gap.

### 4.1 Primary (orange) — the one main action

| State | Light bg / label | Dark bg / label |
|---|---|---|
| Default | `#FF7900` / `#0B2140` | `#FF7900` / `#0B2140` |
| Hover | `#F27300` / `#0B2140` | `#FF8F2E` / `#0B2140` |
| Pressed (clicked) | `#E66C00` / `#0B2140` | `#E66C00` / `#0B2140` |
| Active / selected | `#E4ECF6` / `#102D52`, border `#102D52` | `#1D3A63` / `#FFFFFF`, border `#6E8DB8` |
| Inactive / disabled | `#E6EAF0` / `#94A1B2` | `#13233D` / `#52657F` |
| Focus (keyboard) | default + ring `#102D52` | default + ring `#FFA45C` |

### 4.2 Secondary (outline) — supporting actions

| State | Light | Dark |
|---|---|---|
| Default | bg `#FFFFFF`, border `#102D52`, label `#102D52` | bg transparent, border `#3A5378`, label `#E7EDF5` |
| Hover | bg `#EAF0F7` | bg `#162D50` |
| Pressed | bg `#D9E3EF` | bg `#1D3A63` |
| Active / selected | bg `#E4ECF6`, border/label `#102D52` | bg `#1D3A63`, border `#6E8DB8`, label `#FFFFFF` |
| Disabled | bg transparent, border `#D8DFE8`, label `#94A1B2` | bg transparent, border `#1F3657`, label `#52657F` |
| Focus | ring `#102D52` | ring `#FFA45C` |

### 4.3 Ghost (text) — low-emphasis actions (Share, Full screen)

| State | Light | Dark |
|---|---|---|
| Default | transparent, label `#102D52` | transparent, label `#FFA45C` |
| Hover | bg `#EAF0F7` | bg `#2A2118` |
| Pressed | bg `#D9E3EF` | bg `#3A2A18` |
| Active / selected | bg `#E4ECF6`, label `#102D52` | bg `#1D3A63`, label `#FFFFFF` |
| Disabled | label `#94A1B2` | label `#52657F` |
| Focus | ring `#102D52` | ring `#FFA45C` |

### 4.4 Rules

- **Focus ring:** `box-shadow: 0 0 0 2px <surface>, 0 0 0 4px <ring>` (a 2px ring with a 2px offset). Show it on `:focus-visible` only.
- **One primary button per screen or section.** Put others in secondary or ghost style.
- **Order in button groups:** ghost → secondary → primary, with the primary on the right on desktop. On mobile, the primary button is the wider one, on the right.
- **Disabled state** uses `disabled` / `aria-disabled` and `cursor: not-allowed`. Low contrast is intentional (WCAG exempts disabled controls).
- **Transitions:** `background-color 120ms ease-out`. No scaling or bounce.

---

## 5. Typography

| Role | Font | Settings |
|---|---|---|
| Headings / display | **Archivo** | width 112%, weight 600–650, letter-spacing −0.015em |
| Body and UI | **Archivo** | width 100%, weights 400 / 500 / 600 |
| Engineering data | **Geist Mono** | weights 400 / 500, `font-variant-numeric: tabular-nums` |

Google Fonts:
```
https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..700&family=Geist+Mono:wght@400;500&display=swap
```

### Type scale

| Token | Desktop | Mobile | Weight | Use |
|---|---|---|---|---|
| `display` | 44 / 1.05 | 32 / 1.1 | 650 | Marketing hero |
| `h1` | 30 / 1.2 | 24 / 1.25 | 650 | Page title |
| `h2` | 18 / 1.3 | 18 / 1.3 | 650 | Card / section title |
| `price` | 26 / 1.2 | 20 / 1.2 | 650 | Totals (tabular numerals) |
| `body` | 14–16 / 1.5 | 14–15 / 1.5 | 400 | Paragraphs, values |
| `label` | 12 / 1.4 | 12 / 1.4 | 500 | Field labels, metadata (muted) |
| `overline` | 12, uppercase, +0.08em | same | 600 | Section eyebrows |
| `mono` | 12–15 | 12–14 | 400/500 | Part nos., tolerances, qty, file names, prices |

**Use mono for:** `FL-2041`, `Q-24118`, `J-3307`, `Ø76 H7`, `120.00 ±0.05`, `× 50`, `12 × 1250 × 2500 mm`, `FL-2041_flange.step`.

---

## 6. Logo

| Variant | Use |
|---|---|
| Horizontal lockup (mark + `mechonehub`) — light | Desktop header (30px tall), mobile header (24px tall) on light surfaces |
| Horizontal lockup — dark (navy parts → white, orange kept) | Same placements on dark surfaces |
| Stacked lockup (mark above wordmark) | Splash screen, login, email header, documents |
| Mark only (M1) | App icon, favicon, tight spaces (navy tile with white/orange mark) |

- Clear space around the logo is at least the height of the "1" in the mark.
- Never recolour the orange "1" or the orange "one" in the wordmark.
- Production should use the original **vector (SVG)** logo. The PNGs on the design board were cut from a raster image and are for mock-ups only.

---

## 7. Spacing, radius and elevation

- **Spacing scale (4px base):** 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56
- **Desktop:** page padding 32px; max content width 1440px; 20px gap between cards; 20px card padding
- **Mobile:** screen padding 16px; 14px gap between sections; 12–14px card padding
- **Radius:** 6px buttons, inputs and chips · 8px viewer and option cards · 10px cards · 12px sheets/modals · 999px status pills and category chips
- **Elevation:** borders, not shadows. Use a shadow only on floating layers (menus, modals, toasts): `0 8px 24px rgba(16,45,82,0.12)` in light mode and `0 8px 24px rgba(0,0,0,0.5)` in dark mode.
- **Touch targets:** at least 40px on desktop and 44px on mobile.

---

## 8. Components

### Header (desktop)
White `surface` (dark: `#0D1F3B`) with a bottom border. Logo on the left, then nav tabs (Instant quote · My orders · Raw materials · Vendors), then search (240px), a notifications icon button and an avatar. The active tab has `text.heading`, weight 600 and a **2px orange underline**. Inactive tabs use `text.muted`.

### Bottom tab bar (mobile)
4 tabs, 22px icons with 11px labels. The active tab has heading colour, weight 600 and a 20×3px orange bar above the icon.
- Buyer: Quote · Orders · Materials · Account
- Vendor: Jobs · Drawings · Materials · Account

### Inputs and selects
40px tall (mobile 40–44px), 1px `border`, `surface` background, radius 6px, 14px text, 12px/500 muted label above. Focus: border and ring in the theme ring colour. Error: border `#991B1B` (dark `#F28B8B`) with a 12px message below.

### Segmented control (Process: CNC milling | CNC turning | Sheet metal)
Equal-width buttons with a 6px gap. Selected: `#E4ECF6` bg, navy border and label, weight 600 (dark: `#1D3A63`, `#6E8DB8` border, white label). Unselected: `surface` with a `border` outline.

### Option cards (lead time)
Radio cards. Selected: selected bg and border, plus a radio with a 5px orange ring.

### Quantity stepper
`raised` −/+ buttons (40×38) with a centred mono value.

### Drawing viewer
File chips above the canvas (selected chip uses the selected style). Toolbar of 36px icon buttons: zoom in, zoom out, measure, full screen. Below it, a **manufacturability check** row using the success and warning status colours.

### Price panel
Card with a **3px orange top border**. Rows for unit price, quantity and total use mono values. The total uses the `price` style. Full-width primary button (48px), then a secondary "Download quote PDF".

### Mobile sticky action bar
`surface` with a top border, above the tab bar: the total on the left, the primary button on the right. Vendor screens use secondary + primary buttons side by side.

### Vendor status stepper
Vertical steps with 24px nodes. Done: success circle with a check. Current: orange dot with a 4px selected-colour halo. To do: outlined circle. Steps are joined by a 2px `border` line.

### Marketplace card
Name (15/600), spec in mono (muted), price `₹ /kg` on the right, stock status pill, and a secondary "Add" button (36px).

---

## 9. Icons

Use **Lucide** (or an equivalent outline set): 1.6px stroke, round caps and joins, at 16px (in buttons), 18px (toolbar) or 22px (tab bar). Icons take the text colour of their context. Icon-only buttons must have an `aria-label`.

---

## 10. CSS variables

```css
:root {
  /* brand */
  --brand-navy: #102D52;
  --brand-orange: #FF7900;
  --on-orange: #0B2140;

  /* surfaces & text — light */
  --bg: #F5F7FA;
  --surface: #FFFFFF;
  --raised: #EEF2F7;
  --border: #D8DFE8;
  --text-heading: #102D52;
  --text-body: #23324A;
  --text-muted: #56677E;
  --link: #B34F00;

  /* primary */
  --primary: #FF7900;
  --primary-hover: #F27300;
  --primary-pressed: #E66C00;
  --primary-label: #0B2140;

  /* secondary & ghost */
  --secondary-bg: #FFFFFF;
  --secondary-border: #102D52;
  --secondary-label: #102D52;
  --secondary-hover: #EAF0F7;
  --secondary-pressed: #D9E3EF;
  --ghost-label: #102D52;
  --ghost-hover: #EAF0F7;
  --ghost-pressed: #D9E3EF;

  /* selected / disabled / focus */
  --selected-bg: #E4ECF6;
  --selected-label: #102D52;
  --selected-border: #102D52;
  --disabled-bg: #E6EAF0;
  --disabled-label: #94A1B2;
  --focus-ring: #102D52;

  /* viewer */
  --viewer-bg: #EEF2F7;
  --viewer-grid: #DCE3EC;
  --viewer-line: #102D52;

  /* status */
  --status-queued-bg: #EEF1F5;   --status-queued-fg: #4A5A70;
  --status-machining-bg: #E4ECF6; --status-machining-fg: #1D4E89;
  --status-qc-bg: #FDF3E1;       --status-qc-fg: #8A5300;
  --status-done-bg: #E6F4EA;     --status-done-fg: #166534;
  --status-hold-bg: #FBE9E9;     --status-hold-fg: #991B1B;

  /* type */
  --font-sans: 'Archivo', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;

  /* shape */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
}

[data-theme="dark"] {
  --bg: #07152A;
  --surface: #0D1F3B;
  --raised: #13284A;
  --border: #1F3657;
  --text-heading: #E7EDF5;
  --text-body: #C9D4E3;
  --text-muted: #93A4BC;
  --link: #FFA45C;

  --primary: #FF7900;
  --primary-hover: #FF8F2E;
  --primary-pressed: #E66C00;
  --primary-label: #0B2140;

  --secondary-bg: transparent;
  --secondary-border: #3A5378;
  --secondary-label: #E7EDF5;
  --secondary-hover: #162D50;
  --secondary-pressed: #1D3A63;
  --ghost-label: #FFA45C;
  --ghost-hover: #2A2118;
  --ghost-pressed: #3A2A18;

  --selected-bg: #1D3A63;
  --selected-label: #FFFFFF;
  --selected-border: #6E8DB8;
  --disabled-bg: #13233D;
  --disabled-label: #52657F;
  --focus-ring: #FFA45C;

  --viewer-bg: #0A1A31;
  --viewer-grid: #15294A;
  --viewer-line: #C9D6E8;

  --status-queued-bg: #16263F;   --status-queued-fg: #A9B6C8;
  --status-machining-bg: #183459; --status-machining-fg: #9EC1F0;
  --status-qc-bg: #2A2214;       --status-qc-fg: #F5C451;
  --status-done-bg: #12261A;     --status-done-fg: #6BD58E;
  --status-hold-bg: #2C1515;     --status-hold-fg: #F28B8B;
}

.btn-primary { background: var(--primary); color: var(--primary-label); border: 1px solid var(--primary); }
.btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
.btn-primary:active { background: var(--primary-pressed); border-color: var(--primary-pressed); }
.btn-primary[aria-pressed="true"] { background: var(--selected-bg); color: var(--selected-label); border-color: var(--selected-border); }
.btn-primary:disabled { background: var(--disabled-bg); color: var(--disabled-label); border-color: var(--disabled-bg); cursor: not-allowed; }
.btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--focus-ring); }
```

Dark mode follows the system setting (`prefers-color-scheme`) by default, with a manual switch saved per user.

---

## 11. Accessibility (verified contrast)

| Pair | Ratio |
|---|---|
| `#0B2140` on `#FF7900` (primary label) | 6.1 : 1 |
| `#0B2140` on `#F27300` (hover, light) | 5.5 : 1 |
| `#0B2140` on `#E66C00` (pressed) | 5.0 : 1 |
| `#0B2140` on `#FF8F2E` (hover, dark) | 7.1 : 1 |
| `#102D52` on `#F5F7FA` (heading, light) | 12.9 : 1 |
| `#56677E` on `#F5F7FA` (muted, light) | 5.4 : 1 |
| `#E7EDF5` on `#07152A` (text, dark) | 15.5 : 1 |
| `#93A4BC` on `#0D1F3B` (muted on dark surface) | 6.5 : 1 |
| `#B34F00` on `#FFFFFF` (link, light) | 5.2 : 1 |
| `#FFA45C` on `#07152A` (link, dark) | 9.3 : 1 |

---

## 12. Do / Don't

| Do | Don't |
|---|---|
| Use one orange button per screen or section | Use orange for icons, headings or backgrounds |
| Use dark navy labels on orange | Put white text on #FF7900 |
| Keep the drawing viewer neutral grey with a grid | Tint the viewer in the brand colour |
| Use mono and tabular numerals for prices and specs | Mix proportional digits in tables and totals |
| Use 1px borders and small radii | Use big shadows, gradients or glass effects |
| Show a status label with its colour | Rely on colour alone |

---

## 13. Reference screens

Design board: MechOneHub — Colour & Type Directions, section **"Navy & Orange — light & dark, desktop + mobile"**
- Theme sheet (tokens, logo, button states)
- Desktop · Instant quote (light / dark)
- Mobile · Buyer quote, Vendor job, Raw materials (light / dark)
