import { applyLetterLayer } from './letter-layer.js';
import { applyFormLayer } from './form-layer.js';
import { stripDiacritics } from './rules.js';

export function composeVerse(verseText, ctx = {}) {
  const {
    mode = 2, intensity = 35, progressLetters = {}, seedPrefix = '',
    wordEntries = [], showDiacritics = true,
    grcVerse = null, alignment = null
  } = ctx;

  const activeLetters = new Set();
  for (const [letter, data] of Object.entries(progressLetters)) {
    if (data.status === 'learning' || data.status === 'known') {
      activeLetters.add(letter);
    }
  }

  // Режим 2: только буквенный слой
  if (mode === 2) {
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 3: словарный слой по выравниванию (леммы) + буквенный.
  // Без выравнивания словарных замен нет: точность важнее покрытия.
  if (mode === 3) {
    if (grcVerse && alignment && grcVerse.tokens) {
      const lemmaEntries = wordEntries.map(e => ({
        ...e,
        strong: e.strongNum || null,
        forms: 'lemma'
      }));
      const segs = applyFormLayer(verseText, grcVerse.tokens, alignment, lemmaEntries, { seedPrefix });
      return applyLetterToPlain(segs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 4: формовый слой по выравниванию + буквенный.
  // Без выравнивания словарных замен нет: точность важнее покрытия.
  if (mode === 4) {
    if (grcVerse && alignment && grcVerse.tokens) {
      const dictEntries = wordEntries.map(e => ({
        ...e,
        strong: e.strongNum || null
      }));
      const segs = applyFormLayer(verseText, grcVerse.tokens, alignment, dictEntries, { seedPrefix });
      return applyLetterToPlain(segs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 5: греческий основной — обработка на уровне reading.js
  // Безопасный fallback: показываем русский текст
  return [{ plain: verseText }];
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
