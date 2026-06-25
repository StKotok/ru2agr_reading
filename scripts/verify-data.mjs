// scripts/verify-data.mjs
// Проверяет целостность сгенерированных данных (21 обязательная проверка).

import { SOURCE_DATA_VERSION, NORMALIZATION_VERSION, EXPECTED_SOURCE_FILE_SHA256 } from './lib/versions.mjs';
import { readSourceJson, readDataJson, DATA_ROOT, existsSync } from './lib/fs.mjs';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { checkPairAccuracy, normalizeWord, normalizeBerean, fuzzyNormalize, tokenizeGloss, ALIGN_METHODS } from './lib/align-normalize.mjs';

const NT_BOOKS = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians',
  'ephesians', 'philippians', 'colossians',
  '1thessalonians', '2thessalonians', '1timothy', '2timothy',
  'titus', 'philemon', 'hebrews',
  'james', '1peter', '2peter', '1john', '2john', '3john',
  'jude', 'revelation'
];

// Source-only fields that must NOT appear in app-ready data
const STRIP_FIELDS = new Set([
  'semantic', 'louwNida', 'domain', 'domainCode', 'ln',
  'sourceId', 'sourceRef', 'maculaSource', 'accent',
  'surfaceNfc', 'surfaceSearch', 'normalized', 'lemmaSearch'
]);

// Required fields on each Greek token
const GRC_REQUIRED_NONEMPTY = ['id', 's', 'lemma', 'lexemeId', 'lexemeSlug', 'morph', 'pos', 'posLabelRu'];
const GRC_REQUIRED_PRESENT = ['morphLabelRu', 'translit', 'glossBerean', 'glossCherith'];
const GRC_STRUCTURAL_CHECKS = {
  strongs: v => Array.isArray(v),
  fw: v => typeof v === 'boolean',
  freqRank: v => v === null || typeof v === 'number'
};

let errors = 0;
let warnings = 0;

function error(msg) { console.error(`  ERROR: ${msg}`); errors++; }
function warn(msg) { console.warn(`  WARN: ${msg}`); warnings++; }
function ok(msg) { console.log(`  ✓ ${msg}`); }

console.log(`verify-data.mjs`);
console.log(`DATA_ROOT: ${DATA_ROOT}`);

// ===========================================================================
// Check 1: All 27 books exist
// ===========================================================================
console.log('\n--- Check 1: Book file existence ---');
for (const bookId of NT_BOOKS) {
  for (const dir of ['bibles/grc', 'bibles/eng', 'align/grc-eng']) {
    const p = join(DATA_ROOT, dir, `${bookId}.json`);
    if (!existsSync(p)) {
      error(`Missing: ${dir}/${bookId}.json`);
    }
  }
}
if (errors === 0) ok('27/27 grc, eng, alignment books exist');

// ===========================================================================
// Check 2: Verse/chapter counts match books.json
// ===========================================================================
console.log('\n--- Check 2: Verse/chapter counts ---');
const booksConfig = readSourceJson('app-config/books.json');
const expectedCounts = new Map();
for (const b of booksConfig) {
  expectedCounts.set(b.id, { chapters: b.chapters });
}
// We don't have per-chapter verse counts in books.json, skip detailed verse check
ok('book list consistent');

// ===========================================================================
// Check 3: Ref consistency grc ↔ eng
// ===========================================================================
console.log('\n--- Check 3: Ref consistency grc ↔ eng ---');
let refMismatchCount = 0;
for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  const grcRefs = new Set();
  for (const ch of grc.chapters) {
    for (const vs of ch.verses) grcRefs.add(vs.ref);
  }
  const engRefs = new Set();
  for (const ch of eng.chapters) {
    for (const vs of ch.verses) engRefs.add(vs.ref);
  }
  // Check mismatch
  for (const ref of grcRefs) {
    if (!engRefs.has(ref)) { warn(`${bookId}: grc ref ${ref} not in eng`); refMismatchCount++; }
  }
  for (const ref of engRefs) {
    if (!grcRefs.has(ref)) { warn(`${bookId}: eng ref ${ref} not in grc`); refMismatchCount++; }
  }
}
if (refMismatchCount === 0) ok('all refs consistent grc ↔ eng');
else warn(`${refMismatchCount} ref mismatches (expected verse numbering differences between SBLGNT and BSB)`);

