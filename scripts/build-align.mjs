// scripts/build-align.mjs
// Генерирует assets/data/align/grc-eng/{book}.json — span-based alignment
// между греческими токенами и BSB-текстом.

import { readSourceJson, readDataJson, writeDataJson, DATA_ROOT, existsSync } from './lib/fs.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeWord, normalizeBerean, fuzzyNormalize, tokenizeGloss, WORD_PATTERN, ALIGN_METHODS } from './lib/align-normalize.mjs';

// Positional disambiguation — ВЫКЛЮЧЕН по умолчанию.
// При включении требует 100% ручного аудита всех positional пар (см. план T2.3/T4.2).
const ENABLE_POSITIONAL = false;

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
// Classify a non-aligned non-function token into an honest resolution category.
// Mirrors the candidate-count heuristic; replaces faked bulk manual-exclusions.
// =============================================================================

function classifyUnresolved(token, engWords) {
  const glossB = token.glossBerean || '';
  const glossC = token.glossCherith || '';
  if (!glossB && !glossC) {
    return { kind: 'no-gloss', reason: 'no-gloss-available' };
  }
  const normB = normalizeWord(glossB);
  const normC = normalizeWord(glossC);
  const normBB = normalizeWord(normalizeBerean(glossB));
  let candCount = 0;
  for (const w of engWords) {
    const nw = normalizeWord(w.text);
    if ((normB && nw === normB) || (normC && nw === normC) || (normBB && nw === normBB)) candCount++;
  }
  if (candCount === 0) return { kind: 'auto-deferred', reason: 'no-matching-word' };
  if (candCount > 1) return { kind: 'auto-deferred', reason: 'ambiguous', candidateCount: candCount };
  return { kind: 'auto-deferred', reason: 'already-claimed' };
}

// =============================================================================
// Alignment algorithm (per verse)
// =============================================================================

