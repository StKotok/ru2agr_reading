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

// === 12 тем из дизайн-прототипа ===

export const THEMES = [
  'pergament', 'sepia', 'ivory', 'fog', 'sea',
  'forest', 'rose', 'lavender', 'sunset',
  'dark', 'night', 'coal',
];

export const LIGHT_THEMES = ['pergament', 'sepia', 'ivory', 'fog', 'sea', 'forest', 'rose', 'lavender', 'sunset'];
export const DARK_THEMES = ['dark', 'night', 'coal'];

export const IS_DARK_THEME = Object.fromEntries([
  ...LIGHT_THEMES.map(t => [t, false]),
  ...DARK_THEMES.map(t => [t, true]),
]);

export const DEFAULT_THEME = 'pergament';

// === Контраст ===

export const CONTRAST_LEVELS = ['soft', 'sharp', 'maximum'];
export const CONTRAST_LABELS = { soft: 'Мягкий', sharp: 'Чёткий', maximum: 'Максимальный' };
export const DEFAULT_CONTRAST = 'sharp'; // прототип по умолчанию: Чёткий

// === Настройки по умолчанию ===

const DEFAULTS = {
  intensity: 35,                // 0..100
  wordLayer: 'off',             // 'off' | 'lemma' | 'form'
  readingMode: 'mixed',         // 'mixed' | 'greek'
  newWordsPerChapter: 3,        // 1 | 3 | 5 | 10
  pauseNewToday: false,
  show: {
    diacritics: false,
    strongs: false,
    ruHint: true
  },
  theme: 'auto',                // 'auto' | один из THEMES
  contrast: DEFAULT_CONTRAST,   // 'soft' | 'sharp' | 'maximum'
  onboarded: false,
  dismissedNotices: []
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

// === Общая логика темы (используется app.js и settings screen) ===

/** Карта theme → surface-цвет (для meta theme-color). */
export const SURFACE_COLORS = {
  light: '#efeee9',
  dark: '#1E1E1E',
  // 12-theme surface colors for theme-color meta
  pergament: '#ECE7DD',
  sepia: '#E9DFC8',
  ivory: '#FAF8F3',
  fog: '#E8E8EB',
  sea: '#E2ECF0',
  forest: '#E6EADD',
  rose: '#F1E4E1',
  lavender: '#E9E5F0',
  sunset: '#F0E2D4',
  night: '#1b2230',
  coal: '#1f1f21'
};

/** @returns {MediaQueryList} */
export function getIS_DARK_OS() {
  return window.matchMedia('(prefers-color-scheme: dark)');
}

/**
 * Разрешает 'auto' → тему по умолчанию для OS-темы.
 * auto + светлая OS → pergament
 * auto + тёмная OS  → dark
 * @param {string} theme — 'auto' или одно из значений THEMES
 * @returns {string} одно из значений THEMES
 */
export function resolveEffectiveTheme(theme) {
  if (theme === 'auto') {
    return getIS_DARK_OS().matches ? 'dark' : DEFAULT_THEME;
  }
  return THEMES.includes(theme) ? theme : DEFAULT_THEME;
}

/**
 * Применяет тему к DOM: data-theme, theme-color meta, localStorage.
 * @param {string} theme — 'auto' или одно из значений THEMES
 */
export function applyTheme(theme) {
  const resolved = resolveEffectiveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
  // Кэш для мгновенного применения при следующей загрузке (FOUC-защита)
  localStorage.setItem('theme', theme);
  // Динамический theme-color для мобильного браузерного chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', SURFACE_COLORS[resolved] || SURFACE_COLORS.light);
  }
}

/**
 * Применяет уровень контраста к DOM.
 * @param {string} level — 'soft' | 'sharp' | 'maximum'
 */
export function applyContrast(level) {
  const contrast = CONTRAST_LEVELS.includes(level) ? level : DEFAULT_CONTRAST;
  document.documentElement.setAttribute('data-contrast', contrast);
  localStorage.setItem('contrast', contrast);
}

/**
 * Реакция на изменение системной темы в режиме auto.
 * Вызвать один раз при старте для регистрации слушателя.
 */
export function listenForOSThemeChanges() {
  getIS_DARK_OS().addEventListener('change', () => {
    const current = localStorage.getItem('theme');
    if (current === 'auto') applyTheme('auto');
  });
}
