# Core GNT Vocab — Source README

## Provenance

- **Source name:** Core Greek New Testament Vocabulary
- **Author:** James Tauber
- **Repository:** https://github.com/jtauber/core-gnt-vocab
- **Retrieved at:** 2026-06-12T06:59:05Z
- **Git commit:** `136cc6464f1d4dfca9dec63fbbe5fd013982459c` (short: `136cc64`)
- **Branch:** master
- **Commit date:** 2020-02-12

## License

**License detected:** No explicit LICENSE file in repository. Likely inherits CC-BY-SA from MorphGNT (same author).

**Engineering assessment (not legal advice):** Frequency counts may not be copyrightable (factual data), but glosses from Dodson may carry separate terms. Use as reference/baseline.

**License review status:** needs_human_review

## Files in selected/

### Lemma frequency lists (TSV: `lemma \t count \t gloss`):

| File | Coverage | Approx. lemmas |
|------|----------|----------------|
| `lemma_50.tsv` | ~50% text coverage | ~30 lemmas |
| `lemma_80.tsv` | ~80% coverage | ~170 lemmas |
| `lemma_90.tsv` | ~90% coverage | ~500 lemmas |
| `lemma_95.tsv` | ~95% coverage | ~1,100 lemmas |

### Form frequency lists (TSV: `form \t count \t lemma \t gloss`):

| File | Coverage |
|------|----------|
| `form_50.tsv` | ~50% coverage |
| `form_80.tsv` | ~80% coverage |
| `form_90.tsv` | ~90% coverage |

All files also available as `.txt` plain-text versions.
Scripts: `core_vocab.py` (generator), `convert-txt-to-tsv.py`.

## Usefulness for this project

- **Role:** Baseline/reference for frequency slider. Sanity-check for own calculations.
- **Priority:** Medium-High. Ready-made coverage thresholds (50/80/90/95%) for UI slider.
- **Glosses:** Dodson's glosses — sufficient for basic word cards.
- **Key insight:** ~30 lemmas = 50% coverage, ~170 = 80%, ~1,100 = 95% — excellent slider breakpoints.
- **Use for frequency builder:**
  1. Reference for verifying self-calculated cumulative coverage
  2. Coverage thresholds provide natural slider breakpoints
  3. Gloss field can seed initial lexicon

## License warning

- No explicit license. Likely inherits CC-BY-SA from MorphGNT.
- Use as **reference/baseline only** — do not ship in production without license clarification.
- **Safer approach:** Recalculate frequencies from MACULA SBLGNT (CC BY) and compare to these lists.