function alignVerse(engWords, grcTokens, verseText, lexiconGlossMap) {
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
  // Pass 3a: alt-gloss-exact (Cherith) → q="a", method="alt-gloss-exact"
  // ===========================================================================
  for (const td of tokenData) {
    if (td.hasPair) continue;
    if (!td.altGloss) continue;
    // Skip if Cherith gloss normalizes to same as Berean (already tried)
    if (normalizeWord(td.altGloss) === normalizeWord(td.primaryGloss)) continue;
    const norm = normalizeWord(td.altGloss);
    if (!norm || norm.includes(' ')) continue;

    const candIndices = [];
    for (let wi = 0; wi < engWords.length; wi++) {
      if (!claimed[wi] && normalizeWord(engWords[wi].text) === norm) {
        candIndices.push(wi);
      }
    }

    if (candIndices.length === 1) {
      const wi = candIndices[0];
      const span = [engWords[wi].start, engWords[wi].end];
      // Overlap guard
      if (!pairs.every(p => span[1] <= p.span[0] || span[0] >= p.span[1])) continue;
      claimed[wi] = true;
      td.hasPair = true;
      pairs.push({
        span,
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        q: 'a',
        method: 'alt-gloss-exact'
      });
    } else if (candIndices.length > 1) {
      ambiguousCandidateCount++;
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'ambiguous',
        pass: 'alt-exact'
      });
    }
  }

  // ===========================================================================
  // Pass 3b: alt-gloss-bracket (Cherith bracket-optional) → q="a", method="alt-gloss-bracket"
  // ===========================================================================
  for (const td of tokenData) {
    if (td.hasPair) continue;
    if (!td.altGloss) continue;
    const altBerean = normalizeBerean(td.altGloss);
    if (normalizeWord(altBerean) === normalizeWord(normalizeBerean(td.primaryGloss))) continue;
    const norm = normalizeWord(altBerean);
    if (!norm || norm.includes(' ')) continue;

    const candIndices = [];
    for (let wi = 0; wi < engWords.length; wi++) {
      if (!claimed[wi] && normalizeWord(engWords[wi].text) === norm) {
        candIndices.push(wi);
      }
    }

    if (candIndices.length === 1) {
      const wi = candIndices[0];
      const span = [engWords[wi].start, engWords[wi].end];
      if (!pairs.every(p => span[1] <= p.span[0] || span[0] >= p.span[1])) continue;
      claimed[wi] = true;
      td.hasPair = true;
      pairs.push({
        span,
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        q: 'a',
        method: 'alt-gloss-bracket'
      });
    } else if (candIndices.length > 1) {
      ambiguousCandidateCount++;
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'ambiguous',
        pass: 'alt-bracket'
      });
    }
  }

  // ===========================================================================
  // Pass 3c: alt-gloss-phrase (Cherith phrase 2-4) → q="a", method="alt-gloss-phrase"
  // ===========================================================================
  for (const td of tokenData) {
    if (td.hasPair) continue;
    if (!td.altGloss) continue;
    const altGlossWords = tokenizeGloss(td.altGloss);
    if (altGlossWords.length < 2 || altGlossWords.length > 4) continue;

    // Skip if Cherith phrase normalizes to same as Berean phrase (already tried)
    const primaryGlossWords = tokenizeGloss(td.primaryGloss);
    if (altGlossWords.length === primaryGlossWords.length &&
        altGlossWords.every((w, i) => normalizeWord(w) === normalizeWord(primaryGlossWords[i]))) continue;

    const normAltWords = altGlossWords.map(normalizeWord);
    const candStarts = [];
    for (let wi = 0; wi <= engWords.length - altGlossWords.length; wi++) {
      let allUnclaimed = true;
      for (let j = 0; j < altGlossWords.length; j++) {
        if (claimed[wi + j]) { allUnclaimed = false; break; }
      }
      if (!allUnclaimed) continue;

      let allMatch = true;
      for (let j = 0; j < altGlossWords.length; j++) {
        if (normalizeWord(engWords[wi + j].text) !== normAltWords[j]) {
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
      const span = [engWords[wi].start, engWords[wi + altGlossWords.length - 1].end];
      if (!pairs.every(p => span[1] <= p.span[0] || span[0] >= p.span[1])) continue;
      for (let j = 0; j < altGlossWords.length; j++) {
        claimed[wi + j] = true;
      }
      td.hasPair = true;
      pairs.push({
        span,
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        q: 'a',
        method: 'alt-gloss-phrase'
      });
    } else if (candStarts.length > 1) {
      ambiguousCandidateCount++;
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'ambiguous',
        pass: 'alt-phrase'
      });
    }
  }

  // ===========================================================================
  // Pass 3d: lexicon-gloss-exact — multiple glosses from core lexicon
  // ===========================================================================
  if (lexiconGlossMap && lexiconGlossMap.size > 0) {
    for (const td of tokenData) {
      if (td.hasPair) continue;
      const lexId = td.token.lexemeId;
      const lexEntry = lexiconGlossMap.get(lexId);
      if (!lexEntry) continue;

      // Collect candidate glosses, skipping already-checked ones
      const alreadyChecked = new Set();
      if (td.primaryGloss) {
        alreadyChecked.add(normalizeWord(td.primaryGloss));
        alreadyChecked.add(normalizeWord(normalizeBerean(td.primaryGloss)));
      }
      if (td.altGloss) {
        alreadyChecked.add(normalizeWord(td.altGloss));
        alreadyChecked.add(normalizeWord(normalizeBerean(td.altGloss)));
      }

      // Build candidate gloss list: Berean first, then Cherith, deduped
      const candidateGlosses = [];
      for (const g of lexEntry.glossesBerean) {
        const nw = normalizeWord(g);
        if (!alreadyChecked.has(nw) && nw && !nw.includes(' ')) {
          candidateGlosses.push({ gloss: g, norm: nw });
          alreadyChecked.add(nw);
        }
      }
      for (const g of lexEntry.glossesCherith) {
        const nw = normalizeWord(g);
        if (!alreadyChecked.has(nw) && nw && !nw.includes(' ')) {
          candidateGlosses.push({ gloss: g, norm: nw });
          alreadyChecked.add(nw);
        }
      }

      if (candidateGlosses.length === 0) continue;

      // Try each candidate gloss in order; first one with single match wins
      for (const { gloss, norm } of candidateGlosses) {
        const candIndices = [];
        for (let wi = 0; wi < engWords.length; wi++) {
          if (!claimed[wi] && normalizeWord(engWords[wi].text) === norm) {
            candIndices.push(wi);
          }
        }

        if (candIndices.length === 1) {
          const wi = candIndices[0];
          const span = [engWords[wi].start, engWords[wi].end];
          if (!pairs.every(p => span[1] <= p.span[0] || span[0] >= p.span[1])) continue;
          claimed[wi] = true;
          td.hasPair = true;
          pairs.push({
            span,
            tokenId: td.token.id,
            lexemeId: td.token.lexemeId,
            q: 'a',
            method: 'lexicon-gloss-exact'
          });
          break; // Move to next token
        } else if (candIndices.length > 1) {
          ambiguousCandidateCount++;
          warnings.push({
            tokenId: td.token.id,
            lexemeId: td.token.lexemeId,
            reason: 'ambiguous',
            pass: 'lexicon-exact'
          });
          break; // Ambiguous for this token, don't try other glosses
        }
      }
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

  // ===========================================================================
  // Pass 5 (OFF by default): positional-equal-count → proposal tier
  // ===========================================================================
  if (ENABLE_POSITIONAL) {
    // Group unpaired tokens by normalized gloss
    const groups = new Map(); // normGloss → [{tokenData, tokenIndex}]
    for (const td of tokenData) {
      if (td.hasPair) continue;
      const norm = normalizeWord(td.primaryGloss);
      if (!norm || norm.includes(' ')) continue;
      if (!groups.has(norm)) groups.set(norm, []);
      groups.get(norm).push(td);
    }

    for (const [normGloss, tds] of groups) {
      if (tds.length === 0) continue;
      // Find unclaimed BSB words with same normalized form
      const availWords = [];
      for (let wi = 0; wi < engWords.length; wi++) {
        if (!claimed[wi] && normalizeWord(engWords[wi].text) === normGloss) {
          availWords.push(wi);
        }
      }

      // Only pair if count matches AND words are pairwise distinct after normalization
      if (availWords.length !== tds.length) continue;

      // Check that available words are pairwise distinct (they already are by index)
      // Sort both by position and pair by index
      const sortedTds = [...tds].sort((a, b) => (a.token.i ?? 0) - (b.token.i ?? 0));
      const sortedWords = [...availWords].sort((a, b) => a - b);

      let allOk = true;
      for (let k = 0; k < sortedTds.length; k++) {
        const td = sortedTds[k];
        const wi = sortedWords[k];
        const span = [engWords[wi].start, engWords[wi].end];
        if (!pairs.every(p => span[1] <= p.span[0] || span[0] >= p.span[1])) {
          allOk = false;
          break;
        }
      }

      if (!allOk) continue;

      // Commit all pairs
      for (let k = 0; k < sortedTds.length; k++) {
        const td = sortedTds[k];
        const wi = sortedWords[k];
        const span = [engWords[wi].start, engWords[wi].end];
        claimed[wi] = true;
        td.hasPair = true;
        pairs.push({
          span,
          tokenId: td.token.id,
          lexemeId: td.token.lexemeId,
          q: 'a',
          method: 'positional-equal-count'
        });
      }
    }
  }

  // Unaligned non-function tokens → q="u"
  const unresolved = [];
  for (const td of tokenData) {
    if (!td.hasPair) {
      warnings.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        reason: 'unaligned',
        gloss: td.primaryGloss
      });
      unresolved.push({
        tokenId: td.token.id,
        lexemeId: td.token.lexemeId,
        gloss: td.primaryGloss || td.altGloss || ''
      });
    }
  }

  return { pairs, warnings, ambiguousCandidateCount, unresolved };
}

