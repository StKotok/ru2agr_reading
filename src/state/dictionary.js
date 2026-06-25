import { db } from '../storage/db.js';

const KEY = 'dictionary';
const WARNINGS_KEY = 'dictionary_migration_warnings';

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
 * Build legacy key map from core lexicon.
 * Returns Map<legacyKey, lexemeId> (only unambiguous keys).
 */
function buildLegacyKeyMap(coreLexicon) {
  const map = new Map();
  const conflicts = new Set();
  for (const item of coreLexicon) {
    const keys = [
      ...(item.legacyKeys || []),
      item.lexemeSlug,
      item.lexemeKey
    ].filter(Boolean);
    for (const k of keys) {
      if (map.has(k) && map.get(k) !== item.lexemeId) {
        conflicts.add(k);
      } else {
        map.set(k, item.lexemeId);
      }
    }
  }
  for (const k of conflicts) map.delete(k);
  return map;
}

function parseStoredTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeDictionaryEntry(existing, incoming) {
  const statusOrder = { known: 3, learning: 2, new: 1 };
  const existingTime = parseStoredTimestamp(existing.updatedAt || existing.addedAt);
  const incomingTime = parseStoredTimestamp(incoming.updatedAt || incoming.addedAt);

  const fresher = incomingTime > existingTime ? incoming : existing;
  const strongerStatus = (statusOrder[incoming.status] || 0) > (statusOrder[existing.status] || 0)
    ? incoming.status
    : existing.status;

  return {
    ...existing,
    ...incoming,
    ...fresher,
    status: incomingTime !== existingTime ? fresher.status : strongerStatus,
    showInText: existing.showInText === false || incoming.showInText === false ? false : fresher.showInText,
    addedAt: [existing.addedAt, incoming.addedAt]
      .filter(Boolean)
      .sort((a, b) => parseStoredTimestamp(a) - parseStoredTimestamp(b))[0] || fresher.addedAt
  };
}

/**
 * Migrate dictionary keys from legacy (slug, freq-*) to canonical lexemeId.
 * Idempotent — safe to call multiple times.
 * @param {object} dict — current dictionary
 * @param {object} progress — current progress
 * @param {Array} coreLexicon — core lexicon items
 * @returns {{ dictionary: object, progress: object, warnings: Array }}
 */
export function migrateDictionaryData(dict, progress, coreLexicon) {
  const legacyKeyMap = buildLegacyKeyMap(coreLexicon);
  const knownLexemeIds = new Set(coreLexicon.map(i => i.lexemeId).filter(Boolean));
  const nextDict = {};
  const warnings = [];

  for (const [key, entry] of Object.entries(dict)) {
    if (!isDictionaryEntry(entry)) continue;
    const newKey = knownLexemeIds.has(key) ? key : legacyKeyMap.get(key);
    if (newKey) {
      nextDict[newKey] = nextDict[newKey]
        ? mergeDictionaryEntry(nextDict[newKey], entry)
        : { ...entry };
    } else {
      nextDict[key] = { ...entry, _legacy: true };
      warnings.push({ key, reason: 'no-safe-mapping' });
    }
  }

  const wordsToday = progress.wordsToday || { date: '', added: [] };
  const added = (wordsToday.added || []).map(key => legacyKeyMap.get(key) || key);
  const nextProgress = {
    ...progress,
    wordsToday: { ...wordsToday, added: [...new Set(added)] }
  };

  return { dictionary: nextDict, progress: nextProgress, warnings };
}

/**
 * Persist migration results fail-soft.
 * @param {object} migrated — result from migrateDictionaryData
 */
export async function saveMigrationResults(migrated) {
  try {
    await db.set(KEY, sanitizeDictionary(migrated.dictionary));
    await db.set('progress', migrated.progress);
    if (migrated.warnings.length > 0) {
      await db.set(WARNINGS_KEY, migrated.warnings);
      console.warn('dictionary migration warnings:', migrated.warnings.length);
    }
  } catch (e) {
    console.warn('saveMigrationResults error:', e);
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
  const coreById = new Map(coreLexicon
    .map(l => [l.lexemeId || l.id, l])
    .filter(([key]) => key));
  const coreByLegacyKey = new Map(coreLexicon.flatMap(l =>
    [l.lexemeKey, l.lexemeSlug, ...(l.legacyKeys || [])]
      .filter(Boolean)
      .map(k => [k, l])
  ));
  let c = 0;
  for (const [id, entry] of Object.entries(dict)) {
    if (!isDictionaryEntry(entry)) continue;
    if (entry.showInText === false) continue;
    if (entry.status !== 'new' && entry.status !== 'learning' && entry.status !== 'known') continue;
    if (coreById.get(id) || coreByLegacyKey.get(id)) { c++; continue; }
    // freq-* fallback
    const strongKey = id.startsWith('freq-') ? id.replace('freq-', '') : null;
    if (strongKey) {
      const freqItem = (frequencyList || []).find(f =>
        (f.strong && String(f.strong) === strongKey) || String(f.lexemeKey) === strongKey
      );
      if (freqItem) { c++; }
    }
  }
  return c;
}
