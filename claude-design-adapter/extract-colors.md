# Extract-Colors Report: Cambio Final.dc.html

Scope: `docs/cambio-handoff/project/Cambio Final.dc.html`
Profile: `claude-design-adapter/PROFILE.md`
Token system: `this._dark` / `this._light` class fields -> `renderVals()` -> `{{ t.tokenName }}` interpolation

---

## Section 1: Non-tokenized colours (in template / JS / CSS)

These colour values appear **outside** the `{{ t.* }}` token system and are candidates for tokenization.

### 1.1 Phone frame shadow — box-shadow layers

A single `box-shadow` on the phone outer wrapper (line 20) embeds five hardcoded values:

```
COLOR: rgba(0,0,0,0.55)   (derived)
  Used as: Phone outer shadow, primary layer (48px blur)
  Found at: `rgba(0,0,0,0.55)` in box-shadow on phoneBg div
  Destination: Either (a) shared constant `shadowBase: '#000000'` with alpha in
               renderVals(), or (b) derive as `phoneShadowPrimary` in renderVals().
  Note: Base colour is pure black; alpha .55 is the only variant.
```

```
COLOR: rgba(0,0,0,0.3)   (derived)
  Used as: Phone outer shadow, secondary layer (8px blur)
  Found at: `rgba(0,0,0,0.3)` in same box-shadow
  Destination: Same as above, shadow layer 2.
```

```
COLOR: rgba(255,255,255,0.1)   (derived)
  Used as: Phone frame inset highlight (1px blur, inset)
  Found at: `rgba(255,255,255,0.1)` in same box-shadow
  Destination: Same as above, inset highlight layer.
```

### 1.2 SVG `fill="none"` (named value)

```
COLOR: none   (constant)
  Used as: Battery icon outline — no fill, visible stroke only
  Found at: `fill="none"` on SVG `<rect>` in battery widget (line 30)
  Destination: Keep inline. SVG-specific paint value, not a CSS colour.
  Note: This is `none` as an SVG paint server value, NOT `display:none`.
        The `stroke` on the same element references `{{ t.text }}`.
```

### 1.3 Opacity modulations on token colours

These opacity values modulate a `{{ t.* }}` base colour and are not themselves tokenized.

```
COLOR: opacity:0.35   (derived)
  Used as: Battery icon outline rect — dims `stroke="{{ t.text }}"`
  Found at: `opacity=".35"` on SVG `<rect>` in battery widget (line 30)
  Destination: Could become `batteryOutlineOpacity` in renderVals().
  Note: Currently hardcoded in the SVG attribute. Value is identical in both
        themes so could be a constant.
```

```
COLOR: opacity:0.4   (derived)
  Used as: Battery icon charging indicator — dims `fill="{{ t.text }}"`
  Found at: `opacity=".4"` on SVG `<path>` in battery widget (line 30)
  Destination: Could become `batteryChargeOpacity` in renderVals().
```

```
COLOR: opacity:0.25   (derived)
  Used as: Calculator keypad spacer block (placeholder between "," and "Done")
  Found at: `opacity:.25` inline style (line 134)
  Destination: Could become `calcSpacerOpacity` in renderVals(), or stay inline.
  Note: The spacer has no content and uses `opacity` to visually blend the
        `background:{{ t.calcKey }}` it inherits from the grid. Value is
        independent of theme.
```

```
COLOR: opacity:1   (derived)
  Used as: `@keyframes timerPulse` 0%/100% — full opacity of `background:{{ t.liveDot }}`
  Found at: CSS `@keyframes timerPulse` (line 14)
  Destination: Keep in CSS keyframes. Modulates the liveDot token.
```

```
COLOR: opacity:0.45   (derived)
  Used as: `@keyframes timerPulse` 50% — dimmed opacity of `background:{{ t.liveDot }}`
  Found at: CSS `@keyframes timerPulse` (line 14)
  Destination: Keep in CSS keyframes.
```

