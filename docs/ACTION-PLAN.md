# Action Plan — Fixes & Improvements for v1.1 Release

**Дата:** 2026-06-25  
**Основание:** Senior Developer Review (SENIOR-REVIEW.md)  
**Цель:** Довести реализацию до production-ready состояния

---

## Priority Matrix

| Task | Priority | Blocks Release | Time Est. | Status |
|---|---|---|---|---|
| 1. Improve alignment coverage to ≥85% | 🔴 Critical | Yes | 5-7 days | **TODO** |
| 2. Test IndexedDB migration on real data | 🔴 Critical | Yes | 1 day | **TODO** |
| 3. Create manual-alignments.json | 🔴 Critical | Yes | 2-3 days | **TODO** |
| 4. Add topUnalignedLexemes to build-report | 🟡 High | No | 1 hour | **TODO** |
| 5. Unit tests for IndexedDB migration | 🟡 High | No | 1 day | **TODO** |
| 6. Improve cache-busting for manifest | 🟡 Medium | No | 2 hours | **TODO** |
| 7. Unit tests for pipeline scripts | 🟢 Nice-to-have | No | 2 days | **v1.2** |
| 8. localStorage fallback for notices | 🟢 Nice-to-have | No | 1 hour | **v1.2** |
| 9. Optimize lexicon/core.json size | 🟢 Nice-to-have | No | 3 hours | **v1.2** |

---

## Task 1: Improve Alignment Coverage to ≥85% 🔴

### Current State
- Coverage: 53.5% (threshold: 90%)
- Blocking: Yes
- Root cause: v1 algorithm limitations (no lemma-gloss pass, no permutation, no subset matching)

### Plan

#### Phase 1: Lemma-Gloss Pass (Priority #1, +15-20% coverage)

**What:** Use `englishGlosses` from `enriched/lexemes.json` as additional candidates.

**Where:** `scripts/build-align.mjs`, after bracket-optional pass, before phrase pass.

**Implementation:**
```js
// In alignVerse function, add lemmaGlossPass between bracket-optional and phrase

function lemmaGlossPass(unalignedTokens, bsbWords, lexemesIndex, claimedWords) {
  const pairs = [];
  
  for (const token of unalignedTokens) {
    const lexeme = lexemesIndex.get(token.lexemeId);
    if (!lexeme?.englishGlosses) continue;
    
    // Try each english gloss from lexeme
    for (const gloss of lexeme.englishGlosses) {
      const glossWords = tokenizeWords(gloss.toLowerCase());
      const normalized = glossWords.map(w => w.text.replace(/[[\]]/g, ''));
      
      // Try to find contiguous match in bsbWords
      const match = findContiguousMatch(normalized, bsbWords, claimedWords);
      if (match) {
        pairs.push({
          span: match.span,
          tokenId: token.id,
          lexemeId: token.lexemeId,
          q: 'a',
          method: 'lemma-gloss'
        });
        markClaimed(claimedWords, match.wordIndices);
        break; // one match per token
      }
    }
  }
  
  return pairs;
}
```

**Testing:**
- Run on Matthew only first: `node scripts/build-align.mjs matthew`
- Measure coverage delta
- Check build-report for new method stats

**Expected Result:** 68-73% coverage after lemma-gloss pass.

---

#### Phase 2: Subset Phrase Pass (Priority #2, +5-10% coverage)

**What:** Allow partial matches (gloss ⊂ BSB window).

**Where:** `scripts/build-align.mjs`, modify existing phrase pass or add subset-phrase pass.

**Implementation:**
```js
function subsetPhrasePass(unalignedTokens, bsbWords, claimedWords) {
  const pairs = [];
  
  for (const token of unalignedTokens) {
    const candidates = buildCandidates(token); // glossBerean, glossCherith
    
    for (const cand of candidates) {
      const candWords = tokenizeWords(cand.toLowerCase());
      const normalized = candWords.map(w => w.text.replace(/[[\]]/g, ''));
      
      // Try to find subset: all normalized words present in contiguous BSB window
      const match = findSubsetMatch(normalized, bsbWords, claimedWords);
      if (match && !isAmbiguous(match, unalignedTokens)) {
        pairs.push({
          span: match.span,
          tokenId: token.id,
          lexemeId: token.lexemeId,
          q: 'f', // fuzzy quality for subset matches
          method: 'subset-phrase'
        });
        markClaimed(claimedWords, match.wordIndices);
        break;
      }
    }
  }
  
  return pairs;
}

function findSubsetMatch(normalized, bsbWords, claimedWords) {
  // Find contiguous window in bsbWords where all normalized words appear
  // Window size: normalized.length to normalized.length + 3 (allow up to 3 extra words)
  // Return null if >1 match (ambiguous)
}
```

