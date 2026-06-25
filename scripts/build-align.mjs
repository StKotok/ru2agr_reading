// scripts/build-align.mjs
// Генерирует assets/data/align/grc-eng/{book}.json — span-based alignment
// между греческими токенами и BSB-текстом.

import { readSourceJson, readDataJson, writeDataJson, DATA_ROOT, existsSync } from './lib/fs.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeWord, normalizeBerean, fuzzyNormalize, tokenizeGloss, WORD_PATTERN, ALIGN_METHODS } from './lib/align-normalize.mjs';

const NT_BOOKS = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians',
  'ephesians', 'philippians', 'colossians',
  '1thessalonians', '2thessalonians', '1timothy', '2timothy',
  'titus', 'philemon', 'hebrews',
  'james', '1peter', '2peter', '1john', '2john', '3john',
  'jude', 'revelation'
];

// =============================================================================
// Alignment algorithm (per verse)
// =============================================================================

function alignVerse(engWords, grcTokens, verseText) {
  const claimed = new Array(engWords.length).fill(false);
  const pairs = [];
  const warnings = [];
  let ambiguousCandidateCount = 0;

  // Non-function tokens only, sorted by tokenIndex
  const candidates = grcTokens
    .filter(t => t.fw === false)
    .sort((a, b) => (a.i ?? 0) - (b.i ?? 0));

  // Build candidate data for each token
  const tokenData = candidates.map(t => ({
    token: t,
    primaryGloss: t.glossBerean || '',
    altGloss: t.glossCherith || '',
    hasPair: false
  }));

  // ===========================================================================
  // Pass 1: exact normalized single-word match → q="a", method="gloss-exact"
  // ===========================================================================
  for (const td of tokenData) {
    if (td.hasPair) continue;
    const norm = normalizeWord(td.primaryGloss);
    if (!norm || norm.includes(' ')) continue; // single-word only

    // Find unclaimed BSB words matching exactly
    const candIndices = [];
    for (let wi = 0; wi < engWords.length; wi++) {
      if (!claimed[wi] && normalizeWord(engWords[wi].text) === norm) {
        candIndices.push(wi);
      }
    }

    if (candIndices.length === 1) {
      const wi = candIndices[0];
      claimed[wi] = true;
      td.hasPair = true;
      pairs.push({
        span: [engWords[wi].start, engWords[wi].end],
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        q: 'a',
        method: 'gloss-exact'
      });
    } else if (candIndices.length > 1) {
      ambiguousCandidateCount++;
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'ambiguous',
        pass: 'exact'
      });
    }
  }

  // ===========================================================================
  // Pass 2: bracket-optional single-word match → q="a", method="bracket-optional"
  // ===========================================================================
  for (const td of tokenData) {
    if (td.hasPair) continue;
    const norm = normalizeWord(normalizeBerean(td.primaryGloss));
    if (!norm || norm.includes(' ')) continue;

    const candIndices = [];
    for (let wi = 0; wi < engWords.length; wi++) {
      if (!claimed[wi] && normalizeWord(engWords[wi].text) === norm) {
        candIndices.push(wi);
      }
    }

    if (candIndices.length === 1) {
      const wi = candIndices[0];
      claimed[wi] = true;
      td.hasPair = true;
      pairs.push({
        span: [engWords[wi].start, engWords[wi].end],
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        q: 'a',
        method: 'bracket-optional'
      });
    } else if (candIndices.length > 1) {
      ambiguousCandidateCount++;
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'ambiguous',
        pass: 'bracket-optional'
      });
    }
  }

  // ===========================================================================
  // Pass 3: phrase match (2-4 word contiguous windows) → q="a", method="phrase"
  // ===========================================================================
  for (const td of tokenData) {
    if (td.hasPair) continue;
    // Tokenize gloss into words using same pattern
    const glossWords = tokenizeGloss(td.primaryGloss);
    if (glossWords.length < 2 || glossWords.length > 4) continue;

    const normGlossWords = glossWords.map(normalizeWord);
    // Find contiguous windows of same length with 100% match
    const candStarts = [];
    for (let wi = 0; wi <= engWords.length - glossWords.length; wi++) {
      // All words in window must be unclaimed
      let allUnclaimed = true;
      for (let j = 0; j < glossWords.length; j++) {
        if (claimed[wi + j]) { allUnclaimed = false; break; }
      }
      if (!allUnclaimed) continue;

      // All words must match
      let allMatch = true;
      for (let j = 0; j < glossWords.length; j++) {
        if (normalizeWord(engWords[wi + j].text) !== normGlossWords[j]) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        candStarts.push(wi);
      }
    }

    if (candStarts.length === 1) {
      const wi = candStarts[0];
      for (let j = 0; j < glossWords.length; j++) {
        claimed[wi + j] = true;
      }
      td.hasPair = true;
      pairs.push({
        span: [engWords[wi].start, engWords[wi + glossWords.length - 1].end],
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        q: 'a',
        method: 'phrase'
      });
    } else if (candStarts.length > 1) {
      ambiguousCandidateCount++;
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'ambiguous',
        pass: 'phrase'
      });
    }
  }

  // ===========================================================================
  // Pass 4: simple fuzzy → q="f", method="fuzzy"
  // ===========================================================================
  for (const td of tokenData) {
    if (td.hasPair) continue;
    const norm = fuzzyNormalize(td.primaryGloss);
    if (!norm) continue;

    // Single-word fuzzy only
    if (norm.includes(' ')) continue;

    const candIndices = [];
    for (let wi = 0; wi < engWords.length; wi++) {
      if (!claimed[wi] && fuzzyNormalize(engWords[wi].text) === norm) {
        candIndices.push(wi);
      }
    }

    if (candIndices.length === 1) {
      const wi = candIndices[0];
      claimed[wi] = true;
      td.hasPair = true;
      pairs.push({
        span: [engWords[wi].start, engWords[wi].end],
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        q: 'f',
        method: 'fuzzy'
      });
    } else if (candIndices.length > 1) {
      ambiguousCandidateCount++;
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'ambiguous',
        pass: 'fuzzy'
      });
    }
  }

  // Unaligned non-function tokens → q="u"
  for (const td of tokenData) {
    if (!td.hasPair) {
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'unaligned',
        gloss: td.primaryGloss
      });
    }
  }

  return { pairs, warnings, ambiguousCandidateCount };
}

