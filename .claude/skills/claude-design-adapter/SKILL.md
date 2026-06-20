---
name: claude-design-adapter
description: Use when asked to extract design tokens, consolidate repeated or hardcoded style values (colour, spacing, radius, typography, shadow), refactor inline or duplicated styles into a token/theme system, or catalogue UI components and their states — in any codebase, before changing visual appearance.
---

# Claude Design Adapter

## Overview

Universal, project-agnostic orchestrator for design-token extraction and style
consolidation. It works in any stack (CSS, SCSS, CSS Modules, CSS-in-JS, Tailwind,
inline React/Vue styles, SwiftUI, Flutter, …) because it **discovers the project's
conventions first (Step 0)**, then runs one fixed methodology against them.

**Core invariant:** a token extraction is correct iff the new token resolves to a value
**byte-identical** to the literal it replaced. That is statically checkable in any
language — it is the primary gate (`agents/verify-visual.md`), not "the pixels look the same."

This skill ships **no project knowledge**. Anything specific to the codebase at hand is
learned in Step 0 and recorded in a **project profile** that every later phase consumes.
If the project provides its own navigation/trace doc (UI element → source location), use
it to resolve scope; otherwise discover that in Step 0 too.

## Step 0 — Profile the project (always first)

Dispatch `profile-project` before extracting anything. The profile it returns records,
**from evidence not assumption**: the styling mechanism, any existing token/theme system
(and how raw values flow to resolved ones), the destination layers, the build/test gate,
the render/verify path (or none), and the naming conventions. See `agents/profile-project.md`
for how each is discovered. Pass the profile into every dispatched agent — they start cold
and know nothing else.

## When NOT to run the full pipeline

- One value in one place → just edit it. No agents.
- One dimension on a few units → dispatch only that extract agent.
- Reserve the full audit for a real cross-cutting token pass.

## Dispatch table

| Intent | Dispatch |
|---|---|
| "profile this project" / first run | profile-project |
| "scope: <description>" | scope-resolve |
| Extract everything / "pull tokens" | profile → scope → 4 extract agents → name-tokens → apply-token(×N) → cross-check → audit-coverage → verify → report-summary |
| Colours only | extract-colors |
| Spacing / radii / sizing only | extract-spatial |
| Fonts / typography only | extract-typography |
| Find components / repeated patterns | find-components |
| "check nothing broke" | verify-visual |
| "did we miss anything?" | audit-coverage / cross-check |
| "final report" | report-summary |

## Pipeline

```
Phase 0 — PROFILE + SCOPE:
  profile-project → scope-resolve → profile document + file list

Phase 1 — AUDIT (parallel, independent), scoped to the profile's styling mechanism:
  extract-colors / extract-spatial / extract-typography / find-components

Phase 2 — NAME (sequential):
  name-tokens → dedup (incl. literal-form variants), destination rule, naming,
  conflicts, ordered apply sequence

Phase 3 — APPLY (incremental, git-checkpointed):
  baseline commit/stash first; per token: apply-token → verify-visual(Tier 1) →
  OK → next ; FAIL → revert that change, report

Phase 4 — FINAL VERIFY:
  cross-check (components covered? orphan tokens?) →
  audit-coverage (no stray copies left) →
  verify-visual(Tier 2, optional rendered) →
  report-summary (synthesis + open decisions + next steps)
```

## Token Destination Rule (general)

Map each value to a layer in the project's profile — not to fixed file names:

| Value characteristic | Destination |
|---|---|
| Used **once** | local constant in that unit |
| **Constant**, reused in 2+ places, independent of theme/mode | shared constants/tokens module |
| **Varies** by theme / mode / brand | the project's theme/variant token system |
| **Derived** from another token (alpha, mix, scale, calc) | the computed/derived layer (function, `calc()`, `color-mix()`, …) |

**Key rule:** *"appears everywhere / in every theme" ≠ "varies per theme".* A fixed value
reused across the app is a **constant** → shared module, not a per-theme token. Use the
theme system only when the value must actually differ between themes/modes.

## Dispatching an agent (subagents start COLD)

A dispatched subagent inherits nothing — not this skill, not your conversation, not the profile. So:
1. `Read` the spec in `agents/<name>.md`.
2. Launch a `general-purpose` agent (needs Read/Grep/Edit). Prompt = spec + the project
   profile + the resolved scope (which files/units/functions).
3. The subagent **reads the source itself** — never paste large files into the prompt.
4. Phase 1 agents are independent → one parallel batch. Then name-tokens, then
   apply-token (one per change, sequential), then verify.

**Never bake line numbers** into specs, plans, or edits — source moves. Locate code by
grepping the literal (the exact value string), not by `file:line`.

## Hard Gates

Rules that must NEVER be violated. No exceptions, no "it worked for me", no spirit-vs-letter.

### GATE 1 — Verify URLs before reporting them

**Never tell the user to open a URL you haven't confirmed.**

1. Start the dev server per the project profile.
2. `curl -sI <url>` → require HTTP 200 (follow redirects with `-L`; a 301/302 must land on 200).
3. 404 → the URL is wrong. Debug against the real filename/port on disk — don't guess another.
4. Record the exact working URL (with its full extension) in the profile.

Common traps: clean-URL dev servers strip extensions, so a double-extension file
(`name.x.html`) can 301→404; wrong port; file in a subdirectory not root; case sensitivity
(`Index.html` ≠ `index.html`). Confirm with curl, never assume.

### GATE 2 — Syntax validity

After ANY file edit, run the project's syntax checker:
- JS/TS: `node --check <file>` or `npx tsc --noEmit`
- CSS/SCSS: `npx stylelint <file>` or the build gate
- Python: `python -m py_compile <file>`
- Swift: `swift -parse <file>`

If the syntax check fails — revert immediately, don't proceed to the next token.

### GATE 3 — No guessing values

When extracting a token, the value must be **copied verbatim** from the source — never
typed from memory, never "looks like it's about 0.18". If unsure, grep the literal in the
source to confirm. (This is also enforced per-change by `apply-token` + Tier 1.)

## Agents

| Agent | Phase | Role |
|---|---|---|
| profile-project | 0 | discover styling mechanism, token system, conventions → project profile |
| scope-resolve | 0 | user scope description → concrete file/unit list |
| extract-colors | 1 | hardcoded colours + alpha/opacity |
| extract-spatial | 1 | radii, padding, gaps, sizing, offsets |
| extract-typography | 1 | font size / weight / line-height / letter-spacing |
| find-components | 1 | repeating visual patterns + states/variants |
| name-tokens | 2 | merge, dedup, destination rule, naming, conflicts, ordered apply sequence |
| apply-token | 3 | apply ONE change + static value-identity proof |
| cross-check | 4 | verify components covered by tokens; find orphan tokens & patterns |
| audit-coverage | 4 | find stray un-tokenized copies of an extracted value |
| verify-visual | 3/4 | Tier 1 static value-identity; Tier 2 optional rendered pass |
| report-summary | 4 | synthesis: token inventory, component catalogue, coverage, open decisions |

**12 agents.** 6 report-only, 1 edit-only (apply-token), the rest read + optionally edit.

## Keeping this skill project-agnostic

This skill must contain **zero project-specific identifiers**. Before committing any change
to it, run the guard from the skill directory — it must print `clean`:

```bash
./check-universal.sh
```

It fails if any known project/runtime identifier leaks into a `*.md` file. Project-specific
facts belong in that project's own skill/docs, never here; examples in agent specs must use
neutral, stack-agnostic placeholders.
