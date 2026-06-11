/**
 * Загрузчик алфавита и лексикона.
 */

let alphabetCache = null;

/**
 * Загружает alphabet.json.
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
 * Загружает core lexicon.
 * @returns {Promise<Array|null>}
 */
export async function loadCoreLexicon() {
  try {
    const res = await fetch('./data/lexicon/core.json');
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  } catch (e) {
    console.warn('loadCoreLexicon error:', e);
    return null;
  }
}
