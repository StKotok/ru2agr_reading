const SINGLE = new Map(Object.entries({
  'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z',
  'η': 'e', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm',
  'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's',
  'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps',
  'ω': 'o'
}));
const DIPHTHONGS = new Map(Object.entries({
  'αυ': 'au', 'ευ': 'eu', 'ηυ': 'eu', 'ου': 'ou', 'υι': 'ui'
}));
const ROUGH = '̔'; // густое придыхание (дасия)

/**
 * Учебная ASCII-транслитерация греческой леммы (для поиска).
 * η→e, ω→o (без макронов — поле используется для поиска латиницей).
 */
export function transliterateGreek(text) {
  // Strip parenthetical suffixes: οὕτω(ς) → οὕτω, ἔξεστι(ν) → ἔξεστι
  const clean = text.replace(/\([^)]*\)/g, '');
  const nfd = clean.normalize('NFD');
  const hasRough = nfd.includes(ROUGH);
  const stripped = nfd.replace(/[̀-ͯ]/g, '');
  const lower = stripped.toLowerCase();
  const isCapital = stripped.length > 0 && stripped[0] !== lower[0];

  let body = '';
  for (let i = 0; i < lower.length; i++) {
    // Носовая гамма: γγ/γκ/γξ/γχ → n + следующая буква
    if (lower[i] === 'γ' && 'γκξχ'.includes(lower[i + 1] || '')) {
      body += 'n';
      continue;
    }
    const two = lower.slice(i, i + 2);
    if (DIPHTHONGS.has(two)) {
      body += DIPHTHONGS.get(two);
      i++;
      continue;
    }
    body += SINGLE.get(lower[i]) ?? lower[i];
  }

  // Густое придыхание: ῥ → rh, иначе h в начале слова
  if (hasRough) {
    body = body.startsWith('r') ? 'rh' + body.slice(1) : 'h' + body;
  }

  if (isCapital && body.length > 0) {
    body = body[0].toUpperCase() + body.slice(1);
  }
  return body;
}
