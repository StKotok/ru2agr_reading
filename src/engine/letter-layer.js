import { hash01 } from './hash.js';
import { getRules, isPunctuationOrSpace, finalSigma, preserveCase } from './rules.js';

/**
 * Применяет буквенный слой к тексту.
 * Заменяет русские буквы на греческие детерминированно:
 * hash01(seedPrefix + ':' + offset + ':' + rule.ru) * 100 < intensity
 *
 * @param {string} text — исходный текст
 * @param {object} opts
 * @param {Set<string>} opts.activeLetters — множество строчных греческих букв, доступных для замены
 * @param {number} opts.intensity — 0..100, доля заменяемых вхождений
 * @param {string} opts.seedPrefix — префикс для seed (например, id книги)
 * @returns {Array<{plain?: string, greek?: string, original?: string, kind?: string, letter?: string}>}
 */
export function applyLetterLayer(text, opts = {}) {
  const { activeLetters = new Set(), intensity = 0, seedPrefix = '' } = opts;
  const rules = getRules();
  const segments = [];
  let index = 0;

  while (index < text.length) {
    let matched = false;

    for (const rule of rules) {
      // Проверяем, активна ли греческая буква этого правила
      if (!activeLetters.has(rule.gr[0])) {
        continue;
      }

      let matchLen = 0;
      let original = '';

      if (rule.regex) {
        const part = text.substring(index);
        const match = new RegExp('^' + rule.ru, 'i').exec(part);
        if (match) {
          matchLen = match[0].length;
          original = match[0];
        }
      } else {
        const part = text.substring(index, index + rule.ru.length);
        if (part.toLowerCase() === rule.ru.toLowerCase()) {
          matchLen = rule.ru.length;
          original = part;
        }
      }

      if (matchLen > 0) {
        // Детерминированное решение о замене
        const seed = `${seedPrefix}:${index}:${rule.ru}`;
        const shouldReplace = hash01(seed) * 100 < intensity;

        if (shouldReplace) {
          let replacement = rule.gr;

          // Финальная сигма
          replacement = finalSigma(replacement, index, matchLen, text);

          // Сохранение регистра
          replacement = preserveCase(replacement, original);

          // Определяем, какая буква используется (строчная)
          const letter = rule.gr[0].toLowerCase();

          segments.push({
            greek: replacement,
            original,
            kind: 'letter',
            letter
          });
        } else {
          segments.push({ plain: original });
        }

        index += matchLen;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Берём следующий символ как plain
      const char = text[index];
      // Склеиваем соседние plain-сегменты
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
