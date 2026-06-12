# Dataset Comparison — Greek NT Frequency Sources

**Date:** 2026-06-12
**Purpose:** Technical comparison of all 6 sources for building a lemma frequency dictionary

---

## Feature Matrix

| Feature | SBLGNT | MACULA Greek | MorphGNT SBLGNT | Core GNT Vocab | STEPBible Data | OpenGNT |
|---------|--------|-------------|-----------------|----------------|----------------|---------|
| **Text base** | SBLGNT | SBLGNT + Nestle1904 | SBLGNT | (via MorphGNT) | NA27/28 + TR + SBL + TH + Byz + WH + Treg | OGNT (≈ NA28) |
| **Has lemma?** | ❌ | ✅ `lemma` | ✅ `lemma` (col 7) | ✅ `lemma` | ✅ (in TAGNT) | ✅ `lexeme` |
| **Has morphology?** | ❌ | ✅ `morph` (Robinson) | ✅ `parsing` (Robinson) | ❌ | ✅ (in TAGNT) | ✅ `rmac` (Robinson) |
| **Has Strong?** | ❌ | ✅ `strong` | ❌ | ❌ | ✅ Extended Strong | ✅ `sn` (Extended) |
| **Has gloss?** | ❌ | ✅ `english`, `mandarin` | ❌ | ✅ Dodson | ✅ TBESG | ✅ TBESG + IT + LT + ST |
| **Ready-made frequency?** | ❌ | ❌ | ❌ | ✅ (50/80/90/95%) | ❌ | ❌ |
| **Has transliteration?** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ SBL + modern Greek |
| **Has semantic domain?** | ❌ | ✅ `domain`, `ln` | ❌ | ❌ | ❌ | ✅ Louw-Nida |
| **Multi-edition?** | ❌ | ✅ (2 editions) | ❌ | ❌ | ✅ (7+ editions) | ❌ |
| **License risk** | Low | Medium | **High** | Medium | **High** | **High** |
| **Recommended role** | Text baseline | ⭐ **Primary source** | Verification | Reference baseline | Gloss reference | Comparison/enrichment |
| **Priority for app** | Medium | **Highest** | High (verification) | Medium-High | Medium | Medium |

---

## Data Volume Comparison

| Source | Format | Rows/Words | Columns | File Size (selected/) |
|--------|--------|------------|---------|----------------------|
| SBLGNT | XML | 27 files (books) | — | ~1.5 MB |
| MACULA Greek | TSV | 137,741 | 26 | ~25 MB |
| MorphGNT | TXT | ~138,000 | 7 | ~9 MB |
| Core GNT Vocab | TSV/TXT | ~5,400 lemmas (95%) | 3–4 | ~0.6 MB |
| STEPBible (TAGNT) | TXT | ~138,000+ | 30+ | ~15 MB |
| OpenGNT | CSV | 138,014 | ~40 | ~17 MB zipped |

---

## Annotation Richness

### Poor annotation (text only):
- **SBLGNT** — Greek text in XML. No word-level annotation.

### Medium annotation (lemma + morphology):
- **MorphGNT** — 7 columns: bcv, pos, parsing, text, word, normalized, lemma. Clean, simple, but no Strong/gloss.

### Rich annotation (lemma + morphology + Strong + gloss + more):
- **MACULA Greek** — 26 columns. The sweet spot: has everything needed for a frequency dictionary in a single file.
- **STEPBible TAGNT** — 30+ columns, 7+ editions. Richest but complex format and license problems.
- **OpenGNT** — ~40 columns. Very rich but complex license heritage.

### Pre-computed frequencies:
- **Core GNT Vocab** — Ready-made. No computation needed, but no morphology/Strong.

---

## Text Base Differences

All sources cover the entire Greek New Testament, but the underlying text differs:

| Source | Text Base | Relationship |
|--------|-----------|-------------|
| SBLGNT | SBLGNT | Canonical SBL edition |
| MACULA SBLGNT | SBLGNT | Same text, more annotation |
| MACULA Nestle1904 | Nestle 1904 | Older critical text |
| MorphGNT | SBLGNT | Same text as SBLGNT |
| Core GNT Vocab | MorphGNT (SBLGNT) | Derived from MorphGNT frequencies |
| STEPBible TAGNT | NA27/28 + variants | Multiple editions compared |
| OpenGNT | OGNT (≈ NA28) | Closest free text to NA28 |

**Key insight:** MACULA SBLGNT, MorphGNT, and SBLGNT share the same base text. Core GNT Vocab is derived from MorphGNT. This means MACULA-derived frequencies should closely match MorphGNT and Core GNT Vocab frequencies.

---

## Recommended Strategy

### Phase 1: Build primary frequency dictionary from MACULA SBLGNT
1. Parse `macula-greek-SBLGNT.tsv`
2. Count lemma frequency, form frequency
3. Calculate cumulative coverage %
4. Extract gloss, Strong, morphology per lemma

### Phase 2: Cross-validate
1. Compare lemma frequencies with MorphGNT
2. Compare coverage thresholds with Core GNT Vocab
3. Spot-check top 100 lemmas across all 4 lemma-capable sources

### Phase 3: Enrich
1. Add transliterations from OpenGNT (if license clear for that column)
2. Consider TBESG glosses (if STEPBible license clarified)
3. Add Louw-Nida domains from MACULA or OpenGNT

### Phase 4: Build app JSON
1. Create `lemma → { frequency, rank, coveragePercent, POS, gloss, transliteration, strong }` JSON
2. Create separate form-frequency JSON for form-based slider
3. Define slider breakpoints at 50/80/90/95% (validated against Core GNT Vocab)

---

## Winner: MACULA Greek SBLGNT TSV

**Single best file for the entire frequency dictionary:**
```
selected/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv
```

This one file has:
- Lemma (`lemma` column)
- Surface form (`text` column)
- Normalized form (`normalized` column)
- Strong's number (`strong` column)
- Morphology code (`morph` column)
- English gloss (`english` column)
- Word class (`class` column)
- Semantic domain (`domain`, `ln` columns)

With CC BY 4.0 license (best available among the 6 sources).
