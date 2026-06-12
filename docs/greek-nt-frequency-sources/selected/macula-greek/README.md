# MACULA Greek — Source README

## Provenance

- **Source name:** MACULA Greek Linguistic Datasets
- **Repository:** https://github.com/Clear-Bible/macula-greek
- **Retrieved at:** 2026-06-12T06:59:05Z
- **Git commit:** `453876a98c049b08b54375918d04ead2a3d879e7` (short: `453876a`)
- **Branch:** main
- **Commit date:** 2026-04-24

## License

**License detected:** CC BY 4.0 (see LICENSE.md)

**Engineering assessment (not legal advice):** CC BY 4.0 permits commercial use with attribution. However, underlying Greek texts (SBLGNT, Nestle1904) carry their own licenses. Attribution to Clear Bible and the MACULA project is required.

**License review status:** needs_human_review

## Files in selected/

### TSV files:

| File | Lines | Description |
|------|-------|-------------|
| `SBLGNT/tsv/macula-greek-SBLGNT.tsv` | 137,741 | **PRIMARY CANDIDATE** — word-level SBLGNT with lemma, morphology, Strong, gloss |
| `Nestle1904/tsv/macula-greek-Nestle1904.tsv` | 137,779 | Same format, Nestle 1904 text base |
| `Nestle1904/1904-nodes-vref.tsv` | — | Node/verse reference mapping |
| `sources/Clear/wordsense/greek-wordsenses.tsv` | — | Word sense data |
| `sources/Clear/synonyms/Proximity.tsv` | — | Synonym proximity data |
| `sources/Clear/mappings/mappings-GNT-stripped.tsv` | — | Mapping data |
| `sources/Clear/mappings/mappings-GNT-stripped-pre-2023-08-21.tsv` | — | Historical mapping data |
| `sources/door43/figures-of-speech/UTN-figures-of-speech-NT.tsv` | — | Figures of speech |

### SBLGNT TSV columns (26 columns):

**Key fields for frequency builder:** `lemma`, `normalized`, `text` (surface form), `strong` (Strong's number), `morph` (Robinson code), `english` (gloss), `class`, `type`, `domain`, `ln` (Louw-Nida).

## Usefulness for this project

- **Role:** **PRIMARY CANDIDATE** for production lemma frequency list.
- **Priority:** Highest. Rich annotation: lemma, morphology, Strong's, gloss, semantic domain.
- **Use for frequency builder:**
  1. Parse `SBLGNT/tsv/macula-greek-SBLGNT.tsv`
  2. Group by `lemma` → lemma frequency
  3. Group by `normalized` → form frequency
  4. Extract `strong`, `morph`, `english` for gloss/annotation layer
  5. Calculate cumulative coverage percentages

## License warning

- CC BY 4.0 on MACULA annotations. SBLGNT text has its own license.
- Attribution required: Clear Bible, MACULA project, SBLGNT contributors.
- **Recommended for production:** YES, after human legal review.