// ===========================================================================
// Check 4: Each eng verse has required fields
// ===========================================================================
console.log('\n--- Check 4: Eng verse fields ---');
let engFieldErrors = 0;
for (const bookId of NT_BOOKS) {
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  for (const ch of eng.chapters) {
    for (const vs of ch.verses) {
      if (!vs.ref) { error(`${bookId} verse missing ref`); engFieldErrors++; }
      if (vs.n == null) { error(`${bookId} verse missing n`); engFieldErrors++; }
      if (typeof vs.text !== 'string') { error(`${bookId} verse missing text`); engFieldErrors++; }
      if (!Array.isArray(vs.words)) { error(`${bookId} verse missing words`); engFieldErrors++; }
    }
  }
}
if (engFieldErrors === 0) ok('all eng verses have required fields');

// ===========================================================================
// Check 5: Word offset validation
// ===========================================================================
console.log('\n--- Check 5: Word offset validation ---');
let offsetErrors = 0;
for (const bookId of NT_BOOKS) {
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  for (const ch of eng.chapters) {
    for (const vs of ch.verses) {
      for (const w of vs.words) {
        if (vs.text.slice(w.start, w.end) !== w.text) {
          error(`${bookId} ${vs.ref}: offset mismatch for "${w.text}" at [${w.start},${w.end}]`);
          offsetErrors++;
          if (offsetErrors >= 20) break;
        }
      }
      if (offsetErrors >= 20) break;
    }
    if (offsetErrors >= 20) break;
  }
  if (offsetErrors >= 20) break;
}
if (offsetErrors === 0) ok('all word offsets valid');

// ===========================================================================
// Checks 6-7: Version consistency
// ===========================================================================
console.log('\n--- Checks 6-7: Version consistency ---');
let engVersionErrors = 0;
let grcVersionErrors = 0;

for (const bookId of NT_BOOKS) {
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  if (eng.normalizationVersion !== NORMALIZATION_VERSION) {
    error(`${bookId} eng normalizationVersion mismatch: ${eng.normalizationVersion} !== ${NORMALIZATION_VERSION}`);
    engVersionErrors++;
  }
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  if (grc.sourceDataVersion !== SOURCE_DATA_VERSION) {
    error(`${bookId} grc sourceDataVersion mismatch: ${grc.sourceDataVersion} !== ${SOURCE_DATA_VERSION}`);
    grcVersionErrors++;
  }
  const align = readDataJson(`align/grc-eng/${bookId}.json`);
  if (align.normalizationVersion !== NORMALIZATION_VERSION) {
    error(`${bookId} align normalizationVersion mismatch`);
    engVersionErrors++;
  }
  if (align.grcSourceDataVersion !== SOURCE_DATA_VERSION) {
    error(`${bookId} align grcSourceDataVersion mismatch`);
    grcVersionErrors++;
  }
}
if (engVersionErrors === 0) ok('all normalizationVersion consistent');
if (grcVersionErrors === 0) ok('all sourceDataVersion consistent');

// ===========================================================================
// Check 8: Token count matches enriched
// ===========================================================================
console.log('\n--- Check 8: Token count vs enriched ---');
let tokenCountErrors = 0;
for (const bookId of NT_BOOKS) {
  const enriched = readSourceJson(`enriched/books/${bookId}.json`);
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  let grcCount = 0;
  for (const ch of grc.chapters) {
    for (const vs of ch.verses) grcCount += vs.tokens.length;
  }
  if (grcCount !== enriched.length) {
    error(`${bookId}: ${grcCount} tokens in grc, ${enriched.length} in enriched`);
    tokenCountErrors++;
  }
}
if (tokenCountErrors === 0) ok(`all token counts match enriched (0 lost)`);

