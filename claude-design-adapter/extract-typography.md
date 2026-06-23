# Typography Extraction — Cambio Final.dc.html

Source: `docs/cambio-handoff/project/Cambio Final.dc.html`

---

## TYPESCALE (font-size)

| Value | Count | Roles | Destination |
|-------|-------|-------|-------------|
| `8px` | 3 | column headers (Currency, 24H, Amount) | `fsMicro` — shared |
| `8.5px` | 1 | ticker marquee | local |
| `9px` | 1 | currency sub-name | local |
| `10px` | 8 | CAMBIO label, theme-toggle label, change %, chips (5) | most common, but spans two semantic roles |
| `10.5px` | 1 | ExchangeRate-API pill | local |
| `11px` | 2 | currency decimal, active currency code | `fsSmall` — shared (mono body small) |
| `13px` | 2 | AC key, Done button | local (different families, different contexts) |
| `14px` | 2 | status-bar time, currency code | `fsBody` — shared (mono body default) |
| `15px` | 2 | backspace key, active flag emoji | local |
| `17px` | 15 | all calc digit/operator keys (7 8 9 4 5 6 1 2 3 0 , ÷ × − +) | `fsKeypad` — shared, most repeated value |
| `19px` | 1 | flag emoji (list) | local |
| `20px` | 1 | calc display | `fsDisplay` — shared (display large) |
| dynamic | 1 | `{{ item.amountSize }}px` → resolves to `17px` or `20px` | local (runtime conditional, see renderVals) |

**Note:** `10px` is the most frequent value by occurrence count (8), but spans two disconnected semantic roles — brand label + chips — so it does not form a single shared object. `17px` is the next most frequent (15 uses) and is concentrated in one coherent group (keypad), making `fsKeypad` the strongest candidate.

**Destination:**
- `fsMicro` — `8px`, column headers
- `fsBody` — `14px`, currency code, time
- `fsSmall` — `11px`, decimal, active code
- `fsKeypad` — `17px`, calc digit/operator keys
- `fsDisplay` — `20px`, calc display

---

## WEIGHT scale (font-weight)

| Value | Count | Roles | Destination |
|-------|-------|-------|-------------|
| `400` | 2 | amount, calc display | `fwRegular` — base body |
| `500` | 3 | status-bar time, currency code, active currency code | `fwMedium` — muted emphasis |
| `600` | 5 | column headers (3), change %, Done button | `fwSemiBold` — label emphasis |
| `700` | 1 | CAMBIO brand label | `fwBold` — brand/heading |

**Destination:**
- `fwRegular` — `400` (amount, display numbers)
- `fwMedium` — `500` (mono body text)
- `fwSemiBold` — `600` (labels, actionable text)
- `fwBold` — `700` (brand/heading)

---

## LINE-HEIGHT scale

| Value | Count | Roles | Destination |
|-------|-------|-------|-------------|
| `1` (unitless) | 3 | flag emoji, amount, active flag | `lhTight` — tight single-line display |

No other `line-height` values present. Every other text element inherits from `line-height: normal` (default).

**Destination:** `lhTight` — unitless `1`, for single-line compact layouts.

---

## LETTER-SPACING

| Value | Count | Roles | Destination |
|-------|-------|-------|-------------|
| `-.5px` | 2 | amount, calc display | `lsTight` — negative track for display numbers |
| `.03em` | 2 | currency code, currency sub-name | `lsNarrow` — mono body narrow |
| `.04em` | 1 | Done button | local |
| `.06em` | 2 | ticker marquee, active currency code | `lsWide` — mono accent |
| `.12em` | 3 | column headers (Currency, 24H, Amount) | `lsLabel` — uppercase headings |
| `.18em` | 1 | CAMBIO label | local (brand-only) |

**Destination:**
- `lsTight` — `-.5px` (negative track for display numbers)
- `lsNarrow` — `.03em` (tight mono body)
- `lsWide` — `.06em` (accent mono)
- `lsLabel` — `.12em` (uppercase column headings)

---

## TEXT-TRANSFORM

| Value | Count | Roles |
|-------|-------|-------|
| `uppercase` | 4 | CAMBIO brand label (1), column headers (3) |

Only `uppercase` appears, and always paired with explicit `letter-spacing`. The brand label uses `.18em` spacing; the column headers use `.12em`. Not extractable as a standalone token without its spacing partner.

---

## FONT-FAMILY usage (count only)

| Family | Count | Notes |
|--------|-------|-------|
| `'DM Mono',monospace` | 36 | Dominant — all mono UI text (rates, codes, keypad, chips, ticker) |
| `'DM Sans',sans-serif` | 3 | Root container default, CAMBIO label, Done button |

**Not retokenized** — both are already named font families loaded via Google Fonts. The Google Fonts link imports DM Sans weights 300–700 and DM Mono weights 300–500.

---

## REPEATED MULTI-PROP TEXT STYLES → shared style objects

### 1. `columnHeader` (3 identical occurrences)

```
font-family: 'DM Mono', monospace
font-size:   8px
font-weight: 600
letter-spacing: .12em
text-transform: uppercase
```

Elements: Currency, 24H, Amount column headers (lines 60–62).

**Destination:** shared style object named `columnHeader` or `labelMicro`.

---

### 2. `displayNumber` (2 occurrences, same core — font-size differs)

```
font-family:   'DM Mono', monospace
font-weight:   400
letter-spacing: -.5px
line-height:    1
```

Elements: amount (dynamic `{{ item.amountSize }}px` → 17 or 20), calc display (fixed `20px`).

The `{weight, letter-spacing, line-height, family}` is the shared core. Only `font-size` varies.

**Destination:** shared style object for the fixed props. `font-size` remains local per use (`fsDisplay` for calc display; dynamic for row amounts).

---

### 3. `digitKey` (15+ occurrences, single prop)

```
font-family: 'DM Mono', monospace
font-size:   17px
```

Elements: all calc digit/operator keys. Single prop repeated — too minimal to merit a multi-prop object. Declare `fsKeypad` as the type constant and let weight/spacing inherit.

**Destination:** `fsKeypad` font-size constant only.

---

## LOCALS (single-use, no extraction)

| Element | Style |
|---------|-------|
| Ticker | `8.5px, .06em` |
| Currency name | `9px, .03em` |
| ExchangeRate pill | `10.5px` |
| CAMBIO brand label | `10px, 700, .18em, uppercase` — `'DM Sans'` |
| Theme-toggle label | `10px` |
| Change % | `10px, 600` |
| Chip values | `10px` |
| Time | `14px, 500` |
| Flag emoji | `19px, lh:1` |
| Active flag | `15px, lh:1` |
| AC key | `13px` |
| Backspace key | `15px` |
| Done button | `13px, 600, .04em` — `'DM Sans'` |

---

## RENDER-VALS DYNAMIC

```js
amountSize: c.amount.length > 5 ? 17 : 20,
```

The row amount `font-size` is computed at render time. It resolves to either `17px` (longer amounts) or `20px` (shorter amounts), matching `fsKeypad` and `fsDisplay` respectively. No new type constant needed.
