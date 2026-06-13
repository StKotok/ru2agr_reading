/**
 * Общие утилиты для работы с текстом и лингвистическими таблицами.
 * Используется convert-alignments.js и refine-alignments.mjs.
 */

// Зачистка пунктуации по краям русского слова
const TRAILING_PUNCT_RE = /[.,;:!?—\-–"'«»„"()\[\]'¿¡;]+$/g;
const LEADING_PUNCT_RE = /^[«»"'"„(\[\]—–-]+/;

/** Очищает русское слово от краевой пунктуации. */
export function cleanRuWord(word) {
  return word.replace(TRAILING_PUNCT_RE, '').replace(LEADING_PUNCT_RE, '');
}

// ---------------------------------------------------------------------------
// Именованные константы (единый источник для refine-правил и LLM-промпта)
// ---------------------------------------------------------------------------

/** Греческие леммы, которым «свой» соответствует (Strong's numbers). */
export const SVOV_LEMMAS = new Set([846, 1438, 2398, 4572, 1683]);

/** Рефлексивы — «свой» всегда exact (не G846). */
export const SVOV_REFLEXIVE = new Set([1438, 2398, 4572, 1683]);

/** Полная парадигма «свой» (словоформы, нормализованные cleanRuWord). */
export const SVOV_FORMS = new Set([
  'свой', 'своя', 'своё', 'свое', 'свои',
  'своего', 'своей', 'своих',
  'своему', 'своим',
  'свою',
  'своею', 'своими',
  'своём', 'своем'
]);

/** Русские слова при субстантивном артикле (ὁ δέ → «он же»). */
export const SUBST_ARTICLE_RU = new Set([
  'он', 'она', 'оно', 'они', 'тот', 'та', 'то', 'те'
]);

/** Греческие частицы, с которыми артикль субстантивен (Strong's). */
export const SUBST_ARTICLE_GR = new Set([1161, 3303]); // δέ, μέν

// ---------------------------------------------------------------------------
// Инвентарь русских местоимений (падеж+число+род)
// ---------------------------------------------------------------------------

/**
 * Каждая форма → { cases: Set, numbers: Set, genders: Set }
 * Падежи: N=Nom, G=Gen, D=Dat, A=Acc, I=Instr, L=Loc
 * Числа: s=sg, p=pl
 * Рода: m=masculine, f=feminine, n=neuter
 */
export const RU_PRONOUNS = {
  // --- Единственное число ---
  'он':    { cases: new Set(['N']), numbers: new Set(['s']), genders: new Set(['m']) },
  'она':   { cases: new Set(['N']), numbers: new Set(['s']), genders: new Set(['f']) },
  'оно':   { cases: new Set(['N']), numbers: new Set(['s']), genders: new Set(['n']) },
  'него':  { cases: new Set(['G','A']), numbers: new Set(['s']), genders: new Set(['m','n']) },
  'его':   { cases: new Set(['G','A']), numbers: new Set(['s']), genders: new Set(['m','n']) },
  'неё':   { cases: new Set(['G','A']), numbers: new Set(['s']), genders: new Set(['f']) },
  'её':    { cases: new Set(['G','A']), numbers: new Set(['s']), genders: new Set(['f']) },
  'нее':   { cases: new Set(['G','A']), numbers: new Set(['s']), genders: new Set(['f']) },
  'ее':    { cases: new Set(['G','A']), numbers: new Set(['s']), genders: new Set(['f']) },
  'нему':  { cases: new Set(['D']), numbers: new Set(['s']), genders: new Set(['m','n']) },
  'ему':   { cases: new Set(['D']), numbers: new Set(['s']), genders: new Set(['m','n']) },
  'ней':   { cases: new Set(['D','I','L']), numbers: new Set(['s']), genders: new Set(['f']) },
  'ей':    { cases: new Set(['D','I','L']), numbers: new Set(['s']), genders: new Set(['f']) },
  'ним':   { cases: new Set(['D','I']), numbers: new Set(['s']), genders: new Set(['m','n']) },
  'нём':   { cases: new Set(['L']), numbers: new Set(['s']), genders: new Set(['m','n']) },
  'нем':   { cases: new Set(['L']), numbers: new Set(['s']), genders: new Set(['m','n']) },
  'ею':    { cases: new Set(['I']), numbers: new Set(['s']), genders: new Set(['f']) },
  'нею':   { cases: new Set(['I']), numbers: new Set(['s']), genders: new Set(['f']) },

  // --- Множественное число ---
  'они':   { cases: new Set(['N']), numbers: new Set(['p']), genders: new Set(['m','f','n']) },
  'их':    { cases: new Set(['G','A','L']), numbers: new Set(['p']), genders: new Set(['m','f','n']) },
  'них':   { cases: new Set(['G','A','L']), numbers: new Set(['p']), genders: new Set(['m','f','n']) },
  'им':    { cases: new Set(['D']), numbers: new Set(['p']), genders: new Set(['m','f','n']) },
  'ним':   { cases: new Set(['D','I']), numbers: new Set(['p']), genders: new Set(['m','f','n']) },
  'ими':   { cases: new Set(['I']), numbers: new Set(['p']), genders: new Set(['m','f','n']) },
  'ними':  { cases: new Set(['I']), numbers: new Set(['p']), genders: new Set(['m','f','n']) },
};

/** Множество всех нормализованных форм личных местоимений (для быстрого lookup). */
export const RU_PRONOUN_WORDS = new Set(Object.keys(RU_PRONOUNS));

// ---------------------------------------------------------------------------
// Падеж греческого G846 (αὐτός) — парсер morph-кода
// ---------------------------------------------------------------------------

/**
 * Извлекает падеж+число+род из Robinson morph-кода.
 *   P-GSM  → "gsm"
 *   P-ASF  → "asf"
 *   F-3GSM → "gsm" (рефлексивный префикс срезается)
 *   ADV    → null (не местоимение)
 * @returns {string|null} трёхбуквенный код или null
 */
export function parseG846Case(morph) {
  if (!morph) return null;
  // Убираем \r и пробелы
  morph = morph.trim();
  if (morph === 'ADV') return null;
  // Последний сегмент после дефиса
  const parts = morph.split('-');
  let code = parts[parts.length - 1];
  // Срезать ведущую цифру лица (F-3GSM → GSM)
  code = code.replace(/^\d/, '');
  // Валидировать
  if (!/^[NGDA][SP][MFN]$/.test(code)) return null;
  return code.toLowerCase();
}

/**
 * Извлекает падеж (N/G/D/A) из трёхбуквенного кода.
 */
export function caseFromCode(c) {
  return c ? c[0] : null;
}

// ---------------------------------------------------------------------------
// Таблица совместимости падежей (беспредложный fallback)
// ---------------------------------------------------------------------------

/** Греческий падеж → множество допустимых русских падежей. */
export const CASE_COMPAT = {
  N: new Set(['N']),
  G: new Set(['G','A','I']),
  D: new Set(['D','I','L']),
  A: new Set(['G','A']),
};

// ---------------------------------------------------------------------------
// Предложная таблица: ключ = "греческийПредлог:падежG846"
// Значение: { ruPrep: Set<string>, ruCases: Set<string> }
// ---------------------------------------------------------------------------

export const PREP_TABLE = {
  // ἐν + Dat → «в, на» + Loc
  'ἐν:D':    { ruPrep: new Set(['в','во','на']), ruCases: new Set(['L']) },
  // εἰς + Acc → «в» + Acc / «к» + Dat
  'εἰς:A':   { ruPrep: new Set(['в','во','к']), ruCases: new Set(['A','D']) },
  // πρός + Acc → «к» + Dat
  'πρός:A':  { ruPrep: new Set(['к','ко']), ruCases: new Set(['D']) },
  // ἐκ + Gen → «из, от» + Gen
  'ἐκ:G':    { ruPrep: new Set(['из','от']), ruCases: new Set(['G']) },
  // ἀπό + Gen → «от» + Gen
  'ἀπό:G':   { ruPrep: new Set(['от']), ruCases: new Set(['G']) },
  // μετά + Gen → «с» + Instr
  'μετά:G':  { ruPrep: new Set(['с','со']), ruCases: new Set(['I']) },
  // μετά + Acc → «после» + Gen
  'μετά:A':  { ruPrep: new Set(['после']), ruCases: new Set(['G']) },
  // σύν + Dat → «с» + Instr
  'σύν:D':   { ruPrep: new Set(['с','со']), ruCases: new Set(['I']) },
  // περί + Gen → «о» + Loc
  'περί:G':  { ruPrep: new Set(['о','об']), ruCases: new Set(['L']) },
  // περί + Acc → «вокруг, около» + Gen
  'περί:A':  { ruPrep: new Set(['вокруг','около']), ruCases: new Set(['G']) },
  // διά + Gen → «через» + Acc / (Instr без предлога)
  'διά:G':   { ruPrep: new Set(['через']), ruCases: new Set(['A','I']) },
  // διά + Acc → «ради, для» + Gen
  'διά:A':   { ruPrep: new Set(['ради','для']), ruCases: new Set(['G']) },
  // ὑπέρ + Gen → «за, ради» + Gen/Acc
  'ὑπέρ:G':  { ruPrep: new Set(['за','ради']), ruCases: new Set(['G','A']) },
  // ὑπό + Gen → (Instr без предлога)
  'ὑπό:G':   { ruPrep: new Set([]), ruCases: new Set(['I']) },
  // ἐπί + Gen → «на, при» + Loc
  'ἐπί:G':   { ruPrep: new Set(['на','при']), ruCases: new Set(['L']) },
  // ἐπί + Acc → «на» + Acc
  'ἐπί:A':   { ruPrep: new Set(['на']), ruCases: new Set(['A']) },
  // ἐπί + Dat → «на, при» + Loc
  'ἐπί:D':   { ruPrep: new Set(['на','при']), ruCases: new Set(['L']) },
  // παρά + Gen → «от, у» + Gen
  'παρά:G':  { ruPrep: new Set(['от','у']), ruCases: new Set(['G']) },
  // παρά + Dat → «у» + Gen
  'παρά:D':  { ruPrep: new Set(['у']), ruCases: new Set(['G']) },
  // κατά + Gen → «на» + Acc / «против» + Gen
  'κατά:G':  { ruPrep: new Set(['на','против']), ruCases: new Set(['A','G']) },
  // κατά + Acc → «по» + Dat
  'κατά:A':  { ruPrep: new Set(['по']), ruCases: new Set(['D']) },
  // «Неправильные» предлоги-наречия
  'ὀπίσω:X':   { ruPrep: new Set(['за','позади']), ruCases: new Set(['I']) },
  'ἐνώπιον:X': { ruPrep: new Set(['пред','перед']), ruCases: new Set(['I']) },
  'ἔμπροσθεν:X': { ruPrep: new Set(['пред','перед']), ruCases: new Set(['I']) },
};

/**
 * Ищет запись в предложной таблице.
 * @param {string} prepGreek — греческий предлог (в нижнем регистре)
 * @param {string} grCase — падеж G846: N/G/D/A
 * @returns {object|null} запись таблицы или null (→ fallthrough на CASE_COMPAT)
 */
export function lookupPrep(prepGreek, grCase) {
  // Пробуем точный ключ
  let entry = PREP_TABLE[`${prepGreek}:${grCase}`];
  if (entry) return entry;
  // Пробуем с X (для наречий)
  entry = PREP_TABLE[`${prepGreek}:X`];
  return entry || null;
}