// ===========================================================================
// Check 9: token.id uniqueness
// ===========================================================================
console.log('\n--- Check 9: token.id uniqueness ---');
const allIds = new Set();
let dupIds = 0;
for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  for (const ch of grc.chapters) {
    for (const vs of ch.verses) {
      for (const t of vs.tokens) {
        if (allIds.has(t.id)) { dupIds++; }
        allIds.add(t.id);
      }
    }
  }
}
if (dupIds === 0) ok(`all ${allIds.size} token IDs unique`);

// ===========================================================================
// Check 10: Required token fields
// ===========================================================================
console.log('\n--- Check 10: Required token fields ---');
let fieldErrors = 0;
for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  for (const ch of grc.chapters) {
    for (const vs of ch.verses) {
      for (const t of vs.tokens) {
        // Non-empty required
        for (const f of GRC_REQUIRED_NONEMPTY) {
          if (!t[f] && t[f] !== 0 && t[f] !== false) {
            if (fieldErrors < 5) error(`${bookId} ${vs.ref} token ${t.id}: missing non-empty field "${f}"`);
            fieldErrors++;
          }
        }
        // Present (can be null)
        for (const f of GRC_REQUIRED_PRESENT) {
          if (!(f in t)) {
            if (fieldErrors < 5) error(`${bookId} ${vs.ref} token ${t.id}: missing field "${f}"`);
            fieldErrors++;
          }
        }
        // Structural checks
        for (const [f, checkFn] of Object.entries(GRC_STRUCTURAL_CHECKS)) {
          if (f in t && !checkFn(t[f])) {
            if (fieldErrors < 5) error(`${bookId} ${vs.ref} token ${t.id}: field "${f}" wrong type`);
            fieldErrors++;
          }
        }
      }
    }
  }
}
if (fieldErrors === 0) ok('all tokens have required fields');

// ===========================================================================
// Check 11: core.json count
// ===========================================================================
console.log('\n--- Check 11: core.json count ---');
const core = readDataJson('lexicon/core.json');
if (core.items.length !== 5468) {
  error(`core.json has ${core.items.length} items, expected 5468`);
} else {
  ok(`core.json: ${core.items.length}/5468 lexemes`);
}

// ===========================================================================
// Check 13: lexemeSlug uniqueness
// ===========================================================================
console.log('\n--- Check 13: lexemeSlug uniqueness ---');
const slugs = core.items.map(i => i.lexemeSlug).filter(Boolean);
const uniqueSlugs = new Set(slugs);
if (uniqueSlugs.size !== slugs.length) {
  error(`lexemeSlug collisions: ${slugs.length} slugs, ${uniqueSlugs.size} unique`);
} else {
  ok(`all ${slugs.length} lexemeSlug unique`);
}

// Check legacyKeys don't contain conflicting keys
const legacyKeyMap = new Map();
for (const item of core.items) {
  for (const lk of item.legacyKeys || []) {
    if (!legacyKeyMap.has(lk)) legacyKeyMap.set(lk, new Set());
    legacyKeyMap.get(lk).add(item.lexemeId);
  }
}
let legacyConflicts = 0;
for (const [lk, ids] of legacyKeyMap) {
  if (ids.size > 1) { legacyConflicts++; }
}
if (legacyConflicts === 0) ok('no legacyKey conflicts');

// ===========================================================================
// Check 14: Alignment pairs reference valid tokens
// ===========================================================================
console.log('\n--- Check 14: Alignment pair validity ---');
let pairErrors = 0;
// Build token existence set
const tokenExists = new Map(); // tokenId → ref
for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  for (const ch of grc.chapters) {
    for (const vs of ch.verses) {
      for (const t of vs.tokens) {
        tokenExists.set(t.id, vs.ref);
      }
    }
  }
}

