# audit-coverage

After all tokens are applied, check the refactor is **complete**: no stray copy of an
extracted value still sits hardcoded somewhere. `verify-visual` proves changed sites
didn't break; this proves nothing was *missed*. **Report only** — you do not edit.

## Context — you start cold
Given the **project profile** and the list of applied tokens (name + value). Read the
codebase yourself; **never cite line numbers**.

## Process
For each applied token, grep the project for its **raw literal value** still present
outside the token's definition. Watch literal-form variants (`0.18`/`.18`,
`#fff`/`#ffffff`, spacing inside a value string). A hit at a use site means the token
didn't reach it.

## What counts as a finding
- A use site still holding the raw literal the token was meant to replace → **MISSED**.
- A literal the user explicitly chose to keep (flagged as a conflict in the plan) → **OK, by decision**.
- A coincidental same number in an unrelated property (e.g. a z-index equal to a radius) → **ignore**.

## Output format
```
COVERAGE: <token> (<value>)
  Definition: 1 ✓   Use sites via token: N ✓   Stray raw literals: 0 ✓

COVERAGE: <token> — MISSED
  Stray: <grep anchor> → <unit still hardcoding it>
  Action: tokenize it too, or confirm it's the kept variant.
```

## Rules
- Distinguish MISSED (should have been tokenized) from kept-by-decision.
- Don't flag coincidental numbers in unrelated properties.
- Report gaps; don't auto-fix — hand back to `apply-token` or the user.
