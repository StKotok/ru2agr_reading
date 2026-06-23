# Spatial constants — `Cambio Final.dc.html`

Extracted by `extract-spatial` agent.  
Source: `docs/cambio-handoff/project/Cambio Final.dc.html`

---

## RADIUS

### `46px`
- Used in: phone outer bezel — 1 occurrence
- Find with: `border-radius:46px`
- Destination: `phoneRadius` (local — single use)

### `37px`
- Used in: screen inner frame — 1 occurrence
- Find with: `border-radius:37px`
- Destination: `screenRadius` (local — single use)

### `7px`
- Used in: calculator key buttons — 16 occurrences (all 15 key divs + the spacer)
- Find with: `border-radius:7px`
- Destination: `calcKeyRadius` (shared — 16 uses across keypad)
- Conflict: none within this value, but note `8px` immediately below is a near-adjacent value for a sibling element

### `8px`
- Used in: overflow/three-dot button (action bar, right edge) — 1 occurrence
- Find with: `border-radius:8px`
- Destination: `moreBtnRadius` (local — single use)

### `999px`
- Used in: exchange-rate pill, theme-switch pill, all 5 chips — 7 occurrences
- Find with: `border-radius:999px`
- Destination: `pillRadius` (shared — all pill/chip-style elements use the same max-pill shape)

### `50%`
- Used in: live dots (action bar + ticker), accent dot (currency row) — 3 occurrences
- Find with: `border-radius:50%`
- Destination: `dotRadius` (shared — all circular indicator dots)

### `0 2px 2px 0`
- Used in: accent-stripe left border highlight — 1 occurrence
- Find with: `border-radius:0 2px 2px 0`
- Destination: `stripeRadius` (local — single use, unique asymmetric shape)

---

## PADDING

### `48px`
- Used in: canvas outer wrapper — 1 occurrence
- Find with: `padding:48px`
- Destination: `canvasPad` (local — single use, outermost page pad)

### `10px`
- Used in: phone body (bezel-to-screen gap) — 1 occurrence
- Find with: `padding:10px`
- Destination: `phonePad` (local — single use, encloses screen within phone)

### `12px 20px 0`
- Used in: status bar row — 1 occurrence
- Find with: `padding:12px 20px 0`
- Destination: `statusBarPad` (local — single use)

### `0 18px`
- Used in: action bar (CAMBIO title row) — 1 occurrence
- Find with: `padding:0 18px`
- Destination: `actionBarPad` (local — single use)

### `0 10px`
- Used in: exchange-rate API pill — 1 occurrence
- Find with: `padding:0 10px`
- Destination: local (single use)
- Conflict: `0 9px` is used on the theme pill and all chips — same context (pill/chip), differs by 1 px

### `0 9px`
- Used in: theme-switch pill (line 1) + all 5 chip buttons (lines 5) — 6 occurrences
- Find with: `padding:0 9px`
- Destination: `chipHorizPad` (shared — all chip-style pill elements)
- Conflict: exchange-rate pill uses `0 10px` — 1 px wider. If they should unify, pick `9px` (more occurrences).

### `0 14px`
- Used in: ticker bar — 1 occurrence
- Find with: `padding:0 14px`
- Destination: `tickerPad` (local — single use)

### `6px 14px 4px 18px`
- Used in: column headers row — 1 occurrence
- Find with: `padding:6px 14px 4px 18px`
- Destination: `colHeaderPad` (local — single use, asymmetric vertical 6/4)

### `11px 14px 11px 18px`
- Used in: each currency row (sc-for template, N instances) — 1 template occurrence
- Find with: `padding:11px 14px 11px 18px`
- Destination: `rowPad` (local — single template, but renders N rows; keep local to the row template)

### `5px 12px`
- Used in: chip bar container — 1 occurrence
- Find with: `padding:5px 12px`
- Destination: `chipBarPad` (local — single use)

### `8px 14px 4px`
- Used in: calculator display header — 1 occurrence
- Find with: `padding:8px 14px 4px`
- Destination: `calcHeaderPad` (local — single use)

### `5px 10px 9px`
- Used in: calculator keypad grid container — 1 occurrence
- Find with: `padding:5px 10px 9px`
- Destination: `keypadPad` (local — single use)

### `0 0 8px`
- Used in: nav bar container — 1 occurrence
- Find with: `padding:0 0 8px`
- Destination: `navPad` (local — single use, bottom-only padding for home-indicator clearance)

---

## MARGIN

### `margin-left:5px`
- Used in: theme-switch pill (spacing from exchange-rate pill) — 1 occurrence
- Find with: `margin-left:5px`
- Destination: `themeToggleMarginLeft` (local — single use)

### `margin-left:2px`
- Used in: overflow/three-dot button — 1 occurrence
- Find with: `margin-left:2px`
- Destination: `moreBtnMarginLeft` (local — single use)

### `margin-top:2px`
- Used in: currency row subtext (currency name) — 1 occurrence
- Find with: `margin-top:2px`
- Destination: `curNameMarginTop` (local — single use)

### `margin-top:1px`
- Used in: decimal amount text — 1 occurrence
- Find with: `margin-top:1px`
- Destination: `decMarginTop` (local — single use)

