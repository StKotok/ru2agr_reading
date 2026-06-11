import { applyLetterLayer } from './letter-layer.js';

/**
 * Единая точка входа для UI: превращает стих в Segment[].
 *
 * @param {string} verseText — русский текст стиха
 * @param {object} ctx
 * @param {number} ctx.mode — 1..5
 * @param {number} ctx.intensity — 0..100
 * @param {object} ctx.progressLetters — { 'α': { status: 'learning'|'known' }, ... }
 * @param {string} ctx.seedPrefix — id книги (для детерминизма)
 * @param {object} [ctx.wordLayerOpts] — опции словарного слоя (будут добавлены в MVP 2)
 * @returns {Array<object>} Segment[]
 */
export function composeVerse(verseText, ctx = {}) {
  const { mode = 1, intensity = 35, progressLetters = {}, seedPrefix = '', wordLayerOpts } = ctx;

  // Собираем активные буквы
  const activeLetters = new Set();
  for (const [letter, data] of Object.entries(progressLetters)) {
    if (data.status === 'learning' || data.status === 'known') {
      activeLetters.add(letter);
    }
  }

  // Режимы 1–2: только буквенный слой
  if (mode === 1 || mode === 2) {
    return applyLetterLayer(verseText, {
      activeLetters,
      intensity,
      seedPrefix
    });
  }

  // Режимы 3+ будут добавлены в MVP 2/3
  // Пока заглушка: буквенный слой
  return applyLetterLayer(verseText, {
    activeLetters,
    intensity,
    seedPrefix
  });
}
