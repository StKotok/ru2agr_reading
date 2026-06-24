# TOKENS: ru2gr-handoff

## Token inventory (post-tidy)

### Canvas chrome tokens (CSS custom properties — `:root` in ru2gr.dc.html)

| Token | Value | Role |
|-------|-------|------|
| `--canvas-bg` | `#cfcabf` | Page background (neutral warm gray) |
| `--canvas-bar-bg` | `rgba(207,202,191,0.92)` | Sticky bar background (frosted glass) |
| `--canvas-bar-border` | `rgba(40,34,22,0.10)` | Sticky bar bottom border |
| `--canvas-ink` | `#2b2620` | Primary text (brand, headings) |
| `--canvas-ink-soft` | `#5a5246` | Secondary text (controls) |
| `--canvas-muted` | `#9a9488` | Muted text (subtitles, labels) |
| `--canvas-muted2` | `#7a7468` | Accent muted (section labels) |
| `--canvas-line` | `rgba(40,34,22,0.14)` | Section dividers |
| `--canvas-line-light` | `rgba(40,34,22,0.10)` | Light borders |
| `--canvas-select-bg` | `rgba(255,255,255,0.55)` | Select element background |
| `--canvas-select-border` | `rgba(40,34,22,0.15)` | Select element border |
| `--canvas-card-bg` | `#f4f2ec` | Screen card background |
| `--canvas-phone-bezel` | `#15140f` | Phone frame bezel |

### Theme tokens (ru2gr-tokens.js → `window.RU2GR.THEMES`)

12 themes × 18 raw tokens each:
`paper`, `alt`, `read`, `title`, `ink`, `inkSoft`, `muted`, `muted2`,
`blue`, `blueBg`, `blueTx`, `terra`, `terraSoft`, `green`, `greenDk`, `greenBg`

### Derived tokens (ru2gr-tokens.js → `buildPalette(THEMES, theme, contrast)`)

Contrast-aware: `content`, `card`, `sidebar`, `titlebar`, `read`,
`line`, `line2`, `cardLine`, `shadow`, `paper2`

### Font tokens

| Role | Stack |
|------|-------|
| Serif (headings, Greek, body) | `'Gentium Plus', Georgia, serif` |
| Sans (UI, labels, nav) | `'Source Sans 3', system-ui, sans-serif` |

### Token flow

```
Theme name (prop) ──┐
Contrast name (prop) ┘
  → buildPalette(THEMES, theme, contrast)
    → resolved C object (per-component palette)
      → inline style: {background: C.paper, color: C.ink}
```

## Coverage

- ✅ All themed component colors: via `C.*` palette (100% tokenized)
- ✅ Canvas chrome colors: via CSS custom properties (100% tokenized)
- ✅ Font stack: centralized in component constructors (2 font families)
- ⚠️ Some inline numeric values (padding, gap, border-radius) remain as
  local constants — acceptable per destination rule (used once)
