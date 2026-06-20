---
name: claude-design-adapter
description: Use when asked to extract design tokens, consolidate repeated or hardcoded style values (colour, spacing, radius, typography, shadow), refactor inline or duplicated styles into a token/theme system, catalogue UI components and their states, or to reconcile, clean up, refine, and port a design-handoff bundle (e.g. a Claude Design export) to another stack (React, HTML, Angular, Flutter) — in any codebase, before changing visual appearance.
---

# Claude Design Adapter

## Overview

Universal, project-agnostic orchestrator that takes a design from a handoff bundle
(e.g. a Claude Design export) to a clean, single-source design, and then to another
stack. It runs in **four modes** — `reconcile` → `tidy` → `refine` → `port` — each
invocable **standalone** or chained by a **conditional Wizard**. It works on any stack
because it **discovers the project's conventions first (Step 0)** and ships **no project
knowledge**; everything specific is learned and written to a **project profile**.

**The safety invariant is per-mode, not global:**
- value-preserving modes (`reconcile`, `tidy`) gate on **byte-identical** output (Tier 1),
- `refine` gates on a **ledger of intended changes** (only declared changes may appear),
- `port` gates on **element-parity** with the clean design contract (pixel-perfect, no guessing).

**State lives in on-disk artifacts** (see Artifacts & state), so any mode can run on its
own and resume from what earlier modes wrote — that is what makes standalone use and the
Wizard the same machinery.

## Modes

| Mode | Stage | Input → Output | Safety gate |
|---|---|---|---|
| **reconcile** | согласовать | handoff (multi-source, drifted) → single canonical source + `RECONCILE.md` | value-preserving where sources agree; every conflict is a **fork** (GATE 4), never auto-merged |
| **tidy** | причесать | reconciled design → clean token system (`TOKENS.md`): forms normalised, dedup, fallback copies collapsed, hardcoded chrome linked to roles | **byte-identical** (Tier 1) — must not move a pixel |
| **refine** | исправления | clean design → edited design + `REFINE-LEDGER.md` | **ledgered diff**: every rendered change = exactly one declared entry; an unlisted diff is a bug (+ optional Tier 2) |
| **port** | перенос | clean design (= the contract) → per-stack implementation + `IMPLEMENTATION.md` | **parity per element** vs the contract; pixel-perfect, no guessing |

- `tidy` reuses the existing audit/apply machinery: `extract-*` → `name-tokens` →
  `apply-token` → `verify-visual` (Tier 1) → `cross-check`/`audit-coverage` → `report-summary`.
- `reconcile`, `refine`, `port` each add **one** driver agent (planned — see Agents). No
  parallel pipelines.

## Wizard flow (on activation)

The Wizard is the orchestrator made interactive — **not a separate agent**. It is
**conditional**: it guides when intent is ambiguous, it's a first run, or a handoff is
detected; a direct command takes the **express lane** straight to a mode.

```
[activation]
  1. profile-project (silent) → PROFILE.md, detect `kind`
  2. depth: read claude-design-adapter/config.json
       └─ missing → ask ONCE (Auto / Minimal / Balanced / Thorough), save to config
  3. present: detected kind + recommended path + branches
       «Это <kind>. Рекомендую: reconcile → tidy → refine → port.
        [Начать с reconcile] [Выбрать режим] [Прямая команда]»
  4. walk the path; at every fork honour GATE 4 + the chosen depth
```

**Depth controls how many forks the Wizard raises** (set once per project, overridable):

| Depth | Behaviour |
|---|---|
| **Auto** | 0 questions; recommended defaults end-to-end. The **only** mode where GATE 4 forks are auto-resolved. |
| **Minimal** | only critical forks: drift conflicts, target stack, refine-ledger sign-off |
| **Balanced** | Minimal + mode/path selection + `kind` confirmation |
| **Thorough** | Balanced + per-step explanation and per-token confirmation |

Critical forks always fire unless depth is **Auto**. **Express lane:** a direct command
(`port to React`, `tidy`) skips the intro, still reads the depth config, still honours
GATE 4. Skip the Wizard entirely for trivially-scoped one-off edits (see *When NOT to run*).

## Artifacts & state

All state is written to **`<project-root>/claude-design-adapter/`** (committed to git —
an audit trail of design decisions). This externalised state is what lets any mode run
standalone and resume:

| File | Written by | Holds |
|---|---|---|
| `config.json` | Wizard | depth level, chosen path, target stack(s) |
| `PROFILE.md` | profile-project | `kind`, styling mechanism, token system, drift |
| `RECONCILE.md` | reconcile | drift decisions + canonical-source map |
| `TOKENS.md` | tidy | clean token inventory (roles + resolved values) |
| `REFINE-LEDGER.md` | refine | intended changes: token, old→new, reason |
| `IMPLEMENTATION.md` | port | the design contract + per-stack mapping |

## Step 0 — Profile the project (always first)

Dispatch `profile-project`. It records, **from evidence not assumption**: the project
`kind` (`refactor-existing` | `design-handoff`), the styling mechanism, any existing
token/theme system (and how raw values flow to resolved ones, including duplicated/drifted
sources), the destination layers, the build/test gate, the render/verify path (or none),
and the naming conventions. Output goes to `PROFILE.md` and into every dispatched agent —
they start cold and know nothing else. `kind` chooses the recommended mode path.

## When NOT to run the full pipeline / Wizard

- One value in one place → just edit it. No agents, no Wizard.
- One dimension on a few units → dispatch only that extract agent.
- A direct, unambiguous command → express lane to that mode.

## Dispatch table

