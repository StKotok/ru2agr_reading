/**
 * Парсер морфологических кодов Робинсона.
 * Коды вида: N-NSM, V-PAI-3S, A-GSF, T-NSM и т.д.
 */

const POS_MAP = {
  'N': 'существительное', 'V': 'глагол', 'A': 'прилагательное',
  'T': 'артикль', 'P': 'местоимение', 'R': 'предлог',
  'C': 'союз', 'D': 'наречие', 'PREP': 'предлог',
  'CONJ': 'союз', 'PRT': 'частица', 'I': 'междометие',
  'X': 'частица'
};

const CASE_MAP = {
  'N': 'именительный', 'G': 'родительный', 'D': 'дательный',
  'A': 'винительный', 'V': 'звательный'
};

const NUMBER_MAP = { 'S': 'единственное', 'P': 'множественное' };
const GENDER_MAP = { 'M': 'мужской', 'F': 'женский', 'N': 'средний' };

const TENSE_MAP = {
  'P': 'настоящее', 'I': 'имперфект', 'F': 'будущее',
  'A': 'аорист', 'R': 'перфект', 'L': 'плюсквамперфект'
};

const VOICE_MAP = {
  'A': 'действительный', 'M': 'средний', 'P': 'страдательный',
  'E': 'средне-страдательный'
};

const MOOD_MAP = {
  'I': 'изъявительное', 'D': 'повелительное', 'S': 'сослагательное',
  'O': 'желательное', 'N': 'инфинитив', 'P': 'причастие'
};

const PERSON_MAP = { '1': '1 лицо', '2': '2 лицо', '3': '3 лицо' };

/**
 * Парсит морфокод Робинсона и возвращает объект с русскими метками.
 * @param {string} code — например "N-NSM", "V-PAI-3S"
 * @returns {object} { pos, case, number, gender, tense, voice, mood, person }
 */
export function parseMorph(code) {
  if (!code || code === '---') return { raw: code };

  const parts = code.split('-');
  const result = { raw: code };

  if (parts.length === 1) {
    // PREP, CONJ, PRT и т.д.
    result.pos = POS_MAP[parts[0]] || parts[0];
    return result;
  }

  // Часть речи (1-й символ)
  const posChar = parts[0][0];
  result.pos = POS_MAP[posChar] || posChar;

  // Разбираем по типу части речи
  if (posChar === 'N') {
    // N-NSM: существительное
    if (parts[1].length >= 3) {
      result.case = CASE_MAP[parts[1][0]] || parts[1][0];
      result.number = NUMBER_MAP[parts[1][1]] || parts[1][1];
      result.gender = GENDER_MAP[parts[1][2]] || parts[1][2];
    }
  } else if (posChar === 'V') {
    // V-PAI-3S: глагол
    if (parts[1].length >= 1) result.tense = TENSE_MAP[parts[1][0]] || parts[1][0];
    if (parts[1].length >= 2) result.voice = VOICE_MAP[parts[1][1]] || parts[1][1];
    if (parts[1].length >= 3) result.mood = MOOD_MAP[parts[1][2]] || parts[1][2];
    if (parts.length >= 3 && parts[2].length >= 1) result.person = PERSON_MAP[parts[2][0]] || parts[2][0];
    if (parts.length >= 3 && parts[2].length >= 2) result.number = NUMBER_MAP[parts[2][1]] || parts[2][1];
  } else if (posChar === 'A' || posChar === 'T' || posChar === 'P') {
    // A-GSF, T-NSM: прилагательное, артикль, местоимение
    if (parts[1].length >= 3) {
      result.case = CASE_MAP[parts[1][0]] || parts[1][0];
      result.number = NUMBER_MAP[parts[1][1]] || parts[1][1];
      result.gender = GENDER_MAP[parts[1][2]] || parts[1][2];
    }
  } else if (posChar === 'R') {
    result.pos = 'предлог';
  } else if (posChar === 'C') {
    result.pos = 'союз';
  } else if (posChar === 'D') {
    result.pos = 'наречие';
  }

  return result;
}

/**
 * Возвращает русскую строку описания морфологии.
 * @param {string} code — морфокод
 * @returns {string}
 */
export function formatMorphRu(code) {
  if (!code || code === '---') return code || '—';
  const m = parseMorph(code);
  if (m.raw && Object.keys(m).length === 1) return m.raw;

  const parts = [m.pos].filter(Boolean);

  if (m.case) parts.push(mapCase(m.case));
  if (m.number) parts.push(mapNum(m.number));
  if (m.gender) parts.push(mapGen(m.gender));
  if (m.tense) parts.push(mapTense(m.tense));
  if (m.voice) parts.push(mapVoice(m.voice));
  if (m.mood) parts.push(mapMood(m.mood));
  if (m.person) parts.push(m.person);

  return parts.join(', ');
}

