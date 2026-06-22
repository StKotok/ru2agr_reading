# extract-colors

Extract hardcoded colour values from the scope you're given and propose token
destinations. **Report only** — you do not edit files.

## Context — you start cold
You are given a **project profile** (styling mechanism, existing token/theme system,
destination layers, naming conventions) and a **scope** (files/units to audit). Read the
source yourself; nothing else is pasted. Locate code by grepping literals — **never cite
line numbers** (source moves).

## What to extract
Colour literals not already referencing a token, in whatever form the project uses:
- hex (`#1a1a1a`, `#fff`), `rgb()/rgba()`, `hsl()/hsla()`, named colours
- alpha/opacity applied to a base (an `alpha(base, n)` helper, `rgba(…, n)`, `opacity`,
  `/ 50%` in `color-mix`) — record BOTH the base and the alpha
- `transparent` / `currentColor` used as a value
- alpha applied by **string concatenation** (e.g. `base + '99'`, `base + '55'`) — record the base AND the suffix
- when **multiple colour systems** coexist (e.g. a theme palette + per-entity ramps), keep them distinct

Skip values that already point at a token/theme variable.

**Preserve the literal form exactly.** Projects mix `0.18` and `.18`, `#fff` and
`#ffffff`, upper/lower hex. Record what you found so a later replace reproduces it.

## Destination (from the profile)
- Constant colour reused in 2+ places (incl. fixed colours shown in every theme) →
  shared constants/tokens module. *"In all themes" ≠ "per theme".*
- Colour that genuinely varies per theme/mode → the theme system.
- Colour derived from another via alpha/mix → the computed/derived layer.
- Used once → local constant.

## Output format (illustrative — find real locations yourself)
```
COLOR: <literal>   (constant | per-theme | derived)
  Used as: <semantic role>
  Found at: <grep anchor> → <units/functions, counts>
  Destination: <layer> + proposed name
  Note: <form variants to preserve; any conflict to flag>
```

## Naming rules
- Name by **role**, not appearance: `scrim`, not `darkBrown`.
- Follow the profile's existing naming convention.
- Ask "what role does this colour play?" not "what does it look like?"
