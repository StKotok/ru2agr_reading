import { applyLetterLayer } from './letter-layer.js';
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

  // Режим 1: только буквенный слой
  if (mode === 1) {
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 2: словарный слой по выравниванию (леммы) + буквенный.
  // Без выравнивания словарных замен нет: точность важнее покрытия.
  if (mode === 2) {
    if (grcVerse && alignment && grcVerse.tokens) {
      const entriesForForm = wordEntries.map(e => ({
        ...e,
        strong: e.strongNum || null
        // forms берётся из entry.forms как есть (может быть 'form' если per-word override)
      }));
      const segs = applyFormLayer(verseText, grcVerse.tokens, alignment, entriesForForm, { seedPrefix });
      return applyLetterToPlain(segs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 3: формовый слой по выравниванию + буквенный.
  // Без выравнивания словарных замен нет: точность важнее покрытия.
  if (mode === 3) {
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

  // Режим 4: греческий основной — обработка на уровне reading.js
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
