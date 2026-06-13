/**
 * Настройки отображения карточки слова.
 * Сохраняются в localStorage, индивидуальны для каждого пользователя.
 */

const STORAGE_KEY = 'ru2agr_card_display';

const DEFAULTS = {
  inline: true,      // перевод в этом стихе
  senses: true,      // также означает
  definition: true,  // определение
  derivation: true,  // происхождение
  meta: true,        // часть речи + номер Стронга
  pron: true,        // произношение (транслитерация / strong's)
  morph: true,       // морфология
  status: true,      // учебный статус (не помню / учу / знаю)
};

/** @returns {typeof DEFAULTS} */
export function loadCardSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...DEFAULTS, ...saved };
    }
  } catch {
    // corrupted data — fall through to defaults
  }
  return { ...DEFAULTS };
}

/** @param {typeof DEFAULTS} settings */
export function saveCardSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export const CARD_SECTIONS = [
  { key: 'meta',       label: 'часть речи и номер Стронга' },
  { key: 'pron',       label: 'произношение' },
  { key: 'inline',     label: 'перевод в этом стихе' },
  { key: 'senses',     label: 'также означает' },
  { key: 'definition', label: 'определение' },
  { key: 'derivation', label: 'происхождение' },
  { key: 'morph',      label: 'морфология' },
  { key: 'status',     label: 'статус (не помню / учу / знаю)' },
];
