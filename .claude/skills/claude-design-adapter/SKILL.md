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

Before extracting anything, discover and write down a short profile. Don't assume — verify by reading.

| Profile field | How to discover |
|---|---|
| **Styling mechanism** | grep for `.css`/`.scss`, `styled.`/`` css` `` (CSS-in-JS), `className=`/`class:`, `style={`/`:style`, Tailwind `class="…"`, SwiftUI `.foregroundColor`, Flutter `TextStyle(` |
| **Existing token/theme system** | `:root{--…}` custom props, a tokens/theme file, Tailwind `theme` config, design-tokens JSON, theme objects, asset catalogs — and **how raw values flow to resolved ones** |
| **Destination layers** | where new tokens belong: local → shared-constants module → theme/variant tokens → derived/computed layer |
| **Build/test gate** | the project's own command (e.g. `npm test`, `npm run build`) — run it after edits |
| **Render/verify path** | dev server + screenshot tool, Storybook, headless browser, simulator — or **none** (then rely on the Tier 1 static check) |
| **Naming conventions** | how existing tokens are named (semantic vs descriptive, casing) |

Pass this profile into every dispatched agent — they start cold and know nothing else.

## When NOT to run the full pipeline

- One value in one place → just edit it. No agents.
- One dimension on a few units → dispatch only that extract agent.
- Reserve the full audit for a real cross-cutting token pass.

## Dispatch table

| Intent | Dispatch |
|---|---|
| Extract everything / "pull tokens" | 4 extract agents → name-tokens → apply-token(×N) → verify |
| Colours only | extract-colors |
| Spacing / radii / sizing only | extract-spatial |
| Fonts / typography only | extract-typography |
| Find components / repeated patterns | find-components |
| "check nothing broke" | verify-visual |

## Pipeline

```
Phase 0 — PROFILE: build the project profile (above).
Phase 1 — AUDIT (parallel, independent), scoped to the profile's styling mechanism:
  extract-colors / extract-spatial / extract-typography / find-components
Phase 2 — NAME (sequential):
  name-tokens → dedup, destination rule, naming, conflicts, ordered apply sequence
Phase 3 — APPLY (incremental, git-checkpointed):
  baseline commit/stash first; per token: apply-token → verify-visual(Tier 1) →
  OK → next ; FAIL → revert that change, report
Phase 4 — FINAL VERIFY:
  audit-coverage (no stray copies left) → verify-visual(Tier 2, optional rendered)
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

## Agents

| Agent | Phase | Role |
|---|---|---|
| extract-colors | 1 | hardcoded colours + alpha/opacity |
| extract-spatial | 1 | radii, padding, gaps, sizing, offsets |
| extract-typography | 1 | font size / weight / line-height / letter-spacing |
| find-components | 1 | repeating visual patterns + states/variants |
| name-tokens | 2 | merge, dedup, destination rule, naming, conflicts |
| apply-token | 3 | apply ONE change + static value-identity proof |
| audit-coverage | 4 | find stray un-tokenized copies of an extracted value |
| verify-visual | 3/4 | Tier 1 static value-identity; Tier 2 optional rendered pass |
