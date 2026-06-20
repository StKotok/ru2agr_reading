# reconcile

Reconcile a design-handoff bundle whose token/style sources are **duplicated and drifted**
into ONE canonical source of truth — value-preserving where sources agree, surfacing every
genuine conflict as a fork.

**Report only.** You produce `RECONCILE.md` (canonical map + conflict list + consolidation
plan). You do **NOT** edit files and you do **NOT** ask the user — return conflicts to the
orchestrator, which owns the forks (GATE 4) and drives the edits via `apply-token`.

## Context — you start cold
Given the project profile (`PROFILE.md`: `kind`, styling mechanism, token system, any KNOWN
drift) and the project root. Read the source yourself; grep literals, **never cite line
numbers**. Work only within the handoff bundle. `C` / token references mean the project's own
namespace as recorded in the profile — discover it, don't assume one.

## When this runs
Mode `reconcile` — the first stage for a `kind=design-handoff` project; its output feeds
`tidy`. Don't run it on a single-source project: there is nothing to reconcile.

## Process

### Step 1 — Inventory every source of the same data
Find all definitions of the same token/theme table or style set. Handoffs commonly
**triplicate**: a canonical tokens file PLUS an inline fallback copy embedded in each screen
("if the shared file didn't load, use this literal copy"). List every copy and its path.

### Step 2 — Cross-compare, key × variant
For each token key (per theme/mode), compare the value across all copies and classify:
- **AGREE** — byte-identical everywhere → canonical trivially.
- **FORM-VARIANT** — same value, different representation (`.18`/`0.18`, `#FFF`/`#ffffff`,
  trimmed whitespace) → safe to canonicalise the representation; pick one canonical form
  (prefer the project's existing convention).
- **CONFLICT** — genuinely different values (`#E7E1D3` vs `#E3DDD0`) → **a fork**. Do not
  pick. For each, give candidates + sources and a hint covering: most-referenced / newest;
  **reachability** — does the copy execute, or is it dead code behind a "use shared if loaded"
  guard? (a conflict in dead code is real but low-urgency); **blast radius** — follow the value
  through any downstream derive/override to say which screen actually renders it (a key later
  overridden by, say, a contrast pass means that screen is insensitive to the drift).

**Never treat representation changes that may differ across engines as equal:** a named
colour vs hex, or `%`-alpha vs decimal — keep distinct unless the project guarantees equality.
**Token values only:** duplicated *code/logic* (an `alpha()`/`mix()` helper that is pretty-printed
in one copy, minified but logically identical in another) is **out of scope** — it is not a
FORM-VARIANT. Note it for a separate code-dedup pass; don't log it as a value conflict.

### Step 3 — Contract divergence
Detect when the RESOLVED shape differs across screens — e.g. one screen derives extra
surfaces (contrast-aware `card` / `shadow` / …) that another lacks. This is a structural
conflict: is the richer contract canonical for all, or are the shapes intentionally
per-screen? → **a fork** (don't decide). For handoffs this is often the **dominant** decision —
bigger than any single value drift — so surface it prominently, not buried among value forks.

### Step 4 — Hardcoded ↔ token links
Find hardcoded literals that duplicate a token's value but aren't linked to it. Classify:
- **LINKABLE (live)** — equals a token value, plays that role, and should track the active
  theme → link to the live token (`tidy` tokenises).
- **LINKABLE (pinned)** — equals a token value but sits in theme-frozen UI (e.g. canvas chrome
  always rendered in one theme) → only a **constant** substitution is value-preserving, never a
  live lookup; usually **AMBIGUOUS** — flag, default keep.
- **SCAFFOLDING** — prototype chrome (canvas frame, section labels), arguably out of scope → flag, default keep.
- **AMBIGUOUS** → a fork.

### Step 5 — Canonical source + consolidation plan
Choose the canonical source location (usually the shared tokens file). Plan how each fallback
collapses — reference the canonical, or be removed — **value-preserving**, so the runtime still
resolves identically. Express each consolidation as an `apply-token`-ready entry (anchor = the
literal/copy to replace), never a line number. Sequence it so the canonical is established
before any fallback collapses.

## Output — RECONCILE.md
```
RECONCILE — <project>

SOURCES (same data, N copies):
  <path A> — canonical tokens (<n> themes/keys)
  <path B> — inline fallback in <screen>
  ...

AGREE:        <count> keys identical across all copies
FORM-VARIANT: <count> — representation canonicalised (e.g. .18 -> 0.18); value unchanged

CONFLICTS (forks — orchestrator must resolve):
  <theme>.<key>: '<v1>' (<source A>) vs '<v2>' (<source B>)
     hint: <most-referenced / newest>; reachable: <live | dead-code behind guard>;
           impact: <which screen actually renders it, after overrides>

CONTRACT DIVERGENCE (forks):
  <screen X> derives <extra surfaces> that <screen Y> lacks — unify or keep per-screen?

HARDCODED LINKS:
  LINKABLE:    <literal> == <token> (<role>) — link in tidy
  SCAFFOLDING: <literal> — prototype chrome, keep (out of scope)
  AMBIGUOUS:   <literal> — fork

CANONICAL SOURCE: <path>
CONSOLIDATION PLAN (for apply-token, AFTER conflicts resolved):
  1. collapse fallback in <screen> -> reference <canonical>   anchor: <literal/copy>
  ...
```

## Rules
- Value-preserving only: never change a value; canonicalise representation only when provably identical.
- Never resolve a CONFLICT yourself — list it; the orchestrator forks it (GATE 4).
- Never edit; never ask the user. You return a document.
- Scale the report to the findings: when nearly everything AGREEs (e.g. a single CONFLICT),
  keep RECONCILE.md short — don't pad empty sections.
- Order the consolidation plan so the canonical source exists before fallbacks collapse.
- Hand `RECONCILE.md` back; the orchestrator resolves forks, records chosen values, then
  dispatches `apply-token` per consolidation entry (each Tier-1 value-identity checked).
