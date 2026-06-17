/**
 * Stable lexeme ID generator.
 *
 * Produces a deterministic ID from a NFC lemma string.
 * Format: grc-<transliteration-prefix>-<short-hash>
 *
 * Requirements:
 * - Same lemma always gets the same ID
 * - ID does not depend on token order
 * - Collisions are detected by test
 */

import { createHash } from 'node:crypto';

/**
 * Simple SBL-like transliteration for ID generation (no breathing marks needed).
 * @param {string} lemma - NFC lemma
 * @returns {string} ASCII prefix
 */
function lemmaToAsciiPrefix(lemma) {
  const stripped = lemma
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ς/g, 'σ');

  const map = {
    'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z',
    'η': 'e', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm',
    'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's',
    'τ': 't', 'υ': 'y', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o',
    'ϋ': 'y', 'ϊ': 'i', 'ᾳ': 'a',
  };

  let result = '';
  for (const ch of stripped) {
    // Digraphs
    if (ch === 'γ' && 'γκξχ'.includes(stripped[stripped.indexOf(ch) + 1] || '')) {
      result += 'n';
    } else {
      result += map[ch] || ch;
    }
  }
  // Truncate to reasonable length
  return result.slice(0, 12);
}

/**
 * Generate a stable lexeme ID from a NFC lemma.
 * @param {string} lemma - NFC-normalised lemma
 * @returns {string} e.g. "grc-logos-a13f92"
 */
export function generateLexemeId(lemma) {
  const nfc = lemma.normalize('NFC');
  const prefix = lemmaToAsciiPrefix(nfc);
  const hash = createHash('sha256').update(nfc).digest('hex').slice(0, 6);
  return `grc-${prefix}-${hash}`;
}

/**
 * Generate IDs for a set of lemmas and check for collisions.
 * @param {string[]} lemmas - array of unique NFC lemmas
 * @returns {{ map: Map<string, string>, collisions: string[] }}
 */
export function buildLexemeIdMap(lemmas) {
  const map = new Map();
  const idToLemma = new Map();
  const collisions = [];

  for (const lemma of lemmas) {
    const id = generateLexemeId(lemma);
    if (idToLemma.has(id)) {
      collisions.push(`Collision: "${lemma}" and "${idToLemma.get(id)}" both → ${id}`);
    }
    idToLemma.set(id, lemma);
    map.set(lemma, id);
  }

  return { map, collisions };
}
