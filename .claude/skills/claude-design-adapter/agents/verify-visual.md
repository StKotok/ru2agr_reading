# verify-visual

Prove a refactoring change did not alter the visual output.

**The right invariant is value-identity, not "pixels look the same".** A token extraction
is correct iff the new token resolves to a value **byte-identical** to the literal it
replaced. That is statically checkable in any language and deterministic — it is the
primary gate (Tier 1). A rendered pass (Tier 2) is optional final confirmation and needs
a render/screenshot path from the project profile; an agent cannot "look at a screen"
without one.

## Context — you start cold
Given the **project profile** (its render/verify path, if any) and the change(s) to check.

## Git checkpoint (before applying)
Commit or stash a clean baseline. Then per change: apply → Tier 1 verify → OK → continue;
FAIL → restore (`git checkout -- <file>` or pop the stash) and report. One logical change
between checkpoints, so a revert is surgical.

## Tier 1 — static value-identity (PRIMARY, every change, no rendering)
1. Record the original literal **verbatim**, including its form: number vs string, units
   (`px`/`em`/`rem`/`%`), alpha digits, hex case, every segment of a compound value.
2. Read the new token's definition and resolve its value.
3. Compare byte-for-byte:
   - number == number (no rounding)
   - string == string, units preserved
   - alpha: base AND alpha digits both preserved
   - compound values (shadows, multi-part padding): every segment identical
4. Any mismatch → **FAIL**: revert, report the exact diff.

Catches deterministically: rounding, unit loss, alpha loss, format drift, wrong variant.

## Tier 2 — rendered pass (optional, final)
Run only if the profile has a render/screenshot path (dev server + screenshot tool,
Storybook, headless browser, simulator):
1. Render before/after.
2. Compare across themes/modes, breakpoints, and interactive states
   (hover / focus / open / disabled).
If there is no such path, **say so** and rely on Tier 1 + a human walkthrough — do not
claim a visual check you cannot perform.

## What to report
```
VERIFY Tier 1: OK — <token> = <value> == original literal (form preserved)
VERIFY Tier 1: FAIL — <unit>: original <x> → applied <y> (<reason>); revert.
VERIFY Tier 2: SKIPPED — no render path; Tier 1 passed, manual walkthrough advised.
```

## Common failure modes (all caught by Tier 1)
- Rounding: `11` extracted but defined as `12`
- Alpha lost: `alpha(base, 0.05)` → token without the alpha
- Units lost: `'11px 12px'` → `'11 12'`, or `'0.13em'` → `0.13`
- Format drift treated as a value change: `.28` vs `0.28`, `#fff` vs `#ffffff`
- Wrong variant copied (one shadow/style applied where another belongs)
