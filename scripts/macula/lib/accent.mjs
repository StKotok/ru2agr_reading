/**
 * Accent detection for polytonic Greek.
 *
 * Detects accent type (acute, grave, circumflex) and position,
 * distinct from breathing marks and diaeresis.
 *
 * Does NOT perform syllabification — only reports the grapheme
 * and code-point index of the accented character.
 */

// Combining diacritics in NFD
const ACUTE = '́';   // combining acute accent (oxia)
const GRAVE = '̀';   // combining grave accent (varia)
const CIRCUMFLEX = '̂'; // combining circumflex (perispomeni)

// Precomposed accented characters (NFC) — for faster detection
const ACUTE_RE = /[άέήίόύώΐΰ]/;
const GRAVE_RE = /[ὰὲὴὶὸὺὼ]/;
const CIRCUMFLEX_RE = /[ᾶῆῖῦῶ]/;
// Combined: any accent
const ACCENT_RE = /[άέήίόύώΐΰὰὲὴὶὸὺὼᾶῆῖῦῶ]/;

/**
 * Detect accent on a Greek word.
 * @param {string} text - NFC Greek text
 * @returns {{ hasAccent: boolean, type: string|null, grapheme: string|null, graphemeIndex: number, codePointIndex: number }}
 */
export function detectAccent(text) {
  if (!text) {
    return { hasAccent: false, type: null, grapheme: null, graphemeIndex: -1, codePointIndex: -1 };
  }

  // Fast path: check NFC for common accented characters
  const nfc = text.normalize('NFC');

  if (ACCENT_RE.test(nfc)) {
    // Find the first accented character
    const match = nfc.match(ACCENT_RE);
    const cpIdx = match.index;

    let type = 'acute';
    if (GRAVE_RE.test(match[0])) type = 'grave';
    else if (CIRCUMFLEX_RE.test(match[0])) type = 'circumflex';

    // Approximate grapheme index (same as code point for most cases)
    const gi = cpIdx;

    return {
      hasAccent: true,
      type,
      grapheme: match[0],
      graphemeIndex: gi,
      codePointIndex: cpIdx,
    };
  }

  // Slow path: check NFD for combining accents (rare cases)
  const nfd = text.normalize('NFD');
  let type = null;
  let idx = -1;

  for (let i = 0; i < nfd.length; i++) {
    if (nfd[i] === ACUTE) { type = 'acute'; idx = i; break; }
    if (nfd[i] === GRAVE) { type = 'grave'; idx = i; break; }
    if (nfd[i] === CIRCUMFLEX) { type = 'circumflex'; idx = i; break; }
  }

  if (!type) {
    return { hasAccent: false, type: null, grapheme: null, graphemeIndex: -1, codePointIndex: -1 };
  }

  // Find the base character before the combining accent
  const baseChar = idx > 0 ? nfd[idx - 1] : null;
  // Reconstruct the accented grapheme
  const g = baseChar ? (baseChar + nfd[idx]).normalize('NFC') : null;

  return {
    hasAccent: true,
    type,
    grapheme: g,
    graphemeIndex: idx - 1, // index of the base character in NFD (approx)
    codePointIndex: idx,
  };
}

/**
 * Check if a character is a breathing mark (smooth or rough).
 * @param {string} ch - a single character (NFC) or combining character (NFD)
 * @returns {boolean}
 */
export function isBreathing(ch) {
  return ch === '̓' || ch === '̔' || ch === '᾿' || ch === '῾';
}
