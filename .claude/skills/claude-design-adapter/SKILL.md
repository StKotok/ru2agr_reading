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
| "profile this project" / first run | profile-project |
| "scope: <description>" | scope-resolve |
| Extract everything / "pull tokens" | profile → scope → 4 extract agents → format-canonical → name-tokens → apply-token(×N) → cross-check → audit-coverage → verify → report-summary |
| Colours only | extract-colors |
| Spacing / radii / sizing only | extract-spatial |
| Fonts / typography only | extract-typography |
| Find components / repeated patterns | find-components |
| "check nothing broke" | verify-visual |
| "did we miss anything?" | audit-coverage |
| "final report" | report-summary |

## Pipeline

```
Phase 0 — PROFILE + SCOPE:
  profile-project → scope-resolve → profile document + file list

Phase 1 — AUDIT (parallel, independent), scoped to the profile's styling mechanism:
  extract-colors / extract-spatial / extract-typography / find-components

Phase 1.5 — NORMALISE:
  format-canonical → canonical form map (resolve .28/0.28, #fff/#ffffff, etc.)

Phase 2 — NAME (sequential):
  name-tokens → dedup, destination rule, naming, conflicts, ordered apply sequence
  (uses canonical forms from Phase 1.5)

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

### GATE 1 — URL Verification

**Never tell a user to open a URL you haven't confirmed with curl first.**

1. Start the dev server per the project profile
2. `curl -sI <url>` → must be HTTP 200 (follow redirects with `-L`)
3. If 404 — the URL is wrong. Debug, don't guess.
4. Record the exact working URL (with extension) in the profile

This gate exists because of a real 404 incident: the `serve` dev server stripped the
`.html` extension from `ru2gr.dc.html` → redirected to `/ru2gr.dc` → 404. The
double-extension `.dc.html` broke the clean-URL logic. The orchestrator reported
`http://localhost:3456/ru2gr.dc` without verifying — user got a 404. This must
never happen again in any project.

### GATE 2 — Syntax Validity

After ANY file edit, run the project's syntax checker:
- JS/TS: `node --check <file>` or `npx tsc --noEmit`
- CSS/SCSS: `npx stylelint <file>` or build gate
- Python: `python -m py_compile <file>`
- Swift: `swift -parse <file>`

If syntax check fails — revert immediately, don't proceed to next token.

### GATE 4 — Dev-Mode Label Coverage

**In `?dev=1` mode, every interactive element MUST have a visible `data-section` label
on hover, with click-to-copy to clipboard.**

Three mechanisms work together:

1. **Static labels** — `'data-section'` attribute on render functions' outermost `h('div',...)`
   and on key interactive `h('button',...)` / `h('span',{role:'button'},...)` calls.
   Naming: `{section}--{element}`, e.g. `desk-nav--read-tab`, `phone-mode-menu--backdrop`.

2. **Runtime auto-labeler** — a `MutationObserver`-backed script that finds all unlabeled
   interactive elements and derives names from: closest parent `[data-section]` as prefix +
   element's `textContent`, `aria-label`, `title`, or `placeholder`. Runs 1.2s after load
   and on every DOM mutation (catches dynamically-opened sheets/popups).

3. **Hover + click-to-copy**:
   - CSS: `html.dev [data-section]:hover { outline:1px dashed orange; cursor:copy; }`
   - CSS: `html.dev [data-section]:hover::before { content:attr(data-section); ... }`
     — label appears at top-left of the hovered element
   - JS: `document.addEventListener('click', ...)` — finds closest `[data-section]`,
     calls `navigator.clipboard.writeText(name)`, flashes outline green for 400ms

**The label stays HIDDEN until hover.** This keeps the canvas clean for visual review.
Hover any element → orange dashed border + name label → click → name in clipboard.

**Verification:** open `?dev=1`, hover over elements to see labels, click to copy,
paste into chat. Every tappable element should respond.

### GATE 3 — No Guessing Values

When extracting a token, the value must be **copied verbatim** from the source —
never typed from memory, never "looks like it's about 0.18". If unsure, grep
the literal in the source to confirm.

## Agents

| Agent | Phase | Role |
|---|---|---|
| profile-project | 0 | discover styling mechanism, token system, conventions → project profile |
| scope-resolve | 0 | user scope description → concrete file/unit list |
| extract-colors | 1 | hardcoded colours + alpha/opacity |
| extract-spatial | 1 | radii, padding, gaps, sizing, offsets |
| extract-typography | 1 | font size / weight / line-height / letter-spacing |
| find-components | 1 | repeating visual patterns + states/variants |
| format-canonical | 1.5 | normalise literal-form variants (.28/0.28, #fff/#ffffff) → canonical map |
| name-tokens | 2 | merge, dedup, destination rule, naming, conflicts, ordered apply sequence |
| apply-token | 3 | apply ONE change + static value-identity proof |
| cross-check | 4 | verify components covered by tokens; find orphan tokens & patterns |
| audit-coverage | 4 | find stray un-tokenized copies of an extracted value |
| verify-visual | 3/4 | Tier 1 static value-identity; Tier 2 optional rendered pass |
| report-summary | 4 | synthesis: token inventory, component catalogue, coverage %, open decisions |

**13 agents total.** 5 report-only (no edits), 1 edit-only (apply-token), 7 mixed.
