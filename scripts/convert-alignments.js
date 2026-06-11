/**
 * Конвертер Clear-Bible Alignments → формат проекта.
 *
 * Из SBLGNT.tsv (греческие токены с номерами Стронга) генерирует:
 *   1. data/bibles/grc/*.json — греческий текст с токенами {w, lemma, morph, strong}
 *   2. Обновляет data/bibles/syn/*.json — добавляет alignment [{ru, gr}] к стихам
 *
 * Alignment строится по трёхуровневой стратегии:
 *   1. Manual ID — SBLGNT-RUSSYN-manual.json (89K ручных выравниваний по ID токенов)
 *   2. Strong + sequential consumption — поиск по Strong с потреблением по порядку
 *   3. Regex ruMatches — последний fallback для режима 3
 *
 * Использование:
 *   node scripts/convert-alignments.js
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Конфигурация
// ---------------------------------------------------------------------------

const SBLGNT_TSV = resolve(ROOT, 'docs', 'clear-bible-alignments', 'SBLGNT.tsv');
const RUSSYN_TSV = resolve(ROOT, 'docs', 'clear-bible-alignments', 'nt_RUSSYN.tsv');
const MANUAL_JSON = resolve(ROOT, 'docs', 'clear-bible-alignments', 'SBLGNT-RUSSYN-manual.json');
const LEXICON_JSON = resolve(ROOT, 'public', 'data', 'lexicon', 'core.json');
const BOOKS_JSON = resolve(ROOT, 'public', 'data', 'books.json');
const SYN_DIR = resolve(ROOT, 'public', 'data', 'bibles', 'syn');
const GRC_DIR = resolve(ROOT, 'public', 'data', 'bibles', 'grc');

// USFM book number → project book id
const BOOK_MAP = {
  40: 'matthew', 41: 'mark', 42: 'luke', 43: 'john',
  44: 'acts',
  45: 'romans', 46: '1corinthians', 47: '2corinthians',
  48: 'galatians', 49: 'ephesians', 50: 'philippians',
  51: 'colossians', 52: '1thessalonians', 53: '2thessalonians',
  54: '1timothy', 55: '2timothy', 56: 'titus', 57: 'philemon',
  58: 'hebrews', 59: 'james', 60: '1peter', 61: '2peter',
  62: '1john', 63: '2john', 64: '3john', 65: 'jude', 66: 'revelation'
};

// USFM book number → Greek title
const GRC_TITLES = {
  40: 'ΚΑΤΑ ΜΑΤΘΑΙΟΝ', 41: 'ΚΑΤΑ ΜΑΡΚΟΝ', 42: 'ΚΑΤΑ ΛΟΥΚΑΝ',
  43: 'ΚΑΤΑ ΙΩΑΝΝΗΝ', 44: 'ΠΡΑΞΕΙΣ ΑΠΟΣΤΟΛΩΝ',
  45: 'ΠΡΟΣ ΡΩΜΑΙΟΥΣ', 46: 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Α\'',
  47: 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Β\'', 48: 'ΠΡΟΣ ΓΑΛΑΤΑΣ',
  49: 'ΠΡΟΣ ΕΦΕΣΙΟΥΣ', 50: 'ΠΡΟΣ ΦΙΛΙΠΠΗΣΙΟΥΣ',
  51: 'ΠΡΟΣ ΚΟΛΟΣΣΑΕΙΣ', 52: 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Α\'',
  53: 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Β\'', 54: 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ Α\'',
  55: 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ Β\'', 56: 'ΠΡΟΣ ΤΙΤΟΝ', 57: 'ΠΡΟΣ ΦΙΛΗΜΟΝΑ',
  58: 'ΠΡΟΣ ΕΒΡΑΙΟΥΣ', 59: 'ΙΑΚΩΒΟΥ', 60: 'ΠΕΤΡΟΥ Α\'',
  61: 'ΠΕΤΡΟΥ Β\'', 62: 'ΙΩΑΝΝΟΥ Α\'', 63: 'ΙΩΑΝΝΟΥ Β\'',
  64: 'ΙΩΑΝΝΟΥ Γ\'', 65: 'ΙΟΥΔΑ', 66: 'ΑΠΟΚΑΛΥΨΙΣ ΙΩΑΝΝΟΥ'
};

// USFM book number → краткое греческое название
const GRC_SHORT = {
  40: 'Μθ', 41: 'Μκ', 42: 'Λκ', 43: 'Ιν', 44: 'Πρ',
  45: 'Ρω', 46: '1Κο', 47: '2Κο', 48: 'Γα', 49: 'Εφ',
  50: 'Φι', 51: 'Κο', 52: '1Θε', 53: '2Θε', 54: '1Τι',
  55: '2Τι', 56: 'Ττ', 57: 'Φλ', 58: 'Εβ', 59: 'Ια',
  60: '1Πε', 61: '2Πε', 62: '1Ιω', 63: '2Ιω', 64: '3Ιω',
  65: 'Ιδ', 66: 'Απ'
};

// ---------------------------------------------------------------------------
// Парсинг SBLGNT.tsv
// ---------------------------------------------------------------------------

/**
 * Парсит SBLGNT.tsv.
 * Колонки: id, altId, text, strongs, gloss, gloss2, lemma, pos, morph
 * Возвращает Map<verseRef, Token[]> где verseRef = BBCCCVVV (8 цифр).
 * Также возвращает Map<tokenId, {verseRef, position}> для разрешения manual alignment.
 */
