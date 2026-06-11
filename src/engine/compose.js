import { applyLetterLayer } from './letter-layer.js';
import { applyWordLayer } from './word-layer.js';
import { applyFormLayer } from './form-layer.js';
import { stripDiacritics } from './rules.js';

export function composeVerse(verseText, ctx = {}) {
  const {
    mode = 1, intensity = 35, progressLetters = {}, seedPrefix = '',
    wordEntries = [], showDiacritics = true,
    grcVerse = null, alignment = null
  } = ctx;

  const activeLetters = new Set();
  for (const [letter, data] of Object.entries(progressLetters)) {
    if (data.status === 'learning' || data.status === 'known') {
      activeLetters.add(letter);
    }
  }

  // Режимы 1–2: только буквенный слой
  if (mode === 1 || mode === 2) {
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 3: словарный слой + буквенный
  if (mode === 3) {
    if (wordEntries.length > 0) {
      const wordSegs = applyWordLayer(verseText, wordEntries, { seedPrefix });
      return applyLetterToPlain(wordSegs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 4: формовый слой (если есть grc+align) → буквенный
  if (mode === 4) {
    if (grcVerse && alignment && grcVerse.tokens) {
      const dictEntries = wordEntries.map(e => ({
        ...e,
        strong: e.strongNum || null
      }));
      const formSegs = applyFormLayer(verseText, grcVerse.tokens, alignment, dictEntries, { seedPrefix });
      return applyLetterToPlain(formSegs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    // Fallback: word-layer
    if (wordEntries.length > 0) {
      const wordSegs = applyWordLayer(verseText, wordEntries, { seedPrefix });
      return applyLetterToPlain(wordSegs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 5: греческий основной — обработка на уровне reading.js
  return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
}

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