| Intent | Dispatch |
|---|---|
| First run / ambiguous intent | **Wizard** |
| "profile this project" | profile-project |
| "reconcile this handoff" | reconcile *(planned)* |
| "tidy" / "причеши" | extract-* → name-tokens → apply-token → verify-visual(Tier 1) |
| "refine: <change>" | refine *(planned)* |
| "port to <stack>" | port *(planned)* |
| Colours / spacing / fonts only | extract-colors / extract-spatial / extract-typography |
| Find components / repeated patterns | find-components |
| "check nothing broke" | verify-visual |
| "did we miss anything?" | audit-coverage / cross-check |
| "final report" | report-summary |

## Token Destination Rule (general)

Map each value to a layer in the project's profile — not to fixed file names:

| Value characteristic | Destination |
|---|---|
| Used **once** | local constant in that unit |
| **Constant**, reused in 2+ places, independent of theme/mode | shared constants/tokens module |
| **Varies** by theme / mode / brand | the project's theme/variant token system |
| **Derived** from another token (alpha, mix, scale, calc) | the computed/derived layer (function, `calc()`, `color-mix()`, …) |

**Key rule:** *"appears everywhere / in every theme" ≠ "varies per theme".* A fixed value
reused across the app is a **constant** → shared module, not a per-theme token.

When the profile reports a **duplicated/drifted token source** (the same table copied
across files that disagree), a destination spans **all copies**: edit every copy, or
collapse the fallbacks — `reconcile` resolves which value is canonical first.

## Dispatching an agent (subagents start COLD)

A dispatched subagent inherits nothing — not this skill, not your conversation, not the profile. So:
1. `Read` the spec in `agents/<name>.md`.
2. Launch a `general-purpose` agent (needs Read/Grep/Edit). Prompt = spec + the project
   profile + the resolved scope.
3. The subagent **reads the source itself** — never paste large files into the prompt.
4. **Subagents never ask the user.** A fork found by a subagent is returned to the
   orchestrator, which owns all user questions (see GATE 4).

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
(`name.x.html`) can 301→404; wrong port; subdirectory not root; case sensitivity. Confirm, never assume.

### GATE 2 — Syntax validity
After ANY file edit, run the project's syntax checker (`node --check`, `npx tsc --noEmit`,
`npx stylelint`, `python -m py_compile`, `swift -parse`, or the build gate). On failure —
revert immediately, don't proceed to the next token.

### GATE 3 — No guessing values
When extracting a token, the value must be **copied verbatim** from the source — never
typed from memory, never "looks like ~0.18". If unsure, grep the literal to confirm.

### GATE 4 — Controlled forks (no silent defaults)
Every decision point (a **fork**) is a **STOP**. Unless the project's depth is `Auto`, you
MUST call AskUserQuestion and **wait** — never infer, default, or proceed on assumption.
- Forks are owned by the **main orchestrator only**. Subagents cannot ask the user; a
  subagent returns options to the orchestrator, which asks. Never let a subagent decide and move on.
- The **only** sanctioned bypass is depth=`Auto`, chosen explicitly up front.
- Running non-interactively and depth≠`Auto` → **STOP and report** `awaiting decision: <fork>`.
  Halting is correct; fabricating a default is not.
- Forks include: `kind`/path confirmation, mode selection (when ambiguous), each reconcile
  drift conflict, target stack, refine-ledger sign-off.

**Red flags — STOP, you're rationalizing:** "the answer is obvious", "saves a round-trip",
"recommended is fine, no need to ask", "I'll ask later". All = violation unless depth=`Auto`.

| Excuse | Reality |
|---|---|
| "Obvious choice" | If it were free of consequence it wouldn't be a fork. Ask. |
| "Saves time" | A wrong silent default costs a full redo. Ask. |
| "Recommended = safe" | Recommended ≠ chosen. Only the user's pick counts (unless Auto). |
| "Non-interactive run" | Halt and report the pending fork; don't fabricate. |

## Agents

| Agent | Phase/Mode | Role |
|---|---|---|
| profile-project | 0 | discover styling, token system, `kind`, conventions → `PROFILE.md` |
| scope-resolve | 0 | user scope description → concrete file/unit list |
| extract-colors | 1 / tidy | hardcoded colours + alpha/opacity |
| extract-spatial | 1 / tidy | radii, padding, gaps, sizing, offsets |
| extract-typography | 1 / tidy | font size / weight / line-height / letter-spacing |
| find-components | 1 / tidy | repeating visual patterns + states/variants |
| name-tokens | 2 / tidy | merge, dedup, destination rule, naming, conflicts |
| apply-token | 3 / tidy | apply ONE change + static value-identity proof |
| cross-check | 4 / tidy | components covered by tokens; orphan tokens & patterns |
| audit-coverage | 4 / tidy | stray un-tokenized copies of an extracted value |
| verify-visual | 3/4 | Tier 1 value-identity; Tier 2 optional rendered pass |
| report-summary | 4 / tidy | synthesis: inventory, catalogue, coverage, open decisions |
| reconcile | reconcile | resolve drifted/duplicated sources → one canonical source *(planned)* |
| refine | refine | apply intended edits under a ledgered diff *(planned)* |
| port | port | project the clean contract onto a target stack *(planned)* |

**12 agents today; 3 mode-drivers planned.** Wizard adds zero agents (it's the orchestrator).

## Keeping this skill project-agnostic

This skill must contain **zero project-specific identifiers**. Before committing any change
to it, run the guard from the skill directory — it must print `clean`:

```bash
./check-universal.sh
```

Project-specific facts belong in that project's own skill/docs, never here; examples in
agent specs must use neutral, stack-agnostic placeholders.
