# RECONCILE — ru2gr-handoff

Date: 2026-06-23
Depth: Auto (user requested maximum cleanup)

## Drift inventory

### 1. THEME TABLE (3-way duplication)
- **Canonical**: `ru2gr-tokens.js` → `window.RU2GR.THEMES` (12 themes)
- **Duplicate A**: `Греческая читалка.dc.html` → `buildThemes()` (12 themes, ~18 lines)
- **Duplicate B**: `Слова.dc.html` → `buildThemes()` (12 themes, ~18 lines)
- **Resolution**: Both child files now delegate to `window.RU2GR.THEMES`
- **Fallback**: Removed; if `window.RU2GR` is missing, returns null (error surface)

### 2. PALETTE/CONTRAST BUILDER (3-way duplication)
- **Canonical**: `ru2gr-tokens.js` → `window.RU2GR.buildPalette(THEMES, theme, contrast)`
- **Duplicate A**: `Греческая читалка.dc.html` → `palette()` (with fallback)
- **Duplicate B**: `Слова.dc.html` → `palette()` (full duplicate, ~20 lines)
- **Resolution**: Both child files now delegate to `window.RU2GR.buildPalette()`

### 3. UTILITY FUNCTIONS (duplicated across files)
- `a(hex, al)` — duplicated in all 3 files → now delegates to `window.RU2GR.a()`
- `hexToRgb()`, `rgbToHex()`, `mix()`, `lum()` — duplicated in tokens.js + Слова → now delegates to `window.RU2GR.*`
- **Enhancement**: `window.RU2GR` now exports `hexToRgb`, `rgbToHex`, `mix`, `lum`

### 4. ICON DUPLICATION
- Icons duplicated between Греческая читалка and Слова with slight variations
- **Resolution**: Deferred to future shared icon module (icons are component-internal, not tokens)

### 5. HARDCODED ROOT COLORS
- Canvas bar in `ru2gr.dc.html` uses hardcoded `#cfcabf`, `#2b2620`, `#9a9488`, etc.
- **Resolution**: Deferred to TIDY phase (canvas bar is prototype chrome, not product UI)

## Canonical source map

| Value | Canonical source | Access pattern |
|-------|-----------------|----------------|
| Themes (12) | `ru2gr-tokens.js` → `THEMES` | `window.RU2GR.THEMES` |
| Contrast palette | `ru2gr-tokens.js` → `buildPalette()` | `window.RU2GR.buildPalette(themes, themeName, contrastName)` |
| Alpha helper | `ru2gr-tokens.js` → `a()` | `window.RU2GR.a(hex, alpha)` |
| Color utilities | `ru2gr-tokens.js` → `hexToRgb/rgbToHex/mix/lum` | `window.RU2GR.hexToRgb(...)` |

## Bytes saved
- Греческая читалка: ~720 bytes removed (18 lines theme table + palette simplification)
- Слова: ~850 bytes removed (18 lines theme table + 20 lines palette + utility dedup)
- ru2gr-tokens.js: +4 exports added (negligible)
