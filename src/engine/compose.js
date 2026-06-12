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

  // Режим 4: формовый слой (если есть grc+align) → word-layer fallback → буквенный
  if (mode === 4) {
    if (grcVerse && alignment && grcVerse.tokens) {
      const dictEntries = wordEntries.map(e => ({
        ...e,
        strong: e.strongNum || null
      }));
      let segs = applyFormLayer(verseText, grcVerse.tokens, alignment, dictEntries, { seedPrefix });
      // Fallback для невыровненных слов словаря: применяем word-layer к plain-сегментам
      if (wordEntries.length > 0) {
        segs = applyWordToPlainSegments(segs, wordEntries, seedPrefix);
      }
      return applyLetterToPlain(segs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    // Fallback: word-layer
    if (wordEntries.length > 0) {
      const wordSegs = applyWordLayer(verseText, wordEntries, { seedPrefix });
      return applyLetterToPlain(wordSegs, activeLetters, intensity, seedPrefix, showDiacritics);
    }
    return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
  }

  // Режим 5: греческий основной — обработка на уровне reading.js
  // Безопасный fallback: показываем русский текст
  return [{ plain: verseText }];
}

/**
 * Применяет word-layer к plain-сегментам, сохраняя form-сегменты.
 * Детерминизм: seed использует позицию plain-текста от начала стиха.
 */
function applyWordToPlainSegments(segments, wordEntries, seedPrefix) {
  const result = [];
  let plainOffset = 0;

  for (const seg of segments) {
    if (seg.plain !== undefined) {
      const wordSegs = applyWordLayer(seg.plain, wordEntries, {
        seedPrefix: `${seedPrefix}:wp${plainOffset}`
      });
      result.push(...wordSegs);
      plainOffset += seg.plain.length;
    } else {
      result.push(seg);
    }
  }

  return result;
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
