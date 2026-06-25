/**
 * Lexicon loader — v2.
 * Loads core.json (5468 lexemes) + dictionary.json (Strong's).
 * Each record has lexemeId (canonical) and lexemeSlug (display fallback).
 */

let coreCache = null;
let dictCache = null;
let alignedLexemesCache = null;

/**
 * Get cache-busting version from data manifest.
 * @returns {Promise<string>}
 */
async function getVersion() {
  try {
    const res = await fetch('./data/data-manifest.json', { cache: 'no-cache' });
    if (!res.ok) return '2.0.0';
    const m = await res.json();
    return m?.version || '2.0.0';
  } catch (_) {
    return '2.0.0';
  }
}

/**
 * Load core lexicon (5468 lexemes).
 * Adapts for UI: id = lexemeId, lexemeKey = lexemeSlug.
 * @returns {Promise<Array|null>}
 */
export async function loadCoreLexicon() {
  if (coreCache) return coreCache;
  try {
    const v = await getVersion();
    const res = await fetch(`./data/lexicon/core.json?v=${v}`);
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
 * Load aligned lexemes index (Set of lexemeIds with ≥1 aligned pair q=a|f).
 * @returns {Promise<Set<string>|null>}
 */
export async function loadAlignedLexemes() {
  if (alignedLexemesCache) return alignedLexemesCache;
  try {
    const v = await getVersion();
    const res = await fetch(`./data/align/grc-eng/aligned-lexemes.json?v=${v}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    alignedLexemesCache = new Set(data.lexemeIds || []);
    return alignedLexemesCache;
  } catch (e) {
    console.warn('loadAlignedLexemes error:', e);
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
    const alignedLexemes = await loadAlignedLexemes();
    if (!core) return null;
    return core
      .map(item => ({
        lexemeId: item.lexemeId,
        lexemeKey: item.lexemeKey || item.lexemeSlug,
        lemma: item.lemma,
        transliteration: item.translit,
        count: item.freqTokenCount,
        verseCount: item.freqVerseCount,
        rank: item.freqRank,
        strong: item.strongs?.[0] || null,
        pos: item.pos,
        glossesEn: item.glossesBerean || [],
        isFunctionWord: item.isFunctionWord,
        firstRef: item.allRefs?.[0] || null,
        hasAlignment: alignedLexemes ? alignedLexemes.has(item.lexemeId) : false
      }))
      .sort((a, b) => a.rank - b.rank);
  } catch (e) {
    console.warn('loadFrequency error:', e);
    return null;
  }
}
