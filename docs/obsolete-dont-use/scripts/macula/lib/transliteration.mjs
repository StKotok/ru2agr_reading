/**
 * SBL-like transliteration of polytonic Greek to Latin.
 *
 * This is a "sbl-like" implementation — not officially verified against the
 * SBL Handbook of Style. After full verification the `verified` flag can be
 * set to true.
 *
 * Features:
 * - Handles breathings (rough → h, smooth → ignored)
 * - Handles diphthongs (αι→ai, ει→ei, οι→oi, αυ→au, ευ→eu, ηυ→eu, ου→ou, υι→ui)
 * - Handles gamma nasal (γ before γ/κ/χ/ξ → n)
 * - Handles final sigma
 * - Handles iota subscript (ᾳ→a, ῃ→e, ῳ→o)
 * - Preserves case
 */

const SINGLE = new Map(Object.entries({
  'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z',
  'η': 'ē', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm',
  'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's',
  'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps',
  'ω': 'ō', 'ϋ': 'y', 'ϊ': 'i',
}));

const DIPHTHONGS = new Map(Object.entries({
  'αι': 'ai', 'ει': 'ei', 'οι': 'oi',
  'αυ': 'au', 'ευ': 'eu', 'ηυ': 'ēu', 'ου': 'ou', 'υι': 'yi',
  'ᾳ': 'a', 'ῃ': 'e', 'ῳ': 'o',
}));

// Characters that indicate a rough breathing in NFD
const ROUGH = '̔'; // combining reversed comma above (dasia)
const SMOOTH = '̓'; // combining comma above (psili)

/**
 * Transliterate a polytonic Greek word to Latin.
 * @param {string} text - NFC Greek word
 * @returns {{ value: string, system: string, verified: boolean }}
 */
export function transliterateGreek(text) {
  if (!text) return { value: '', system: 'sbl-like', verified: false };

  const nfc = text.normalize('NFC');
  const nfd = nfc.normalize('NFD');

  // Detect rough breathing (before stripping diacritics)
  const hasRough = nfd.includes(ROUGH);

  // Strip ALL combining diacritics: accents, breathings, diaeresis, macron, breve, iota subscript
  const stripped = nfd.replace(/[̀-ͯ]/g, '');
  const lower = stripped.toLowerCase();

  // Detect capitalisation: compare original first base letter to lowercased version
  const strippedNfc = nfc.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  const strippedLowerFc = strippedNfc.toLowerCase();
  const isCapital = nfc.length > 0 && strippedNfc.length > 0 && strippedNfc[0] !== strippedLowerFc[0];

  let body = '';
  for (let i = 0; i < lower.length; i++) {
    // Gamma nasal
    if (lower[i] === 'γ' && i + 1 < lower.length && 'γκξχ'.includes(lower[i + 1])) {
      body += 'n';
      continue;
    }
    // Diphthongs (2-char)
    const two = lower.slice(i, i + 2);
    if (DIPHTHONGS.has(two)) {
      body += DIPHTHONGS.get(two);
      i++;
      continue;
    }
    body += SINGLE.get(lower[i]) ?? lower[i];
  }

  // Initial rho with rough breathing → rh
  if (hasRough) {
    if (body.startsWith('r')) {
      body = 'rh' + body.slice(1);
    } else {
      body = 'h' + body;
    }
  }

  if (isCapital && body.length > 0) {
    body = body[0].toUpperCase() + body.slice(1);
  }

  return { value: body, system: 'sbl-like', verified: false };
}

/**
 * Transliterate a word, returning just the string value.
 * @param {string} text
 * @returns {string}
 */
export function transliterateToStr(text) {
  return transliterateGreek(text).value;
}
