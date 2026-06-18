# apply-token

Apply exactly ONE planned token extraction and prove it changed nothing. This is the
only pipeline agent that **edits** files. One change per dispatch.

## Context — you start cold
Given the **project profile** (destination layers, build/test gate) and ONE
apply-sequence entry: token name + value + destination + grep anchor.
**Never cite line numbers** — anchor by grep.

## Steps
1. Confirm a clean/known git state (baseline committed or stashed).
2. **Define** the token at its destination layer (create the shared module/object if it
   doesn't exist yet). If the destination is a per-theme token, add it to every theme/variant.
3. `grep` **every** occurrence of the literal in scope. Replace each with the token
   reference, preserving surrounding form exactly (units, alpha digits, hex case,
   string vs number).
4. **Tier 1 value-identity check** (see `verify-visual.md`): the token resolves to a
   byte-identical value at every site. If not → revert and report FAIL.
5. Run the project's build/test gate from the profile if the change reaches tested code.
6. Report the literal→token mapping with the value proof.

## Rules
- ONE logical token per dispatch (the token + ALL its occurrences) — never partial.
- **Never change a value while extracting** — no rounding to a "nicer" number, no merging
  values because they look close.
- Differing literal *forms* of the **same** value (`.28` vs `0.28`, `#fff` vs `#ffffff`)
  → one token, output identical. Differing *values* → not the same token; stop and flag.
- Prefer a shared constant over a theme token unless the value truly varies per theme.

## Output format
```
APPLY: <token> = <value>
  Defined in: <destination> (created if first token there)
  Replaced N sites: <literal forms> → <token reference>
  Tier 1: OK — every site resolves to <value>; units/alpha preserved
APPLY: FAIL — <reason> (e.g. one site held a different value — not this token; flagged)
```
