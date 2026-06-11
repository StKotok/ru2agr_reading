import { applyLetterLayer } from './letter-layer.js';
import { applyWordLayer } from './word-layer.js';
import { stripDiacritics } from './rules.js';

/**
 * Единая точка входа для UI: превращает стих в Segment[].
 */
export function composeVerse(verseText, ctx = {}) {
  const {
    mode = 1,
    intensity = 35,
    progressLetters = {},
    seedPrefix = '',
    wordEntries = [],    // [{lexemeId, lemma, regexps, excludeRegexps, intensityPct, status}]
    showDiacritics = true
  } = ctx;

  // Собираем активные буквы
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

  // Режим 3+: словарный слой, затем буквенный слой на оставшемся plain-тексте
  if (mode >= 3 && wordEntries.length > 0) {
    const wordSegments = applyWordLayer(verseText, wordEntries, { seedPrefix });

    // Применяем буквенный слой к plain-сегментам
    const result = [];
    let plainOffset = 0;
    for (const seg of wordSegments) {
      if (seg.plain !== undefined) {
        const letterSegments = applyLetterLayer(seg.plain, {
          activeLetters,
          intensity,
          seedPrefix: `${seedPrefix}:${plainOffset}`
        });
        result.push(...letterSegments);
        plainOffset += seg.plain.length;
      } else {
        // Применяем диакритику если нужно
        let greekText = seg.greek;
        if (!showDiacritics && seg.kind === 'word') {
          greekText = stripDiacritics(greekText);
        }
        result.push({ ...seg, greek: greekText });
      }
    }
    return result;
  }

  // Режим 3 без слов в словаре — только буквы
  return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
}