**Caution:** Subset matching increases ambiguity risk. Must check for multiple matches and skip if ambiguous.

**Expected Result:** 75-80% coverage after subset-phrase pass.

---

#### Phase 3: Permutation Pass (Priority #3, +3-5% coverage, optional)

**What:** Allow word order permutations for 2-3 word glosses.

**When:** Only if Phase 1+2 < 85%.

**Implementation:**
```js
function permutationPass(unalignedTokens, bsbWords, claimedWords) {
  // For glosses with 2-3 words, try all permutations
  // E.g., "to him" → try "to him", "him to"
  // Only for short glosses (≤3 words) to avoid combinatorial explosion
}
```

**Expected Result:** 78-85% coverage after permutation pass.

---

### Success Criteria
- [ ] Coverage ≥85% (target: 87-90%)
- [ ] `npm run verify:data` passes (warnings OK, no errors)
- [ ] Build-report shows method breakdown (exact/bracket/phrase/lemma-gloss/subset/permutation)
- [ ] No new overlapping spans (verify check #15b)
- [ ] Ambiguous candidates properly skipped (logged in build-report)

### Testing Plan
1. Run on Matthew only (fast iteration)
2. Measure coverage after each phase
3. Full 27-book run after satisfactory Matthew results
4. Compare per-book coverage (check for regression)

---

## Task 2: Test IndexedDB Migration on Real Data 🔴

### Current State
- Code: `migrateDictionaryData` implemented
- Tests: None
- Risk: Untested on real user data (merge logic, legacy key collisions)

### Plan

#### Step 1: Collect Real User Data Sample
- Get anonymous dump of IndexedDB `app_state` from 2-3 real users (if available)
- OR create realistic fixtures based on v1.0.x schema:
  ```js
  {
    dictionary: {
      'biblos': { status: 'known', addedAt: '2026-01-15', ... },
      'freq-3056': { status: 'learning', addedAt: '2026-02-20', ... },
      'logos': { status: 'known', addedAt: '2026-03-10', ... }
    },
    progress: {
      wordsToday: { date: '2026-06-25', added: ['biblos', 'freq-3056'] }
    }
  }
  ```

#### Step 2: Create Test Suite
**File:** `tests/dictionary-migration.test.js`

**Test Cases:**
1. **Basic migration:** legacy key → lexemeId
2. **Legacy key collision:** two legacy keys → one lexemeId (merge)
3. **Unknown legacy key:** no mapping → `_legacy: true`
4. **wordsToday migration:** legacy keys in added array
5. **Timestamp parsing:** date-string vs number vs invalid
6. **Idempotency:** run twice, second run no-op

```js
import { describe, it, expect } from 'vitest';
import { migrateDictionaryData, mergeDictionaryEntry } from '../src/state/dictionary.js';

describe('migrateDictionaryData', () => {
  const mockCore = [
    { lexemeId: 'grc-biblos-9adfa6', lexemeSlug: 'biblos', legacyKeys: ['biblos', 'freq-976'] },
    { lexemeId: 'grc-logos-123456', lexemeSlug: 'logos', legacyKeys: ['logos', 'freq-3056'] }
  ];
  
  it('migrates simple legacy key to lexemeId', () => {
    const dict = { 'biblos': { status: 'known', addedAt: '2026-01-15' } };
    const prog = { wordsToday: { date: '2026-06-25', added: [] } };
    
    const result = migrateDictionaryData(dict, prog, mockCore);
    
    expect(result.dictionary['grc-biblos-9adfa6']).toBeDefined();
    expect(result.dictionary['grc-biblos-9adfa6'].status).toBe('known');
    expect(result.dictionary['biblos']).toBeUndefined();
  });
  
  it('merges colliding legacy keys', () => {
    const dict = {
      'biblos': { status: 'known', addedAt: '2026-01-15' },
      'freq-976': { status: 'learning', addedAt: '2026-02-20' }
    };
    const prog = { wordsToday: { date: '2026-06-25', added: [] } };
    
    const result = migrateDictionaryData(dict, prog, mockCore);
    
    expect(result.dictionary['grc-biblos-9adfa6']).toBeDefined();
    expect(result.dictionary['grc-biblos-9adfa6'].status).toBe('known'); // stronger
    expect(result.dictionary['biblos']).toBeUndefined();
    expect(result.dictionary['freq-976']).toBeUndefined();
  });
  
  it('keeps unknown legacy keys with _legacy flag', () => {
    const dict = { 'unknown-key': { status: 'known', addedAt: '2026-01-15' } };
    const prog = { wordsToday: { date: '2026-06-25', added: [] } };
    
    const result = migrateDictionaryData(dict, prog, mockCore);
    
    expect(result.dictionary['unknown-key']).toBeDefined();
    expect(result.dictionary['unknown-key']._legacy).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });
});

describe('mergeDictionaryEntry', () => {
  it('chooses stronger status', () => {
    const entry1 = { status: 'learning', addedAt: '2026-01-15' };
    const entry2 = { status: 'known', addedAt: '2026-01-15' };
    
    const merged = mergeDictionaryEntry(entry1, entry2);
    
    expect(merged.status).toBe('known');
  });
  
  it('chooses fresher timestamp when different', () => {
    const entry1 = { status: 'learning', addedAt: '2026-01-15' };
    const entry2 = { status: 'known', addedAt: '2026-02-20' };
    
    const merged = mergeDictionaryEntry(entry1, entry2);
    
    expect(merged.status).toBe('known'); // fresher wins
  });
});
```

#### Step 3: Manual Smoke Test
1. Create test HTML page with IndexedDB dump
2. Load v1.1 app
3. Open DevTools → Application → IndexedDB → `ru2agr_db`
4. Verify:
   - Dictionary keys are lexemeId format
   - No data loss (word count same)
   - `_legacy` entries logged in `dictionary_migration_warnings`

### Success Criteria
- [ ] All test cases pass
- [ ] Manual smoke test on real data sample shows no data loss
- [ ] Migration warnings logged correctly

---

## Task 3: Create manual-alignments.json 🔴

### Current State
- Pipeline supports `manual-alignments.json` (IMPL-PIPELINE Task 4)
- File does not exist
- Purpose: Safety valve for release (manual overrides for high-frequency unaligned lemmas)

### Plan

#### Step 1: Add topUnalignedLexemes to build-report (Task 4)
See Task 4 below.

#### Step 2: Identify Top-20 Unaligned Lemmas
After running improved alignment (Task 1):
1. Check `build-report.json.topUnalignedLexemes`
2. Filter by `freqRank < 500` (high-frequency words)
3. Sort by `unalignedCount DESC`
4. Take top-20

#### Step 3: Create Manual Overrides
**File:** `docs/source-data/alignments/grc-eng/manual-alignments.json`

**Format:**
```json
{
  "schema": "manual-alignments-v1",
  "created": "2026-06-25",
  "comment": "Manual overrides for high-frequency unaligned lemmas",
  "items": [
    {
      "ref": "matthew 1:18",
      "tokenId": "n40001018004",
      "span": [42, 47],
      "method": "manual-override",
      "comment": "γάρ → 'birth' (inferential translation)"
    }
  ]
}
```

**Rules:**
- Only for tokens that **cannot** be algorithmically aligned (e.g., untranslated particles, inferential translations)
- Each entry must have `comment` explaining why manual override is needed
- Keep file small (<50 entries for v1.1)
- Validate spans in verify check #16

#### Step 4: Integrate into Pipeline
Already implemented in `scripts/build-align.mjs`:
```js
const manualPath = join(SOURCE_ROOT, 'alignments/grc-eng/manual-alignments.json');
const manual = existsSync(manualPath) ? readSourceJson('alignments/grc-eng/manual-alignments.json') : null;
```

### Success Criteria
- [ ] `manual-alignments.json` created with ≤50 entries
- [ ] All entries validated (refs exist, spans valid, tokens exist)
- [ ] Coverage improves by +1-2%
- [ ] Build-report shows `manualPairCount > 0`

---

## Task 4: Add topUnalignedLexemes to build-report 🟡

### Current State
- `build-report.json` has empty `topUnalignedLexemes: []`
- Needed for creating manual-alignments.json (Task 3)

### Plan

**Where:** `scripts/build-align.mjs`, in final report generation.

**Implementation:**
```js
// After processing all books, before writing build-report.json

const unalignedByLexeme = new Map(); // Map<lexemeId, {lexemeSlug, lemma, count, freqRank}>

for (const book of allBooks) {
  for (const verse of book.verses) {
    for (const token of verse.tokens) {
      if (token.fw) continue; // skip function words
      const aligned = verse.pairs.some(p => p.tokenId === token.id);
      if (!aligned) {
        const key = token.lexemeId;
        if (!unalignedByLexeme.has(key)) {
          unalignedByLexeme.set(key, {
            lexemeId: token.lexemeId,
            lexemeSlug: token.lexemeSlug,
            lemma: token.lemma,
            count: 0,
            freqRank: token.freqRank
          });
        }
        unalignedByLexeme.get(key).count++;
      }
    }
  }
}

const topUnalignedLexemes = Array.from(unalignedByLexeme.values())
  .filter(x => x.freqRank && x.freqRank < 1000) // only high-frequency
  .sort((a, b) => b.count - a.count)
  .slice(0, 100);

// Add to report
report.topUnalignedLexemes = topUnalignedLexemes;
```

### Success Criteria
- [ ] `build-report.json.topUnalignedLexemes` has ≥100 entries
- [ ] Sorted by unaligned count DESC
- [ ] Only includes high-frequency lemmas (freqRank < 1000)

---

## Task 5: Unit Tests for IndexedDB Migration 🟡

Already covered in Task 2.

---

## Task 6: Improve Cache-Busting for Manifest 🟡

### Current State
- `bible-loader.js` loads manifest with `cache: 'no-cache'`
- Risk: if old SW returns cached manifest, version won't update

### Plan

#### Option A: Build Timestamp in URL (Simple)
**Where:** `src/data/bible-loader.js`

```js
const BUILD_TIMESTAMP = '20260625'; // from vite.config.js or env

async function loadManifest() {
  const url = `data/data-manifest.json?t=${BUILD_TIMESTAMP}`;
  const manifest = await fetch(url, { cache: 'no-cache' }).then(r => r.json());
  return manifest;
}
```

**Build:** Inject `BUILD_TIMESTAMP` via vite's `define`:
```js
// vite.config.js
export default {
  define: {
    '__BUILD_TIMESTAMP__': JSON.stringify(Date.now().toString())
  }
}
```

#### Option B: Retry with cache: 'reload' on Mismatch (Defensive)
**Where:** `src/data/bible-loader.js`

```js
async function loadBook(type, bookId, manifest) {
  const url = `data/bibles/${type}/${bookId}.json?v=${manifest.version}`;
  let book = await fetch(url).then(r => r.json());
  
  // Check version match
  if (type === 'grc' && book.sourceDataVersion !== manifest.sourceDataVersion) {
    console.warn('[loader] version mismatch, retrying with cache reload');
    book = await fetch(url, { cache: 'reload' }).then(r => r.json());
  }
  
  return book;
}
```

### Recommendation
Use **both** (defense in depth):
- Option A for manifest
- Option B as fallback for books

### Success Criteria
- [ ] Manifest URL includes build timestamp
- [ ] Version mismatch triggers cache reload
- [ ] Test: old SW + new data → version updates correctly

---

## Task 7-9: Nice-to-Have (v1.2)

Deferred to v1.2 (not blocking release).

---

## Release Checklist

### Before Deploying v1.1

- [ ] **Task 1 complete:** Alignment coverage ≥85%
- [ ] **Task 2 complete:** IndexedDB migration tested on real data
- [ ] **Task 3 complete:** manual-alignments.json created
- [ ] **Task 4 complete:** topUnalignedLexemes in build-report
- [ ] **npm test:** 212 passed
- [ ] **npm run build:** OK
- [ ] **npm run verify:data:** 0 errors
- [ ] **Smoke test on Netlify preview:**
  - New user: onboarding + BSB data notice → reading works
  - Existing user (simulate migration): dictionary preserved, no data loss
  - Alignment: click Greek words → card opens, mark as known → highlights
  - PWA: install → offline → works
- [ ] **Performance check:** Time to Interactive <3s on 3G
- [ ] **Cross-browser:** Chrome, Firefox, Safari (mobile + desktop)

### Deploy Command

```bash
# After all checks pass
git checkout main
git merge dev2
git tag v1.1.0
npm run build:data  # final generation
npm run verify:data # must be 0 errors, <15 warnings
npm run build       # production build
netlify deploy --prod --dir=dist
git push origin main --tags
```

---

## Timeline

| Week | Tasks | Deliverable |
|---|---|---|
| Week 1 | Task 1 Phase 1-2 + Task 4 | Coverage 75-80%, topUnalignedLexemes |
| Week 2 | Task 1 Phase 3 + Task 3 | Coverage ≥85%, manual-alignments.json |
| Week 3 | Task 2 + Task 6 | IndexedDB tests, improved cache-busting |
| Week 4 | Smoke tests + Deploy | v1.1 in production |

**Total:** 3-4 weeks to production-ready v1.1.
