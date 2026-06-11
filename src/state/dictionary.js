import { db } from '../storage/db.js';

const KEY = 'dictionary';

/**
 * Загружает словарь пользователя.
 * @returns {Promise<object>}
 */
export async function loadDictionary() {
  try {
    const data = await db.get(KEY);
    return data || {};
  } catch (e) {
    console.warn('loadDictionary error:', e);
    return {};
  }
}

/**
 * Сохраняет словарь.
 * @param {object} dict
 */
export async function saveDictionary(dict) {
  try {
    await db.set(KEY, dict);
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
    forms: 'lemma',
    addedAt: new Date().toISOString().split('T')[0]
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
    updated[id] = { ...updated[id], [key]: value };
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
    .filter(([_, e]) => e.showInText !== false)
    .map(([id, e]) => ({ lexemeId: id, ...e }));
}