### 1.4 `transparent` in renderVals()

```
COLOR: transparent   (constant)
  Used as: Currency row background for non-active rows
  Found at: `'transparent'` in renderVals() rowBg ternary (line 280)
  Destination: Stays local in renderVals(). Expression is:
               `c.code === activeRow ? t.activeRowBg : 'transparent'`
               `transparent` is the CSS default; no token needed.
```

---

## Section 2: Per-theme token definitions (in `_dark` / `_light`)

These are the **existing** token definitions. Every colour here already participates in the token system. Listed below for completeness — to identify within-theme duplicates (candidates for shared constants) and cross-theme constants.

### 2.1 Cross-theme constant (same hex in both themes)

One colour is identical in both themes and could be elevated to a shared constant:

| Hex | Tokens (dark) | Tokens (light) |
|-----|---------------|----------------|
| `#FFFFFF` | calcDoneText | screenBg, calcKey, pillBg, navBg, statusBar, headerBg, calcDoneText |

Note: In the **light** theme, `#FFFFFF` serves 7 tokens (semantically distinct roles all happen to be white). In the **dark** theme, it only serves `calcDoneText`. A shared constant `const WHITE = '#FFFFFF'` could replace the literal in both theme objects, though the light theme's heavy reuse of it for many roles is a semantic choice — the tokens remain separate even when their value is identical.

### 2.2 Dark theme — within-theme value reuse

Same hex value shared by multiple tokens in `_dark`:

| Hex | Tokens | Frequency |
|-----|--------|-----------|
| `#070A12` | screenBg, navBg, statusBar, headerBg | 4 |
| `#0D1524` | surface, activeRowBg, pillBg | 3 |
| `#0A0F1C` | surfaceAlt, calcBg, tickerBg | 3 |
| `#1E2E48` | borderLight, pillBorder, chipBorder | 3 |
| `#4B7CF8` | accent, calcDone, navActive | 3 |
| `#8AA4CC` | textSub, pillText | 2 |
| `#3D5070` | textMuted, moreIcon | 2 |
| `#243348` | textDim, navInactive | 2 |
| `#10B981` | green, liveDot | 2 |

Note: These are existing tokens that happen to share colour values. Not a refactor target unless the naming should be rationalized. Keeping separate semantic names is preferred per the profile's convention.

### 2.3 Light theme — within-theme value reuse

| Hex | Tokens | Frequency |
|-----|--------|-----------|
| `#FFFFFF` | screenBg, calcKey, pillBg, navBg, statusBar, headerBg, calcDoneText | 7 |
| `#E4E8F0` | borderMid, borderLight, pillBorder, chipBorder | 4 |
| `#F8F9FC` | surfaceAlt, tickerBg | 2 |
| `#0A0A14` | text, navActive | 2 |
| `#9BA3AE` | textMuted, moreIcon | 2 |
| `#1E50D8` | accent, calcDone | 2 |
| `#059669` | green, liveDot | 2 |

### 2.4 Full per-theme token inventory

#### Dark theme (`_dark`)

| Token | Value |
|-------|-------|
| canvasBg | `#0D0E14` |
| phoneBg | `#0A0A0E` |
| screenBg | `#070A12` |
| surface | `#0D1524` |
| surfaceAlt | `#0A0F1C` |
| border | `#0F1A2E` |
| borderMid | `#1A2840` |
| borderLight | `#1E2E48` |
| text | `#E0E8FF` |
| textSub | `#8AA4CC` |
| textMuted | `#3D5070` |
| textDim | `#243348` |
| accent | `#4B7CF8` |
| green | `#10B981` |
| red | `#EF4444` |
| calcBg | `#0A0F1C` |
| calcKey | `#111D30` |
| calcOp | `#192540` |
| calcDone | `#4B7CF8` |
| calcDoneText | `#FFFFFF` |
| navBg | `#070A12` |
| tickerBg | `#0A0F1C` |
| statusBar | `#070A12` |
| activeRowBg | `#0D1524` |
| headerBg | `#070A12` |
| pillBg | `#0D1524` |
| pillBorder | `#1E2E48` |
| pillText | `#8AA4CC` |
| liveDot | `#10B981` |
| chipBorder | `#1E2E48` |
| chipText | `#5070A0` |
| navActive | `#4B7CF8` |
| navInactive | `#243348` |
| moreIcon | `#3D5070` |

