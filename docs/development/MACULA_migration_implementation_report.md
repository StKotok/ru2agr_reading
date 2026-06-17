# MACULA Migration — Implementation Report

**Created:** 2026-06-17
**Branch:** `feat/macula-v3`
**Plan:** `MACULA_migration_implementation_plan.md` (checklist)
**Architecture:** `MACULA_migration_plan_v3.md` (data model)

---

## Step 0 — Baseline (2026-06-17)

### Gate 0: Branch created, baseline green and recorded ✅

| Metric | Value |
|---|---|
| Branch | `feat/macula-v3` (from `dev2`) |
| `npm test` | 259 tests, 20 files, **all passing** |
| `npm run build` | **green** (1.34s, 15 precache entries, 1600 KiB) |
| `assets/data/generated` | 369 MB |
| `assets/data/bibles` | 36 MB |
| `assets/data` total | 411 MB |
| `dist/` size | 440 MB |

