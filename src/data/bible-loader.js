/**
 * Bible book loader — v2 paths.
 * fetch + in-memory cache (Map), fail-soft.
 *
 * Новые пути:
 *   data/bibles/grc/{bookId}.json  — Greek text
 *   data/bibles/eng/{bookId}.json  — BSB English translation
 *   data/align/grc-eng/{bookId}.json — span-based alignment
 */

const cache = new Map();

let _manifest = null;
let _manifestLoaded = false;

/**
 * Load data manifest (always fresh, for cache-busting version).
 * @returns {Promise<object|null>}
 */
export async function loadManifest() {
  if (_manifestLoaded) return _manifest;
  try {
    const res = await fetch('./data/data-manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _manifest = await res.json();
    _manifestLoaded = true;
    return _manifest;
  } catch (e) {
    console.warn('loadManifest error:', e);
    _manifestLoaded = true;
    return null;
  }
}

/**
 * Get cache-busting version string from manifest.
 * @returns {Promise<string>}
 */
async function getVersion() {
  const m = await loadManifest();
  return m?.version || '2.0.0';
}

/**
 * Load book manifest (books.json).
 * @returns {Promise<Array>}
 */
export async function loadBooks() {
  if (cache.has('__books__')) {
    return cache.get('__books__');
  }
  try {
    const v = await getVersion();
    const res = await fetch(`./data/books.json?v=${v}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const books = await res.json();
    cache.set('__books__', books);
    return books;
  } catch (e) {
    console.warn('loadBooks error:', e);
    return [];
  }
}

/**
 * Load a Greek or English (BSB) book.
 * @param {'grc'|'eng'} type
 * @param {string} bookId — 'john', 'matthew', ...
 * @returns {Promise<object|null>}
 */
export async function loadBook(type, bookId) {
  const cacheKey = `${type}:${bookId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const dir = type === 'grc' ? 'data/bibles/grc' : 'data/bibles/eng';

  try {
    const v = await getVersion();
    const res = await fetch(`./${dir}/${bookId}.json?v=${v}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    const book = await res.json();
    cache.set(cacheKey, book);
    return book;
  } catch (e) {
    console.warn(`loadBook(${type}, ${bookId}) error:`, e);
    return null;
  }
}

/**
 * Load alignment pack for a book.
 * @param {string} bookId
 * @returns {Promise<object|null>}
 */
export async function loadAlignment(bookId) {
  const cacheKey = `align:${bookId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  try {
    const v = await getVersion();
    const res = await fetch(`./data/align/grc-eng/${bookId}.json?v=${v}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    const alignment = await res.json();
    cache.set(cacheKey, alignment);
    return alignment;
  } catch (e) {
    console.warn(`loadAlignment(${bookId}) error:`, e);
    return null;
  }
}

/**
 * Load alphabet (no version busting needed).
 * @returns {Promise<object|null>}
 */
export async function loadAlphabet() {
  if (cache.has('__alphabet__')) return cache.get('__alphabet__');
  try {
    const res = await fetch('./data/alphabet.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache.set('__alphabet__', data);
    return data;
  } catch (e) {
    console.warn('loadAlphabet error:', e);
    return null;
  }
}