function parseSblgnt(filePath) {
  const byVerse = new Map();
  const byTokenId = new Map(); // tokenId → {verseRef, indexInVerse}
  const text = readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  let skipped = 0;

  // Счётчики позиций внутри стиха
  const verseCounters = new Map(); // verseRef → nextIndex

  for (const line of lines) {
    if (!line.trim() || line.startsWith('id\t')) continue;
    const cols = line.split('\t');
    if (cols.length < 8) { skipped++; continue; }

    const tokenId = cols[0];          // n40001001001
    const word = cols[2];             // Βίβλος
    const strongsRaw = cols[3];       // G0976
    const lemma = cols[6];            // βίβλος
    const morph = cols[7];            // N-NSF

    // verseRef: nBBCCCVVVWWW → BBCCCVVV
    const bare = tokenId.startsWith('n') ? tokenId.slice(1) : tokenId;
    const verseRef = bare.slice(0, 8);

    // Strong's: G0976 → 976
    const strongNum = parseInt(strongsRaw.replace(/^G/i, ''), 10) || 0;

    const token = { w: word, lemma, morph, strong: strongNum };

    if (!byVerse.has(verseRef)) {
      byVerse.set(verseRef, []);
      verseCounters.set(verseRef, 0);
    }
    const idx = verseCounters.get(verseRef);
    byVerse.get(verseRef).push(token);
    byTokenId.set(tokenId, { verseRef, indexInVerse: idx });
    verseCounters.set(verseRef, idx + 1);
  }

  return { byVerse, byTokenId };
}

// ---------------------------------------------------------------------------
// Парсинг nt_RUSSYN.tsv
// ---------------------------------------------------------------------------

/**
 * Парсит nt_RUSSYN.tsv.
 * Колонки: id, source_verse, text, skip_space_after, exclude, id_range_end, source_verse_range_end
 * Возвращает Map<tokenId, {verseRef, wordIndex, isPunct}>.
 * wordIndex — индекс среди НЕ-пунктуационных токенов (0-based),
 * соответствует позиции слова в verseText.split(/\s+/).
 * Пунктуационные токены (exclude='y' — знаки препинания) не учитываются в wordIndex.
 */
function parseRussyn(filePath) {
  const byTokenId = new Map();
  const verseWordCounters = new Map(); // verseRef → nextWordIndex (без пунктуации)

  const text = readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');

  for (const line of lines) {
    if (!line.trim() || line.startsWith('id\t')) continue;
    const cols = line.split('\t');
    if (cols.length < 2) continue;

    const tokenId = cols[0];         // 40001001001
    const verseRefRaw = cols[1];     // 40001001
    const tokenText = cols[2] || ''; // текст токена
    const exclude = cols[4] || '';   // 'y' для пунктуационных токенов

    if (!verseRefRaw || verseRefRaw.length < 8) continue;

    const verseRef = verseRefRaw.slice(0, 8);

    // Пунктуация помечена exclude='y' в данных Clear-Bible
    const isPunct = exclude === 'y';

    if (!verseWordCounters.has(verseRef)) {
      verseWordCounters.set(verseRef, 0);
    }

    if (isPunct) {
      byTokenId.set(tokenId, { verseRef, wordIndex: -1, isPunct: true });
    } else {
      const wordIdx = verseWordCounters.get(verseRef);
      byTokenId.set(tokenId, { verseRef, wordIndex: wordIdx, isPunct: false });
      verseWordCounters.set(verseRef, wordIdx + 1);
    }
  }

  return byTokenId;
}

// ---------------------------------------------------------------------------
// Парсинг manual alignment JSON
// ---------------------------------------------------------------------------

/**
 * Парсит SBLGNT-RUSSYN-manual.json.
 * Возвращает массив записей: [{sourceIds: string[], targetIds: string[], id: string}].
 */
function parseManualAlignment(filePath) {
  if (!existsSync(filePath)) {
    console.log('   ⚠️  Manual alignment file not found, skipping.');
    return [];
  }
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  return (data.records || []).map(r => ({
    sourceIds: r.source || [],
    targetIds: r.target || [],
    id: r.meta?.id || ''
  }));
}

// ---------------------------------------------------------------------------
// Сборка греческих книг
// ---------------------------------------------------------------------------

function buildGrcBooks(byVerse) {
  const books = new Map();
  for (const [verseRef, tokens] of byVerse) {
    const bookNum = parseInt(verseRef.slice(0, 2), 10);
    const chN = parseInt(verseRef.slice(2, 5), 10);
    const vN = parseInt(verseRef.slice(5, 8), 10);
    const bookId = BOOK_MAP[bookNum];
    if (!bookId) continue;

    if (!books.has(bookId)) {
      books.set(bookId, { bookNum, chapters: new Map() });
    }
    const chapters = books.get(bookId).chapters;
    if (!chapters.has(chN)) chapters.set(chN, new Map());
    chapters.get(chN).set(vN, tokens);
  }
  return books;
}

function serializeGrcBook(bookId, bookData, booksMeta) {
  const meta = booksMeta.find(b => b.id === bookId);
  const bookNum = bookData.bookNum;
  const chaptersMap = bookData.chapters;
  const maxCh = meta ? meta.chapters : Math.max(...chaptersMap.keys());

  const chapters = [];
  for (let chN = 1; chN <= maxCh; chN++) {
    const versesMap = chaptersMap.get(chN);
    const verses = [];

    if (versesMap && versesMap.size > 0) {
      const maxV = Math.max(...versesMap.keys());
      for (let vN = 1; vN <= maxV; vN++) {
        const tokens = versesMap.get(vN);
        if (tokens && tokens.length > 0) {
          verses.push({ n: vN, text: tokens.map(t => t.w).join(' '), tokens });
        }
      }
    }

    chapters.push({ n: chN, verses });
  }

  return {
    id: bookId,
    title: GRC_TITLES[bookNum] || bookId,
    short: GRC_SHORT[bookNum] || bookId.slice(0, 3),
    chapters
  };
}

