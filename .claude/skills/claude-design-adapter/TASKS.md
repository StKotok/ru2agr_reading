# claude-design-adapter — Tasks to reach "ideal"

v1 ships via the pragmatic path (Path 2): the riskiest paths are validated by real cold-agent
runs (`profile-project` ×3 formats, `reconcile` parity, `functionalize` write-path on cambio,
GATE 4 pressure test); the rest is validated by spec. The tasks below close that debt and polish
the skill to "ideal", in dependency/priority order.

**Tracking legend:** `[ ]` = not done · `[x]` = done, tagged `(YYYY-MM-DD)` pointing to the
**Validation log** at the bottom (what ran, result, any spec fix it forced). The skill improves
in small documented iterations: run a real scenario (a cold agent IS the "test"), fix the spec
ONLY where the agent actually stumbled, then check the box and log the evidence.

## Planned iterations (next 1–2)

1. **Validate the `tidy` spine end-to-end (cold agents) on one fixture** — exercises the largest
   cluster of never-run-cold agents at once (4 extract → `name-tokens` → `apply-token` →
   `verify-visual` Tier 1 → `cross-check` → `audit-coverage` → `report-summary`). Fix spec bugs
   found; log; check the §A items it closes.
2. **Validate `functionalize`'s adapt-case + the canvas/overlay placement, then pressure-test
   GATE 1/2/3/5** — closes the only untested `functionalize` branch and the remaining gates
   (§A bullets 5–6, §B).

## A. Core agent validation (the main test debt)
- [ ] Run a full end-to-end pipeline via real cold agents on each of the 3 fixtures
      (ru2gr / proverbs1 / cambio) — exercises every still-unrun agent at least once.
- [ ] Validate the `tidy` chain end-to-end on a fixture: `extract-colors` / `extract-spatial` /
      `extract-typography` / `find-components` → `name-tokens` → `apply-token` → `verify-visual`
      (Tier 1) → `cross-check` → `audit-coverage` → `report-summary`.
- [ ] Run `refine` as a cold agent (ledgered-diff) on a fixture — currently only done by hand.
- [ ] Run `reconcile`'s full consolidation (the apply path via `apply-token`) end-to-end on the
      ru2gr drift fixture — not just the report.
- [ ] Validate `functionalize`'s **adapt** case (proverbs1: activate the existing tweak panel,
      strip host chrome) as a cold agent — only the **build** case (cambio) has been run.
- [ ] Validate the **canvas / draggable-overlay** control placement in a real `functionalize`
      run (control outside product DOM; events wired from a root that contains it).
- [ ] Run the **Wizard** end-to-end on a first-run fixture: depth gating (Auto/Minimal/Balanced/
      Thorough), forks, express-lane, config persistence.
- [ ] Verify the **artifacts/state model** actually round-trips (`config.json`, `RECONCILE.md`,
      `TOKENS.md`, `REFINE-LEDGER.md`) is written by one mode and consumed by the next.
      *(2026-06-24: static contract audited & aligned — see log; runtime round-trip still needs a cold run.)*

## B. Discipline gates
- [ ] Pressure-test GATE 1 (URL verify), GATE 2 (syntax), GATE 3 (no guessing), GATE 5 (host-tool
      artifacts) under combined pressure — only GATE 4 has been pressure-tested.
- [ ] Micro-test the discipline-gate wording per writing-skills (5+ fresh-context reps vs a
      no-guidance control; read every flagged match) before trusting GATE 4/5 phrasing.

## C. Polish & consistency
- [ ] Token-efficiency / clarity pass on `SKILL.md` + every `agents/*.md` (length, redundancy,
      one excellent example each).
- [x] (2026-06-24) Final consistency sweep: agent-table counts, dispatch table, mode list, `ROADMAP.md`,
      `description`, and `./check-universal.sh` all in agreement.
- [x] (2026-06-24) Re-run `./check-universal.sh` (must print `clean`) after any spec edit.
- [x] (2026-06-24) Add a one-line skill status / "what works in v1" note (top of `SKILL.md` or a short README).

## D. Known carry-overs (also in ROADMAP.md — v2, not "ideal-v1")
- [ ] `port` mode (export to React/HTML/Angular/Flutter) — v2.
- [ ] Non-Claude-Design / non-DC inputs — v2.

## Validation log

Dated evidence for every checked box above, newest first.

### 2026-06-24 — Iteration 2: static artifact-contract audit (in-context, no cold agents)
- Result: PASS — resolved an Artifacts & state contradiction; one nuance flagged for the cold run.
- Found:  (a) `PROFILE.md` / `RECONCILE.md` / `TOKENS.md` were attributed to **report/plan-only**
          agents whose specs say "do not edit files" — so the table's "Written by" contradicted
          the specs. (b) `TOKENS.md` had **no producer**: its row said "tidy" (a mode), and no
          tidy-chain spec names the file; its content comes from `name-tokens`' unified plan.
- Fix:    Added a "Who writes them" note to the Artifacts table (edit-agents persist their own
          artifact; report/plan-only agents return a document the orchestrator persists; "written
          by" = whose output populates the file). `TOKENS.md` row now reads `tidy (name-tokens
          plan)`. `REFINE-LEDGER.md`←refine, `config.json`←Wizard already consistent. guard: clean.
- Flag:   whether `TOKENS.md` should reflect the **post-apply committed** inventory (not just the
          pre-apply plan), and whether `name-tokens.md` should name the file — left to the cold
          tidy run (§A bullets 2 & 8), not rewritten blind.
- Closes: advances §A bullet 8 (static contract aligned; runtime round-trip still pending).

### 2026-06-24 — Iteration 1: spec consistency sweep + v1 status note (in-context, no cold agents)
- Result: PASS — `SKILL.md` / `ROADMAP.md` / `description` / agent-table / guard now agree.
- Found:  ROADMAP claimed v1 is **DC-only** ("Claude Design DC front-end"; "v1 tests only DC
          input"), but `SKILL.md`, `profile-project`, and the `description` treat **React/Babel
          HTML** as a supported v1 Claude Design shape. ROADMAP conflated "non-DC" with
          "non-Claude-Design".
- Fix:    ROADMAP now front-ends **Claude Design exports** (DC + React/Babel shapes); its v2 item
          renamed **"Non-Claude-Design inputs"**. Added a **Status — v1** line to `SKILL.md`.
          Agent count verified (15 files = 15 rows; `port` = v2 placeholder). guard: clean.
          Token-efficiency trim of the 15 agent specs deliberately deferred — behavioral specs
          need a failing test before rewording (writing-skills Iron Law); kept as an open §C item.
- Closes: §C consistency sweep + guard re-run + v1 status note.

### Template — YYYY-MM-DD — <what ran> on <fixture>
- Result: PASS | PARTIAL | FAIL — <one line>
- Found:  <gaps / spec bugs the cold agent hit, or "none">
- Fix:    <spec edit made, or "n/a"> ; guard: clean
- Closes: §A bullet <n>
