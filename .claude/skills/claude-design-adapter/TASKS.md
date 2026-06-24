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

### 2026-06-24 — Iteration 3: full cold-agent validation campaign (IN PROGRESS)
Real cold `general-purpose` subagents run against the 3 fixtures (each given ONLY its spec +
profile + scope — no hints). Edit-agents run on isolated `/tmp/cda-test/<fixture>` copies with a
git baseline, so the repo working tree stays pristine. Findings + fixes below; box-checks follow
once a chain fully passes.

- **Step 0 — artifact round-trip (static, no cold agents).** Validated the persisted ru2gr
  artifact set against the SKILL.md contract.
  - **F1 (RED→GREEN) — `profile-project` never emitted `kind`.** SKILL.md (Artifacts table,
    Step 0, Wizard step 1 "detect kind", GATE 4 "kind confirmation") all depend on `PROFILE.md`
    carrying `kind`, but `profile-project.md`'s prose + Output template never mentioned it; the
    real ru2gr `PROFILE.md` had no `kind` line. Cold run on proverbs1 confirmed the omission (RED).
    **Fix:** added a "Project kind" discovery item + `Kind:` template slot.
  - **F4 (RED→GREEN) — Output template contradicted its own prose.** Prose says "Record the
    sub-shape too" and SKILL/reconcile reference PROFILE `drift`, but the template had no slot;
    the cold agent explicitly flagged "no slot for…". **Fix:** added `Sub-shape:` + `Drift/dup:`
    template slots.
  - **GREEN:** re-ran `profile-project` cold on proverbs1 (React/Babel) and cambio (DC+mustache);
    both now emit `Kind: design-handoff` *with cited evidence* + filled `Sub-shape:`/`Drift/dup:`.
    The `Sub-shape:` slot proved its worth — three genuinely different shapes across the fixtures
    (DC+createElement+onClick / DC+mustache+`data-*` delegation / JSX+onClick).
- **`reconcile` report (cold, ru2gr source-only scratch) — GREEN.**
  - **F2 resolved (no spec change).** `reconcile.md` forbids line numbers; the cold run cited
    **zero** (anchored by literals/paths). The persisted `RECONCILE.md`'s "(lines 15-24)" was a
    non-compliant hand-made artifact, **not** a spec bug. Spec is correct.
  - Quality: found the token tables are **already single-source** (no value CONFLICTs), surfaced
    the real dominant issue as a **CONTRACT DIVERGENCE fork** (one screen uses the full derived
    surface set, the other a flat elevation model), classified hardcoded literals (SCAFFOLDING /
    LINKABLE-pinned / code-dedup), didn't resolve forks, scaled the report. Spec is robust.
  - **Limitation logged:** ru2gr has **no collapsible fallback drift**, so the reconcile
    **apply/consolidation path** (`apply-token` collapsing fallbacks) cannot be exercised on it —
    needs a fixture with real duplicated copies. §A "reconcile full consolidation" stays open.
- **`functionalize` adapt (cold, proverbs1 isolated copy) — GREEN.** Correctly detected Case (a)
  + Case (b) overlay placement: activated the host-gated tweak panel standalone
  (`window.parent===window` auto-open + a reopen FAB), wired via the existing React state. Diff
  **verified**: `Binah.html` byte-identical; EDITMODE sentinel + all 5 postMessage protocol
  messages preserved (GATE 5 ✓); only `data-omelette-chrome`/`--dc-inv-zoom` chrome stripped.
  Closes §A bullets 5 (adapt) + 6 (canvas/overlay) and is a real GATE-5 pressure-test.
- **`functionalize` build (cold, cambio) — F5 (RED→GREEN), a real bug.** Cambio already had a
  correctly-placed canvas theme control **plus** a theme-toggle pill rendered *inside* the product
  action bar. The agent **deleted the in-product pill** (verified: `data-theme-toggle` 3→0) and
  falsely certified "Default check: Unchanged" — but that pill is default-rendered product DOM, so
  removing it **violates the additive/preserve-default invariant**. Spec was *silent* on a variant
  control already living inside product UI, and Step 6 didn't stop a removal. **Fix (functionalize.md):**
  (a) Invariant now states *additive ≠ subtractive* — never remove/move/restyle a product-DOM node;
  an in-product control is product design, not chrome; moving it is a HALT-fork for `refine`.
  (b) Adapt case gained an **"already functional → no edit"** outcome + "strip host chrome, not
  product controls". (c) Step 6 verify: product-DOM diff at default **must be empty**; any removal =
  FAIL. GREEN re-run on the reset copy in flight.
- **Tidy Phase 1 (cold, 4 extract agents on `ru2gr.dc.html`) — GREEN.** All four converged on the
  same findings (section-02 colour drift, 3 byte-identical selects, eyebrow pattern, split hairline
  tokens); form-preserving, role-based names, near-identical variants flagged-not-merged, behavioural
  values skipped. Fixture note: this file is **already post-tidy** (the `--canvas-*` tokens exist), so
  the chain runs on the genuine residual drift the agents found — a small but real end-to-end.
- **`name-tokens` (cold) — GREEN on substance:** theme-tokens intentionally empty (chrome is
  constant, not per-theme), drift linked to *existing* tokens, derived/alpha flagged "don't
  auto-collapse", behavioural enums guarded, ordered apply sequence with grep anchors.
- **Line-number rule slip — 2 of 6 report agents** (`extract-spatial`, `name-tokens`) cited line
  numbers despite their spec's "never cite line numbers" — **both benignly** (grep anchors still
  provided, so the rule's purpose held). NOT rewording blind on uncontrolled N=2 (prohibitions
  backfire — writing-skills). → concrete data for §B's "micro-test the discipline-gate wording"
  item; treated as cosmetic for now.
- **F3 RESOLVED.** The real ru2gr `TOKENS.md` + the post-tidy fixture confirm `TOKENS.md` is the
  **finished/post-apply inventory** (token→value→role + coverage), whose content *originates* in the
  `name-tokens` plan and is *confirmed after apply*. SKILL.md row `tidy (name-tokens plan)` is
  defensible but slightly undersells it — minor doc-precision item (see §C), not an agent bug.
- **In flight / queued:** `apply-token` + `verify-visual` (tidy edit gate) and the cambio
  `functionalize` GREEN re-run; then `cross-check`/`audit-coverage`/`report-summary`; `refine` cold;
  GATE 1/2/3 pressure-tests; Wizard (orchestrator-run).

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