### `margin:0 14px`
- Used in: row divider line (between currency rows) — 1 occurrence
- Find with: `margin:0 14px`
- Destination: `dividerMarginX` (local — single use, horizontal margins matching row padding inset)

---

## GAP (flex/grid gaps)

### `5px`
- Used in: status bar icons, exchange pill, theme pill, row code+dot group, chip bar — 5 occurrences
- Find with: `gap:5px`
- Destination: `gapXs` or `gapSm` (shared — smallest base gap, used across 5 unrelated containers)

### `7px`
- Used in: ticker bar — 1 occurrence
- Find with: `gap:7px`
- Destination: `tickerGap` (local — single use, between live dot and text)

### `8px`
- Used in: currency row items, calculator display header — 2 occurrences
- Find with: `gap:8px`
- Destination: `gapMd` (shared — occurs in two structurally similar horizontal-group contexts)

### `4px`
- Used in: calculator keypad grid — 1 occurrence
- Find with: `gap:4px`
- Destination: `keypadGap` (local — single use, tight key-to-key gutter)

---

## WIDTH / HEIGHT / MIN/MAX DIMENSIONS

### `min-height:100vh`
- Used in: canvas wrapper — 1 occurrence
- Find with: `min-height:100vh`
- Destination: `canvasMinH` (local — single use, viewport-fill)

### `width:340px; height:780px`
- Used in: screen frame (phone display area) — 1 occurrence
- Find with: `width:340px` / `height:780px`
- Destination: `screenWidth`, `screenHeight` (local — single use, fixed device canvas)

### `height:44px`
- Used in: status bar (line 1) + calculator keys (16 keys) — 17 occurrences total
- Find with: `height:44px`
- Destination: **CONFLICT** — same literal value, two entirely different contexts
  - Status bar row → `statusBarH`
  - Calculator key buttons → `calcKeyH`
  - Do NOT merge: status bar height is a layout-bar constant, key height is a touch-target constant. If they happen to match it is coincidental.

### `height:50px`
- Used in: action bar (CAMBIO + pills row) — 1 occurrence
- Find with: `height:50px`
- Destination: `actionBarH` (local — single use)

### `height:30px`
- Used in: exchange-rate pill + theme-switch pill — 2 occurrences
- Find with: `height:30px`
- Destination: `pillHeight` (shared — both pills are identical size)

### `width:36px; height:36px`
- Used in: overflow/three-dot button container — 1 occurrence
- Find with: `width:36px` / `height:36px`
- Destination: `moreBtnSize` (local — single use)

### `height:24px`
- Used in: ticker bar — 1 occurrence
- Find with: `height:24px`
- Destination: `tickerH` (local — single use)

### `width:6px; height:6px`
- Used in: live dot in action bar pill + live dot in ticker — 2 occurrences
- Find with: `width:6px` / `height:6px`
- Destination: `liveDotSize` (shared — both are the pulsing green live indicator)

### `width:52px`
- Used in: 24H column header + change value cell — 2 occurrences
- Find with: `width:52px`
- Destination: `changeColW` (shared — fixed column width for the 24H/change column)

### `width:96px`
- Used in: Amount column header + amount tappable cell — 2 occurrences
- Find with: `width:96px`
- Destination: `amountColW` (shared — fixed column width for the Amount column)

### `width:3px`
- Used in: accent stripe (left edge of active row) — 1 occurrence
- Find with: `width:3px`
- Destination: `stripeW` (local — single use)

### `width:5px; height:5px`
- Used in: accent dot in currency row — 1 occurrence
- Find with: `width:5px` / `height:5px`
- Destination: `accentDotSize` (local — single use, distinct from `liveDotSize`)

### `height:26px`
- Used in: all 5 chip buttons — 5 occurrences
- Find with: `height:26px`
- Destination: `chipHeight` (shared — all chips identical)

### `height:54px`
- Used in: nav bar — 1 occurrence
- Find with: `height:54px`
- Destination: `navBarH` (local — single use)

---

## POSITIONING OFFSETS

### `left:0; top:4px; bottom:4px`
- Used in: accent stripe (active-row highlight, absolutely positioned) — 1 occurrence
- Find with: `left:0; top:4px; bottom:4px`
- Destination: local — single use

---

## SVG ICON DIMENSIONS (for reference)

| Icon | Size | Occurrences |
|---|---|---|
| Signal bars | `16x11` | 1 |
| Wi-Fi | `15x11` | 1 |
| Battery | `25x12` | 1 |
| Chevron down | `11x11` | 1 |
| Moon (theme) | `11x11` | 1 |
| Three-dot horiz | `11x11` | 1 (actually the "more" icon in action bar — same 11x11) |
| Three-dot vert | `18x18` | 1 (overflow button) |
| Exchange arrows | `22x22` | 1 (nav) |
| Grid | `22x22` | 1 (nav) |
| Settings gear | `22x22` | 1 (nav) |

These are icon-container sizes, not layout constants. Included for completeness; likely do not need token extraction.

---

## SUMMARY BY DESTINATION TYPE

| Category | Count |
|---|---|
| Shared (multi-use, same context) | 12 |
| Local (single use) | 33 |
| Conflict (same literal, different contexts) | 1 (`height:44px`) |
| Near-identical conflict (1 px delta) | 1 (`0 9px` vs `0 10px` on pills) |
