/**
 * ru-tokenizer.mjs — Russian text tokenizer producing frozen word offsets.
 *
 * Returns lexical word spans only. External punctuation, quotes, brackets
 * are excluded from spans — they remain as plain text between spans.
 * Word case is preserved.
 *
 * This is the single shared tokenizer used by both build-syn-packs.mjs
 * (Step 2.5) and build-alignment.mjs (Step 3.2). Runtime never calls this.
 *
 * @returns Array<{ i: number, text: string, start: number, end: number }>
 *   where text === verseText.slice(start, end)
 */

/**
 * Tokenize a Russian verse text into word spans.
 * Preserves case. External punctuation is excluded from spans.
 *
 * @param {string} verseText - Raw verse text in Russian
 * @returns {Array<{i: number, text: string, start: number, end: number}>}
 */
export function tokenizeRussianVerse(verseText) {
  if (!verseText || verseText.trim() === '') return [];

  const words = [];
  let i = 0;
  let pos = 0;
  const len = verseText.length;

  while (pos < len) {
    // Skip whitespace
    while (pos < len && /\s/.test(verseText[pos])) {
      pos++;
    }
    if (pos >= len) break;

    // Check for leading punctuation/quotes
    const leadingPunct = [];
    while (pos < len && isNonLexical(verseText[pos])) {
      leadingPunct.push(verseText[pos]);
      pos++;
    }

    // Find the lexical word core
    const wordStart = pos;
    while (pos < len && isLexicalChar(verseText[pos])) {
      pos++;
    }
    const wordEnd = pos;

    if (wordEnd > wordStart) {
      // Check for trailing punctuation
      const trailingStart = pos;
      while (pos < len && isNonLexical(verseText[pos])) {
        pos++;
      }

      // Only emit the lexical span (without external punctuation)
      const text = verseText.slice(wordStart, wordEnd);
      words.push({
        i,
        text,
        start: wordStart,
        end: wordEnd,
      });
      i++;
    } else if (leadingPunct.length > 0) {
      // Pure punctuation token (e.g., em-dash as standalone) — skip, stays as plain text
      // But check for trailing punctuation after it
      while (pos < len && isNonLexical(verseText[pos])) {
        pos++;
      }
    }
  }

  return words;
}

/**
 * Check if character is part of a lexical word.
 * Includes Cyrillic letters, Latin letters (for mixed text), apostrophe, hyphen.
 */
function isLexicalChar(ch) {
  // Cyrillic range
  if (ch >= 'Ѐ' && ch <= 'ӿ') return true;
  // Basic Latin letters (for loan words)
  if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) return true;
  // Word-internal: apostrophe (U+0027), soft sign, hard sign
  // Already covered by Cyrillic range above
  // Hyphen (U+002D) — word-internal only, not leading/trailing
  return false;
}

/**
 * Check if character is non-lexical (punctuation, quotes, brackets, etc.)
 * These characters are excluded from word spans.
 */
function isNonLexical(ch) {
  // Standard punctuation
  if ('.,;:!?…—–-‐‑‒―«»„"\'‘’“”`()[]{}<>/\\|@#$%^&*+=~'.includes(ch)) return true;
  // Unicode punctuation ranges
  const cp = ch.codePointAt(0);
  if (cp >= 0x2000 && cp <= 0x206F) return true; // General Punctuation
  if (cp >= 0x2E00 && cp <= 0x2E7F) return true; // Supplemental Punctuation
  if (cp >= 0x3000 && cp <= 0x303F) return true; // CJK Symbols and Punctuation
  // Digits — treated as non-lexical (verse numbers, etc.)
  if (ch >= '0' && ch <= '9') return true;
  return false;
}

/**
 * Verify that word offsets are consistent with the text.
 * Returns an array of error messages.
 */
export function verifyTokenOffsets(verseText, words) {
  const errors = [];
  for (const w of words) {
    const actual = verseText.slice(w.start, w.end);
    if (actual !== w.text) {
      errors.push(`Offset mismatch at word[${w.i}]: expected "${w.text}", got "${actual}" from [${w.start},${w.end}]`);
    }
  }
  return errors;
}

export { isLexicalChar, isNonLexical };