// =============================================================================
// Per-book alignment
// =============================================================================

function buildAlignmentForBook(bookId, manualAlignments) {
  const grcBook = readDataJson(`bibles/grc/${bookId}.json`);
  const engBook = readDataJson(`bibles/eng/${bookId}.json`);

  const grcSourceDataVersion = grcBook.sourceDataVersion;
  const normalizationVersion = engBook.normalizationVersion;

  if (!grcSourceDataVersion) throw new Error(`Missing sourceDataVersion in grc/${bookId}.json`);
  if (!normalizationVersion) throw new Error(`Missing normalizationVersion in eng/${bookId}.json`);

  // Build token lookup by chapter+verse
  const grcTokensByRef = new Map();
  let totalTokenCount = 0;
  let totalNonFunctionTokens = 0;
  for (const ch of grcBook.chapters) {
    for (const vs of ch.verses) {
      grcTokensByRef.set(vs.ref, vs.tokens);
      totalTokenCount += vs.tokens.length;
      totalNonFunctionTokens += vs.tokens.filter(t => t.fw === false).length;
    }
  }

  const pairsByRef = {};
  const warningsByRef = {};
  let totalAlignedNonFunction = 0;
  let totalAmbiguous = 0;
  let versesWithZeroPairs = 0;
  let totalOverlappingSpanCount = 0;

  // Build ref set from eng book
  for (const ch of engBook.chapters) {
    for (const vs of ch.verses) {
      const ref = vs.ref;
      const grcTokens = grcTokensByRef.get(ref) || [];
      const engWords = vs.words || [];
      const verseText = vs.text || '';

      const result = alignVerse(engWords, grcTokens, verseText);
      let pairs = result.pairs;
      totalAmbiguous += result.ambiguousCandidateCount;

      // Apply manual overrides/exclusions for this ref
      if (manualAlignments) {
        const manualForRef = manualAlignments.filter(m => m.ref === ref);
        for (const manual of manualForRef) {
          if (manual.method === 'manual-exclusion') {
            // Remove algorithmic pair for this tokenId
            pairs = pairs.filter(p => p.tokenId !== manual.tokenId);
            warningsByRef[ref] = warningsByRef[ref] || [];
            warningsByRef[ref].push({
              tokenId: manual.tokenId,
              reason: 'manual-exclusion',
              method: 'manual-exclusion'
            });
          } else if (manual.span) {
            // Manual pair replaces algorithmic pair for same tokenId
            pairs = pairs.filter(p => p.tokenId !== manual.tokenId);
            pairs.push({
              span: manual.span,
              tokenId: manual.tokenId,
              lexemeId: manual.lexemeId || grcTokens.find(t => t.id === manual.tokenId)?.lexemeId,
              q: manual.q || 'a',
              method: 'manual'
            });
          }
        }
      }

      // Sort pairs by span[0], then tokenId
      pairs.sort((a, b) => {
        if (a.span[0] !== b.span[0]) return a.span[0] - b.span[0];
        return a.tokenId.localeCompare(b.tokenId);
      });

      // Check span invariants
      let hasOverlap = false;
      for (let pi = 1; pi < pairs.length; pi++) {
        const prev = pairs[pi - 1];
        const cur = pairs[pi];
        // duplicate span check
        if (prev.span[0] === cur.span[0] && prev.span[1] === cur.span[1]) {
          throw new Error(
            `Duplicate span in ${ref}: tokenIds ${prev.tokenId} and ${cur.tokenId}`
          );
        }
        // overlapping span check
        if (prev.span[1] > cur.span[0]) {
          hasOverlap = true;
        }
      }
      if (hasOverlap) totalOverlappingSpanCount++;

      // Count aligned non-function tokens
      const alignedTokenIds = new Set(pairs.map(p => p.tokenId));
      const alignedNonFunc = grcTokens.filter(t => t.fw === false && alignedTokenIds.has(t.id)).length;
      totalAlignedNonFunction += alignedNonFunc;

      if (pairs.length === 0) versesWithZeroPairs++;
      if (result.warnings.length > 0) {
        warningsByRef[ref] = (warningsByRef[ref] || []).concat(result.warnings);
      }
      if (pairs.length > 0) {
        pairsByRef[ref] = pairs;
      }
    }
  }

  const stats = {
    tokenCount: totalTokenCount,
    nonFunctionTokenCount: totalNonFunctionTokens,
    alignedNonFunctionTokens: totalAlignedNonFunction,
    alignedTokenCount: totalAlignedNonFunction,
    unalignedTokenCount: totalNonFunctionTokens - totalAlignedNonFunction,
    warningCount: Object.values(warningsByRef).reduce((sum, w) => sum + w.length, 0),
    nonFunctionCoveragePercent: totalNonFunctionTokens > 0
      ? Math.round((totalAlignedNonFunction / totalNonFunctionTokens) * 1000) / 10
      : 0,
    versesWithZeroPairs,
    ambiguousCandidateCount: totalAmbiguous,
    overlappingSpanCount: totalOverlappingSpanCount
  };

  writeDataJson(`align/grc-eng/${bookId}.json`, {
    schema: 'alignment-book-v2',
    alignmentId: 'grc-eng',
    bookId,
    grcSourceDataVersion,
    normalizationVersion,
    stats,
    pairsByRef,
    warningsByRef
  });

  return stats;
}

