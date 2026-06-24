# RECONCILE: ru2gr-handoff

## Resolved conflicts

### 1. Duplicated base CSS + keyframes (all 3 .dc.html files)
**Decision:** Keep full `<style>` block only in entry point `ru2gr.dc.html`.
Remove from `Греческая читалка.dc.html` and `Слова.dc.html` — the DC runtime's
helmet manager injects styles from the entry point, and child components inherit them.

**Action:**
- `ru2gr.dc.html`: KEEP `<style>` with base reset + keyframes (canonical source)
- `Греческая читалка.dc.html`: REMOVE `<style>` block (lines 15-24)
- `Слова.dc.html`: REMOVE `<style>` block (lines 15-24)

### 2. Duplicated Google Fonts `<link>` (all 3 .dc.html files)
**Decision:** Keep `<link>` only in entry point. DC runtime helmet manager deduplicates
`<link>` elements — the entry point loads them once.

**Action:**
- `ru2gr.dc.html`: KEEP font `<link>` + preconnect (canonical source)
- `Греческая читалка.dc.html`: REMOVE font `<link>` and preconnect (lines 11-13)
- `Слова.dc.html`: REMOVE font `<link>` and preconnect (lines 11-13)

### 3. Duplicated `<script src="./ru2gr-tokens.js">` (all 3 files)
**Decision:** KEEP in all files. Each `.dc.html` is independently fetchable by the
DC runtime and needs `window.RU2GR` available at parse time. The `<script>` tag in
`<helmet>` is processed by the helmet manager which deduplicates. Keep for safety.

### 4. Duplicated `<script src="./support.js">` (all 3 files)
**Decision:** KEEP in entry point only. The DC runtime (`support.js`) bootstraps
once from the entry HTML page. Child `.dc.html` files loaded via `dc-import` don't
need it — the runtime is already active.

**Action:**
- `Греческая читалка.dc.html`: REMOVE `<script src="./support.js">`
- `Слова.dc.html`: REMOVE `<script src="./support.js">`

### 5. Hardcoded wrapper colors in ru2gr.dc.html
**Decision:** These are "host chrome" (design-system showcase frame), not themed app UI.
Keep as-is but document as intentional non-themed chrome. The canvas bar serves as a
neutral frame around themed components.

## Canonical source map

| Content | Canonical location |
|---------|-------------------|
| Base CSS reset + keyframes | `ru2gr.dc.html` `<style>` |
| Google Fonts | `ru2gr.dc.html` `<link>` |
| DC runtime | `support.js` (generated — DO NOT EDIT) |
| Design tokens | `ru2gr-tokens.js` `window.RU2GR` |
| Theme definitions (12 themes) | `ru2gr-tokens.js` `THEMES` |
| Contrast palette builder | `ru2gr-tokens.js` `buildPalette()` |
| Reading screen component | `Греческая читалка.dc.html` |
| Dictionary screen component | `Слова.dc.html` |
| Entry point / canvas | `ru2gr.dc.html` |
