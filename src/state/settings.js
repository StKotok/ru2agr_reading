import { db } from '../storage/db.js';

const KEY = 'settings';

const DEFAULTS = {
  mode: 1,                  // 1..5
  intensity: 35,            // 0..100
  newWordsPerChapter: 3,    // 1 | 3 | 5 | 10
  pauseNewToday: false,
  show: {
    translit: true,
    gloss: true,
    grammar: true,
    diacritics: false,
    strongs: false
  },
  theme: 'auto',            // 'light' | 'dark' | 'auto'
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
