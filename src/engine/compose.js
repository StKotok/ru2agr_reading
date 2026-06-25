import { applyLetterLayer } from './letter-layer.js';
import { applyFormLayer, buildDictByLexemeId } from './form-layer.js';
import { stripDiacritics } from './rules.js';

/**
 * Compose all layers for a BSB source verse.
 *
 * v2: alignment comes from a separate pack (loadAlignment),
 * not embedded in translation JSON. Words come from translation pack with frozen offsets.
 *
 * @param {string} verseText — BSB source verse text
 * @param {object} ctx
 *   mode, intensity, progressLetters, seedPrefix, showDiacritics
 *   words — frozen word tokens [{i, text, start, end}] from translation pack
 *   grcTokens — Greek tokens [{id, i, s, lemma, lexemeId, lexemeSlug, morph, strongs, fw}]
 *   alignment — alignment pairs [{span, tokenId, lexemeId, q, method}]
 *   wordEntries — dict entries with lexemeId
 */
export function composeVerse(verseText, ctx = {}) {
  const {
    mode = 1, intensity = 35, progressLetters = {}, seedPrefix = '',
    wordEntries = [], showDiacritics = true,
    words = null, grcTokens = null, alignment = null
  } = ctx;

  const activeLetters = new Set();
  for (const [letter, data] of Object.entries(progressLetters)) {
    if (data.status === 'learning' || data.status === 'known') {
      activeLetters.add(letter);
    }
  }

  // Mode 1: letter layer only
  if (mode === 1) {
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Modes 2–5: word/form layer with alignment
  if (mode >= 2 && mode <= 5) {
    if (grcTokens && alignment && words) {
      const dictByLexemeId = buildDictByLexemeId(wordEntries);
      const segs = applyFormLayer(verseText, words, grcTokens, alignment, dictByLexemeId, {
        seedPrefix, mode,
      });

      // Apply letter layer to plain segments only
      return applyLetterToPlain(segs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    // Fallback: no alignment data → letter layer
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Unknown mode — safe fallback
  return [{ plain: verseText }];
}

/**
 * Apply letter layer to plain segments within an already-composed form layer.
 */
function applyLetterToPlain(segments, activeLetters, intensity, seedPrefix, showDiacritics) {
  const result = [];
  let plainOffset = 0;
  for (const seg of segments) {
    if (seg.plain !== undefined) {
      const letterSegs = applyLetterLayer(seg.plain, {
        activeLetters, intensity, seedPrefix: `${seedPrefix}:${plainOffset}`
      });
      result.push(...letterSegs);
      plainOffset += seg.plain.length;
    } else {
      let greekText = seg.greek;
      if (!showDiacritics && (seg.kind === 'word' || seg.kind === 'form')) {
        greekText = stripDiacritics(greekText);
      }
      result.push({ ...seg, greek: greekText });
    }
  }
  return result;
}
