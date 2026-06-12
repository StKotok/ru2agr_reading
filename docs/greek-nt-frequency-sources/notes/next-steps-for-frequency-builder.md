# Next Steps — Building the Frequency Dictionary

**Date:** 2026-06-12
**Status:** Raw sources collected. Ready to build.

---

## Step 1: Choose Primary Source

**Decision:** Use `selected/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv`

**Why:**
- Richest single file: lemma, morphology, Strong, gloss, word class, semantic domain
- CC BY 4.0 (best license among all sources)
- 137,741 rows = complete SBLGNT (matches existing alignment data in `docs/clear-bible-alignments/SBLGNT.tsv`)
- Same text base as MorphGNT and Core GNT Vocab → cross-validation possible

## Step 2: Build Lemma Frequency

**Script location:** `scripts/build-frequency.mjs` (to be created)

**Algorithm:**
```
1. Parse TSV (TAB-separated, skip header row)
2. Extract `lemma` column for each row
3. Count occurrences: Map<lemma, count>
4. Sort by count descending
5. Calculate cumulative coverage:
   - Total words = sum of all counts
   - For each lemma (in frequency order): cumulative += count / total
6. Output: lemma → { frequency, rank, cumulativeCoverage }
```

**Expected quick-check values (from Core GNT Vocab):**
- Top lemma: `ὁ` (the) — ~19,769 occurrences (~14% of NT)
- Top 30 lemmas → ~50% coverage
- Top ~170 lemmas → ~80% coverage
- Top ~1,100 lemmas → ~95% coverage

## Step 3: Build Form Frequency

**Parallel task — same source file, different column:**
```
1. Extract `normalized` (or `text`) column
2. Count occurrences: Map<form, count>
3. Sort by count descending
4. Calculate cumulative coverage
```

Form frequency is useful for a form-based slider (instead of lemma-based). Forms are what the user actually sees in the text.

## Step 4: Enrich with Annotations

**From MACULA SBLGNT TSV (same file):**
- `strong` → Strong's number for each lemma
- `morph` → Robinson morphology code (e.g., N-NSF)
- `english` → English gloss
- `class` / `type` → word class (noun, verb, etc.)
- `domain` / `ln` → Louw-Nida semantic domain

**From other sources (license permitting):**
- TBESG glosses (STEPBible) — richer glosses than MACULA's `english`
- SBL transliterations (OpenGNT) — `transSBL` column
- Russian glosses? (None of these sources have them — may need separate enrichment)

## Step 5: Handle Function Words

**Separate flag for function words:**

Function words (articles, prepositions, conjunctions, particles) dominate the top of the frequency list but are not what users want to "learn" as vocabulary items. Options:

1. **Filter by POS:** Exclude words with `class` = `det` (determiner/article), `conj` (conjunction), `prep` (preposition), `part` (particle)
2. **Manual curation:** Flag top-100 lemmas as `isFunctionWord: true/false`
3. **User-toggle:** Allow user to include/exclude function words from the slider

**Recommendation:** Build with all words, add `isFunctionWord` boolean flag, let the UI decide.

## Step 6: Cross-Validate

**Compare against other sources:**

1. **MorphGNT**: Parse `*-morphgnt.txt` files, count lemmas, compare top-100 with MACULA
2. **Core GNT Vocab**: Compare cumulative coverage thresholds (50/80/90/95%) — should be very close
3. **OpenGNT**: Parse `OpenGNT_version3_3.csv`, extract `lexeme`, compare frequencies

**Acceptable variance:** <1% difference in top-100 lemma frequencies between MACULA and MorphGNT. If larger, investigate text base differences.

## Step 7: Define Slider Breakpoints

**Natural breakpoints from Core GNT Vocab:**
- ~30 lemmas → 50% coverage
- ~170 lemmas → 80% coverage
- ~500 lemmas → 90% coverage
- ~1,100 lemmas → 95% coverage