// =============================================================================
// Build report
// =============================================================================

function buildReport(allStats, manualPairCount, manualExclusionCount) {
  const totalTokens = allStats.reduce((s, st) => s + st.tokenCount, 0);
  const totalNonFunc = allStats.reduce((s, st) => s + st.nonFunctionTokenCount, 0);
  const totalAligned = allStats.reduce((s, st) => s + st.alignedNonFunctionTokens, 0);
  const totalUnaligned = totalNonFunc - totalAligned;
  const totalWarnings = allStats.reduce((s, st) => s + st.warningCount, 0);
  const totalAmbiguous = allStats.reduce((s, st) => s + st.ambiguousCandidateCount, 0);
  const totalOverlapping = allStats.reduce((s, st) => s + st.overlappingSpanCount, 0);
  const totalVersesWithZero = allStats.reduce((s, st) => s + st.versesWithZeroPairs, 0);

  const coverage = totalNonFunc > 0
    ? Math.round((totalAligned / totalNonFunc) * 1000) / 10
    : 0;

  // Top unaligned lexemes (from all warnings)
  const unalignedCounts = new Map();
  // We'd need to read warnings data; for now, compute from stats
  // This is a simplified version

  const report = {
    generatedAt: new Date().toISOString(),
    totalTokens,
    alignedTokens: totalAligned,
    unalignedTokens: totalUnaligned,
    alignedNonFunctionTokens: totalAligned,
    totalNonFunctionTokens: totalNonFunc,
    coveragePercent: coverage,
    nonFunctionCoveragePercent: coverage,
    versesWithZeroPairs: totalVersesWithZero,
    duplicateSpanCount: 0,
    overlappingSpanCount: totalOverlapping,
    ambiguousCandidateCount: totalAmbiguous,
    topUnalignedLexemes: [],
    manualPairCount,
    manualExclusionCount,
    perBook: allStats.map(st => ({
      bookId: st.bookId,
      tokenCount: st.tokenCount,
      nonFunctionTokenCount: st.nonFunctionTokenCount,
      alignedNonFunctionTokens: st.alignedNonFunctionTokens,
      nonFunctionCoveragePercent: st.nonFunctionCoveragePercent,
      versesWithZeroPairs: st.versesWithZeroPairs,
      ambiguousCandidateCount: st.ambiguousCandidateCount,
      overlappingSpanCount: st.overlappingSpanCount
    })),
    thresholds: {
      // accuracyInvariant: 'hard' — enforced by verify:data Check 16 (accuracy invariant)
      // coverage is advisory (warn, never blocks release)
      accuracyInvariant: 'hard',
      nonFunctionCoverageMin: 90,
      nonFunctionCoverageEnforced: false,
      versesWithPairsMin: 95
    }
  };

  writeDataJson('align/grc-eng/build-report.json', report);
  return report;
}