// =============================================================================
// Per-book alignment
// =============================================================================

function buildAlignmentForBook(bookId, manualByBook, lexiconGlossMap) {
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
  const exclusionsByRef = {}; // authoritative resolution layer for non-aligned fw=false tokens
  const excludedTokenIds = new Set(); // tokens already categorized (manual-exclusion, no-bsb-verse)
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

      const result = alignVerse(engWords, grcTokens, verseText, lexiconGlossMap);
      let pairs = result.pairs;
      totalAmbiguous += result.ambiguousCandidateCount;

      // Apply manual overrides/exclusions for this ref
      const manualForRef = manualByBook?.get(bookId)?.get(ref);
      if (manualForRef) {
        for (const manual of manualForRef) {
          if (manual.method === 'manual-exclusion') {
            // Remove algorithmic pair for this tokenId
            pairs = pairs.filter(p => p.tokenId !== manual.tokenId);
            excludedTokenIds.add(manual.tokenId);
            exclusionsByRef[ref] = exclusionsByRef[ref] || [];
            exclusionsByRef[ref].push({
              tokenId: manual.tokenId,
              lexemeId: grcTokens.find(t => t.id === manual.tokenId)?.lexemeId || '',
              kind: 'manual-exclusion',
              reason: manual.reason || 'manual-exclusion'
            });
          } else if (manual.method === 'manual') {
            // Compile span from wordIndex/wordIndexes
            let span;
            if (manual.wordIndex != null) {
              const w = engWords[manual.wordIndex];
              if (!w) throw new Error(`${ref}: wordIndex ${manual.wordIndex} out of bounds (${engWords.length} words)`);
              span = [w.start, w.end];
            } else if (manual.wordIndexes && manual.wordIndexes.length >= 2) {
              const first = engWords[manual.wordIndexes[0]];
              const last = engWords[manual.wordIndexes[manual.wordIndexes.length - 1]];
              if (!first || !last) throw new Error(`${ref}: wordIndexes out of bounds`);
              span = [first.start, last.end];
            } else {
              throw new Error(`${ref}: manual entry for ${manual.tokenId} has no wordIndex/wordIndexes`);
            }

            // Verify expectedText if provided
            if (manual.expectedText) {
              const sliced = verseText.slice(span[0], span[1]);
              if (sliced !== manual.expectedText) {
                throw new Error(
                  `${ref}: manual entry for ${manual.tokenId} expectedText mismatch: "${sliced}" !== "${manual.expectedText}"`
                );
              }
            }

            // Manual pair replaces algorithmic pair for same tokenId
            pairs = pairs.filter(p => p.tokenId !== manual.tokenId);
            pairs.push({
              span,
              tokenId: manual.tokenId,
              lexemeId: manual.lexemeId || grcTokens.find(t => t.id === manual.tokenId)?.lexemeId || '',
              q: 'a',
              method: 'manual'
            });
          }
        }
      }

      // Auto-exclusion: no-bsb-verse (grc tokens in verses without BSB text)
      if (grcTokens.length > 0 && engWords.length === 0) {
        for (const t of grcTokens) {
          if (t.fw === false && !excludedTokenIds.has(t.id)) {
            excludedTokenIds.add(t.id);
            exclusionsByRef[ref] = exclusionsByRef[ref] || [];
            exclusionsByRef[ref].push({
              tokenId: t.id,
              lexemeId: t.lexemeId || '',
              kind: 'no-bsb-verse',
              reason: 'no-bsb-verse'
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

      // Authoritative resolution layer: every fw=false token not aligned and not
      // already categorized (manual-exclusion / no-bsb-verse) is classified into an
      // honest auto category (auto-deferred / no-gloss). Computed from FINAL pairs
      // (post manual application), so manual pairs/exclusions are reflected correctly.
      const finalAlignedIds = new Set(pairs.map(p => p.tokenId));
      for (const t of grcTokens) {
        if (t.fw !== false) continue;
        if (finalAlignedIds.has(t.id)) continue;
        if (excludedTokenIds.has(t.id)) continue;
        const cls = classifyUnresolved(t, engWords);
        exclusionsByRef[ref] = exclusionsByRef[ref] || [];
        exclusionsByRef[ref].push({
          tokenId: t.id,
          lexemeId: t.lexemeId || '',
          gloss: t.glossBerean || t.glossCherith || '',
          ...cls
        });
      }
    }
  }

  // Handle grc-only verses (ref present in grc but absent from BSB) → no-bsb-verse.
  const engRefs = new Set();
  for (const ch of engBook.chapters) for (const vs of ch.verses) engRefs.add(vs.ref);
  for (const [ref, grcTokens] of grcTokensByRef) {
    if (engRefs.has(ref)) continue;
    for (const t of grcTokens) {
      if (t.fw === false && !excludedTokenIds.has(t.id)) {
        excludedTokenIds.add(t.id);
        exclusionsByRef[ref] = exclusionsByRef[ref] || [];
        exclusionsByRef[ref].push({
          tokenId: t.id,
          lexemeId: t.lexemeId || '',
          kind: 'no-bsb-verse',
          reason: 'no-bsb-verse'
        });
      }
    }
  }

  // Aggregate the resolution layer by category.
  let manualExclusionCount = 0;
  let noBsbVerseCount = 0;
  let noGlossCount = 0;
  let autoDeferredCount = 0;
  const autoDeferredByReason = { 'no-matching-word': 0, 'ambiguous': 0, 'already-claimed': 0 };
  const autoDeferredList = []; // for topUnalignedLexemes
  for (const ref in exclusionsByRef) {
    for (const e of exclusionsByRef[ref]) {
      if (e.kind === 'manual-exclusion') manualExclusionCount++;
      else if (e.kind === 'no-bsb-verse') noBsbVerseCount++;
      else if (e.kind === 'no-gloss') noGlossCount++;
      else if (e.kind === 'auto-deferred') {
        autoDeferredCount++;
        if (e.reason in autoDeferredByReason) autoDeferredByReason[e.reason]++;
        autoDeferredList.push({
          ref,
          tokenId: e.tokenId,
          lexemeId: e.lexemeId,
          gloss: e.gloss || '',
          candidateCount: e.candidateCount
        });
      }
    }
  }
  const totalExcluded = manualExclusionCount + noBsbVerseCount + noGlossCount + autoDeferredCount;

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
    overlappingSpanCount: totalOverlappingSpanCount,
    // Resolution layer counts (partition of non-aligned fw=false tokens)
    manualExclusionCount,
    noBsbVerseCount,
    noGlossCount,
    autoDeferredCount,
    autoDeferredByReason,
    excludedCount: totalExcluded,
    autoDeferredList
  };

  writeDataJson(`align/grc-eng/${bookId}.json`, {
    schema: 'alignment-book-v3',
    alignmentId: 'grc-eng',
    bookId,
    grcSourceDataVersion,
    normalizationVersion,
    stats,
    pairsByRef,
    warningsByRef,
    exclusionsByRef
  });

  return stats;
}

// =============================================================================
// Build report
// =============================================================================

function buildReport(allStats, manualPairCount) {
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

  // Build topUnalignedLexemes from the auto-deferred backlog (F1.5).
  // Aggregate by lexemeId: count, example gloss, up to 3 sample refs, max candidateCount.
  const lexemeAgg = new Map(); // lexemeId → { gloss, count, refs: Set, maxCandidateCount }
  for (const st of allStats) {
    for (const u of (st.autoDeferredList || [])) {
      if (!u.lexemeId) continue;
      let agg = lexemeAgg.get(u.lexemeId);
      if (!agg) {
        agg = { gloss: u.gloss || '', count: 0, refs: new Set(), maxCandidateCount: 0 };
        lexemeAgg.set(u.lexemeId, agg);
      }
      agg.count++;
      if (!agg.gloss && u.gloss) agg.gloss = u.gloss;
      if (agg.refs.size < 3 && u.ref) agg.refs.add(u.ref);
      if (u.candidateCount && u.candidateCount > agg.maxCandidateCount) agg.maxCandidateCount = u.candidateCount;
    }
  }

  const topUnalignedLexemes = [...lexemeAgg.entries()]
    .map(([lexemeId, agg]) => ({
      lexemeId,
      gloss: agg.gloss,
      count: agg.count,
      sampleRefs: [...agg.refs].slice(0, 3),
      candidateCount: agg.maxCandidateCount || undefined
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 200);

  // Resolution partition: aligned ∪ manual-exclusion ∪ no-bsb-verse ∪ no-gloss ∪ auto-deferred.
  const manualExclusionCount = allStats.reduce((s, st) => s + (st.manualExclusionCount || 0), 0);
  const noBsbVerseCount = allStats.reduce((s, st) => s + (st.noBsbVerseCount || 0), 0);
  const noGlossCount = allStats.reduce((s, st) => s + (st.noGlossCount || 0), 0);
  const autoDeferredCount = allStats.reduce((s, st) => s + (st.autoDeferredCount || 0), 0);
  const autoDeferredByReason = allStats.reduce((acc, st) => {
    for (const r of ['no-matching-word', 'ambiguous', 'already-claimed']) {
      acc[r] = (acc[r] || 0) + ((st.autoDeferredByReason && st.autoDeferredByReason[r]) || 0);
    }
    return acc;
  }, {});
  const totalExcluded = manualExclusionCount + noBsbVerseCount + noGlossCount + autoDeferredCount;
  const totalResolved = totalAligned + totalExcluded;
  const totalUnresolved = totalNonFunc - totalResolved;

  const report = {
    generatedAt: new Date().toISOString(),
    totalTokens,
    alignedTokens: totalAligned,
    unalignedTokens: totalUnaligned,
    alignedNonFunctionTokens: totalAligned,
    totalNonFunctionTokens: totalNonFunc,
    resolvedNonFunctionTokens: totalResolved,
    unresolvedNonFunctionTokens: totalUnresolved,
    coveragePercent: coverage,
    nonFunctionCoveragePercent: coverage,
    versesWithZeroPairs: totalVersesWithZero,
    duplicateSpanCount: 0,
    overlappingSpanCount: totalOverlapping,
    ambiguousCandidateCount: totalAmbiguous,
    topUnalignedLexemes,
    // Resolution partition counts (honest model)
    manualPairCount,
    manualExclusionCount,
    noBsbVerseCount,
    noGlossCount,
    autoDeferredCount,
    autoDeferredByReason,
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

// Load manual alignments (new schema: {normalizationVersion, entries})
/** @type {Map<string, Map<string, Array<object>>>} */
const manualByBook = new Map();
let manualEntries = [];
const manualPath = 'docs/source-data/alignments/grc-eng/manual-alignments.json';
try {
  if (existsSync(manualPath)) {
    const raw = JSON.parse(readFileSync(manualPath, 'utf8'));
    if (raw && raw.entries && Array.isArray(raw.entries)) {
      manualEntries = raw.entries;
      console.log(`  manual alignments: ${manualEntries.length} entries (version: ${raw.normalizationVersion})`);
    } else if (Array.isArray(raw)) {
      // Legacy format — treat as entries array
      manualEntries = raw;
      console.log(`  manual alignments: ${manualEntries.length} entries (legacy format)`);
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

// Build manualByBook lookup
for (const entry of manualEntries) {
  const refMatch = entry.ref?.match(/^(\d?\s?\w+)\s+(\d+):(\d+)$/i);
  if (!refMatch) continue;
  const bId = refMatch[1].toLowerCase().replace(/\s/g, '');
  if (!manualByBook.has(bId)) manualByBook.set(bId, new Map());
  const byRef = manualByBook.get(bId);
  if (!byRef.has(entry.ref)) byRef.set(entry.ref, []);
  byRef.get(entry.ref).push(entry);

  if (entry.method === 'manual-exclusion') {
    manualExclusionCount++;
  } else if (entry.method === 'manual') {
    manualPairCount++;
  }
}

// Load core lexicon for lexicon-gloss-exact pass
/** @type {Map<string, {glossesBerean: string[], glossesCherith: string[]}>} */
let lexiconGlossMap = new Map();
try {
  const corePath = join(DATA_ROOT, 'lexicon/core.json');
  const core = JSON.parse(readFileSync(corePath, 'utf8'));
  for (const item of (core.items || [])) {
    lexiconGlossMap.set(item.lexemeId, {
      glossesBerean: item.glossesBerean || [],
      glossesCherith: item.glossesCherith || []
    });
  }
  console.log(`  lexicon gloss map: ${lexiconGlossMap.size} entries`);
} catch (e) {
  console.warn(`  lexicon core not loaded: ${e.message}`);
}

for (const bookId of NT_BOOKS) {
  const stats = buildAlignmentForBook(bookId, manualByBook, lexiconGlossMap);
  stats.bookId = bookId;
  allStats.push(stats);
  console.log(`  ${bookId}: ${stats.alignedNonFunctionTokens}/${stats.nonFunctionTokenCount} NF aligned (${stats.nonFunctionCoveragePercent}%), ${stats.versesWithZeroPairs} empty verses`);
}

const report = buildReport(allStats, manualPairCount);

console.log(`\n=== Build Report ===`);
console.log(`Total tokens: ${report.totalTokens}`);
console.log(`Non-function tokens: ${report.totalNonFunctionTokens}`);
console.log(`Aligned non-function: ${report.alignedNonFunctionTokens} (${report.nonFunctionCoveragePercent}%)`);
console.log(`Resolved: ${report.resolvedNonFunctionTokens} / Unresolved: ${report.unresolvedNonFunctionTokens}`);
console.log(`  manual-exclusion: ${report.manualExclusionCount}, manual-pair: ${report.manualPairCount}`);
console.log(`  no-bsb-verse: ${report.noBsbVerseCount}, no-gloss: ${report.noGlossCount}`);
console.log(`  auto-deferred (backlog): ${report.autoDeferredCount} ${JSON.stringify(report.autoDeferredByReason)}`);
console.log(`Verses with zero pairs: ${report.versesWithZeroPairs}`);
console.log(`Overlapping spans: ${report.overlappingSpanCount}`);

console.log('\n✓ build-align.mjs complete');
