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

Component: OverlayCard
  States covered:    hidden ✓  open ✓
  Properties:
    background       C.paper           COVERED (existing CR slot)
    borderRadius     18                COVERED (TK.overlayRadius)
    boxShadow        overlayShadow     COVERED (new CR slot)
    backdrop         alpha(#15140f,0.18) MISSED — alpha 0.18 not tokenized
    animation        scPop .16s        MISSED — duration .16s not tokenized

Component: SectionLabel
  Properties:
    fontSize         11                COVERED (TK.fsLabel)
    fontWeight       700               COVERED (TK.fwActive)
    letterSpacing    '0.13em'          COVERED (TK.lsLabel)
    textTransform    'uppercase'       INTENTIONAL (semantic, not a token)
    color            C.muted           COVERED (existing CR slot)
  COMPLETE ✓

Orphan tokens:
  TK.chipGap: 3 — defined but not referenced by any component; verify usage exists

Orphan patterns (not yet components):
  "iconButton" — 38×38, borderRadius:11, border:C.line, centered icon
    Appears in: top-bar (eye toggle, intensity), word-card (gear, close)
    Not proposed as component — candidate for extraction
```

## Rules
- Report gaps; don't auto-fix. The user decides to extract more or keep.
- An orphan token is a warning, not a failure — it may be used in a component
  that wasn't in scope.
- An orphan pattern is a suggestion, not a requirement.
- Distinguish "missed" (should be in plan) from "intentional" (kept by design).
