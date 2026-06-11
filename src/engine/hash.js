/**
 * FNV-1a хеш (32-bit), нормализованный в [0, 1).
 * Используется для детерминированной псевдослучайности: один и тот же ввод
 * всегда даёт одинаковый результат. Math.random() в engine/ запрещён.
 *
 * @param {string} str
 * @returns {number} число в диапазоне [0, 1)
 */
export function hash01(str) {
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // Нормализуем в [0, 1)
  return (hash >>> 0) / 4294967296;
}
