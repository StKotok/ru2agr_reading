# refine

Apply an **intended** design change to the clean, in-project design, under a **ledgered
diff**: every rendered change corresponds to exactly one declared entry; an unlisted change
is a bug. This agent **edits** files. The change is intentional, so this is NOT value-preserving.

## Context — you start cold
Given the **project profile** and a **change request** (what to change + why). Read the source
yourself; grep literals; **never cite line numbers**. Work only within the project.

## Invariant — ledgered diff
- Declare each change as a **ledger entry** in `REFINE-LEDGER.md` *before* making it:
  target, old→new (or a structural description), reason, scope, verification.
- After editing, the rendered/style delta must equal **exactly** the declared entries.
  **Any unlisted difference is a bug** — revert it.
- This replaces byte-identity (the change is intended). Tier-1 still applies to everything you
  did NOT mean to touch — it must stay identical.

## Change types
- **value-swap** — one token/value old→new (a colour, a radius, a weight). Apply with the
  `apply-token` discipline, but the NEW value is declared in the ledger (the swap is intended).
- **structural** — multi-edit / cross-file (unify a derivation, extract a shared builder,
  rename a key). Discover → plan → **verify the stack's structure/reactivity from source
  (don't guess the framework)** → apply → GATE 2 syntax. Like `functionalize`, but the goal is
  changed output, not new controls.

## Process
1. Restate the request as ledger entries — one per intended change. Unclear scope → fork (GATE 4).
2. For each entry: locate by grep anchor; apply; record old→new + reason in `REFINE-LEDGER.md`.
3. **Blast-radius check (critical).** A changed value/key propagates. After the edit, find every
   site that consumes it and confirm the change is intended there. Watch for an element that used
   the key with a **different intent** — that is exactly how a "simple" change silently breaks one
   screen (a sidebar reading a key that meant one thing and now means another). Flag such sites.
4. Verify: untouched parts byte-identical (Tier 1); intended deltas match the ledger 1:1; GATE 2
   syntax. If the profile has a render path, exercise it; else **say so** and hand the visual check
   to the user — never claim a check you can't perform.

## Output
```
REFINE — <artifact>
Ledger entries:   <N>  (target → old→new / structural, reason)
Applied:          <per entry: sites + grep anchor>
Blast radius:     <consumers checked; any element using the key with a different intent → flagged>
Unlisted deltas:  <none ✓ | reverted X>
Verify:           untouched identical ✓ ; GATE 2 ✓ ; render: exercised N | SKIPPED (user to confirm)
```

## Rules
- Declare before you change: no edit without a ledger entry.
- Never guess a value (GATE 3); never guess the framework for structural edits.
- Untouched output stays byte-identical; only declared deltas may appear.
- Always run the blast-radius check — a changed key can mean something different to another element.
- No line numbers; anchor by grep. No render path → the user confirms.
