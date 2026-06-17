/**
 * Unicode normalisation utilities for Greek text.
 *
 * All Greek strings are stored in NFC. Search forms strip diacritics,
 * lowercase, normalise final sigma → sigma, and remove iota subscript.
 */

// Combining diacritics range U+0300–U+036F: covers acute, grave, circumflex,
// smooth/rough breathing, diaeresis, iota subscript, macron, breve,
// AND Greek perispomeni (U+0342) etc.
const DIACRITIC_RE = /[̀-ͯ]/g;

// Accent + breathing diacritics only (not diaeresis, not iota subscript)
const ACCENT_BREATHING_RE = /[̀́̂̓̔]/g;

/**
 * Normalise a Greek string to NFC.
 * @param {string} s
 * @returns {string}
 */
export function toNfc(s) {
  if (!s) return s;
  return s.normalize('NFC');
}

/**
 * Build a search-friendly form:
 * - lowercase
 * - no accents, breathings, diaeresis, macron, breve
 * - no iota subscript
 * - final sigma (ς) → medial sigma (σ)
 * @param {string} s
 * @returns {string}
 */
export function toSearchForm(s) {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(DIACRITIC_RE, '')
    .toLowerCase()
    .replace(/ς/g, 'σ');
}

/**
 * Remove only accent and breathing diacritics, keeping diaeresis and iota subscript.
 * Useful for comparing lemmas where accent may differ.
 * @param {string} s
 * @returns {string}
 */
export function stripAccents(s) {
  if (!s) return '';
  return s.normalize('NFD').replace(ACCENT_BREATHING_RE, '').normalize('NFC');
}

/**
 * Normalise an entire array of token rows from the TSV.
 * Applies NFC to surface, lemma, normalized, gloss, and english fields.
 * @param {Array<Record<string,string>>} rows
 * @returns {Array<Record<string,string>>}
 */
export function normaliseTokenRows(rows) {
  for (const row of rows) {
    if (row.text) row.text = toNfc(row.text);
    if (row.lemma) row.lemma = toNfc(row.lemma);
    if (row.normalized) row.normalized = toNfc(row.normalized);
    if (row.gloss) row.gloss = toNfc(row.gloss);
    if (row.english) row.english = toNfc(row.english);
  }
  return rows;
}
