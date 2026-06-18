# format-canonical

Normalise literal-form variants before `name-tokens` merges them.
**Report only** — you produce a canonicalisation map, not edits.

## Context — you start cold
Given the **project profile** and the raw outputs of Phase 1 agents. Run AFTER
the 4 audit agents complete, BEFORE `name-tokens`.

## Why
Different parts of a codebase may write the same value differently:
- `.28` vs `0.28`
- `#fff` vs `#ffffff` vs `#FFF` vs `white`
- `'11px 12px'` vs `'11px 12px'` (trailing space)
- `rgba(0,0,0,.5)` vs `rgba(0, 0, 0, 0.5)` (spacing)

These are one token — but `name-tokens` sees them as different strings.

## Process

### Step 1 — Collect all literal forms
Scan the 4 audit outputs. For each extracted value, collect every surface form
it appears in across the codebase.

### Step 2 — Group equivalent forms
| Dimension | Equivalence rule |
|-----------|-----------------|
| Numbers | `0.18` = `.18` = `.180` (trailing zeros are format) |
| Hex colours | `#fff` = `#ffffff` = `#FFF` = `#FFFFFF` (case-insensitive, short/long) |
| Named colours | `white` = `#ffffff` = `#fff` (only for CSS named colours) |
| rgba/hsla | `rgba(0,0,0,.5)` = `rgba(0, 0, 0, 0.5)` = `rgba(0,0,0,50%)` |
| Strings | Compare trimmed — trailing spaces are format, not value |

### Step 3 — Choose canonical form
For each group, pick ONE canonical form. Prefer:
1. The form already used in the project's token definitions
2. The most common form in the codebase
3. Lowercase hex, `0.18` over `.18`, no trailing zeros

### Step 4 — Flag genuine value differences
If two forms DON'T normalise to the same value → they are genuinely different.
`#15140f` ≠ `#15140e`. Flag as conflict.

## Output format
```
CANONICAL MAP:

<value-group>:
  Forms found:   0.18 / .18 / .180
  Canonical:     0.18  (matches project convention)
  Affected:      3 sites in 2 units
  Action:        use 0.18 in token definition; all sites resolve correctly

<value-group>:
  Forms found:   #FFF / #ffffff
  Canonical:     #fff  (short hex, lowercase — project convention)
  Affected:      1 site each
  Action:        define token as #fff; both sites resolve correctly

CONFLICT — not the same value:
  #15140f ≠ #15140e — one character different
  Location:      backdrop in modeMenu vs overlay in wordSheet
  Action:        keep as TWO separate tokens; flag for user
```

## Rules
- Never change a value — only normalise its representation.
- If the project has no canonical form convention, use the most common form.
- Flag ambiguous cases; don't silently merge.
- Pass the canonical map directly into `name-tokens` — it uses canonical forms
  for deduplication.
