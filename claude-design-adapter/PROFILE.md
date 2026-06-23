# PROFILE — ru2gr-handoff

Generated: 2026-06-23

## kind
`design-handoff` — Claude Design export bundle (DC `.dc.html` format).

## Bundle structure
```
docs/ru2gr-handoff/
  README.md                           — handoff instructions (generic)
  project/
    ru2gr.dc.html                     — ROOT: canvas bar + imports children
    Греческая читалка.dc.html         — CHILD: Greek reader screen (~1005 lines)
    Слова.dc.html                     — CHILD: Dictionary screen (~940 lines)
    ru2gr-tokens.js                   — CANONICAL: 12 themes + contrast palette
    support.js                        — DC RUNTIME (generated, do not edit)
```

## Styling mechanism
- **Inline styles** via React `style` objects — no CSS classes for components
- **JS token system**: `window.RU2GR.THEMES` + `window.RU2GR.buildPalette(THEMES, theme, contrast)` → resolved palette object `C`
- Palette keys: `paper`, `paper2`, `sidebar`, `read`, `titlebar`, `ink`, `inkSoft`, `muted`, `muted2`, `line`, `line2`, `blue`, `blueHead`, `blueBg`, `blueTx`, `terra`, `terraSoft`, `green`, `greenDk`, `greenBg`, plus contrast-derived: `content`, `card`, `shadow`, `cardLine`
- Each component accesses `this.C` (the resolved palette) and references colors as `C.ink`, `C.muted`, etc.
- Alpha helper: `this.a(hex, alpha)` → `rgba(...)`

## Token system
- **Source**: `ru2gr-tokens.js` — IIFE, sets `window.RU2GR = { THEMES, a, buildPalette }`
- **12 themes**: Пергамент, Сепия, Слоновая кость, Туман, Море, Лес, Роза, Лаванда, Закат, Тёмная, Ночь, Уголь
- **3 contrast levels**: Мягкий, Чёткий, Максимальный
- **Contrast model**: elevates/recesses paper color to derive content, card, sidebar, titlebar, read surfaces + shadow/line tokens

## Critical DRIFT (3-way duplication)
1. **`buildThemes()`** — duplicated in BOTH child DC files with fallback to `window.RU2GR`
2. **`palette()`** — duplicated in BOTH child DC files with fallback to `window.RU2GR.buildPalette`
3. **Utility functions**: `a()`, `hexToRgb()`, `rgbToHex()`, `mix()`, `lum()` — duplicated across files
4. **Icons**: `iconRead`, `iconWords`, `iconInfo`, `iconEye`, `iconGear`, `chev`, `chevH` — duplicated between child DC files
5. **Root HTML hardcoded colors**: `#cfcabf`, `#2b2620`, `#9a9488`, `#7a7468`, `#5a5246` in canvas bar

## Destination layers
- `ru2gr-tokens.js` — canonical token source (keep as single source of truth)
- Child DC `<script data-dc-script>` — component logic only (remove token duplication)
- Root DC `<x-dc>` template — layout + controls (de-hardcode colors where possible)

## Fonts
- Serif: `'Gentium Plus', Georgia, serif`
- Sans: `'Source Sans 3', system-ui, sans-serif`
