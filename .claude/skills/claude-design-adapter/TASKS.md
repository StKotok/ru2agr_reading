# claude-design-adapter — Tasks to reach "ideal"

v1 ships via the pragmatic path (Path 2): the riskiest paths are validated by real cold-agent
runs (`profile-project` ×3 formats, `reconcile` parity, `functionalize` write-path on cambio,
GATE 4 pressure test); the rest is validated by spec. The tasks below close that debt and polish
the skill to "ideal", in dependency/priority order. Unchecked = not done.

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

## B. Discipline gates
- [ ] Pressure-test GATE 1 (URL verify), GATE 2 (syntax), GATE 3 (no guessing), GATE 5 (host-tool
      artifacts) under combined pressure — only GATE 4 has been pressure-tested.
- [ ] Micro-test the discipline-gate wording per writing-skills (5+ fresh-context reps vs a
      no-guidance control; read every flagged match) before trusting GATE 4/5 phrasing.

## C. Polish & consistency
- [ ] Token-efficiency / clarity pass on `SKILL.md` + every `agents/*.md` (length, redundancy,
      one excellent example each).
- [ ] Final consistency sweep: agent-table counts, dispatch table, mode list, `ROADMAP.md`,
      `description`, and `./check-universal.sh` all in agreement.
- [ ] Re-run `./check-universal.sh` (must print `clean`) after any spec edit.
- [ ] Add a one-line skill status / "what works in v1" note (top of `SKILL.md` or a short README).

## D. Known carry-overs (also in ROADMAP.md — v2, not "ideal-v1")
- [ ] `port` mode (export to React/HTML/Angular/Flutter) — v2.
- [ ] Non-Claude-Design / non-DC inputs — v2.