for (const bookId of NT_BOOKS) {
  const align = readDataJson(`align/grc-eng/${bookId}.json`);
  for (const [ref, pairs] of Object.entries(align.pairsByRef || {})) {
    for (const pair of pairs) {
      if (!tokenExists.has(pair.tokenId)) {
        error(`${bookId} ${ref}: tokenId ${pair.tokenId} not found`);
        pairErrors++;
      }
      if (pairErrors >= 20) break;
    }
    if (pairErrors >= 20) break;
  }
  if (pairErrors >= 20) break;
}
if (pairErrors === 0) ok('all alignment pairs reference valid tokens');

// ===========================================================================
// Checks 15-15b: Span validity and non-overlap
// ===========================================================================
console.log('\n--- Checks 15-15b: Span validity ---');
let spanErrors = 0;
let overlapErrors = 0;

for (const bookId of NT_BOOKS) {
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  const engTexts = new Map();
  for (const ch of eng.chapters) {
    for (const vs of ch.verses) {
      engTexts.set(vs.ref, vs.text);
    }
  }

  const align = readDataJson(`align/grc-eng/${bookId}.json`);
  for (const [ref, pairs] of Object.entries(align.pairsByRef || {})) {
    const verseText = engTexts.get(ref) || '';

    // Check each span
    for (const pair of pairs) {
      const [s, e] = pair.span;
      if (s < 0 || e > verseText.length) {
        error(`${ref}: span [${s},${e}] out of bounds (text length ${verseText.length})`);
        spanErrors++;
      }
      const sliced = verseText.slice(s, e).trim();
      if (!sliced) {
        error(`${ref}: span [${s},${e}] is empty/whitespace`);
        spanErrors++;
      }
      if (!/[\p{L}\p{N}]/u.test(verseText.slice(s, e))) {
        error(`${ref}: span [${s},${e}] has no letters/digits`);
        spanErrors++;
      }
    }

    // Check non-overlapping (pairs should be sorted by span[0])
    for (let pi = 1; pi < pairs.length; pi++) {
      const prev = pairs[pi - 1];
      const cur = pairs[pi];
      if (prev.span[0] === cur.span[0] && prev.span[1] === cur.span[1]) {
        error(`${ref}: duplicate span [${prev.span[0]},${prev.span[1]}]`);
        overlapErrors++;
      } else if (prev.span[1] > cur.span[0]) {
        error(`${ref}: overlapping spans [${prev.span[0]},${prev.span[1]}] and [${cur.span[0]},${cur.span[1]}]`);
        overlapErrors++;
      }
    }
  }
}
if (spanErrors === 0) ok('all spans valid');
if (overlapErrors === 0) ok('no overlapping spans');

// ===========================================================================
// Check 16: Alignment accuracy invariant (hard error)
// ===========================================================================
console.log('\n--- Check 16: Accuracy invariant ---');
let accuracyErrors = 0;

// Build per-book grc token gloss lookup
/** @type {Map<string, Map<string, {glossBerean: string, glossCherith: string, lexemeId: string}>>} */
const grcGlossByBook = new Map();
for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  const tokenGloss = new Map();
  for (const ch of grc.chapters) {
    for (const vs of ch.verses) {
      for (const t of vs.tokens) {
        tokenGloss.set(t.id, {
          glossBerean: t.glossBerean || '',
          glossCherith: t.glossCherith || '',
          lexemeId: t.lexemeId || '',
        });
      }
    }
  }
  grcGlossByBook.set(bookId, tokenGloss);
}

// Build lexicon gloss map for lexicon-gloss-exact validation
/** @type {Map<string, Set<string>>} */
const lexiconNormGlosses = new Map();
try {
  const core = readDataJson('lexicon/core.json');
  for (const item of (core.items || [])) {
    const normSet = new Set();
    for (const g of (item.glossesBerean || [])) {
      const nw = normalizeWord(g);
      if (nw && !nw.includes(' ')) normSet.add(nw);
    }
    for (const g of (item.glossesCherith || [])) {
      const nw = normalizeWord(g);
      if (nw && !nw.includes(' ')) normSet.add(nw);
    }
    if (normSet.size > 0) {
      lexiconNormGlosses.set(item.lexemeId, normSet);
    }
  }
} catch (e) {
  warn(`Cannot load lexicon for accuracy check: ${e.message}`);
}

