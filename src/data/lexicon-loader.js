/**
 * Lexicon loader — v2.
 * Loads core.json (5468 lexemes) + dictionary.json (Strong's).
 * Each record has lexemeId (canonical) and lexemeSlug (display fallback).
 */

let coreCache = null;
let dictCache = null;

/**
 * Load core lexicon (5468 lexemes).
 * Adapts for UI: id = lexemeId, lexemeKey = lexemeSlug.
 * @returns {Promise<Array|null>}
 */
export async function loadCoreLexicon() {
  if (coreCache) return coreCache;
  try {
    const res = await fetch('./data/lexicon/core.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Adapt: add id/lexemeKey for UI backward compatibility
    coreCache = (data.items || []).map(item => ({
      ...item,
      id: item.lexemeId,
      lexemeKey: item.lexemeSlug || item.lexemeKey
    }));
    return coreCache;
  } catch (e) {
    console.warn('loadCoreLexicon error:', e);
    return null;
  }
}

/**
 * Load Strong's dictionary.
 * @returns {Promise<Map<string, object>|null>}
 */
export async function loadDictionary() {
  if (dictCache) return dictCache;
  try {
    const res = await fetch('./data/lexicon/dictionary.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    dictCache = await res.json();
    return dictCache;
  } catch (e) {
    console.warn('loadDictionary error:', e);
    return null;
  }
}

/**
 * Load frequency data from core lexicon.
 * @returns {Promise<Array|null>}
 */
export async function loadFrequency() {
  try {
    const core = await loadCoreLexicon();
    if (!core) return null;
    return core.map(item => ({
      lexemeId: item.lexemeId,
      lexemeKey: item.lexemeKey || item.lexemeSlug,
      lemma: item.lemma,
      transliteration: item.translit,
      tokenCount: item.freqTokenCount,
      verseCount: item.freqVerseCount,
      rank: item.freqRank,
      strong: item.strongs,
      pos: item.pos,
      glossesEn: item.glossesBerean || [],
      isFunctionWord: item.isFunctionWord,
      firstRef: item.allRefs?.[0] || null,
    }));
  } catch (e) {
    console.warn('loadFrequency error:', e);
    return null;
  }
}
