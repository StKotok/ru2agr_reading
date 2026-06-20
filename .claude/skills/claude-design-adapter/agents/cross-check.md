# cross-check

Verify every component found by `find-components` is covered by the token plan —
and every token in the plan is actually used by something. Closes the loop
between "what patterns exist" and "what we extracted". **Report only.**

## Context — you start cold
Given the **project profile**, the **unified token plan** from `name-tokens`,
and the **component definitions** from `find-components`. Read the codebase
yourself to verify coverage.

## Process

### Pass 1 — Component coverage
For each component in the find-components output:
1. List all style properties that define its visual appearance
2. For each property, check: does a token in the unified plan cover this value?
3. Mark: **COVERED** (token exists), **MISSED** (value not in plan), or
   **INTENTIONAL** (kept as local constant by decision)

### Pass 2 — Token usage
For each token in the unified plan:
1. Does it appear in at least one component definition or use site?
2. If NO — **ORPHAN TOKEN**: extracted but unused. Flag for removal.

### Pass 3 — Orphan patterns
Are there style patterns in `find-components` that repeat but weren't proposed
as components? These are candidates for further extraction.

## Output format
```
CROSS-CHECK:

Component: <ComponentA>   (e.g. an overlay/dialog)
  States covered:    closed ✓  open ✓
  Properties:
    background       <surface token>        COVERED (existing token)
    border-radius    <value>                COVERED (new shared token)
    box-shadow       <value>                COVERED (new shared token)
    backdrop         <colour> @ <alpha>     MISSED — alpha not tokenized
    animation        <name> <duration>      MISSED — duration not tokenized

Component: <ComponentB>   (e.g. a section label)
  Properties:
    font-size        <value>                COVERED (shared token)
    font-weight      <value>                COVERED (shared token)
    letter-spacing   <value>                COVERED (shared token)
    text-transform   uppercase              INTENTIONAL (semantic, not a token)
    color            <muted token>          COVERED (existing token)
  COMPLETE ✓

Orphan tokens:
  <token> — defined but not referenced by any component; verify a use site exists

Orphan patterns (not yet components):
  "<icon-button>" — same size + radius + border + centered icon
    Appears in: <several places>
    Not proposed as a component — candidate for extraction
```

## Rules
- Report gaps; don't auto-fix. The user decides to extract more or keep.
- An orphan token is a warning, not a failure — it may be used in a component
  that wasn't in scope.
- An orphan pattern is a suggestion, not a requirement.
- Distinguish "missed" (should be in plan) from "intentional" (kept by design).
