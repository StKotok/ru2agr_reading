# TOKENS — ru2gr-handoff

Clean token inventory after reconcile + tidy.

## Source
`docs/ru2gr-handoff/project/ru2gr-tokens.js` — single canonical source.

## Structure
```
window.RU2GR = {
  THEMES,         // { [themeName: string]: RawTheme }
  a,              // (hex: string, alpha: number) => rgba string
  buildPalette,   // (THEMES, themeName, contrastName) => ResolvedPalette
  hexToRgb,       // (hex: string) => [r, g, b]
  rgbToHex,       // ([r, g, b]) => hex string
  mix,            // (hex1, hex2, t) => mixed hex
  lum,            // (hex) => relative luminance 0-1
}
```

## Raw Theme (12 themes)
Each theme has 12 base tokens:
- **Surfaces**: `paper`, `alt`, `read`, `title`
- **Ink**: `ink`, `inkSoft`, `muted`, `muted2`
- **Accent**: `blue`, `blueBg`, `blueTx`
- **Warm**: `terra`, `terraSoft`
- **Positive**: `green`, `greenDk`, `greenBg`

## Resolved Palette (per theme + contrast)
`buildPalette()` derives these from the raw theme:
- **Derived from paper**: `content`, `card`, `sidebar`, `titlebar`, `read`
- **Derived from ink**: `line`, `line2`, `cardLine`
- **Computed**: `shadow`
- **Pass-through**: all raw theme tokens + `paper2 = card`

## Contrast levels (3)
| Level | rec (recess) | elv (elevate) |
|-------|-------------|---------------|
| Мягкий | 0.05 | 0.42 |
| Чёткий | 0.11 | 0.72 |
| Максимальный | 0.185 | 1.0 |

Dark themes use dampened multipliers: `elvAmt * 0.17`, `recAmt * 0.75`.

## Hardcoded chrome (prototype canvas bar)
In `ru2gr.dc.html`, the sticky canvas bar uses fixed neutral colors:
- `#cfcabf` — background (outside themed area)
- `#2b2620` — title text
- `#9a9488` — muted labels
- `#7a7468` — section headers
- `#5a5246` — select text

These are **intentionally neutral** — the canvas bar is prototype chrome,
not product UI. It sits above the themed components and controls them.