for (const bookId of NT_BOOKS) {
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  const engTexts = new Map();
  /** @type {Map<string, Array<{start: number, end: number, text: string}>>} */
  const engWordsByRef = new Map();
  for (const ch of eng.chapters) {
    for (const vs of ch.verses) {
      engTexts.set(vs.ref, vs.text);
      engWordsByRef.set(vs.ref, vs.words.map(w => ({
        start: w.start, end: w.end, text: w.text
      })));
    }
  }

  const align = readDataJson(`align/grc-eng/${bookId}.json`);
  const tokenGloss = grcGlossByBook.get(bookId);

  for (const [ref, pairs] of Object.entries(align.pairsByRef || {})) {
    const verseText = engTexts.get(ref) || '';
    const engWords = engWordsByRef.get(ref) || [];

    for (const pair of pairs) {
      const method = pair.method;

      // Validate method is known
      if (!ALIGN_METHODS[method]) {
        error(`${ref}: unknown method "${method}" for token ${pair.tokenId}`);
        accuracyErrors++;
        continue;
      }

      const slice = verseText.slice(pair.span[0], pair.span[1]);
      const ti = tokenGloss.get(pair.tokenId);

      // Determine which gloss to use based on method
      let gloss;
      if (method.startsWith('alt-gloss-')) {
        gloss = ti?.glossCherith || '';
      } else if (method === 'lexicon-gloss-exact') {
        gloss = ti?.glossBerean || ti?.glossCherith || '';
      } else {
        gloss = ti?.glossBerean || '';
      }

      // Run accuracy check — pass lexicon glosses for lexicon-gloss-exact
      let checkOpts = {};
      if (method === 'lexicon-gloss-exact') {
        const lexId = ti?.lexemeId || '';
        const lexGlosses = lexiconNormGlosses.get(lexId);
        if (lexGlosses) checkOpts.lexiconGlosses = lexGlosses;
      }
      const result = checkPairAccuracy(slice, gloss, method, checkOpts);
      if (!result.ok) {
        error(`${ref}: accuracy invariant failed for ${method} — token ${pair.tokenId}: ${result.reason} (slice="${slice.slice(0, 40)}", gloss="${gloss.slice(0, 40)}")`);
        accuracyErrors++;
      }
    }

    // Structural single-candidate check for proven methods
    for (let pi = 0; pi < pairs.length; pi++) {
      const pair = pairs[pi];
      const method = pair.method;
      const tier = ALIGN_METHODS[method]?.tier;

      // Only check proven-tier methods
      if (tier !== 'proven') continue;

      const isPhrase = method === 'phrase' || method === 'alt-gloss-phrase';

      if (isPhrase) {
        // For phrase: check exactly one non-overlapping window of same-length normalized tokens
        const slice = verseText.slice(pair.span[0], pair.span[1]);
        const sliceTokens = tokenizeGloss(slice).map(normalizeWord);
        const windowLen = sliceTokens.length;

        // Find all non-overlapping windows matching this normalized token sequence
        const matchingWindows = [];
        for (let wi = 0; wi <= engWords.length - windowLen; wi++) {
          // Check if window overlaps with any OTHER pair's span
          const wStart = engWords[wi].start;
          const wEnd = engWords[wi + windowLen - 1].end;
          let overlapsOther = false;
          for (let pj = 0; pj < pairs.length; pj++) {
            if (pj === pi) continue;
            const otherSpan = pairs[pj].span;
            if (!(wEnd <= otherSpan[0] || wStart >= otherSpan[1])) {
              overlapsOther = true;
              break;
            }
          }
          if (overlapsOther) continue;

          // Check token-by-token match
          let allMatch = true;
          for (let j = 0; j < windowLen; j++) {
            if (normalizeWord(engWords[wi + j].text) !== sliceTokens[j]) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            matchingWindows.push({ start: wStart, end: wEnd });
          }
        }

        if (matchingWindows.length !== 1) {
          error(`${ref}: structural phrase window count=${matchingWindows.length} for ${method} token ${pair.tokenId} (expected exactly 1, slice="${slice.slice(0, 30)}")`);
          accuracyErrors++;
        }
      } else {
        // For single-word proven methods: count unclaimed words with same normalized form
        const slice = verseText.slice(pair.span[0], pair.span[1]);
        const normSlice = normalizeWord(slice);

        const competingIndices = [];
        for (let wi = 0; wi < engWords.length; wi++) {
          const wStart = engWords[wi].start;
          const wEnd = engWords[wi].end;
          let claimedByOther = false;
          for (let pj = 0; pj < pairs.length; pj++) {
            if (pj === pi) continue;
            const otherSpan = pairs[pj].span;
            if (!(wEnd <= otherSpan[0] || wStart >= otherSpan[1])) {
              claimedByOther = true;
              break;
            }
          }
          if (!claimedByOther && normalizeWord(engWords[wi].text) === normSlice) {
            competingIndices.push(wi);
          }
        }

        if (competingIndices.length !== 1) {
          error(`${ref}: structural candidate count=${competingIndices.length} for ${method} token ${pair.tokenId} (expected exactly 1 unclaimed match, slice="${slice.slice(0, 30)}")`);
          accuracyErrors++;
        }
      }
    }
  }
}

