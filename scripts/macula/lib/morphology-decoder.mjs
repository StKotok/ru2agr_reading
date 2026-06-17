/**
 * Enhanced Robinson morphology decoder with full Russian labels.
 *
 * This replaces the inline decoder in src/engine/morphology.js with a
 * complete, table-driven decoder that covers ALL Robinson morphology codes.
 *
 * Sources:
 * - MACULA TSV `morph` column (Robinson codes)
 * - MACULA TSV individual feature columns (person, number, gender, case, tense, voice, mood, degree)
 */

// === FULL Robinson code tables ===

export const POS_MAP = {
  'N': { label: 'существительное', category: 'noun' },
  'V': { label: 'глагол', category: 'verb' },
  'A': { label: 'прилагательное', category: 'adjective' },
  'T': { label: 'артикль', category: 'article' },
  'P': { label: 'местоимение', category: 'pronoun' },
  'R': { label: 'предлог', category: 'preposition' },
  'C': { label: 'союз', category: 'conjunction' },
  'D': { label: 'наречие', category: 'adverb' },
  'I': { label: 'междометие', category: 'interjection' },
  'X': { label: 'частица', category: 'particle' },
  'F': { label: 'возвратное местоимение', category: 'pronoun' },
  'K': { label: 'соотносительное местоимение', category: 'pronoun' },
  'Q': { label: 'вопросительно-соотносительное местоимение', category: 'pronoun' },
  'S': { label: 'притяжательное местоимение', category: 'pronoun' },
  'PREP': { label: 'предлог', category: 'preposition' },
  'CONJ': { label: 'союз', category: 'conjunction' },
  'PRT': { label: 'частица', category: 'particle' },
  'ADV': { label: 'наречие', category: 'adverb' },
  'COND': { label: 'условная частица', category: 'particle' },
  'INJ': { label: 'междометие', category: 'interjection' },
  'ARAM': { label: 'арамейское слово', category: 'other' },
  'HEB': { label: 'еврейское слово', category: 'other' },
};

export const CASE_MAP = {
  'N': 'именительный',
  'G': 'родительный',
  'D': 'дательный',
  'A': 'винительный',
  'V': 'звательный',
};

export const NUMBER_MAP = {
  'S': 'единственное',
  'P': 'множественное',
};

export const GENDER_MAP = {
  'M': 'мужской',
  'F': 'женский',
  'N': 'средний',
};

export const TENSE_MAP = {
  'P': 'настоящее',
  'I': 'имперфект',
  'F': 'будущее',
  'A': 'аорист',
  'R': 'перфект',
  'L': 'плюсквамперфект',
};

export const VOICE_MAP = {
  'A': 'действительный',
  'M': 'средний',
  'P': 'страдательный',
  'E': 'средне-страдательный',
};

export const MOOD_MAP = {
  'I': 'изъявительное',
  'D': 'повелительное',
  'S': 'сослагательное',
  'O': 'желательное',
  'N': 'инфинитив',
  'P': 'причастие',
};

export const PERSON_MAP = {
  '1': '1-е',
  '2': '2-е',
  '3': '3-е',
};

export const DEGREE_MAP = {
  'C': 'сравнительная',
  'S': 'превосходная',
};

// === Short labels for UI ===

export const POS_SHORT = {
  'N': 'сущ.', 'V': 'глаг.', 'A': 'прил.', 'T': 'арт.',
  'P': 'мест.', 'R': 'предл.', 'C': 'союз', 'D': 'нар.',
  'I': 'межд.', 'X': 'част.', 'F': 'возвр. мест.', 'K': 'соотн. мест.',
  'Q': 'вопр.-соотн. мест.', 'S': 'притяж. мест.',
  'PREP': 'предл.', 'CONJ': 'союз', 'PRT': 'част.', 'ADV': 'нар.',
  'COND': 'усл. част.', 'INJ': 'межд.', 'ARAM': 'арам.', 'HEB': 'евр.',
};

