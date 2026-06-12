# Greek NT Frequency Sources

Raw source datasets for building a Greek New Testament lemma frequency dictionary for the **Греческая читалка НЗ** (ru2agr_reading) app.

**Status:** Raw data collected. Frequency dictionary not yet built.
**Date:** 2026-06-12

## Quick Navigation

| Document | Purpose |
|----------|---------|
| [`manifest.md`](manifest.md) | Human-readable source manifest |
| [`manifest.json`](manifest.json) | Machine-readable source manifest |
| [`checksums.sha256`](checksums.sha256) | SHA256 checksums for all selected files |
| [`notes/dataset-comparison.md`](notes/dataset-comparison.md) | Technical comparison of all 6 sources |
| [`notes/license-review.md`](notes/license-review.md) | License analysis per source |
| [`notes/next-steps-for-frequency-builder.md`](notes/next-steps-for-frequency-builder.md) | How to build the frequency dictionary |

## Directory Structure

```
greek-nt-frequency-sources/
├── README.md              ← this file
├── manifest.json           ← machine-readable manifest
├── manifest.md             ← human-readable manifest
├── checksums.sha256        ← file integrity checksums
├── raw/                    ← full shallow clones (git repos)
│   ├── sblgnt/                SBL Greek New Testament
│   ├── macula-greek/          MACULA Greek Linguistic Datasets
│   ├── morphgnt-sblgnt/       MorphGNT SBLGNT
│   ├── core-gnt-vocab/        Core GNT Vocab (James Tauber)
│   ├── stepbible-data/        STEPBible Data (Tyndale House)
│   └── opengnt/               Open Greek New Testament Project
├── selected/               ← curated copies of useful files
│   ├── sblgnt/                SBLGNT XML books + LICENSE
│   ├── macula-greek/          ★ SBLGNT TSV (137,741 rows) + Nestle1904 TSV
│   ├── morphgnt-sblgnt/       27 *-morphgnt.txt files
│   ├── core-gnt-vocab/        lemma_50/80/90/95.tsv + form_50/80/90.tsv
│   ├── stepbible-data/        TAGNT, TBESG, TEGMC morphology codes
│   └── opengnt/               Base text CSV, keyed features, DictRMAC
├── licenses/               ← collected license files
└── notes/                  ← analysis and planning documents
    ├── dataset-comparison.md
    ├── license-review.md
    └── next-steps-for-frequency-builder.md
```

## Sources Summary

| # | Source | Primary Use | License Risk | Production Ready? |
|---|--------|------------|-------------|-------------------|
| 1 | SBLGNT | Text reference | Low | Reference only |
| 2 | **MACULA Greek** | **⭐ PRIMARY: lemma/form frequency** | Medium | **Best candidate** |
| 3 | MorphGNT SBLGNT | Cross-validate frequencies | **High** (CC-BY-SA) | Verification only |
| 4 | Core GNT Vocab | Baseline coverage thresholds | Medium | Reference only |
| 5 | STEPBible Data | Glosses (TBESG), morphology codes | **High** (license conflict) | Reference only |
| 6 | OpenGNT | Comparison, transliterations | **High** (multi-source) | Comparison only |

## ⭐ Recommended Path

1. **Build the frequency dictionary** from `selected/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv`
2. **Cross-validate** against MorphGNT and Core GNT Vocab
3. **Enrich** with transliterations and glosses where licenses permit
4. **Get legal review** before production use — see `notes/license-review.md`

## Attribution Requirements

All sources require attribution. See individual source READMEs in `selected/*/README.md` and `notes/license-review.md` for details.

## ⚠️ Disclaimer

**Engineering assessment only — NOT LEGAL ADVICE.** All license determinations are preliminary. Human legal review is required before embedding any source data in a production application, especially for commercial distribution.
