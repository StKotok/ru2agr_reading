import { db } from '../storage/db.js';

const KEY = 'settings';

export const DEFAULT_MODE = 1;

export const MODES = [
  { id: 1, label: '1. Буквы + подсказки', group: 'Учебный мостик' },
  { id: 2, label: '2. Слова из словаря', group: 'Учебный мостик' },
  { id: 3, label: '3. Формы оригинала', group: 'Ближе к оригиналу' },
  { id: 4, label: '4. Почти оригинал', group: 'Ближе к оригиналу' },
];

const DEFAULTS = {
  mode: DEFAULT_MODE,         // 1..4
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