export const CASE_SHORT = {
  'N': 'им. падеж', 'G': 'род. падеж', 'D': 'дат. падеж',
  'A': 'вин. падеж', 'V': 'зват. падеж',
};

export const NUMBER_SHORT = { 'S': 'ед. ч.', 'P': 'мн. ч.' };
export const GENDER_SHORT = { 'M': 'муж. род', 'F': 'жен. род', 'N': 'ср. род' };

export const TENSE_SHORT = {
  'P': 'наст. вр.', 'I': 'имперф.', 'F': 'буд. вр.',
  'A': 'аорист', 'R': 'перф.', 'L': 'плюскв.',
};

export const VOICE_SHORT = {
  'A': 'действ. залог', 'M': 'средн. залог', 'P': 'страд. залог', 'E': 'ср.-стр. залог',
};

export const MOOD_SHORT = {
  'I': 'изъяв. накл.', 'D': 'повел. накл.', 'S': 'сосл. накл.',
  'O': 'желат. накл.', 'N': 'инфинитив', 'P': 'причастие',
};

export const PERSON_SHORT = { '1': '1 л.', '2': '2 л.', '3': '3 л.' };

export const DEGREE_SHORT = { 'C': 'сравн. ст.', 'S': 'превосх. ст.' };

// ============================================================
// Parsing
// ============================================================

// Nominal POS symbols that carry case/number/gender
const NOMINAL_POS = new Set(['N', 'A', 'T', 'P', 'R', 'D', 'F', 'I', 'K', 'Q', 'S', 'X', 'C']);
const RE_NOMINAL_CASE = /[NGDAV]/;
const RE_LEADING_DIGIT = /^\d/;

/**
 * Parse a Robinson morphology code into structured features.
 * @param {string|null} code - e.g. "N-NSM", "V-PAI-3S", "PREP"
 * @returns {object}
 */
export function parseMorphCode(code) {
  if (!code || code === '---') {
    return { raw: code || null, pos: null, unknown: false };
  }

  const parts = code.split('-');

  // Single-part codes: PREP, CONJ, PRT, ADV, etc.
  if (parts.length === 1) {
    const pos = POS_MAP[parts[0]]?.label || parts[0].toLowerCase();
    return {
      raw: code,
      pos,
      posCategory: POS_MAP[parts[0]]?.category || 'other',
      isUninflected: true,
      unknown: !POS_MAP[parts[0]],
    };
  }

  const posChar = parts[0][0];
  const posInfo = POS_MAP[posChar] || { label: posChar.toLowerCase(), category: 'other' };

  const result = {
    raw: code,
    pos: posInfo.label,
    posCategory: posInfo.category,
    isUninflected: false,
    unknown: !POS_MAP[posChar],
  };

  if (NOMINAL_POS.has(posChar) && parts.length >= 2) {
    const nomPart = parts[1];
    const caseIdx = nomPart.search(RE_NOMINAL_CASE);
    if (caseIdx !== -1) {
      result.case = CASE_MAP[nomPart[caseIdx]] || nomPart[caseIdx];
      result.number = NUMBER_MAP[nomPart[caseIdx + 1]] || nomPart[caseIdx + 1];
      result.gender = GENDER_MAP[nomPart[caseIdx + 2]] || nomPart[caseIdx + 2];
    }
  }

  if (posChar === 'V' && parts.length >= 2) {
    const tvm = parts[1].replace(RE_LEADING_DIGIT, '');
    result.tense = TENSE_MAP[tvm[0]] || tvm[0];
    result.voice = VOICE_MAP[tvm[1]] || tvm[1];
    result.mood = MOOD_MAP[tvm[2]] || tvm[2];
    if (parts.length >= 3) {
      result.person = PERSON_MAP[parts[2][0]] || parts[2][0];
      result.number = NUMBER_MAP[parts[2][1]] || parts[2][1];
    }
  }

  return result;
}