// ---------------------------------------------------------------------------
// Стоп-списки для фильтрации ложных пар
// ---------------------------------------------------------------------------

// Русские служебные слова — не должны выравниваться на знаменательные греческие
const RU_STOP_WORDS = new Set([
  'и', 'в', 'у', 'с', 'на', 'к', 'не', 'же', 'а', 'о', 'по', 'за',
  'от', 'до', 'из', 'со', 'об', 'при', 'без', 'но', 'ли', 'бы', 'то',
  'как', 'что', 'он', 'она', 'они', 'оно', 'мы', 'вы', 'я', 'ты',
  'его', 'ее', 'её', 'их', 'им', 'нас', 'вас', 'мне', 'тебе', 'тебя',
  'себя', 'себе', 'мой', 'твой', 'свой', 'наш', 'ваш',
  'это', 'эта', 'этот', 'эти', 'там', 'тут', 'где', 'кто', 'когда',
  'весь', 'вся', 'всё', 'все', 'ещё', 'уже', 'так', 'да', 'нет',
  'был', 'была', 'было', 'были', 'есть', 'будет', 'будут',
  'или', 'чтобы', 'если', 'хотя', 'ибо', 'потому', 'посему',
  'один', 'одна', 'одно', 'одни', 'два', 'три',
  'более', 'менее', 'очень', 'лишь', 'только', 'вот',
]);

// Греческие функциональные слова: артикли, союзы, предлоги, частицы, отрицания
const GR_FUNCTION_LEMMAS = new Set([
  'ὁ', 'καί', 'δέ', 'τε', 'γάρ', 'οὖν', 'μέν', 'ἀλλά', 'ἤ', 'εἰ',
  'ἐάν', 'ὅτι', 'ἵνα', 'ὡς', 'καθώς', 'ὅτε', 'ὅταν', 'ἕως', 'πρίν',
  'ἐν', 'εἰς', 'ἐκ', 'πρός', 'ἀπό', 'διά', 'μετά', 'περί', 'ὑπό',
  'ἐπί', 'παρά', 'κατά', 'ὑπέρ', 'σύν', 'πρό', 'ἀντί', 'χωρίς',
  'οὐ', 'μή', 'οὐκ', 'οὐχ', 'μήτι', 'οὐδείς', 'μηδείς',
  'αὐτός', 'ἐγώ', 'σύ', 'ἐκεῖνος', 'οὗτος', 'ὅς', 'τίς',
  'εἰμί', 'λέγω', 'γίνομαι', 'ἔχω',  // ultra-common verbs rarely useful for dictionary
]);

const GR_FUNCTION_MORPH_PREFIXES = ['T-', 'CONJ', 'PREP', 'PRT', 'D-', 'I-', 'X-'];

// ---------------------------------------------------------------------------
// Alignment — четырёхуровневая стратегия
// ---------------------------------------------------------------------------

/**
 * Уровень 1: Manual ID alignment.
 * Разрешает ID токенов из SBLGNT-RUSSYN-manual.json в позиции внутри стихов.
 *
 * @returns {Map<string, Array>} verseKey → alignment[]
 */
function buildManualAlignment(manualRecords, grcByTokenId, ruByTokenId) {
  const byVerse = new Map(); // "BBCCCVVV" → [{ru, gr, srcId, tgtId}]

  for (const record of manualRecords) {
    for (const srcId of record.sourceIds) {
      const grcInfo = grcByTokenId.get(srcId);
      if (!grcInfo) continue;

      for (const tgtId of record.targetIds) {
        const ruInfo = ruByTokenId.get(tgtId);
        if (!ruInfo) continue;
        if (ruInfo.isPunct || ruInfo.wordIndex < 0) continue;
        if (grcInfo.verseRef !== ruInfo.verseRef) continue;

        const verseKey = grcInfo.verseRef;
        if (!byVerse.has(verseKey)) {
          byVerse.set(verseKey, []);
        }
        byVerse.get(verseKey).push({
          ru: ruInfo.wordIndex,
          gr: grcInfo.indexInVerse,
          srcId,
          tgtId
        });
      }
    }
  }

  return byVerse;
}

/**
 * Фильтрует и дедуплицирует alignment для одного стиха.
 *
 * Фазы:
 * 1) Удалить пары где русское слово — служебное (< 3 букв или в стоп-списке)
 *    И греческий токен — знаменательный (Strong в лексиконе)
 * 2) Удалить пары где греческий токен — функциональный (артикль/союз/предлог/частица)
 * 3) Order-aware re-matching: для Strong с несколькими вхождениями в стихе
 *    собрать ВСЕ русские слова, матчащиеся по regex лексикона, и ВСЕ греческие
 *    токены с этим Strong — сопоставить 1-е→1-е, 2-е→2-е по порядку
 *
 * @returns {{ alignment: Array, droppedFunc: number, totalBefore: number }}
 */