// =============================================================================
// Main
// =============================================================================

console.log('build-align.mjs');
console.log(`DATA_ROOT: ${DATA_ROOT}`);

// Load manual alignments if exists
let manualAlignments = null;
const manualPath = 'docs/source-data/alignments/grc-eng/manual-alignments.json';
try {
  if (existsSync(manualPath)) {
    const raw = JSON.parse(readFileSync(manualPath, 'utf8'));
    if (Array.isArray(raw)) {
      manualAlignments = raw;
      console.log(`  manual alignments: ${manualAlignments.length} entries`);
    }
  } else {
    console.log('  no manual alignments file');
  }
} catch (e) {
  console.warn(`  manual alignments not found: ${e.message}`);
}

const allStats = [];
let manualPairCount = 0;
let manualExclusionCount = 0;

if (manualAlignments) {
  manualPairCount = manualAlignments.filter(m => m.method !== 'manual-exclusion').length;
  manualExclusionCount = manualAlignments.filter(m => m.method === 'manual-exclusion').length;
}

for (const bookId of NT_BOOKS) {
  const stats = buildAlignmentForBook(bookId, manualAlignments);
  stats.bookId = bookId;
  allStats.push(stats);
  console.log(`  ${bookId}: ${stats.alignedNonFunctionTokens}/${stats.nonFunctionTokenCount} NF aligned (${stats.nonFunctionCoveragePercent}%), ${stats.versesWithZeroPairs} empty verses`);
}

const report = buildReport(allStats, manualPairCount, manualExclusionCount);

console.log(`\n=== Build Report ===`);
console.log(`Total tokens: ${report.totalTokens}`);
console.log(`Non-function tokens: ${report.totalNonFunctionTokens}`);
console.log(`Aligned non-function: ${report.alignedNonFunctionTokens}`);
console.log(`Coverage: ${report.nonFunctionCoveragePercent}%`);
console.log(`Verses with zero pairs: ${report.versesWithZeroPairs}`);
console.log(`Overlapping spans: ${report.overlappingSpanCount}`);

console.log('\n✓ build-align.mjs complete');