/**
 * Format morphology as a Russian string (full labels).
 * @param {object} parsed - result of parseMorphCode
 * @returns {string}
 */
export function formatMorphFull(parsed) {
  if (!parsed || !parsed.pos) return parsed?.raw || '—';
  if (parsed.isUninflected) return `${parsed.pos}, неизм.`;

  const parts = [parsed.pos];
  if (parsed.case) parts.push(parsed.case);
  if (parsed.number) parts.push(parsed.number);
  if (parsed.gender) parts.push(parsed.gender);
  if (parsed.tense) parts.push(parsed.tense);
  if (parsed.voice) parts.push(parsed.voice);
  if (parsed.mood) parts.push(parsed.mood);
  if (parsed.person) parts.push(`${parsed.person} лицо`);
  if (parsed.degree) parts.push(parsed.degree);

  return parts.join(', ');
}

/**
 * Format morphology as a Russian string (short labels).
 * @param {object} parsed - result of parseMorphCode
 * @returns {string}
 */
export function formatMorphShort(parsed) {
  if (!parsed || !parsed.pos) return parsed?.raw || '—';
  if (parsed.isUninflected) {
    const rawCode = parsed.raw || '';
    const firstPart = rawCode.split('-')[0];
    const posKey = rawCode.includes('-') ? (firstPart[0] || firstPart) : firstPart;
    const shortPos = POS_SHORT[posKey] || parsed.pos;
    return `${shortPos}, неизм.`;
  }

  const parts = [];
  // Find POS short label
  const rawCode = parsed.raw || '';
  const firstPart = rawCode.split('-')[0];
  // For single-part codes (PREP, CONJ, etc.), use the full code as key
  const posKey = rawCode.includes('-') ? (firstPart[0] || firstPart) : firstPart;
  parts.push(POS_SHORT[posKey] || parsed.pos);

  if (parsed.case) {
    const caseKey = Object.entries(CASE_MAP).find(([, v]) => v === parsed.case)?.[0];
    parts.push(caseKey ? CASE_SHORT[caseKey] : parsed.case);
  }
  if (parsed.number) {
    const numKey = Object.entries(NUMBER_MAP).find(([, v]) => v === parsed.number)?.[0];
    parts.push(numKey ? NUMBER_SHORT[numKey] : parsed.number);
  }
  if (parsed.gender) {
    const genKey = Object.entries(GENDER_MAP).find(([, v]) => v === parsed.gender)?.[0];
    parts.push(genKey ? GENDER_SHORT[genKey] : parsed.gender);
  }
  if (parsed.tense) {
    const tKey = Object.entries(TENSE_MAP).find(([, v]) => v === parsed.tense)?.[0];
    parts.push(tKey ? TENSE_SHORT[tKey] : parsed.tense);
  }
  if (parsed.voice) {
    const vKey = Object.entries(VOICE_MAP).find(([, v]) => v === parsed.voice)?.[0];
    parts.push(vKey ? VOICE_SHORT[vKey] : parsed.voice);
  }
  if (parsed.mood && parsed.mood !== 'изъявительное') {
    const mKey = Object.entries(MOOD_MAP).find(([, v]) => v === parsed.mood)?.[0];
    parts.push(mKey ? MOOD_SHORT[mKey] : parsed.mood);
  }
  if (parsed.person) {
    const pKey = Object.entries(PERSON_MAP).find(([, v]) => v === parsed.person)?.[0];
    parts.push(pKey ? PERSON_SHORT[pKey] : parsed.person);
  }

  return parts.join(', ');
}

/**
 * Build labelRu: a concise Russian description suitable for UI card display.
 * @param {object} parsed - result of parseMorphCode
 * @returns {string}
 */
export function buildLabelRu(parsed) {
  if (!parsed || !parsed.pos) return '—';
  if (parsed.isUninflected) return `${parsed.pos}, неизм.`;
  return formatMorphShort(parsed);
}
