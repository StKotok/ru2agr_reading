# MACULA Pipeline — Greek NT Data Generator

**Date:** 2026-06-17
**Status:** Implemented ✅

Pipeline for generating all Greek NT data structures from the MACULA Greek linguistic datasets (CC BY 4.0).

---

## Quick Start

```bash
npm run build:macula
```

This reads `docs/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv` (137 741 rows, 27 columns)
and TEI XML verse files, then generates everything into `assets/data/generated/macula/`.

---

## Source Files Used

| File | Purpose |
|------|---------|
| `docs/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv` | Primary data: tokens with lemma, morphology, Strong, glosses, domains |
| `docs/macula-greek/SBLGNT/tei/*.xml` (27 files) | Verse-level text reconstruction with correct punctuation |
| `docs/macula-greek/sources/MARBLE/SDBG/marble-domain-label-mapping.json` | Domain code → English label mapping |

**MACULA commit:** `9fec504` (determined at build time by SHA-256 of source TSV).

---

## Output Files

```text
assets/data/generated/macula/
├── tokens.jsonl              # 137 740 Greek token records (JSONL)
├── lexemes.json              # 5 468 aggregated lexeme records
├── verses.json               # 7 939 reconstructed verse texts
├── frequency.json            # 5 468 frequency entries (ranked, cumulative coverage)
├── source-manifest.json      # Provenance and license metadata
├── build-report.json         # Machine-readable coverage and issue report
├── build-report.md           # Human-readable coverage and issue report
├── schema/
│   ├── token.schema.json     # JSON Schema for token records
│   ├── lexeme.schema.json    # JSON Schema for lexeme records
│   ├── verse.schema.json     # JSON Schema for verse records
│   └── build-report.schema.json
└── books/
    ├── matthew.json          # Per-book token files (27 books)
    ├── mark.json
    └── ...
```

---

## Field Provenance

| Field | Source | Type |
|-------|--------|------|
| `surface` (text) | MACULA `text` | direct |
| `lemma` | MACULA `lemma` | direct |
| `normalized` | MACULA `normalized` | direct |
| `strong` | MACULA `strong` | direct |
| `morph` (code) | MACULA `morph` | direct |
| `person`, `number`, `gender`, `case`, `tense`, `voice`, `mood`, `degree` | MACULA individual columns | direct |
| `gloss` (Berean) | MACULA `gloss` | direct |
| `english` (Cherith) | MACULA `english` | direct |
| `louwNida` (ln) | MACULA `ln` (MARBLE) | direct |
| `domain` codes | MACULA `domain` (MARBLE) | direct |
| `domainLabelEn` | MARBLE label mapping | lookup (derived) |
| `class`, `type`, `role` | MACULA columns | direct |
| `frame`, `subjref`, `referent` | MACULA columns | direct |
| `surfaceNfc` | Unicode NFC of `surface` | derived |
| `surfaceSearch` | Diacritic-stripped lowercase | derived |
| `lemmaSearch` | Diacritic-stripped lowercase of lemma | derived |
| `lexemeId` | Deterministic hash of NFC lemma | derived |
| `transliteration` | SBL-like algorithm | derived |
| `accent` | Unicode analysis (without syllabification) | derived |
| `morphology.labelRu` | Robinson code → Russian decoder | derived |
| `isFunctionWord` | POS → config mapping | derived |
| `tokenCount`, `verseCount`, `rank`, `denseRank` | Aggregation + sorting | derived |
| `coverage`, `coveragePercent`, `cumulativeCoverage` | Computation | derived |
| `attestedForms` | Aggregation by lemma | derived |
| `allRefs`, `allRefsCount`, `firstRef` | Aggregation | derived |
| `autoSelectedRefs` | Deterministic heuristic | derived |
| `verse.text` | TEI XML reconstruction | derived |

---

## Algorithms

### Frequency