function mapCase(c) {
  const m = { 'N': 'им. падеж', 'G': 'род. падеж', 'D': 'дат. падеж', 'A': 'вин. падеж', 'V': 'зват. падеж' };
  return m[c] || c;
}
function mapNum(n) {
  const m = { 'S': 'ед. число', 'P': 'мн. число' };
  return m[n] || n;
}
function mapGen(g) {
  const m = { 'M': 'муж. род', 'F': 'жен. род', 'N': 'ср. род' };
  return m[g] || g;
}
function mapTense(t) {
  const m = { 'P': 'наст. время', 'I': 'имперфект', 'F': 'буд. время', 'A': 'аорист', 'R': 'перфект', 'L': 'плюсквамперфект' };
  return m[t] || t;
}
function mapVoice(v) {
  const m = { 'A': 'действ. залог', 'M': 'средн. залог', 'P': 'страд. залог', 'E': 'средне-страд. залог' };
  return m[v] || v;
}
function mapMood(md) {
  const m = { 'I': 'изъявит. наклонение', 'D': 'повелит. наклонение', 'S': 'сослаг. наклонение', 'O': 'желат. наклонение', 'N': 'инфинитив', 'P': 'причастие' };
  return m[md] || md;
}

// === Короткие аббревиатуры для карточки ===

const POS_SHORT = {
  'N': 'сущ.', 'V': 'глаг.', 'A': 'прил.',
  'T': 'арт.', 'P': 'мест.', 'R': 'предл.',
  'C': 'союз', 'D': 'нар.', 'PREP': 'предл.',
  'CONJ': 'союз', 'PRT': 'част.', 'I': 'межд.',
  'X': 'част.'
};

const CASE_SHORT = {
  'N': 'им. п.', 'G': 'род. п.', 'D': 'дат. п.',
  'A': 'вин. п.', 'V': 'зват. п.'
};

const NUMBER_SHORT = { 'S': 'ед. ч.', 'P': 'мн. ч.' };
const GENDER_SHORT = { 'M': 'м. р.', 'F': 'ж. р.', 'N': 'ср. р.' };

const TENSE_SHORT = {
  'P': 'наст. вр.', 'I': 'имперф.', 'F': 'буд. вр.',
  'A': 'аорист', 'R': 'перф.', 'L': 'плюскв.'
};

const VOICE_SHORT = {
  'A': 'действ.', 'M': 'средн.', 'P': 'страд.',
  'E': 'ср.-стр.'
};

const MOOD_SHORT = {
  'I': 'изъяв.', 'D': 'повел.', 'M': 'повел.',
  'S': 'сосл.', 'O': 'желат.', 'N': 'инф.', 'P': 'прич.'
};

const PERSON_SHORT = { '1': '1 л.', '2': '2 л.', '3': '3 л.' };

/**
 * Возвращает массив коротких русских меток для морфокода Робинсона.
 * @param {string} code — например "N-NSM", "V-PAI-3S"
 * @returns {string[]} — например ['сущ.', 'им. п.', 'ед. ч.', 'м. р.']
 */
export function formatMorphShort(code) {
  if (!code || code === '---') return [];

  const parts = code.split('-');
  if (parts.length === 0) return [];

  const posChar = parts[0][0];
  const posShort = POS_SHORT[posChar] || parts[0];

  // Неизменяемые части речи (многосимвольные коды: PREP, CONJ, PRT)
  if (parts.length === 1) {
    const fullPos = parts[0];
    if (fullPos === 'PREP') return ['предл.', 'неизм.'];
    if (fullPos === 'CONJ') return ['союз', 'неизм.'];
    if (fullPos === 'PRT')  return ['част.', 'неизм.'];
    // Односимвольные неизменяемые: R, C, D, X, I
    return [posShort, 'неизм.'];
  }

  const result = [posShort];

  // Именные: N, A, T, P — parts[1] = NSM, GSF etc.
  if (posChar === 'N' || posChar === 'A' || posChar === 'T' || posChar === 'P') {
    const caseCode = parts[1][0];
    const numCode = parts[1][1];
    const genCode = parts[1][2];
    if (caseCode && CASE_SHORT[caseCode]) result.push(CASE_SHORT[caseCode]);
    if (numCode && NUMBER_SHORT[numCode]) result.push(NUMBER_SHORT[numCode]);
    if (genCode && GENDER_SHORT[genCode]) result.push(GENDER_SHORT[genCode]);
    return result;
  }

  // Глаголы: V — parts[1] = PAI, parts[2] = 3S
  if (posChar === 'V') {
    const tenseCode = parts[1][0];
    const voiceCode = parts[1][1];
    const moodCode = parts[1][2];

    if (tenseCode && TENSE_SHORT[tenseCode]) result.push(TENSE_SHORT[tenseCode]);
    if (voiceCode && VOICE_SHORT[voiceCode]) result.push(VOICE_SHORT[voiceCode]);
    // Для изъявительного наклонения (I) не показываем
    if (moodCode && moodCode !== 'I' && MOOD_SHORT[moodCode]) result.push(MOOD_SHORT[moodCode]);

    if (parts.length >= 3) {
      const personCode = parts[2][0];
      const numCode = parts[2][1];
      if (personCode && PERSON_SHORT[personCode]) result.push(PERSON_SHORT[personCode]);
      if (numCode && NUMBER_SHORT[numCode]) result.push(NUMBER_SHORT[numCode]);
    }
    return result;
  }

  // Предлоги, союзы, наречия, частицы
  if (posChar === 'R' || posChar === 'C' || posChar === 'D' || posChar === 'X' || posChar === 'I') {
    return result; // только часть речи, без «неизм.»
  }

  return result;
}

/**
 * Возвращает полные названия для tooltip.
 * @param {string} code
 * @returns {string}
 */
export function formatMorphFull(code) {
  if (!code || code === '---') return code || '—';
  return formatMorphRu(code);
}