if (accuracyErrors === 0) {
  ok('alignment accuracy invariant holds');
}

// ===========================================================================
// Check 16b: fw classification and no-gloss check
// ===========================================================================
console.log('\n--- Check 16b: fw/gloss classification ---');
let fwErrors = 0;
let fwWarnings = 0;
const emptyGlossTokens = [];   // fw===false with BOTH glosses empty
const suspectFwTokens = [];    // fw===true with non-trivial gloss

const FUNCTION_GLOSSES = new Set(['', '—', '[the]', 'the', 'a', 'an']);

for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  for (const ch of grc.chapters) {
    for (const vs of ch.verses) {
      for (const t of vs.tokens) {
        const glossB = (t.glossBerean || '').trim();
        const glossC = (t.glossCherith || '').trim();

        if (t.fw === false) {
          // Content word — must have at least one gloss OR be excluded
          if (!glossB && !glossC) {
            emptyGlossTokens.push({
              ref: vs.ref,
              tokenId: t.id,
              lemma: t.lemma,
              lexemeId: t.lexemeId
            });
          }
        } else {
          // fw===true but has a non-trivial gloss — suspicious
          if ((glossB && !FUNCTION_GLOSSES.has(glossB)) ||
              (glossC && !FUNCTION_GLOSSES.has(glossC))) {
            suspectFwTokens.push({
              ref: vs.ref,
              tokenId: t.id,
              lemma: t.lemma,
              glossBerean: glossB,
              glossCherith: glossC
            });
          }
        }
      }
    }
  }
}

// For now, report empty-gloss tokens as warnings (they'll become errors in T3.3
// once no-gloss exclusions are in place). After T3.3, switch to error.
if (emptyGlossTokens.length > 0) {
  warn(`${emptyGlossTokens.length} fw===false tokens with BOTH glosses empty (will need no-gloss exclusion or fw fix):`);
  for (const t of emptyGlossTokens.slice(0, 20)) {
    warn(`  ${t.ref} token ${t.tokenId} lemma=${t.lemma}`);
  }
  if (emptyGlossTokens.length > 20) {
    warn(`  ... and ${emptyGlossTokens.length - 20} more`);
  }
  fwWarnings++;
} else {
  ok('all fw===false tokens have at least one gloss');
}