function filterAndDedupAlignment(rawAlignments, verseText, grcTokens, lexicon) {
  const totalBefore = rawAlignments.length;
  const words = verseText.split(/\s+/);
  const strongSet = new Set(lexicon.filter(l => l.strong && !l.skip).map(l => l.strong));

  // Строим карту Strong → [ruMatches regex] из лексикона
  const strongRegexps = new Map();
  for (const lexeme of lexicon) {
    if (!lexeme.strong || lexeme.skip) continue;
    const patterns = [];
    for (const p of lexeme.ruMatches) {
      try { patterns.push(new RegExp(p, 'iu')); } catch (_) {}
    }
    if (patterns.length > 0) {
      if (!strongRegexps.has(lexeme.strong)) strongRegexps.set(lexeme.strong, { patterns, excludes: [] });
      // Объединяем exclude-паттерны
      for (const ep of (lexeme.ruExclude || [])) {
        try { strongRegexps.get(lexeme.strong).excludes.push(new RegExp(ep, 'iu')); } catch (_) {}
      }
    }
  }

  // Фаза 1-2: фильтрация
  const filtered = [];
  let droppedFunc = 0;

  for (const a of rawAlignments) {
    const ruWord = words[a.ru] || '';
    const cleanRu = ruWord.replace(/[.,;:!?—\-–"'«»„"()\[\]¿¡;]+$/g, '').replace(/^[«»"'(\[\]]+/g, '').toLowerCase();

    // Фаза 1: русское служебное → греческое знаменательное
    if ((cleanRu.length < 3 || RU_STOP_WORDS.has(cleanRu)) &&
        a.gr < grcTokens.length && strongSet.has(grcTokens[a.gr]?.strong)) {
      droppedFunc++;
      continue;
    }

    // Фаза 2: греческий функциональный токен
    const grToken = grcTokens[a.gr];
    if (grToken) {
      if (GR_FUNCTION_LEMMAS.has(grToken.lemma)) continue;
      const morphPrefix = (grToken.morph || '').split('-')[0] || '';
      if (GR_FUNCTION_MORPH_PREFIXES.includes(morphPrefix)) continue;
    }

    filtered.push(a);
  }

  // Фаза 3: order-aware re-matching для повторяющихся Strong
  const grStrongMap = new Map(); // strong → [grIndices sorted]
  for (let i = 0; i < grcTokens.length; i++) {
    const s = grcTokens[i].strong;
    if (s && strongSet.has(s)) {
      if (!grStrongMap.has(s)) grStrongMap.set(s, []);
      grStrongMap.get(s).push(i);
    }
  }

  // Собираем alignment через order-aware matching
  const strongAware = [];
  const usedRu = new Set();
  const usedGr = new Set();

  // Сначала: обрабатываем Strong, у которых несколько вхождений
  for (const [strong, grIndices] of grStrongMap) {
    if (grIndices.length <= 1) continue;

    const regexInfo = strongRegexps.get(strong);
    if (!regexInfo) continue;

    // Находим ВСЕ русские слова в стихе, матчащиеся по regex этого Strong
    const matchingRuIndices = [];
    for (let wi = 0; wi < words.length; wi++) {
      const clean = words[wi].replace(/[.,;:!?—\-–"'«»„"()\[\]¿¡;]+$/g, '').replace(/^[«»"'(\[\]]+/g, '').toLowerCase();
      if (clean.length < 3 || RU_STOP_WORDS.has(clean)) continue;

      let matched = false;
      for (const re of regexInfo.patterns) {
        if (re.test(words[wi])) {
          let excluded = false;
          for (const excRe of regexInfo.excludes) {
            if (excRe.test(words[wi])) { excluded = true; break; }
          }
          if (!excluded) { matched = true; break; }
        }
      }
      if (matched) matchingRuIndices.push(wi);
    }

    // Также собираем уже существующие пары из filtered для этого Strong
    for (const a of filtered) {
      if (a.gr < grcTokens.length && grcTokens[a.gr].strong === strong) {
        if (!matchingRuIndices.includes(a.ru)) matchingRuIndices.push(a.ru);
      }
    }

    // Сортируем и дедуплицируем
    const uniqueRu = [...new Set(matchingRuIndices)].sort((a, b) => a - b);
    const uniqueGr = [...grIndices].sort((a, b) => a - b);

    // Сопоставляем по порядку
    const maxLen = Math.min(uniqueRu.length, uniqueGr.length);
    for (let i = 0; i < maxLen; i++) {
      strongAware.push({ ru: uniqueRu[i], gr: uniqueGr[i] });
      usedRu.add(uniqueRu[i]);
      usedGr.add(uniqueGr[i]);
    }
  }

  // Добавляем оставшиеся пары из filtered (не part of multi-Strong)
  for (const a of filtered) {
    if (usedRu.has(a.ru) || usedGr.has(a.gr)) continue;
    strongAware.push(a);
    usedRu.add(a.ru);
    usedGr.add(a.gr);
  }

  // Финальная сортировка
  const alignment = strongAware
    .sort((a, b) => a.ru - b.ru)
    .filter((a, i, arr) => i === 0 || a.ru !== arr[i - 1].ru); // дедуп по ru

  return { alignment, droppedFunc, totalBefore };
}

/**
 * Подсчитывает качество manual alignment: % пар где русское служебное слово
 */
function computeQualityMetrics(manualByVerse, synDir, grcBooks, lexicon) {
  const strongSet = new Set(lexicon.filter(l => l.strong && !l.skip).map(l => l.strong));
  let totalManualPairs = 0;
  let badPairs = 0;

  const files = readdirSync(synDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const synBook = JSON.parse(readFileSync(resolve(synDir, file), 'utf-8'));
    const bookId = synBook.id;
    const grcBook = grcBooks.get(bookId);

    for (const ch of synBook.chapters) {
      for (const verse of ch.verses) {
        if (!verse.alignment || verse.alignment.length === 0) continue;
        const words = verse.text.split(/\s+/);
        const grcTokens = grcBook?.chapters?.get(ch.n)?.get(verse.n) || [];

        for (const a of verse.alignment) {
          totalManualPairs++;
          const ruWord = (words[a.ru] || '').replace(/[.,;:!?—\-–"'«»„"()\[\]¿¡;]+$/g, '').toLowerCase();
          if ((ruWord.length < 3 || RU_STOP_WORDS.has(ruWord)) &&
              a.gr < grcTokens.length && strongSet.has(grcTokens[a.gr]?.strong)) {
            badPairs++;
          }
        }
      }
    }
  }

  return { totalManualPairs, badPairs, pct: totalManualPairs > 0 ? (badPairs / totalManualPairs * 100).toFixed(1) : '0.0' };
}

/**
 * Уровень 2: Strong + sequential consumption.
 * Для стихов без manual alignment — ищет греческий токен с тем же Strong,
 * используя sequential consumption (Map<strong, usageCount>).
 *
 * @param {string} verseText — русский текст стиха
 * @param {Array} grcTokens — греческие токены
 * @param {Array} lexicon — лексикон
 * @returns {Array|null}
 */
function buildStrongAlignment(verseText, grcTokens, lexicon) {
  if (!grcTokens || grcTokens.length === 0) return null;

  const words = verseText.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return null;

  // Строим карту strong → [индексы токенов] для sequential consumption
  const strongToIndices = new Map();
  for (let i = 0; i < grcTokens.length; i++) {
    const s = grcTokens[i].strong;
    if (s) {
      if (!strongToIndices.has(s)) strongToIndices.set(s, []);
      strongToIndices.get(s).push(i);
    }
  }

  // Счётчики потребления: strong → сколько уже использовано
  const strongUsage = new Map();

  // Карта лексем по Strong для быстрого поиска
  const lexByStrong = new Map();
  for (const lexeme of lexicon) {
    if (lexeme.strong) {
      if (!lexByStrong.has(lexeme.strong)) lexByStrong.set(lexeme.strong, []);
      lexByStrong.get(lexeme.strong).push(lexeme);
    }
  }

  const alignment = [];

  for (let wi = 0; wi < words.length; wi++) {
    const cleanWord = words[wi].replace(/[.,;:!?—\-–"«»„"()\[\]'¿¡;]+$/g, '').replace(/^[«»"'(\[\]]+/g, '');
    if (cleanWord.length === 0) continue;

    for (const [strong, lexemes] of lexByStrong) {
      // Проверяем regex-паттерны лексемы
      let matched = false;
      for (const lexeme of lexemes) {
        for (const pattern of lexeme.ruMatches) {
          try {
            const re = new RegExp(pattern, 'iu');
            if (re.test(cleanWord)) {
              let excluded = false;
              for (const excPattern of (lexeme.ruExclude || [])) {
                try {
                  const excRe = new RegExp(excPattern, 'iu');
                  if (excRe.test(cleanWord)) { excluded = true; break; }
                } catch (_) { /* skip */ }
              }
              if (!excluded) { matched = true; break; }
            }
          } catch (_) { /* skip */ }
        }
        if (matched) break;
      }
      if (!matched) continue;

      // Sequential consumption: ищем usageCount-е вхождение
      const indices = strongToIndices.get(strong);
      if (!indices || indices.length === 0) continue;

      const used = strongUsage.get(strong) || 0;
      if (used < indices.length) {
        const grIdx = indices[used];
        strongUsage.set(strong, used + 1);
        alignment.push({ ru: wi, gr: grIdx });
        break;
      }
    }
  }

  return alignment.length > 0 ? alignment : null;
}

/**
 * Уровень 3: Regex ruMatches (последний fallback).
 * Только для режима 3. Использует first match (не sequential).
 *
 * @param {string} verseText
 * @param {Array} grcTokens
 * @param {Array} lexicon
 * @returns {Array|null}
 */
function buildRegexAlignment(verseText, grcTokens, lexicon) {
  if (!grcTokens || grcTokens.length === 0) return null;

  const words = verseText.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return null;

  // Строим strong → первый индекс токена
  const strongToGrIdx = new Map();
  for (let i = 0; i < grcTokens.length; i++) {
    const s = grcTokens[i].strong;
    if (s && !strongToGrIdx.has(s)) {
      strongToGrIdx.set(s, i);
    }
  }

  const alignment = [];

  for (let wi = 0; wi < words.length; wi++) {
    const cleanWord = words[wi].replace(/[.,;:!?—\-–"«»„"()\[\]'¿¡;]+$/g, '').replace(/^[«»"'(\[\]]+/g, '');
    if (cleanWord.length === 0) continue;

    for (const lexeme of lexicon) {
      const strong = lexeme.strong;
      if (!strong) continue;

      let matched = false;
      for (const pattern of lexeme.ruMatches) {
        try {
          const re = new RegExp(pattern, 'iu');
          if (re.test(cleanWord)) {
            let excluded = false;
            for (const excPattern of (lexeme.ruExclude || [])) {
              try {
                const excRe = new RegExp(excPattern, 'iu');
                if (excRe.test(cleanWord)) { excluded = true; break; }
              } catch (_) { /* skip */ }
            }
            if (!excluded) { matched = true; break; }
          }
        } catch (_) { /* skip */ }
      }
      if (!matched) continue;

      const grIdx = strongToGrIdx.get(strong);
      if (grIdx !== undefined) {
        alignment.push({ ru: wi, gr: grIdx });
        break;
      }
    }
  }

  return alignment.length > 0 ? alignment : null;
}

/**
 * Главная функция построения alignment для стиха.
 * Трёхуровневая стратегия: Manual ID → Strong → Regex.
 *
 * @param {string} verseKey — "BBCCCVVV"
 * @param {string} verseText — русский текст
 * @param {Array} grcTokens — греческие токены
 * @param {Map} manualByVerse — manual alignment по стихам
 * @param {Array} lexicon — лексикон
 * @returns {{ alignment: Array|null, tier: string }}
 */
function buildAlignment(verseKey, verseText, grcTokens, manualByVerse, lexicon) {
  // Уровень 1: Manual ID
  const manualAlign = manualByVerse.get(verseKey);
  if (manualAlign && manualAlign.length > 0) {
    return { alignment: manualAlign, tier: 'manual' };
  }

  // Уровень 2: Strong + sequential
  if (grcTokens && grcTokens.length > 0) {
    const strongAlign = buildStrongAlignment(verseText, grcTokens, lexicon);
    if (strongAlign) {
      return { alignment: strongAlign, tier: 'strong' };
    }

    // Уровень 3: Regex
    const regexAlign = buildRegexAlignment(verseText, grcTokens, lexicon);
    if (regexAlign) {
      return { alignment: regexAlign, tier: 'regex' };
    }

  }

  return { alignment: null, tier: 'none' };
}

// ---------------------------------------------------------------------------
// Обновление syn-файлов
// ---------------------------------------------------------------------------

function updateSynWithAlignment(synDir, grcBooks, manualByVerse, lexicon, grcByTokenId) {
  const files = readdirSync(synDir).filter(f => f.endsWith('.json'));

  // Статистика
  let totalVerses = 0;
  let manualCount = 0;
  let strongCount = 0;
  let regexCount = 0;
  let noneCount = 0;

  for (const file of files) {
    const filePath = resolve(synDir, file);
    const synBook = JSON.parse(readFileSync(filePath, 'utf-8'));
    const bookId = synBook.id;
    const grcBook = grcBooks.get(bookId);

    // Карта "ch:v" → tokens
    const grcVerseMap = new Map();
    if (grcBook) {
      for (const [chN, versesMap] of grcBook.chapters) {
        for (const [vN, tokens] of versesMap) {
          if (tokens && tokens.length > 0) {
            grcVerseMap.set(`${chN}:${vN}`, tokens);
          }
        }
      }
    }

    for (const ch of synBook.chapters) {
      for (const verse of ch.verses) {
        totalVerses++;
        const verseKey = buildVerseKey(bookId, ch.n, verse.n, grcByTokenId);

        // Получаем grcTokens для этого стиха
        const grcTokens = grcVerseMap.get(`${ch.n}:${verse.n}`);

        // Для manual alignment применяем фильтрацию служебных слов
        let { alignment, tier } = buildAlignment(
          verseKey, verse.text, grcTokens, manualByVerse, lexicon
        );

        if (alignment && tier === 'manual') {
          const result = filterAndDedupAlignment(alignment, verse.text, grcTokens, lexicon);
          alignment = result.alignment.length > 0 ? result.alignment : null;
          if (!alignment) tier = 'none';
        }

        if (alignment) {
          verse.alignment = alignment;
        } else {
          delete verse.alignment;
        }

        switch (tier) {
          case 'manual': manualCount++; break;
          case 'strong': strongCount++; break;
          case 'regex': regexCount++; break;
          default: noneCount++; break;
        }
      }
    }

    writeFileSync(filePath, JSON.stringify(synBook, null, 2), 'utf-8');
  }

  console.log(`\n📊 Статистика alignment:`);
  console.log(`   Всего стихов: ${totalVerses}`);
  console.log(`   Manual ID:    ${manualCount} (${(manualCount / totalVerses * 100).toFixed(1)}%)`);
  console.log(`   Strong+seq:   ${strongCount} (${(strongCount / totalVerses * 100).toFixed(1)}%)`);
  console.log(`   Regex:        ${regexCount} (${(regexCount / totalVerses * 100).toFixed(1)}%)`);
  console.log(`   Без alignment: ${noneCount} (${(noneCount / totalVerses * 100).toFixed(1)}%)`);
  console.log(`   Общее покрытие: ${totalVerses - noneCount} / ${totalVerses} (${((totalVerses - noneCount) / totalVerses * 100).toFixed(1)}%)`);
}

/**
 * Строит verseKey (BBCCCVVV) из bookId + chapter + verse.
 * Использует grcByTokenId для поиска примера токена этой книги.
 */
function buildVerseKey(bookId, chN, vN, grcByTokenId) {
  // Находим book number
  const bookNum = Object.entries(BOOK_MAP).find(([_, id]) => id === bookId)?.[0];
  if (!bookNum) return '';

  const bookStr = String(bookNum).padStart(2, '0');
  const chStr = String(chN).padStart(3, '0');
  const vStr = String(vN).padStart(3, '0');
  return `${bookStr}${chStr}${vStr}`;
}

// ---------------------------------------------------------------------------
// Верификация
// ---------------------------------------------------------------------------

function verify(synDir, grcBooks) {
  console.log('\n🔍 Верификация alignment...');
  let errors = 0;

  const STOP_RU = new Set(['в', 'и', 'у', 'с', 'на', 'к', 'не', 'а', 'о', 'было', 'был', 'были', 'есть']);
  const FN_GR_LEMMAS = new Set(['ὁ', 'καί', 'δέ', 'ἐν', 'εἰς', 'ἐκ', 'πρός', 'εἰμί']);

  // === Ин 1:1 ===
  const johnPath = resolve(synDir, 'john.json');
  if (existsSync(johnPath)) {
    const john = JSON.parse(readFileSync(johnPath, 'utf-8'));
    const v = john.chapters[0]?.verses[0];
    if (!v?.alignment || v.alignment.length === 0) {
      console.log('   ❌ Ин 1:1 — alignment отсутствует');
      errors++;
    } else {
      const words = v.text.split(/\s+/);
      const grcTokens = grcBooks.get('john')?.chapters?.get(1)?.get(1) || [];
      const alignMap = new Map(v.alignment.map(a => [a.ru, a.gr]));

      // 1) Все 3 «Слово» → 3 разных λόγος
      const logosRus = [3, 5, 10]; // ожидаемые позиции трёх «Слово»
      const logosGrs = logosRus.map(ru => alignMap.get(ru)).filter(g => g !== undefined);
      const uniqueLogos = new Set(logosGrs);
      const allAreLogos = logosGrs.every(g => g < grcTokens.length && grcTokens[g].lemma === 'λόγος');
      const formsAreNom = logosGrs.every(g => g < grcTokens.length && grcTokens[g].w === 'λόγος');

      if (logosGrs.length === 3 && uniqueLogos.size === 3 && allAreLogos && formsAreNom) {
        console.log(`   ✅ Ин 1:1 — 3 «Слово» → 3 разных λόγος (gr=${logosGrs.join(',')})`);
      } else {
        console.log(`   ❌ Ин 1:1 — «Слово»: найдено ${logosGrs.length}/3, уникальных gr=${uniqueLogos.size}/3`);
        if (!allAreLogos) console.log('      НЕ все указывают на лемму λόγος');
        if (!formsAreNom) console.log('      НЕ все формы = λόγος (именительный)');
        errors++;
      }

      // 2) «Бог» (ru=12) → θεὸς (номинатив), НЕ θεόν
      const bogGr = alignMap.get(12);
      if (bogGr !== undefined && bogGr < grcTokens.length) {
        const t = grcTokens[bogGr];
        if (t.w === 'θεὸς' && t.lemma === 'θεός') {
          console.log('   ✅ Ин 1:1 — «Бог» → θεὸς (именительный)');
        } else {
          console.log(`   ❌ Ин 1:1 — «Бог» → ${t.w} (${t.lemma}), ожидалось θεὸς`);
          errors++;
        }
      } else {
        console.log('   ❌ Ин 1:1 — «Бог» не выровнен');
        errors++;
      }

      // 3) «Бога» (ru=8) → θεόν
      const bogaGr = alignMap.get(8);
      if (bogaGr !== undefined && bogaGr < grcTokens.length) {
        const t = grcTokens[bogaGr];
        if (t.w === 'θεόν' && t.lemma === 'θεός') {
          console.log('   ✅ Ин 1:1 — «Бога» → θεόν (винительный)');
        } else {
          console.log(`   ❌ Ин 1:1 — «Бога» → ${t.w} (${t.lemma}), ожидалось θεόν`);
          errors++;
        }
      } else {
        console.log('   ❌ Ин 1:1 — «Бога» не выровнен');
        errors++;
      }

      // 4) НЕТ служебных слов в alignment
      const funcWordPairs = v.alignment.filter(a => {
        const w = (words[a.ru] || '').replace(/[.,;:!?—\-–"'«»„"()\[\]¿¡;]+$/g, '').toLowerCase();
        const grToken = grcTokens[a.gr];
        return STOP_RU.has(w) && grToken && FN_GR_LEMMAS.has(grToken.lemma);
      });
      if (funcWordPairs.length === 0) {
        console.log('   ✅ Ин 1:1 — нет служебных слов в alignment');
      } else {
        console.log(`   ❌ Ин 1:1 — ${funcWordPairs.length} служебных слов в alignment`);
        errors++;
      }
    }
  }

  // === Мк 1:1 ===
  const markPath = resolve(synDir, 'mark.json');
  if (existsSync(markPath)) {
    const mark = JSON.parse(readFileSync(markPath, 'utf-8'));
    const v = mark.chapters[0]?.verses[0];
    if (!v?.alignment || v.alignment.length === 0) {
      console.log('   ❌ Мк 1:1 — alignment отсутствует');
      errors++;
    } else {
      const grcTokens = grcBooks.get('mark')?.chapters?.get(1)?.get(1) || [];
      const alignMap = new Map(v.alignment.map(a => [a.ru, a.gr]));

      // 1) «Начало» (ru=0) → gr=0 (Ἀρχὴ)
      const nachaloGr = alignMap.get(0);
      if (nachaloGr === 0 && grcTokens[0]?.w === 'Ἀρχὴ') {
        console.log('   ✅ Мк 1:1 — «Начало» → Ἀρχὴ (gr=0)');
      } else {
        console.log(`   ❌ Мк 1:1 — «Начало» → gr=${nachaloGr}, ожидалось gr=0 (Ἀρχὴ)`);
        errors++;
      }

      // 2) «Евангелия» (ru=1) → εὐαγγελίου
      const evGr = alignMap.get(1);
      if (evGr !== undefined && evGr < grcTokens.length) {
        const t = grcTokens[evGr];
        if (t.w === 'εὐαγγελίου' && t.lemma === 'εὐαγγέλιον') {
          console.log('   ✅ Мк 1:1 — «Евангелия» → εὐαγγελίου (род. падеж)');
        } else {
          console.log(`   ❌ Мк 1:1 — «Евангелия» → ${t.w} (${t.lemma}), ожидалось εὐαγγελίου`);
          errors++;
        }
      } else {
        console.log('   ❌ Мк 1:1 — «Евангелия» не выровнено');
        errors++;
      }

      // 3) «Иисуса» (ru=2) → Ἰησοῦ
      const isGr = alignMap.get(2);
      if (isGr !== undefined && isGr < grcTokens.length) {
        const t = grcTokens[isGr];
        if (t.w === 'Ἰησοῦ' && t.lemma === 'Ἰησοῦς') {
          console.log('   ✅ Мк 1:1 — «Иисуса» → Ἰησοῦ (род. падеж)');
        } else {
          console.log(`   ❌ Мк 1:1 — «Иисуса» → ${t.w} (${t.lemma}), ожидалось Ἰησοῦ`);
          errors++;
        }
      } else {
        console.log('   ❌ Мк 1:1 — «Иисуса» не выровнено');
        errors++;
      }
    }
  }

  if (errors > 0) {
    console.error(`\n❌❌❌ Верификация провалена: ${errors} ошибок. Исправь alignment и перезапусти.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Главная
// ---------------------------------------------------------------------------

function main() {
  console.log('=== Конвертер Clear-Bible Alignments → формат проекта ===\n');

  // 1. Проверяем входные файлы
  if (!existsSync(SBLGNT_TSV)) {
    console.error(`❌ Не найден ${SBLGNT_TSV}`);
    console.error('   Сначала скачайте файлы в docs/clear-bible-alignments/');
    process.exit(1);
  }

  // 2. Загружаем метаданные книг
  const booksMeta = JSON.parse(readFileSync(BOOKS_JSON, 'utf-8'));

  // 3. Парсим SBLGNT → строим греческие книги
  console.log('📖 Парсинг SBLGNT.tsv...');
  const { byVerse, byTokenId: grcByTokenId } = parseSblgnt(SBLGNT_TSV);
  console.log(`   Стихов с токенами: ${byVerse.size}`);
  console.log(`   Греческих токенов: ${grcByTokenId.size}`);

  const grcBooks = buildGrcBooks(byVerse);
  console.log(`   Книг: ${grcBooks.size}`);

  // 4. Парсим nt_RUSSYN.tsv для разрешения target ID в manual alignment
  console.log('\n📖 Парсинг nt_RUSSYN.tsv...');
  let ruByTokenId = new Map();
  if (existsSync(RUSSYN_TSV)) {
    ruByTokenId = parseRussyn(RUSSYN_TSV);
    console.log(`   Русских токенов: ${ruByTokenId.size}`);
  } else {
    console.log('   ⚠️  nt_RUSSYN.tsv не найден — manual alignment будет пропущен');
  }

  // 5. Парсим manual alignment
  console.log('\n📖 Парсинг SBLGNT-RUSSYN-manual.json...');
  const manualRecords = parseManualAlignment(MANUAL_JSON);
  console.log(`   Manual alignment записей: ${manualRecords.length}`);

  // Строим manual alignment по стихам
  const manualByVerse = buildManualAlignment(manualRecords, grcByTokenId, ruByTokenId);
  const manualVerseCount = manualByVerse.size;
  const totalAlignPairs = [...manualByVerse.values()].reduce((s, a) => s + a.length, 0);
  console.log(`   Стихов с manual alignment: ${manualVerseCount}`);
  console.log(`   Пар alignment всего: ${totalAlignPairs}`);

  // 6. Генерируем data/bibles/grc/*.json
  console.log('\n📝 Генерация data/bibles/grc/*.json...');
  mkdirSync(GRC_DIR, { recursive: true });

  let totalGrcVerses = 0;
  for (const [bookId, bookData] of grcBooks) {
    const grcBook = serializeGrcBook(bookId, bookData, booksMeta);
    const outPath = resolve(GRC_DIR, `${bookId}.json`);
    writeFileSync(outPath, JSON.stringify(grcBook, null, 2), 'utf-8');
    const vCount = grcBook.chapters.reduce((s, c) => s + c.verses.length, 0);
    totalGrcVerses += vCount;
    console.log(`   ${bookId}.json: ${grcBook.chapters.length} гл, ${vCount} стихов`);
  }
  console.log(`   Всего стихов в grc: ${totalGrcVerses}`);

  // 7. Загружаем лексикон
  console.log('\n📚 Загрузка лексикона...');
  const lexicon = JSON.parse(readFileSync(LEXICON_JSON, 'utf-8'));
  console.log(`   Лексем: ${lexicon.length}`);

  // 8. Обновляем syn-данные с alignment
  console.log('\n🔗 Обновление syn-файлов с alignment (трёхуровневая стратегия)...');
  updateSynWithAlignment(SYN_DIR, grcBooks, manualByVerse, lexicon, grcByTokenId);

  // 9. Метрика качества manual alignment
  console.log('\n📊 Метрика качества manual alignment...');
  const quality = computeQualityMetrics(manualByVerse, SYN_DIR, grcBooks, lexicon);
  console.log(`   Всего manual-пар: ${quality.totalManualPairs}`);
  console.log(`   Ложных пар (служебное RU → знаменательное GR): ${quality.badPairs} (${quality.pct}%)`);
  if (parseFloat(quality.pct) >= 0.5) {
    console.error(`   ❌ Качество неприемлемо: ${quality.pct}% ложных пар (лимит 0.5%)`);
    process.exit(1);
  }

  // 10. Верификация
  verify(SYN_DIR, grcBooks);

  // 10. Итоги
  console.log('\n✅ Конвертация завершена.');
  console.log(`   Греческие книги → ${GRC_DIR}/`);
  console.log(`   Syn с alignment → ${SYN_DIR}/`);
}

main();
