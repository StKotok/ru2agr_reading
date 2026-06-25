import { hash01 } from './hash.js';

/**
 * Apply form layer (mode 3/4/5) using frozen word offsets and span-based alignment.
 *
 * v2 architecture:
 *   - Translation words come pre-tokenized with {i, text, start, end} offsets.
 *   - Alignment pairs use span: [start, end] (character offsets in verse.text)
 *     and tokenId (MACULA token anchor), lexemeId (canonical key).
 *   - q="u" and q="x" pairs are NEVER shown as Greek insertions.
 *   - External punctuation is excluded from spans and remains as plain text.
 *   - dictByLexemeId replaces dictByLexemeKey — canonical key is lexemeId.
 *
 * @param {string} verseText — BSB verse text (raw string)
 * @param {Array} words — frozen word tokens [{i, text, start, end}]
 * @param {Array} grcTokens — Greek tokens [{id, i, s, lemma, lexemeId, lexemeSlug, morph, strongs, fw}]
 * @param {Array} alignment — alignment pairs [{span:[int,int], tokenId, lexemeId, q, method}]
 * @param {Map} dictByLexemeId — Map<lexemeId, dictEntry>
 * @param {object} opts — {seedPrefix, verseRef, mode}
 * @returns {Array} Segment[]
 */
export function applyFormLayer(verseText, words, grcTokens, alignment, dictByLexemeId, opts = {}) {
  const { seedPrefix = '', mode = 3 } = opts;

  if (!grcTokens || grcTokens.length === 0 || !alignment || alignment.length === 0) {
    return [{ plain: verseText }];
  }

  // Build Greek token lookup by tokenId (primary)
  const grcTokenById = new Map();
  for (const t of grcTokens) {
    grcTokenById.set(t.id, t);
  }

  const segments = [];
  let cursor = 0;
  let segmentCount = 0;

  for (const pair of alignment) {
    if (pair.q === 'u' || pair.q === 'x') continue;       // uncertain/excluded never shown
    if (!pair.span) continue;                              // span-less not reachable (defense)

    const [spanStart, spanEnd] = pair.span;

    // Overlap guard (pipeline guarantees non-overlapping, sorted spans)
    if (spanStart < cursor) {
      console.warn('[form-layer] overlapping span skipped:', pair.tokenId, pair.span);
      continue;
    }

    // Plain text before this span
    if (cursor < spanStart) {
      const plain = verseText.slice(cursor, spanStart);
      if (plain.length > 0) {
        // Skip leading whitespace-only at segment 0
        if (segmentCount === 0 && plain.trim() === '') {
          // skip
        } else {
          segments.push({ plain });
          segmentCount++;
        }
      }
      cursor = spanStart;
    }

    // The source word span
    const srcWord = verseText.slice(spanStart, spanEnd);

    // Find Greek token
    const grToken = grcTokenById.get(pair.tokenId);
    if (!grToken) {
      segments.push({ plain: srcWord });
      cursor = spanEnd;
      segmentCount++;
      continue;
    }

    // Canonical key: lexemeId, fallback to lexemeKey (legacy alignment fixture)
    const lexemeId = pair.lexemeId || pair.lexemeKey;
    const dictEntry = lexemeId ? dictByLexemeId.get(lexemeId) : null;

    if (!dictEntry) {
      // No dictionary entry — show as plain BSB word
      segments.push({ plain: srcWord });
      cursor = spanEnd;
      segmentCount++;
      continue;
    }

    // Apply replacement logic
    const seed = `${seedPrefix}:${lexemeId}:${pair.tokenId}`;
    const pct = dictEntry.intensityPct ?? 100;
    const shouldReplace = dictEntry.status === 'known' || hash01(seed) * 100 < pct;

    if (shouldReplace) {
      let display;
      const forms = dictEntry.forms || 'form';

      if (mode === 5) {
        display = grToken.s || grToken.lemma;
      } else if (forms === 'lemma') {
        display = grToken.lemma;
      } else {
        display = grToken.s;
      }

      // Capitalization: match source word's case
      const isUpper = srcWord.length > 0 && srcWord[0] === srcWord[0].toUpperCase();
      let greekText = display || grToken.s || '';
      if (isUpper && greekText.length > 0) {
        greekText = greekText[0].toUpperCase() + greekText.slice(1);
      }

      const seg = {
        greek: greekText,
        original: srcWord,
        kind: 'form',
        lexemeId,                                            // canonical
        lexemeKey: pair.lexemeKey || pair.lexemeSlug || lexemeId,  // legacy/display alias
        morph: grToken.morph,
        strong: grToken.strongs?.[0] || null,
        strongs: grToken.strongs || [],
        lemma: grToken.lemma,
        tokenId: pair.tokenId,
      };

      if (pair.q === 'f') seg.quality = 'f';

      segments.push(seg);
    } else {
      segments.push({ plain: srcWord });
    }

    cursor = spanEnd;
    segmentCount++;
  }

  // Plain tail after last pair
  if (cursor < verseText.length) {
    const tail = verseText.slice(cursor);
    if (tail.length > 0 && tail.trim() !== '') {
      segments.push({ plain: tail });
    }
  }

  return segments;
}

/**
 * Build dictByLexemeId map from word entries.
 * Each entry should have lexemeId (canonical), with lexemeKey as fallback.
 *
 * @param {Array} wordEntries — dictionary entries
 * @returns {Map<lexemeId, entry>}
 */
export function buildDictByLexemeId(wordEntries) {
  const map = new Map();
  for (const entry of wordEntries) {
    const key = entry.lexemeId || entry.lexemeKey || entry.id;
    if (key) {
      map.set(key, entry);
    }
  }
  return map;
}
