# OpenGNT — Source README

## Provenance

- **Source name:** Open Greek New Testament Project (OpenGNT)
- **Author:** Eliran Wong
- **Repository:** https://github.com/eliranwong/OpenGNT
- **Retrieved at:** 2026-06-12T06:59:05Z
- **Git commit:** `0029589cccd50bd48b1941aa041a956de6c29ac4` (short: `0029589`)
- **Branch:** master
- **Commit date:** 2022-04-21

## License

The README states a "public license" but does not specify exact terms. Aggregates data from multiple sources: TANTT (CC BY), OpenText annotations, Levinsohn GNT, Berean translations, TBESG (STEPBible — license conflict).

**Engineering assessment (not legal advice):** Fantastic aggregation, but complex multi-source license heritage. "Not preferred for production frequency until legal review."

**License review status:** needs_human_review — complex multi-source license heritage.

## Files in selected/

### Primary data:
- `OpenGNT_BASE_TEXT.zip` (8.4 MB) — base Greek NT text (OGNT v3.3)
- `OpenGNT_keyedFeatures.csv.zip` (8.6 MB) — keyed linguistic features

### Dictionaries: OpenGNT_DictRMAC_{English,Chinese_simplified,Chinese_traditional,Spanish}.tsv

### Cross-references: OpenGNT_headingCrossRef{1,2,3}.tsv, OpenGNT_verseFirstSort.tsv

### Unpacked inspection (in `unpacked/`):
- `base_text/OpenGNT_version3_3.csv` — 138,014 rows, TAB-separated
- `keyed_features/OpenGNT_keyedFeatures.csv` — 138,026 rows

### Documentation: README.md, fileDescription.md (comprehensive column reference)
### Scripts: Script/ directory with generation scripts
### Templates: mapping_template/ with POS codes, word lists

## Base text CSV key columns

13 column groups in TAB-separated format. For frequency building:
- `〔OGNTk｜OGNTu｜OGNTa｜lexeme｜rmac｜sn〕` — **Koine form, unaccented, accented, LEMMA, morphology, Strong's**
- `〔TBESG｜IT｜LT｜ST｜Español〕` — glosses at multiple levels
- `〔transSBLcap｜transSBL｜modernGreek｜Fonética_Transliteración〕` — transliterations
- `〔Book｜Chapter｜Verse〕` — reference
- `〔BDAGentry｜...｜LN-LouwNidaNumbers〕` — lexicon cross-references

## Usefulness for this project

- **Role:** Alternative/aggregated source for comparison and enrichment.
- **Priority:** Medium. Use for cross-referencing and supplementary features (transliterations, glosses).
- **Key strengths:**
  - Clean, well-documented CSV with `fileDescription.md`
  - Rich layers: morphology, Strong's, multiple glosses, transliterations
  - SBL transliteration (useful for Russian-speaking users)
- **Use for frequency builder:**
  1. Extract `lexeme` → compare frequencies with MACULA
  2. Use `TBESG` gloss field to seed lexicon
  3. Use `transSBL` for English transliteration
  4. Use `rmac` with DictRMAC for morphology labels

## License warning

- Multi-source heritage: OGNT ("public license"), TBESG (CC BY/NC ambiguity), TANTT (CC BY), Berean translations.
- Attribution required: Eliran Wong, OpenGNT, TANTT, Berean, STEPBible, MorphGNT.
- **Recommendation:** Use for cross-validation only. MACULA SBLGNT is preferred for production.
