/**
 * Lexicon loader — MACULA v3.
 * Loads top1000.core.json + locale/ru/* overlays.
 * Join by lexemeKey; fallback to EN glosses for non-curated entries.
 */

let alphabetCache = null;

/**
 * Load alphabet.json.
 * @returns {Promise<Array|null>}
 */
export async function loadAlphabet() {
  if (alphabetCache) return alphabetCache;
  try {
    const res = await fetch('./data/alphabet.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    alphabetCache = await res.json();
    return alphabetCache;
  } catch (e) {
    console.warn('loadAlphabet error:', e);
    return null;
  }
}

/**
 * Load core lexicon (old format — kept for backward compat until UI migration).
 * @returns {Promise<Array|null>}
 */
export async function loadCoreLexicon() {
  try {
    const res = await fetch('./data/lexicon/locales/ru/core.json');
    if (res.ok) return res.json();
    return null;
  } catch (e) {
    console.warn('loadCoreLexicon error:', e);
    return null;
  }
}

let top1000Cache = null;

/**
 * Load top-1000 lexicon core (language-neutral).
 * @returns {Promise<object|null>} — { schema, originalId, items: [...] }
 */
export async function loadTop1000Core() {
  if (top1000Cache) return top1000Cache;
  try {
    const res = await fetch('./data/lexicon/top1000.core.json');
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    top1000Cache = await res.json();
    return top1000Cache;
  } catch (e) {
    console.warn('loadTop1000Core error:', e);
    return null;
  }
}

let localeTopCache = null;

/**
 * Load Russian gloss overlay for top-1000.
 * @returns {Promise<object|null>}
 */
export async function loadLocaleTop1000() {
  if (localeTopCache) return localeTopCache;
  try {
    const res = await fetch('./data/lexicon/locales/ru/top1000.json');
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    localeTopCache = await res.json();
    return localeTopCache;
  } catch (e) {
    console.warn('loadLocaleTop1000 error:', e);
    return null;
  }
}

/**
 * Build unified lexicon items by joining core + locale overlay by lexemeKey.
 * Fallback: EN glosses + transliteration for non-curated entries.
 *
 * @returns {Promise<Array>} — unified items with {lexemeKey, gloss, lemma, translit, ...}
 */
export async function loadUnifiedLexicon() {
  const [core, localeTop] = await Promise.all([
    loadTop1000Core(),
    loadLocaleTop1000(),
  ]);

  if (!core || !core.items) return [];

  const glossByKey = new Map();
  if (localeTop && localeTop.items) {
    for (const item of localeTop.items) {
      glossByKey.set(item.lexemeKey, item);
    }
  }

  const unified = core.items.map(item => {
    const overlay = glossByKey.get(item.lexemeKey);
    const enGloss = (item.sourceGlosses && item.sourceGlosses.en && item.sourceGlosses.en.length > 0)
      ? item.sourceGlosses.en.slice(0, 3).join(', ')
      : '';

    return {
      lexemeKey: item.lexemeKey,
      lemma: item.lemma,
      translit: item.translit,
      strongs: item.strongs || [],
      rank: item.rank,
      count: item.count,
      verseCount: item.verseCount,
      pos: item.pos,
      isFunctionWord: item.isFunctionWord,
      // Russian gloss from overlay, or EN fallback + transliteration
      gloss: overlay?.gloss || enGloss,
      shortGloss: overlay?.shortGloss || enGloss.split(',')[0]?.trim() || item.translit || '',
      sourceGlosses: item.sourceGlosses,
      forms: item.forms || [],
      firstRef: item.firstRef,
      domains: item.domains || [],
      // Flag: is curated (has ru overlay)?
      isCurated: !!overlay,
    };
  });

  return unified;
}

/**
 * Load frequency data (old format — kept for tests/backward compat).
 * @returns {Promise<Array|null>}
 */
export async function loadFrequency() {
  try {
    const core = await loadTop1000Core();
    if (core && core.items) {
      // Convert to old frequency format
      return core.items.map(item => ({
        lexemeKey: item.lexemeKey,
        lemma: item.lemma,
        transliteration: item.translit,
        tokenCount: item.count,
        verseCount: item.verseCount,
        rank: item.rank,
        strong: item.strongs,
        pos: item.pos,
        glossesEn: item.sourceGlosses?.en || [],
        isFunctionWord: item.isFunctionWord,
        firstRef: item.firstRef,
      }));
    }
    return null;
  } catch (e) {
    console.warn('loadFrequency error:', e);
    return null;
  }
}
