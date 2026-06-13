/**
 * Настройки отображения карточки слова.
 * Сохраняются в localStorage, индивидуальны для каждого пользователя.
 */

const STORAGE_KEY = 'ru2agr_card_display';

/** @type {Array<{key: string, label: string}>} */
export const CARD_SECTIONS = [
  { key: 'grammar',    label: 'грамматика и номер Стронга' },
  { key: 'pron',       label: 'произношение' },
  { key: 'inline',     label: 'перевод в этом стихе' },
  { key: 'senses',     label: 'также означает' },
  { key: 'definition', label: 'определение' },
  { key: 'derivation', label: 'происхождение' },
  { key: 'status',     label: 'статус (не помню / учу / знаю)' },
];

const DEFAULT_ORDER = CARD_SECTIONS.map(s => s.key);

const DEFAULTS = {
  inline: true,
  senses: true,
  definition: true,
  derivation: true,
  grammar: true,
  pron: true,
  status: true,
  order: DEFAULT_ORDER,
};

/** @returns {typeof DEFAULTS} */
export function loadCardSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Миграция: старые ключи meta/morph → grammar
      if (saved.order) {
        saved.order = saved.order.map(k => k === 'meta' || k === 'morph' ? 'grammar' : k);
        // Убрать дубликаты grammar после миграции
        saved.order = [...new Set(saved.order)];
      }
      if (!saved.order || saved.order.length === 0) {
        saved.order = DEFAULT_ORDER;
      }
      return { ...DEFAULTS, ...saved };
    }
  } catch {
    // corrupted data
  }
  return { ...DEFAULTS, order: [...DEFAULT_ORDER] };
}

/** @param {typeof DEFAULTS} settings */
export function saveCardSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage full or unavailable
  }
}