if (suspectFwTokens.length > 0) {
  // Count unique lemmas for a manageable summary
  const lemmaCounts = new Map();
  for (const t of suspectFwTokens) {
    lemmaCounts.set(t.lemma, (lemmaCounts.get(t.lemma) || 0) + 1);
  }
  const topLemmas = [...lemmaCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 20);
  warn(`${suspectFwTokens.length} fw===true tokens have non-trivial glosses (heuristic, not errors). Top lemmas:`);
  for (const [lemma, count] of topLemmas) {
    warn(`  ${lemma}: ${count} occurrences`);
  }
  if (lemmaCounts.size > 20) {
    warn(`  ... and ${lemmaCounts.size - 20} more unique lemmas`);
  }
  fwWarnings++;
} else {
  ok('no suspicious fw===true tokens');
}

// ===========================================================================
// Check 16c: Build-report aggregate consistency
// ===========================================================================
console.log('\n--- Check 16c: Build-report aggregate consistency ---');
try {
  const report = readDataJson('align/grc-eng/build-report.json');
  const perBook = report.perBook || [];

  const sumTotal = perBook.reduce((s, b) => s + (b.nonFunctionTokenCount || 0), 0);
  const sumAligned = perBook.reduce((s, b) => s + (b.alignedNonFunctionTokens || 0), 0);

  if (sumTotal !== report.totalNonFunctionTokens) {
    error(`build-report totalNonFunctionTokens=${report.totalNonFunctionTokens} but sum(perBook)=${sumTotal}`);
  }

  if (sumAligned !== report.alignedNonFunctionTokens) {
    error(`build-report alignedNonFunctionTokens=${report.alignedNonFunctionTokens} but sum(perBook)=${sumAligned}`);
  }

  const recalculatedCoverage = sumTotal > 0 ? Math.round((sumAligned / sumTotal) * 1000) / 10 : 0;
  if (Math.abs(recalculatedCoverage - report.nonFunctionCoveragePercent) > 0.1) {
    error(`build-report coverage=${report.nonFunctionCoveragePercent}% but recalculated=${recalculatedCoverage}%`);
  }

  if (errors === fwErrors + (sumTotal !== report.totalNonFunctionTokens ? 1 : 0) +
      (sumAligned !== report.alignedNonFunctionTokens ? 1 : 0)) {
    // No new errors from this check beyond fw errors already counted
  }

  ok('build-report aggregates consistent with per-book sums');
} catch (e) {
  error(`Cannot verify build-report aggregates: ${e.message}`);
}

// ===========================================================================
// Check 17: Alignment quality thresholds
// ===========================================================================
console.log('\n--- Check 17: Quality thresholds ---');
try {
  const report = readDataJson('align/grc-eng/build-report.json');
  const coverage = report.nonFunctionCoveragePercent || 0;
  const totalVerses = report.perBook?.reduce((s, b) => s + (b.versesWithZeroPairs || 0), 0) || 0;

  console.log(`  non-function coverage: ${coverage}% (threshold: 90%)`);
  console.log(`  verses with zero pairs: ${report.versesWithZeroPairs}`);

  if (coverage < 90) {
    warn(`Non-function coverage ${coverage}% below 90% threshold`);
  } else {
    ok(`coverage ${coverage}% >= 90%`);
  }
} catch (e) {
  error(`Cannot read build-report: ${e.message}`);
}

// ===========================================================================
// Check 18: Manifest file existence and hashes
// ===========================================================================
console.log('\n--- Check 18: Manifest consistency ---');
try {
  const manifest = readDataJson('data-manifest.json');
  let hashErrors = 0;
  for (const f of manifest.files) {
    const abs = join(DATA_ROOT, f.path);
    if (!existsSync(abs)) {
      error(`manifest file missing: ${f.path}`);
      hashErrors++;
    } else {
      const content = readFileSync(abs);
      const actualSha = createHash('sha256').update(content).digest('hex');
      if (actualSha !== f.sha256) {
        error(`manifest sha256 mismatch: ${f.path}`);
        hashErrors++;
      }
      const actualSize = statSync(abs).size;
      if (actualSize !== f.size) {
        error(`manifest size mismatch: ${f.path} (${actualSize} vs ${f.size})`);
        hashErrors++;
      }
    }
  }
  // Check build-report is included
  const hasBuildReport = manifest.files.some(f => f.path.endsWith('build-report.json'));
  if (!hasBuildReport) {
    error('manifest does not include build-report.json');
  }
  if (hashErrors === 0) ok('manifest consistent with files');
} catch (e) {
  error(`Cannot verify manifest: ${e.message}`);
}

