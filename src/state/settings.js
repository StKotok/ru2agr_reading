import { db } from '../storage/db.js';

const KEY = 'settings';

export const COMPOSE_MODES = {
  LETTERS_ONLY: 1,
  WORD_LEMMA: 2,
  WORD_FORM: 3,
  GREEK_ORIGINAL: 4
};

/**
 * Adapter к текущему composeVerse(ctx.mode).
 * Не является пользовательским режимом и не сохраняется в settings.
 * @param {object} s — settings с полями readingMode, wordLayer
 * @param {number} activeWordCount — количество активных слов для word layer
 * @returns {number} один из COMPOSE_MODES
 */
export function deriveComposeMode(s, activeWordCount = 0) {
  if (s.readingMode === 'greek') return COMPOSE_MODES.GREEK_ORIGINAL;
  if (s.wordLayer === 'off') return COMPOSE_MODES.LETTERS_ONLY;
  if (activeWordCount === 0) return COMPOSE_MODES.LETTERS_ONLY;
  return s.wordLayer === 'form'
    ? COMPOSE_MODES.WORD_FORM
    : COMPOSE_MODES.WORD_LEMMA;
}

/**
 * Нужно ли загружать греческую книгу для текущего UI state.
 */
export function shouldLoadGreek(s, activeWordCount = 0) {
  return s.readingMode === 'greek' || (s.wordLayer !== 'off' && activeWordCount > 0);
}

const DEFAULTS = {
  intensity: 35,                // 0..100
  wordLayer: 'off',             // 'off' | 'lemma' | 'form'
  readingMode: 'mixed',         // 'mixed' | 'greek'
  lastActiveTab: 'mixed',       // 'mixed' | 'greek'
  newWordsPerChapter: 3,        // 1 | 3 | 5 | 10
  pauseNewToday: false,
  show: {
    diacritics: false,
    strongs: false,
    ruHint: true
  },
  theme: 'auto',
  onboarded: false
};

/**
 * Загружает настройки из IndexedDB.
 * @returns {Promise<object>}
 */
export async function loadSettings() {
  try {
    const data = await db.get(KEY);
    if (!data) return { ...DEFAULTS, show: { ...DEFAULTS.show } };
    return {
      ...DEFAULTS,
      ...data,
      show: { ...DEFAULTS.show, ...(data.show || {}) }
    };
  } catch (e) {
    console.warn('loadSettings error:', e);
    return { ...DEFAULTS, show: { ...DEFAULTS.show } };
  }
}

/**
 * Сохраняет настройки в IndexedDB.
 * @param {object} settings
 */
export async function saveSettings(settings) {
  try {
    await db.set(KEY, settings);
  } catch (e) {
    console.warn('saveSettings error:', e);
  }
}
