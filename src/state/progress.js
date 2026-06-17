import { db } from '../storage/db.js';

const KEY = 'progress';

const DEFAULTS = {
  letters: {},
  reading: {
    lastBook: 'john',
    lastScroll: 0,
    books: {}
  },
  wordsToday: { date: '', added: [] }
};

/**
 * Загружает прогресс из IndexedDB.
 * @returns {Promise<object>}
 */
export async function loadProgress() {
  try {
    const data = await db.get(KEY);
    if (!data) return { ...DEFAULTS, letters: {}, reading: { ...DEFAULTS.reading, books: {} }, wordsToday: { date: '', added: [] } };
    // Мержим с дефолтами для обратной совместимости
    return {
      ...DEFAULTS,
      ...data,
      letters: { ...DEFAULTS.letters, ...(data.letters || {}) },
      reading: { ...DEFAULTS.reading, ...(data.reading || {}), books: { ...(data.reading?.books || {}) } },
      wordsToday: { ...DEFAULTS.wordsToday, ...(data.wordsToday || {}) }
    };
  } catch (e) {
    console.warn('loadProgress error:', e);
    return { ...DEFAULTS, letters: {}, reading: { ...DEFAULTS.reading, books: {} }, wordsToday: { date: '', added: [] } };
  }
}

/**
 * Сохраняет прогресс в IndexedDB (с дебаунсом — вызывается часто).
 * @param {object} progress
 */
export async function saveProgress(progress) {
  try {
    await db.set(KEY, progress);
    // Защита от вытеснения
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(granted => {
          if (granted) console.log('Storage persisted');
        });
      }
    } catch (_) { /* ignore */ }
  } catch (e) {
    console.warn('saveProgress error:', e);
  }
}

/**
 * Вводит следующие n букв по learnOrder.
 * @param {number} n
 * @param {object} progress
 * @param {Array} alphabet — массив букв из alphabet.json
 * @returns {{introduced: string[], progress: object}}
 */
export function introduceLetters(n, progress, alphabet) {
  const existing = new Set(Object.keys(progress.letters));
  const sorted = [...alphabet].sort((a, b) => a.learnOrder - b.learnOrder);
  const candidates = sorted.filter(l => !existing.has(l.lower));
  const toAdd = candidates.slice(0, n);

  const updated = { ...progress.letters };
  const today = new Date().toISOString().split('T')[0];
  for (const letter of toAdd) {
    updated[letter.lower] = { status: 'learning', introducedAt: today };
  }

  return {
    introduced: toAdd.map(l => l.lower),
    progress: { ...progress, letters: updated }
  };
}

/**
 * Отмечает букву как известную.
 * @param {string} ch — строчная греческая буква
 * @param {object} progress
 * @returns {object}
 */
export function markLetterKnown(ch, progress) {
  const letters = { ...progress.letters };
  letters[ch] = { ...(letters[ch] || {}), status: 'known' };
  return { ...progress, letters };
}

/**
 * Регистрирует новое слово в wordsToday (для экрана прогресса).
 * @param {string} lexemeId
 * @param {object} progress
 * @returns {object} обновлённый progress
 */
export function trackNewWord(lexemeId, progress) {
  const today = new Date().toISOString().split('T')[0];
  const wordsToday = progress.wordsToday?.date === today
    ? { ...progress.wordsToday }
    : { date: today, added: [] };
  if (!wordsToday.added.includes(lexemeId)) {
    wordsToday.added = [...wordsToday.added, lexemeId];
  }
  return { ...progress, wordsToday };
}
