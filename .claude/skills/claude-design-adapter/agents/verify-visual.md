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

## URL Verification (MANDATORY before reporting any URL to the user)

**Never tell a user to open a URL you haven't confirmed works.**

1. Start the dev server using the profile's render command
2. `curl -sI <url>` or `curl -sL <url>` — confirm HTTP 200
3. If 301/302 redirect — FOLLOW it with `-L` and confirm the final destination is 200
4. If 404 — the URL is WRONG. Debug: check the actual filename on disk, try alternative URLs
5. Only after curl returns 200, report the URL to the user
6. Record the exact working URL format in the project profile: `renderURL: "http://localhost:3456/ru2gr.dc.html"` (include the full filename with extension)

**Common URL mistakes caught by this rule:**
- URL rewriting (301→404): serve/polymer dev servers strip `.html` but `.dc.html` double-extension breaks the redirect
- Wrong port: server started on a different port than assumed
- Wrong path: file is in a subdirectory, not root
- Case sensitivity: `Index.html` ≠ `index.html` on case-sensitive servers

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
