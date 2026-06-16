import { db } from '../storage/db.js';

const KEY = 'dictionary';

/**
 * Загружает словарь пользователя (без миграций — пользователей нет).
 * Санирует данные: удаляет metadata-подобные ключи.
 * @returns {Promise<object>}
 */
export async function loadDictionary() {
  try {
    const data = await db.get(KEY);
    if (!data) return {};
    return sanitizeDictionary(data);
  } catch (e) {
    console.warn('loadDictionary error:', e);
    return {};
  }
}

/**
 * Чистый предикат: является ли значение настоящей словарной записью.
 * Возвращает true только для не-null, не-массив объектов.
 * @param {*} entry
 * @returns {boolean}
 */
export function isDictionaryEntry(entry) {
  return entry !== null && typeof entry === 'object' && !Array.isArray(entry);
}

/**
 * Санирует загруженный словарь: копирует только записи, проходящие isDictionaryEntry.
 * Не пишет обратно в IndexedDB и не добавляет метаданные схемы.
 * @param {*} data
 * @returns {object}
 */
export function sanitizeDictionary(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (isDictionaryEntry(value)) {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Сохраняет словарь.
 * @param {object} dict
 */
export async function saveDictionary(dict) {
  try {
    await db.set(KEY, sanitizeDictionary(dict));
  } catch (e) {
    console.warn('saveDictionary error:', e);
  }
}

/**
 * Добавляет слово в словарь.
 * @param {string} id — lexemeId
 * @param {object} dict
 * @returns {object} обновлённый словарь
 */
export function addWord(id, dict) {
  const updated = { ...dict };
  updated[id] = {
    status: 'new',
    showInText: true,
    intensity: 'often',
    addedAt: new Date().toISOString().split('T')[0]
    // forms не задаётся — глобальный wordLayer действует как значение по умолчанию
  };
  return updated;
}

/**
 * Устанавливает статус слова.
 */
export function setWordStatus(id, status, dict) {
  const updated = { ...dict };
  if (updated[id]) {
    updated[id] = { ...updated[id], status };
  }
  return updated;
}

/**
 * Устанавливает настройку слова.
 */
export function setWordSetting(id, key, value, dict) {
  const updated = { ...dict };
  if (updated[id]) {
    const entry = { ...updated[id] };
    if (value === undefined) delete entry[key];
    else entry[key] = value;
    updated[id] = entry;
  }
  return updated;
}

/**
 * Возвращает активные записи словаря (showInText !== false).
 * @param {object} dict
 * @returns {Array<{lexemeId: string, ...}>}
 */
export function getActive(dict) {
  return Object.entries(dict)
    .filter(([_, e]) => isDictionaryEntry(e) && e.showInText !== false)
    .map(([id, e]) => ({ lexemeId: id, ...e }));
}

/**
 * Считает активные слова, проходящие фильтр для замены в тексте.
 * Единая реализация для reading.js и mode-widget.
 * @param {object} dict — словарь
 * @param {Array} coreLexicon — массив записей лексикона
 * @param {Array|null} frequencyList — частотный список
 * @returns {number}
 */
export function countActiveWords(dict, coreLexicon, frequencyList) {
  if (!dict || !coreLexicon) return 0;
  const coreById = new Map(coreLexicon.map(l => [l.id, l]));
  const freqByStrong = new Map();
  if (frequencyList) {
    for (const item of frequencyList) freqByStrong.set(String(item.strong), item);
  }
  let c = 0;
  for (const [id, entry] of Object.entries(dict)) {
    if (!isDictionaryEntry(entry)) continue;
    if (entry.showInText === false) continue;
    if (entry.status !== 'new' && entry.status !== 'learning' && entry.status !== 'known') continue;
    const coreEntry = coreById.get(id);
    if (coreEntry) { c++; continue; }
    const strongKey = id.startsWith('freq-') ? id.replace('freq-', '') : null;
    if (strongKey && freqByStrong.get(strongKey)) { c++; }
  }
  return c;
}
