/**
 * Bible book loader — MACULA v3 paths.
 * fetch + in-memory cache (Map), fail-soft.
 */

const cache = new Map();

/**
 * Load book manifest.
 * @returns {Promise<Array>}
 */
export async function loadBooks() {
  if (cache.has('__books__')) {
    return cache.get('__books__');
  }
  try {
    const res = await fetch('./data/books.json');
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
 * Load a Greek original or Russian translation book.
 * @param {'grc'|'syn'} kind
 * @param {string} bookId — 'john', 'matthew', ...
 * @returns {Promise<object|null>}
 */
export async function loadBook(kind, bookId) {
  const cacheKey = `${kind}:${bookId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // Map kind to new path
  const dir = kind === 'grc'
    ? `data/originals/sblgnt-macula/books`
    : `data/translations/syn/books`;

  try {
    const res = await fetch(`./${dir}/${bookId}.json`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    const book = await res.json();
    cache.set(cacheKey, book);
    return book;
  } catch (e) {
    console.warn(`loadBook(${kind}, ${bookId}) error:`, e);
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
    const res = await fetch(`./data/align/syn--sblgnt-macula/books/${bookId}.json`);
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
 * Load alignment index (list of lexemeKeys with visible pairs).
 * @returns {Promise<object|null>}
 */
export async function loadAlignmentIndex() {
  if (cache.has('__alignIndex__')) {
    return cache.get('__alignIndex__');
  }
  try {
    const res = await fetch('./data/align/syn--sblgnt-macula/index.json');
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    const index = await res.json();
    cache.set('__alignIndex__', index);
    return index;
  } catch (e) {
    console.warn('loadAlignmentIndex error:', e);
    return null;
  }
}
