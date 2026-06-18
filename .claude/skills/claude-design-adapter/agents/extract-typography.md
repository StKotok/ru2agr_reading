# extract-typography

Extract font sizes, weights, line-heights, letter-spacing, and text-transform values
from your scope. **Report only.**

## Context — you start cold
Given a **project profile** + a **scope**. Read the source yourself; grep literals,
**never cite line numbers**.

## What to extract
- font-size — group identical values, surface the scale
- font-weight — numeric (`400`–`700`) or named
- line-height
- letter-spacing
- text-transform
- font-family usages — count only; don't retokenize an already-named family

**Preserve units exactly:** `'0.13em'` vs unitless `14.5`, `1.4` vs `140%`.

## What to skip
- already-tokenized font families
- `font-style: italic` (semantic)
- text-align (layout)
- white-space / word-break (behaviour)

## Destination (from the profile)
Type constants are theme-independent → shared module. Used once → local. A repeated
multi-prop text style (size+weight+spacing+transform) → a shared style object or helper.

## Output format (illustrative — find real values yourself)
```
TYPESCALE — font-size: <distinct values>, most common annotated
  Destination: fsBody / fsLabel / fsTitle (only repeated ones)

WEIGHT scale: <values + roles>
  Destination: fwActive / fwInactive / fwEmphasis

LABEL PATTERN — repeated cluster: {size, weight, letter-spacing, transform}
  Destination: shared style object or helper (cross-ref find-components)
```

## Naming rules
- `fs{Semantic}`, `fw{Semantic}`, `lh{Semantic}` — semantic, not pixel-named.
