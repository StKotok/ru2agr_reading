import { hash01 } from './hash.js';

/**
 * Применяет словарный слой: заменяет русские слова на греческие леммы.
 *
 * @param {string} text — исходный русский текст стиха
 * @param {Array} entries — активные записи словаря: [{lexemeId, lemma, regexps, exclude, intensityPct, status}]
 * @param {object} opts
 * @param {string} opts.seedPrefix — id книги
 * @returns {Array} Segment[]
 */
export function applyWordLayer(text, entries, opts = {}) {
  const { seedPrefix = '' } = opts;
  const segments = [];
  let index = 0;

  while (index < text.length) {
    let bestMatch = null;
    let bestMatchLen = 0;

    // Ищем самое раннее совпадение среди всех записей
    for (const entry of entries) {
      const re = entry.regexps;
      // Устанавливаем lastIndex вручную
      for (const regex of re) {
        regex.lastIndex = 0;
        const part = text.substring(index);
        const match = regex.exec(part);
        if (match && match.index === 0) {
          const matchedText = match[0];

          // Проверяем exclude
          let excluded = false;
          for (const excRe of entry.excludeRegexps) {
            excRe.lastIndex = 0;
            if (excRe.test(matchedText)) {
              excluded = true;
              break;
            }
          }
          if (excluded) continue;

          if (matchedText.length > bestMatchLen) {
            bestMatch = { entry, matchedText };
            bestMatchLen = matchedText.length;
          }
          break;
        }
      }
    }

    if (bestMatch) {
      const { entry, matchedText } = bestMatch;
      const { lexemeId, lemma, intensityPct, status } = entry;

      // Решаем, заменять ли
      const seed = `${seedPrefix}:${index}:${lexemeId}`;
      let shouldReplace = hash01(seed) * 100 < intensityPct;
      if (status === 'known') shouldReplace = true;

      if (shouldReplace) {
        // Сохраняем регистр первой буквы
        const isUpper = matchedText[0] === matchedText[0].toUpperCase();
        let display = lemma;
        if (isUpper && display.length > 0) {
          display = display[0].toUpperCase() + display.slice(1);
        }

        segments.push({
          greek: display,
          original: matchedText,
          kind: 'word',
          lexemeId
        });
      } else {
        segments.push({ plain: matchedText });
      }

      index += bestMatchLen;
    } else {
      const char = text[index];
      const last = segments[segments.length - 1];
      if (last && last.plain !== undefined) {
        last.plain += char;
      } else {
        segments.push({ plain: char });
      }
      index++;
    }
  }

  return segments;
}