1. Parse all 137 740 tokens from TSV
2. Group by lemma, count tokens and unique verses
3. Sort by tokenCount descending, then lemma NFC
4. Assign `rank` (1-based, unique per lemma)
5. Assign `denseRank` (same count → same rank)
6. Compute `coverage = tokenCount / totalLexicalTokens`
7. Compute `cumulativeCoverage` (running sum of coverage)

**Breakpoints:**
| Coverage | Lemmas needed |
|----------|--------------|
| 50% | ~28 lemmas |
| 80% | ~317 lemmas |
| 90% | ~892 lemmas |
| 95% | ~1 756 lemmas |

### Transliteration (SBL-like)

Rules-based, not verified against official SBL Handbook:
1. Strip all combining diacritics (U+0300–U+036F)
2. Map Greek → Latin per letter/diphthong table
3. Gamma nasal: γ before γ/κ/χ/ξ → 'n'
4. Initial rough breathing: add 'h' prefix (ῥ → 'rh')
5. Preserve case of original

### Accent Detection

- Detects acute (oxia), grave (varia), circumflex (perispomeni)
- Reports the accented grapheme and its NFD base character index
- Does NOT perform syllabification
- Distinguishes accent from breathing marks, diaeresis, and iota subscript

### `isFunctionWord`

Config-driven mapping from POS category:
```json
{
  "article": true,
  "preposition": true,
  "conjunction": true,
  "particle": true,
  "pronoun": true,
  "determiner": true
}
```
All other categories → `false`.

### `autoSelectedRefs`

Deterministic selection of up to 5 example verses:
1. First occurrence in canonical order
2. Most frequent surface forms (up to 2 distinct verses)
3. Different books (up to 2 more)
4. Distinct morphology forms (supplementary)
5. Fallback from remaining refs

Each selection records its `reason` (e.g., `"first-occurrence"`).

---

## Limitations

The following fields are **intentionally not generated** by this pipeline
(they require external data sources or manual curation):

- Russian glosses
- Russian definitions
- Etymology
- IPA pronunciation
- Russian transcription of pronunciation
- Audio files
- Syllable breaks
- Declension/conjugation type
- Full theoretical paradigm (only attestedForms provided)
- Verb transitivity
- Adjective type
- Alignment with Synodal/KJV/other translations
- Translation variants
- Editorially curated "key verses"
- `ruMatches` / `ruExclude` regex patterns

---

## How to Update MACULA

1. Replace/add files in `docs/macula-greek/`
2. Run `npm run build:macula`
3. Verify: `npx vitest run scripts/macula/test/`
4. Commit generated data

---

## Tests

```bash
npx vitest run scripts/macula/test/
```

6 test files, 84 tests:
- `normalizer.test.js` — Unicode NFC, search forms, accent stripping
- `lexeme-id.test.js` — Stable ID generation, collision detection
- `transliteration.test.js` — SBL-like transliteration fixtures
- `accent.test.js` — Accent detection, breathing vs accent
- `morphology-decoder.test.js` — Robinson code parsing, Russian labels
- `output-data.test.js` — Integration: token counts, verse text, frequency integrity, book coverage, determinism

---

## License & Attribution

**MACULA Greek Linguistic Datasets**, available at https://github.com/Clear-Bible/macula-greek/
Licensed under CC BY 4.0.

**Required attribution text for app UI:**

> MACULA Greek Linguistic Datasets, available at https://github.com/Clear-Bible/macula-greek/

**Additional source attributions:**

- SBLGNT: © 2010 Society of Biblical Literature and Logos Bible Software, CC-BY 4.0
- Berean Interlinear Bible glosses: Public domain (as of April 30, 2023)
- Cherith Glosses: © 2023 Cherith Analytics, CC BY 4.0
- MARBLE word sense data: Used with permission, United Bible Societies

---

## Next Steps

After this pipeline, the next stage is:
1. Russian glosses — enrich lexemes with Russian translations (manual curation + LLM-assisted)
2. Alignment with Synodal text — connect Greek tokens to Synodal words via Strong numbers
3. Multi-translation alignment — KJV, modern Russian translations
