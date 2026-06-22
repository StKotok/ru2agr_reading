# RECONCILE — docs/ru2gr-handoff

Claude Design handoff; `kind = design-handoff`. Produced by claude-design-adapter `reconcile`.

## SOURCES
12-theme token table is **triplicated**, every fallback behind
`if(window.RU2GR)return window.RU2GR.THEMES` (so fallbacks are **dead code** at runtime):
- **S1 canonical** — `project/ru2gr-tokens.js` (`window.RU2GR.THEMES`)
- S2 fallback — `project/Греческая читалка.dc.html` (`buildThemes()`)
- S3 fallback — `project/Слова.dc.html` (`buildThemes()`)

## CROSS-COMPARE
- **AGREE:** 191 / 192 raw cells.
- **FORM-VARIANT:** 0.
- **CONFLICT:** 1 — Пергамент `alt`: `#E3DDD0` (S1+S3) vs `#E7E1D3` (S2).
  reachable: dead-code (behind guard); impact: «Греческая» consumes `alt` directly,
  «Слова» overrides `paper2`/`sidebar`.

## RESOLUTIONS
- **CONFLICT-1 → RESOLVED to `#E7E1D3`** (user, 2026-06-22).
  Applied: S1 canonical set to `#E7E1D3` [refine — see REFINE-LEDGER]; S3 synced
  `#E3DDD0`→`#E7E1D3` [value-preserving on the happy path]; S2 already `#E7E1D3`.
  All three now agree; zero drift; `#E3DDD0` no longer present in the bundle.
- **CONTRACT-1** (Слова's contrast `palette()`+helpers vs «Греческая»'s plain lookup)
  → **RESOLVED: unified** (user). Shared `buildPalette(THEMES, theme, contrast)` + helpers
  (`hexToRgb/rgbToHex/mix/lum`) moved into `ru2gr-tokens.js` (`window.RU2GR.buildPalette`).
  «Слова» now calls it (value-preserving — identical logic; offline fallback kept).
  «Греческая» now calls it too and gains contrast levels (intended visual change —
  see REFINE-LEDGER); `contrast` wired into its `dc-import`. node --check OK; builder smoke-tested.

## HARDCODED LINKS
- `#9a9488` == Пергамент `muted`, `#bdb6a7` == `muted2` — but the canvas chrome is
  **theme-frozen** → pinned / AMBIGUOUS, default keep.
- SCAFFOLDING (keep, out of scope): `#cfcabf`, `#2b2620`, `#7a7468`, `#c4beb0`,
  `rgba(207,202,191,…)`, `rgba(40,34,22,…)`.

## REMAINING / FOLLOW-UPS
- *(optional)* Collapse fallbacks to a true single source: reduce both `buildThemes()` to
  `return window.RU2GR.THEMES;` — removes triplication entirely, trades the offline-load
  fallback. Not done in this slice (bulk literal deletion).
- CONTRACT-1 structural unification — pending the planned step.
