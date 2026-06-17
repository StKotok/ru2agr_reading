import { hash01 } from './hash.js';

/**
 * Apply form layer (mode 3/4/5) using frozen word offsets and span-based alignment.
 *
 * New MACULA-based architecture:
 *   - Translation words come pre-tokenized with {i, text, start, end} offsets.
 *   - Alignment pairs use span: [start, end] (character offsets in verse.text)
 *     and tokenId (MACULA token anchor).
 *   - q="u" pairs are NEVER shown.
 *   - External punctuation is excluded from spans and remains as plain text.
 *   - dictByLexemeKey replaces dictByStrong.
 *
 * @param {string} verseText — Russian verse text (raw string)
 * @param {Array} words — frozen word tokens [{i, text, start, end}]
 * @param {Array} grcTokens — Greek tokens [{id, i, s, lemma, lexemeKey, maculaLexemeId, morph, strongs, fw}]
 * @param {Array} alignment — alignment pairs [{span:[int,int], tokenId, lexemeKey, q, src}]
 * @param {Map} dictByLexemeKey — Map<lexemeKey, dictEntry>
 * @param {object} opts — {seedPrefix, verseRef, mode}
 * @returns {Array} Segment[]
 */
export function applyFormLayer(verseText, words, grcTokens, alignment, dictByLexemeKey, opts = {}) {
  const { seedPrefix = '', mode = 3 } = opts;

  if (!grcTokens || grcTokens.length === 0 || !alignment || alignment.length === 0) {
    return [{ plain: verseText }];
  }

  // Build Greek token lookup by tokenId and by lexemeKey
  const grcTokenById = new Map();
  const grcTokenByLexemeKey = new Map();
  for (const t of grcTokens) {
    grcTokenById.set(t.id, t);
    if (t.lexemeKey) {
      if (!grcTokenByLexemeKey.has(t.lexemeKey)) grcTokenByLexemeKey.set(t.lexemeKey, []);
      grcTokenByLexemeKey.get(t.lexemeKey).push(t);
    }
  }

  // Build alignment lookup: span → pair (for fast lookup by word position)
  // Filter out u (uncertain) pairs
  const alignBySpanStart = new Map(); // start offset → pair
  for (const pair of alignment) {
    if (pair.q === 'u') continue; // NEVER show uncertain pairs
    alignBySpanStart.set(pair.span[0], pair);
  }

  // Cursor-based rendering
  const segments = [];
  let cursor = 0;
  let segmentCount = 0;

  for (const pair of alignment) {
    if (pair.q === 'u') continue;

    const [spanStart, spanEnd] = pair.span;

    // Plain text before this span
    if (cursor < spanStart) {
      const plain = verseText.slice(cursor, spanStart);
      if (plain.length > 0) {
        // Don't add plain-only space segments at the very beginning without content
        if (segmentCount === 0 && plain.trim() === '') {
          // Leading whitespace — skip
        } else if (plain.trim() === '' && segmentCount > 0) {
          segments.push({ plain });
          segmentCount++;
        } else {
          segments.push({ plain });
          segmentCount++;
        }
      }
      cursor = spanStart;
    }

    // The interactive word span
    const ruWord = verseText.slice(spanStart, spanEnd);

    // Find Greek token
    const grToken = grcTokenById.get(pair.tokenId);
    if (!grToken) {
      // Token not found in original pack — show as plain
      segments.push({ plain: ruWord });
      cursor = spanEnd;
      segmentCount++;
      continue;
    }

    const lexemeKey = pair.lexemeKey;
    const dictEntry = dictByLexemeKey.get(lexemeKey);

    if (!dictEntry) {
      // No dictionary entry for this lexemeKey — show as plain
      segments.push({ plain: ruWord });
      cursor = spanEnd;
      segmentCount++;
      continue;
    }

    // Apply replacement logic
    const seed = `${seedPrefix}:${lexemeKey}:${pair.tokenId}`;
    const pct = dictEntry.intensityPct ?? 100;
    const shouldReplace = dictEntry.status === 'known' || hash01(seed) * 100 < pct;

    if (shouldReplace) {
      // Determine what to display
      let display;
      const forms = dictEntry.forms || 'form'; // 'lemma' or 'form'

      if (mode === 5) {
        // Mode 5: always show original Greek (real form)
        display = grToken.s || grToken.lemma;
      } else if (forms === 'lemma') {
        display = grToken.lemma;
      } else {
        // Real surface form
        display = grToken.s;
      }

      // Capitalization: match Russian word's case
      const isUpper = ruWord.length > 0 && ruWord[0] === ruWord[0].toUpperCase();
      let greekText = display || grToken.s || '';
      if (isUpper && greekText.length > 0) {
        greekText = greekText[0].toUpperCase() + greekText.slice(1);
      }

      const seg = {
        greek: greekText,
        original: ruWord,
        kind: 'form',
        lexemeKey,
        lexemeId: pair.lexemeKey, // backward compat
        morph: grToken.morph,
        strong: grToken.strongs?.[0] || null,
        strongs: grToken.strongs || [],
        lemma: grToken.lemma,
        tokenId: pair.tokenId,
      };

      if (pair.q === 'f') seg.quality = 'f';

      segments.push(seg);
    } else {
      // Not replacing — show original Russian word
      segments.push({ plain: ruWord });
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
 * Build dictByLexemeKey map from word entries.
 * Each entry should have lexemeKey, intensityPct, status, forms, lemma.
 *
 * @param {Array} wordEntries — dictionary entries with lexemeKey
 * @returns {Map<lexemeKey, entry>}
 */
export function buildDictByLexemeKey(wordEntries) {
  const map = new Map();
  for (const entry of wordEntries) {
    const key = entry.lexemeKey || entry.lexemeId || entry.id;
    if (key) {
      map.set(key, entry);
    }
  }
  return map;
}