Total: 34 token values, 19 unique hex values.

#### Light theme (`_light`)

| Token | Value |
|-------|-------|
| canvasBg | `#E5E1D8` |
| phoneBg | `#D8D4CC` |
| screenBg | `#FFFFFF` |
| surface | `#FAFBFF` |
| surfaceAlt | `#F8F9FC` |
| border | `#EFEFEF` |
| borderMid | `#E4E8F0` |
| borderLight | `#E4E8F0` |
| text | `#0A0A14` |
| textSub | `#4B5563` |
| textMuted | `#9BA3AE` |
| textDim | `#C8D0DC` |
| accent | `#1E50D8` |
| green | `#059669` |
| red | `#DC2626` |
| calcBg | `#F4F6FA` |
| calcKey | `#FFFFFF` |
| calcOp | `#EBF0FF` |
| calcDone | `#1E50D8` |
| calcDoneText | `#FFFFFF` |
| navBg | `#FFFFFF` |
| tickerBg | `#F8F9FC` |
| statusBar | `#FFFFFF` |
| activeRowBg | `#F5F7FF` |
| headerBg | `#FFFFFF` |
| pillBg | `#FFFFFF` |
| pillBorder | `#E4E8F0` |
| pillText | `#6B7280` |
| liveDot | `#059669` |
| chipBorder | `#E4E8F0` |
| chipText | `#B0B8C8` |
| navActive | `#0A0A14` |
| navInactive | `#D0D5DD` |
| moreIcon | `#9BA3AE` |

Total: 34 token values, 20 unique hex values.

---

## Section 3: Summary of findings

### Not found in scope
- `currentColor` — no occurrences
- 3-digit hex shorthand (`#fff`, `#000`) — no occurrences
- `hsl()` / `hsla()` — no occurrences
- `rgb()` (non-alpha) — no occurrences
- Token-like `{{ t.* }}` interpolations used as colour — confirmed, all 24 theme tokens are properly referenced in template

### Actionable candidates for tokenization

| Priority | What | Where | Rationale |
|----------|------|-------|-----------|
| High | `rgba(0,0,0,0.55)` + `rgba(0,0,0,0.3)` + `rgba(255,255,255,0.1)` | box-shadow on phoneBg div (line 20) | Only shadow in the design; should be a derived token in renderVals() — needs to adapt if theme changes dramatically |
| Low | `opacity:0.35`, `opacity:0.4` | Battery SVG (line 30) | Modulate `{{ t.text }}`; rare usage, keep inline |
| Low | `opacity:0.25` | Calc spacer (line 134) | Modulates `{{ t.calcKey }}`; single use, keep inline |
| None | `fill="none"` | Battery SVG (line 30) | SVG paint value, not a CSS colour |
| None | `'transparent'` | renderVals() rowBg (line 280) | CSS default; used as ternary fallback |
| None | `opacity:1`, `opacity:0.45` | CSS @keyframes (line 14) | CSS animation; stays in stylesheet |

### Constant candidate

| Hex | Token | Why |
|-----|-------|-----|
| `#FFFFFF` | calcDoneText (both themes) | Identical value in `_dark` and `_light`. Could be `const WHITE = '#FFFFFF'` above the class, then referenced in both theme objects. Light theme's other white tokens (screenBg, calcKey, pillBg, navBg, statusBar, headerBg) share `#FFFFFF` by coincidence of design — they remain semantically separate even if aliased to the same constant. |
