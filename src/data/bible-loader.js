/**
 * Загрузчик книг Библии.
 * fetch + in-memory кеш (Map), fail-soft.
 */

const cache = new Map();

/**
 * Загружает манифест книг.
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
 * Загружает книгу перевода.
 * @param {string} translation — 'syn', 'grc'
 * @param {string} bookId — 'john', 'matthew', ...
 * @returns {Promise<object|null>}
 */
export async function loadBook(translation, bookId) {
  const cacheKey = `${translation}:${bookId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  try {
    const res = await fetch(`./data/bibles/${translation}/${bookId}.json`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    const book = await res.json();
    cache.set(cacheKey, book);
    return book;
  } catch (e) {
    console.warn(`loadBook(${translation}, ${bookId}) error:`, e);
    return null;
  }
}
