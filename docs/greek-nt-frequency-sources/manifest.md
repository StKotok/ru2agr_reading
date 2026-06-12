# Greek NT Frequency Sources — Manifest

**Created:** 2026-06-12T06:59:05Z
**Project:** Греческая читалка Нового Завета (ru2agr_reading)
**Purpose:** Raw source datasets for building a Greek NT lemma frequency list

---

## Sources Overview

| # | Source | Commit | License | Production Ready? |
|---|--------|--------|---------|-------------------|
| 1 | SBLGNT | `c4d241a` | SBLGNT EUL | Reference only |
| 2 | **MACULA Greek** | `453876a` | CC BY 4.0 | ⭐ **Best candidate** |
| 3 | MorphGNT SBLGNT | `aaed91e` | CC-BY-SA | ⚠️ Share-alike risk |
| 4 | Core GNT Vocab | `136cc64` | Unclear | Reference baseline |
| 5 | STEPBible Data | `b86d26c` | Conflicting | ⚠️ License conflict |
| 6 | OpenGNT | `0029589` | Multi-source | ⚠️ Complex heritage |

---

## Source Details

### 1. SBLGNT — SBL Greek New Testament
- **URL:** https://github.com/LogosBible/SBLGNT
- **Raw:** `raw/sblgnt/` | **Selected:** `selected/sblgnt/`
- **Files:** 27 XML books, LICENSE, About.md
- **Role:** Canonical text reference. No lemma/morphology — text only.
- **License:** SBLGNT End-User License. Attribution to SBL + Logos.
- **For frequency builder:** Cross-reference text consistency.

### 2. MACULA Greek ⭐ — PRIMARY CANDIDATE
- **URL:** https://github.com/Clear-Bible/macula-greek
- **Raw:** `raw/macula-greek/` | **Selected:** `selected/macula-greek/`
- **Files:** `SBLGNT/tsv/macula-greek-SBLGNT.tsv` (137,741 rows, 26 columns), Nestle1904 TSV, + 5 supplementary TSVs
- **Role:** Primary production source for lemma/form frequency dictionary.
- **License:** CC BY 4.0. Attribution to Clear Bible + MACULA + SBLGNT.
- **For frequency builder:** Group by `lemma` → frequency. Extract `strong`, `morph`, `english` for annotations.

### 3. MorphGNT SBLGNT — Verification Corpus
- **URL:** https://github.com/morphgnt/sblgnt
- **Raw:** `raw/morphgnt-sblgnt/` | **Selected:** `selected/morphgnt-sblgnt/`
- **Files:** 27 `*-morphgnt.txt` (one per NT book, 7 columns each)
- **Role:** Cross-check MACULA-derived lemma frequencies.
- **License:** SBLGNT text: SBLGNT EUL. Lemmatization: **CC-BY-SA** ⚠️.
- **For frequency builder:** Parse `lemma` column, compare with MACULA lemma frequencies.

### 4. Core GNT Vocab — Reference Baseline
- **URL:** https://github.com/jtauber/core-gnt-vocab
- **Raw:** `raw/core-gnt-vocab/` | **Selected:** `selected/core-gnt-vocab/`
- **Files:** `lemma_50/80/90/95.tsv`, `form_50/80/90.tsv`, Python scripts
- **Role:** Ready-made coverage thresholds for slider breakpoints.
- **License:** Unclear (likely CC-BY-SA via MorphGNT heritage). Reference only.
- **For frequency builder:** Verify self-calculated cumulative coverage against these lists.

### 5. STEPBible Data — Gloss Reference
- **URL:** https://github.com/STEPBible/STEPBible-Data
- **Raw:** `raw/stepbible-data/` | **Selected:** `selected/stepbible-data/`
- **Files:** TAGNT (2 files), TBESG lexicon, TEGMC morphology codes
- **Role:** TBESG as Strong→gloss lookup; TEGMC as morphology code reference.
- **License:** ⚠️ **CONFLICT** — CC BY 4.0 vs CC BY-NC 3.0 vs CC BY-NC-ND.
- **For frequency builder:** Join TBESG glosses with MACULA data via Strong's numbers.

### 6. OpenGNT — Comparison & Enrichment
- **URL:** https://github.com/eliranwong/OpenGNT
- **Raw:** `raw/opengnt/` | **Selected:** `selected/opengnt/`
- **Files:** Base text ZIP (138,014 rows), keyed features ZIP, DictRMAC TSVs, scripts
- **Role:** Cross-validation; SBL transliterations; multi-level glosses.
- **License:** Complex multi-source heritage. Attribution to Eliran Wong + upstream.
- **For frequency builder:** Extract `lexeme` for comparison; use `transSBL` for transliteration.

---

## Quick Start for Frequency Builder

1. **Primary data:** Parse `selected/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv`
2. **Group by `lemma`** → count → sort descending → calculate cumulative coverage
3. **Cross-check** against `selected/morphgnt-sblgnt/` lemma frequencies
4. **Verify coverage thresholds** against `selected/core-gnt-vocab/` lists
5. **Enrich with glosses** from TBESG (`selected/stepbible-data/`) or MACULA's own `english` column
6. **Build JSON** for the app's frequency slider

---

**⚠️ DISCLAIMER:** Engineering assessment only — not legal advice. All sources require human legal review before production use.