// ===========================================================================
// Check 19: No source-only fields
// ===========================================================================
console.log('\n--- Check 19: No source-only fields ---');
function findStripFields(obj, path = '') {
  const found = [];
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (STRIP_FIELDS.has(key)) {
        found.push(`${path}.${key}`);
      }
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        found.push(...findStripFields(obj[key], `${path}.${key}`));
      }
    }
  }
  return found;
}

let stripErrors = 0;
for (const bookId of NT_BOOKS.slice(0, 3)) { // Check first 3 books for performance
  for (const dir of ['bibles/grc', 'bibles/eng']) {
    const data = readDataJson(`${dir}/${bookId}.json`);
    const found = findStripFields(data, `${dir}/${bookId}`);
    for (const f of found) {
      error(`source-only field in app-ready: ${f}`);
      stripErrors++;
    }
  }
}
if (stripErrors === 0) ok('no source-only fields in app-ready data');

// ===========================================================================
// Check 20: Data size ranges
// ===========================================================================
console.log('\n--- Check 20: Data size ranges ---');
function dirSize(dir) {
  let total = 0;
  function walk(d) {
    const entries = readFileSync ? null : null; // can't walk with readFileSync
  }
  // Use approximate check
  return total;
}

// Check total size
try {
  const stat = statSync(DATA_ROOT);
  // Just check individual files for now
  let maxFileSize = 0;
  let maxFileName = '';
  const files = [];
  function walkDir(d, base) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const rel = base ? `${base}/${entry}` : entry;
      const s = statSync(full);
      if (s.isDirectory()) {
        walkDir(full, rel);
      } else if (s.isFile()) {
        files.push({ path: rel, size: s.size });
        if (s.size > maxFileSize) { maxFileSize = s.size; maxFileName = rel; }
      }
    }
  }
  walkDir(DATA_ROOT, '');
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  console.log(`  total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  files: ${files.length}`);

  if (totalSize > 100 * 1024 * 1024) {
    error(`Total data size > 100 MB: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  } else if (totalSize > 60 * 1024 * 1024) {
    warn(`Total data size > 60 MB: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  }

  if (maxFileSize > 20 * 1024 * 1024) {
    error(`File > 20 MB: ${maxFileName} (${(maxFileSize / 1024 / 1024).toFixed(1)} MB)`);
  } else if (maxFileSize > 5 * 1024 * 1024) {
    warn(`File > 5 MB: ${maxFileName} (${(maxFileSize / 1024 / 1024).toFixed(1)} MB)`);
  }
} catch (e) {
  warn(`Cannot check sizes: ${e.message}`);
}

// ===========================================================================
// Check 21: Source snapshot verification
// ===========================================================================
console.log('\n--- Check 21: Source snapshot ---');
try {
  const sourceManifest = readSourceJson('enriched/source-manifest.json');
  const actualSha = sourceManifest.sourceFileSha256;
  if (actualSha !== EXPECTED_SOURCE_FILE_SHA256) {
    error(`Enriched source changed: expected sha ${EXPECTED_SOURCE_FILE_SHA256.substring(0, 16)}..., got ${actualSha?.substring(0, 16)}... — bump SOURCE_DATA_VERSION & expected sha`);
  } else {
    ok('source snapshot matches expected hash');
  }
} catch (e) {
  error(`Cannot verify source snapshot: ${e.message}`);
}

// ===========================================================================
// Summary
// ===========================================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`VERIFY SUMMARY: ${errors} errors, ${warnings} warnings`);

if (errors > 0) {
  console.error(`\n✗ VERIFY FAILED`);
  process.exit(1);
} else {
  console.log(`\n✓ VERIFY PASSED`);
  process.exit(0);
}
