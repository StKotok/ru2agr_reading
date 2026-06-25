/**
 * Правила буквенных замен: исходный алфавит → греческий.
 *
 * Два словаря: кириллица (русский текст) и латиница (английский BSB и др.).
 * Диграфы сортируются раньше одиночных букв — первое совпадение побеждает.
 */

// =============================================================================
// Кириллица → греческий (русский Синодальный и другие славянские переводы)
// =============================================================================

const RULES_CYRILLIC = [
  // Диграфы
  { ru: 'кс', gr: 'ξ' },
  { ru: 'пс', gr: 'ψ' },
  { ru: 'тх', gr: 'θ' },
  { ru: 'дж', gr: 'τζ' },
  { ru: 'йо', gr: 'ιο' },
  { ru: 'иян', gr: 'ιαν' },
  { ru: 'ия', gr: 'ια' },
  { ru: 'ai', gr: 'αι' },
  { ru: 'ei', gr: 'ει' },
  { ru: 'oi', gr: 'οι' },
  { ru: 'ou', gr: 'ου' },
  { ru: 'eu', gr: 'ευ' },
  { ru: 'au', gr: 'αυ' },
  { ru: 'я', gr: 'ια' },
  { ru: 'ю', gr: 'ιυ' },
  { ru: 'ё', gr: 'ιο' },

  // Контекстная замена: г → γ перед е/и
  { ru: 'г(?=[еи])', gr: 'γ', regex: true },

  // Одиночные буквы
  { ru: 'ф', gr: 'φ' },
  { ru: 'т', gr: 'τ' },
  { ru: 'п', gr: 'π' },
  { ru: 'з', gr: 'ζ' },
  { ru: 'г', gr: 'γ' },
  { ru: 'х', gr: 'χ' },
  { ru: 'в', gr: 'β' },
  { ru: 'д', gr: 'δ' },
  { ru: 'к', gr: 'κ' },
  { ru: 'л', gr: 'λ' },
  { ru: 'м', gr: 'μ' },
  { ru: 'н', gr: 'ν' },
  { ru: 'р', gr: 'ρ' },
  { ru: 'с', gr: 'σ' },
  { ru: 'у', gr: 'υ' },
  { ru: 'а', gr: 'α' },
  { ru: 'е', gr: 'ε' },
  { ru: 'и', gr: 'ι' },
  { ru: 'о', gr: 'ο' },
  { ru: 'э', gr: 'η' },
  { ru: 'й', gr: 'ι' },
];

// =============================================================================
// Латиница → греческий (английский BSB и другие западные переводы)
// =============================================================================

const RULES_LATIN = [
  // Диграфы
  { ru: 'th', gr: 'θ' },
  { ru: 'ph', gr: 'φ' },
  { ru: 'ch', gr: 'χ' },
  { ru: 'ps', gr: 'ψ' },
  { ru: 'ai', gr: 'αι' },
  { ru: 'ei', gr: 'ει' },
  { ru: 'oi', gr: 'οι' },
  { ru: 'ou', gr: 'ου' },
  { ru: 'eu', gr: 'ευ' },
  { ru: 'au', gr: 'αυ' },

  // Одиночные буквы
  { ru: 'f', gr: 'φ' },
  { ru: 't', gr: 'τ' },
  { ru: 'p', gr: 'π' },
  { ru: 'k', gr: 'κ' },
  { ru: 'b', gr: 'β' },
  { ru: 'd', gr: 'δ' },
  { ru: 'g', gr: 'γ' },
  { ru: 'v', gr: 'β' },
  { ru: 'z', gr: 'ζ' },
  { ru: 'x', gr: 'ξ' },
  { ru: 'l', gr: 'λ' },
  { ru: 'm', gr: 'μ' },
  { ru: 'n', gr: 'ν' },
  { ru: 'r', gr: 'ρ' },
  { ru: 's', gr: 'σ' },
  { ru: 'a', gr: 'α' },
  { ru: 'e', gr: 'ε' },
  { ru: 'i', gr: 'ι' },
  { ru: 'o', gr: 'ο' },
  { ru: 'u', gr: 'υ' },
  { ru: 'y', gr: 'υ' },
  { ru: 'w', gr: 'ω' },
];

/**
 * Возвращает список правил замены для указанного алфавита.
 * @param {'cyrillic'|'latin'} script
 * @returns {Array<{ru: string, gr: string, regex?: boolean}>}
 */
export function getRules(script = 'latin') {
  return script === 'cyrillic' ? RULES_CYRILLIC : RULES_LATIN;
}

/**
 * Проверяет, является ли символ пунктуацией, пробелом или концом строки.
 * @param {string|null|undefined} char
 * @returns {boolean}
 */
export function isPunctuationOrSpace(char) {
  if (!char) return true;
  return /[\s.,!?;:()\[\]{}"'\-]/.test(char);
}

/**
 * Применяет правило финальной сигмы: σ → ς перед пробелом/пунктуацией/концом
 * или в конце строки.
 * @param {string} text — текст для проверки
 * @param {number} pos — позиция заменённой сигмы в тексте
 * @param {number} len — длина заменённого фрагмента
 * @param {string} original — исходная строка (весь текст)
 * @returns {string} — σ или ς
 */
export function finalSigma(text, pos, len, original) {
  if (text !== 'σ') return text;
  const nextChar = original[pos + len];
  if (nextChar === undefined || isPunctuationOrSpace(nextChar)) {
    return 'ς';
  }
  return 'σ';
}

/**
 * Сохраняет регистр оригинала в замене.
 * @param {string} replacement — греческая замена (нижний регистр)
 * @param {string} original — оригинальный фрагмент
 * @returns {string}
 */
export function preserveCase(replacement, original) {
  const isLetter = /\p{L}/u.test(original[0]);
  if (!isLetter) return replacement;

  const isUpper = original[0] === original[0].toUpperCase();
  const isAllUpper = original.toUpperCase() === original && original.length > 1;

  if (isAllUpper) {
    return replacement.toUpperCase();
  }
  if (isUpper) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Удаляет диакритику с греческого текста, сохраняя различие σ/ς.
 * Использует NFD-декомпозицию и удаление combining marks (категория Mn).
 * @param {string} s
 * @returns {string}
 */
export function stripDiacritics(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ς/g, 'σ')
    .replace(/σ$/, 'ς');
}
