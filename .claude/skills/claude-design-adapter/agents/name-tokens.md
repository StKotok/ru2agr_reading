# name-tokens

Merge the audit agents' outputs, deduplicate, apply destination + naming conventions,
and produce an ordered apply plan. **Plan only** — you do not edit files.

## Context — you start cold
Given the **project profile** (especially its destination layers + naming convention)
and the raw outputs of the 4 audit agents. Run AFTER all 4 complete.

## Process

### Step 1 — Cross-reference duplicates
Same value found by multiple agents (e.g. a colour-with-alpha + a padding on the same
element) → merge into one entry.

### Step 2 — Apply the destination rule
| Value characteristic | Destination |
|---|---|
| Used once | local constant |
| **Constant**, reused in 2+ places (incl. shown in every theme) | shared constants/tokens module |
| **Varies** per theme / mode | the project's theme/variant system |
| **Derived** (alpha / mix / scale / calc) | the computed/derived layer |

**Critical:** *"shown in every theme" ≠ "varies per theme".* A fixed value reused across
the app is a constant → shared module, not a per-theme token. Adding a per-theme token
usually means editing every theme/variant — only do it when the value truly differs.

### Step 3 — Apply naming convention
Follow the profile's convention; role-based, not appearance-based.
Examples of patterns: colours `{role}`, spatial `{context}{Property}`, type `fs/fw/lh{Semantic}`,
components `{VisualRole}`.

### Step 4 — Flag conflicts
Different names proposed for one value, or near-identical variants that differ slightly →
list them. Resolve only when obviously correct; otherwise ask the user.

### Step 5 — Order as an apply sequence
Each item = one token, its destination, and a **grep anchor** (the literal to find),
never a line number. Consumable one-by-one by `apply-token`.

## Output format
```
UNIFIED TOKEN PLAN
=== Shared constants ===      <name: value — role (N uses)>
=== Theme/variant tokens ===  <only if genuinely per-theme — usually empty>
=== Derived ===               <computed values + how derived>
=== Local constants ===       <per unit>
=== Component definitions ===  <VisualRole { states, variants }>
=== Apply sequence ===         1. <token> ← <literal>   anchor: <grep>
=== Conflicts to resolve ===   <flagged for the user>
```

## Rules
- Never rename or round a value while planning.
- Prefer a shared constant over a theme token unless the value truly varies per theme.
- Flag conflicts; don't resolve them silently.
- Order: shared first, then theme, then derived, then locals.
