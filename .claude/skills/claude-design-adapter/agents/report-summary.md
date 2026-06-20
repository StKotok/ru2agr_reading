# report-summary

Synthesise the full pipeline output into a single report the user can scan,
decide on, and commit. Runs LAST. **Report only.**

## Context — you start cold
Given the **project profile** and the outputs of ALL preceding phases:
- 4 audit agent reports (Phase 1)
- Unified token plan (name-tokens)
- Apply log (apply-token × N)
- Component definitions (find-components)
- Coverage report (audit-coverage)
- Cross-check report (cross-check)
- Verification log (verify-visual — Tier 1 results)

## What to produce

### 1. One-paragraph summary
What happened, in plain language. Tokens extracted, components found, coverage %.

### 2. Token inventory
```
Shared constants created:   12
Theme tokens added:          3
Derived tokens added:        1
Local constants:             8
Total tokens extracted:     24
```

### 3. Component catalogue
List every component found, its states, and whether it's fully tokenised.

### 4. Coverage
% of hardcoded values now tokenised within scope.
List what's left — and why (intentional, out of scope, needs separate pass).

### 5. Open decisions for the user
Flagged conflicts from name-tokens, unresolved variants from find-components,
near-identical values the user should decide on.

### 6. Next steps
What to extract next, what needs manual review, what can be committed now.

## Output format
```
══════════════════════════════════
CLAUDE DESIGN ADAPTER — EXTRACTION REPORT
══════════════════════════════════

Project:  <name>
Scope:    <scope description, N files>
Date:     <today>

SUMMARY
<Two sentences on what was done.>

TOKEN INVENTORY
Shared:   12  (fsBody, fwActive, radiusCard, …)
Theme:     3  (surface, surfaceMuted, textInverse)
Derived:   1  (overlay — mix(scrim, n%))
Local:     8  (navItemPad, toastMaxWidth, …)
TOTAL:    24 extracted

COMPONENTS FOUND
<Dialog>        [closed, open]           ✓ fully tokenised
<Label>         [static]                 ✓ fully tokenised
<Button>        [active, inactive]       3 variants — radii differ, pending user decision
<IconButton>    [default, pressed]       not yet extracted — orphan pattern

COVERAGE
Tokenised:  87% (63 of 72 hardcoded values in scope)
Remaining:   9 values — 4 intentional (single-use local), 3 near-identical (user decision),
             2 missed (flag for next pass)

OPEN DECISIONS
1. <Dialog> radii: two close values on similar surfaces — merge or keep separate?
2. <Button> variants: 3 different radii — one component or three?
3. <Label>: extract as a shared style object or keep as a local pattern?

VERIFICATION
Tier 1: 24/24 tokens byte-identical ✓
Tier 2: skipped — no render path in profile

NEXT STEPS
- Commit current changes: 24 tokens, 4 components catalogued
- Resolve open decisions → run apply-token for remaining values
- Extract <IconButton> component (orphan pattern)
- Re-run on the next scope

══════════════════════════════════
```

## Rules
- Every number backed by an agent report. No estimates, no rounding.
- Open decisions must reference the specific agent output they come from.
- If the user hasn't resolved a conflict, it stays in "open decisions".
- Don't claim successes you can't prove — if Tier 2 was skipped, say so.
