# extract-spatial

Extract hardcoded spacing, sizing, and radius values from your scope. **Report only.**

## Context — you start cold
Given a **project profile** + a **scope**. Read the source yourself; grep literals,
**never cite line numbers** (source moves).

## What to extract
- border-radius / corner radius
- padding, margin, gap
- width, height, min/max dimensions
- positioning offsets (top/left/right/bottom/inset) where they are visual constants

**Preserve the literal form with units:** `'11px 12px'`, `1.5rem`, `84%`, unitless `11`.

## What to skip
- layout-mode props (display, flex direction, align, justify)
- behaviour (overflow, position, z-index)
- interaction (cursor, user-select), functional transforms, standard flex shorthands

These are not visual tokens.

## Destination (from the profile)
Spatial values are almost always theme-independent constants → shared constants module,
**not** the theme system. Used once → local.

## Output format (illustrative — find real locations yourself)
```
RADIUS: <value>
  Used in: <units>     Find with: <grep anchor>
  Destination: <shared token name>
  Conflict: <near-identical values — flag, don't merge silently>

PADDING: <literal with units>
  Used in: <unit> — N occurrences
  Destination: <token, or local if single use>
```

## Naming rules
- `{context}{Property}` — `navItemRadius`, `cardPad`, `chipGap`.
- Use the unit/component as context. Don't abbreviate unclearly (`pad` ok, `br` not).