**UI slider positions (suggestion):**
| Position | Lemmas | Coverage | Label |
|----------|--------|----------|-------|
| 0% | 0 | 0% | No Greek |
| 25% | ~30 | ~50% | Top 30 words |
| 50% | ~170 | ~80% | Core vocabulary |
| 75% | ~500 | ~90% | Extended vocabulary |
| 100% | All | ~100% | Full NT vocabulary |

## Step 8: Output JSON Format

**Target format for the app (`data/frequency.json` or similar):**

```json
{
  "generatedAt": "2026-06-12T...",
  "source": "macula-greek SBLGNT",
  "sourceCommit": "453876a",
  "license": "CC BY 4.0",
  "totalWords": 137741,
  "totalLemmas": 5394,
  "lemmas": [
    {
      "lemma": "ὁ",
      "frequency": 19769,
      "rank": 1,
      "coveragePercent": 14.35,
      "cumulativeCoverage": 14.35,
      "pos": "determiner",
      "morph": "various",
      "strong": 3588,
      "gloss": "the",
      "transliteration": "ho",
      "isFunctionWord": true
    }
  ],
  "forms": [
    {
      "form": "καί",
      "frequency": 8973,
      "lemma": "καί",
      "rank": 1,
      "coveragePercent": 6.51
    }
  ],
  "sliderBreakpoints": {
    "50percent": { "lemmasNeeded": 30, "formsNeeded": 55 },
    "80percent": { "lemmasNeeded": 170, "formsNeeded": 1100 },
    "90percent": { "lemmasNeeded": 500, "formsNeeded": 3500 },
    "95percent": { "lemmasNeeded": 1100, "formsNeeded": 6600 }
  }
}
```

## Step 9: Build Script Template

```js
// scripts/build-frequency.mjs
import { readFileSync, writeFileSync } from 'fs';

const TSV = 'docs/greek-nt-frequency-sources/selected/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv';
const raw = readFileSync(TSV, 'utf-8');
const lines = raw.trim().split('\n');
const header = lines[0].split('\t');
const data = lines.slice(1).map(line => {
  const cols = line.split('\t');
  // ... parse into objects
});

// Count lemmas
const lemmaCounts = new Map();
for (const row of data) {
  const lemma = row.lemma;
  lemmaCounts.set(lemma, (lemmaCounts.get(lemma) || 0) + 1);
}

// Sort and calculate coverage
const sorted = [...lemmaCounts.entries()]
  .sort((a, b) => b[1] - a[1]);

const total = sorted.reduce((sum, [, c]) => sum + c, 0);
let cumulative = 0;
const result = sorted.map(([lemma, freq], i) => {
  cumulative += freq;
  return {
    lemma, frequency: freq,
    rank: i + 1,
    coveragePercent: (freq / total) * 100,
    cumulativeCoverage: (cumulative / total) * 100,
    // ... add gloss, strong, morph from the data
  };
});

writeFileSync('data/frequency.json', JSON.stringify({ generatedAt: new Date().toISOString(), ... }, null, 2));
```

## Step 10: Verification Checklist

After building the frequency dictionary, verify:

- [ ] Top lemma is `ὁ` with ~19,500–20,000 occurrences
- [ ] `καί` is #2 with ~8,900–9,000 occurrences  
- [ ] Top 30 lemmas achieve ~48–52% cumulative coverage
- [ ] Top 170 lemmas achieve ~78–82% cumulative coverage
- [ ] Total distinct lemma count is ~5,300–5,500
- [ ] Frequencies match MorphGNT within 1%
- [ ] Cumulative coverage matches Core GNT Vocab breakpoints
- [ ] All lemmas have at least `lemma`, `frequency`, `rank`, `coveragePercent` fields
- [ ] Output JSON is valid and parseable
- [ ] `npm test` passes (add a frequency data validator test)
- [ ] `npm run build` succeeds (if frequency data is loaded at build time)

---

**Next action:** Create `scripts/build-frequency.mjs` and run it. Do NOT modify production code in `src/` until the frequency JSON is validated.
