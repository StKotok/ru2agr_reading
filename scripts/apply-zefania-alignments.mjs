#!/usr/bin/env node

/**
 * apply-zefania-alignments.mjs
 *
 * Переносит Strong-номера из Zefania XML в syn JSON файлы,
 * после чего генерирует выравнивание с греческими токенами SBLGNT.
 *
 * Алгоритм:
 *   1. Парсит Zefania XML → русские слова с номерами Стронга на каждый стих
 *   2. Для каждого стиха сопоставляет слова Zefania ↔ bolls.life через
 *      жадное выравнивание последовательностей (с допуском на расхождения)
 *   3. Переносит номера Стронга на bolls.life-слова
 *   4. Генерирует alignment [{ru, gr}] используя Strong + SBLGNT-токены
 *   5. Добавляет alignment в syn JSON файлы
 *
 * Это заменяет regex-based выравнивание из лексикона для слов,
 * покрытых Zefania Strong-разметкой. Для непокрытых слов —
 * fallback на старый алгоритм из convert-alignments.js.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const ZEFANIA_XML = resolve(ROOT, 'assets', 'data', 'rus_nt_strongs.xml');
const SBLGNT_TSV = resolve(ROOT, 'docs', 'clear-bible-alignments', 'SBLGNT.tsv');
const LEXICON_JSON = resolve(ROOT, 'assets', 'data', 'lexicon', 'core.json');
const SYN_DIR = resolve(ROOT, 'assets', 'data', 'bibles', 'syn');
const BOOKS_JSON = resolve(ROOT, 'assets', 'data', 'books.json');

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

const BOOK_NUM_BY_ID = Object.fromEntries(
  Object.entries(BOOK_MAP).map(([num, id]) => [id, parseInt(num)])
);

// ── Лексикон (для fallback) ──────────────────────────────────────

const TRAILING_PUNCT_RE = /[.,;:!?—\-–"'«»„"()\[\]'¿¡;]+$/g;
const LEADING_PUNCT_RE = /^[«»"'"„(\[\]—–-]+/;

function cleanRuWord(word) {
  return word.replace(TRAILING_PUNCT_RE, '').replace(LEADING_PUNCT_RE, '');
}

function precompileLexicon(lexicon) {
  const entries = [];
  for (const lexeme of lexicon) {
    if (!lexeme.strong || !Array.isArray(lexeme.ruMatches)) continue;
    let matches, excludes;
    try {
      matches = lexeme.ruMatches.map(p => new RegExp(p, 'iu'));
      excludes = (lexeme.ruExclude || []).map(p => new RegExp(p, 'iu'));
    } catch (e) {
      console.error(`❌ Невалидная регулярка у "${lexeme.id}": ${e.message}`);
      process.exit(1);
    }
    entries.push({
      strong: lexeme.strong, id: lexeme.id,
      lemma: lexeme.lemma, matches, excludes
    });
  }
  return entries;
}

function matchLexeme(cleanWord, lexEntries) {
  for (const entry of lexEntries) {
    let matched = false;
    for (const re of entry.matches) {
      if (re.test(cleanWord)) { matched = true; break; }
    }
    if (!matched) continue;
    let excluded = false;
    for (const re of entry.excludes) {
      if (re.test(cleanWord)) { excluded = true; break; }
    }
    if (!excluded) return entry;
  }
  return null;
}

// ── Парсинг SBLGNT ───────────────────────────────────────────────

function parseSblgnt(filePath) {
  const byVerse = new Map();
  const text = readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');

  for (const line of lines) {
    if (!line.trim() || line.startsWith('id\t')) continue;
    const cols = line.split('\t');
    if (cols.length < 8) continue;

    const tokenId = cols[0];
    const word = cols[2];
    const strongsRaw = cols[3];
    const lemma = cols[6];
    const morph = cols[7];

    const bare = tokenId.startsWith('n') ? tokenId.slice(1) : tokenId;
    const verseRef = bare.slice(0, 8);

    // Strong: G0976 → 976
    const strongNum = parseInt(strongsRaw.replace(/^G/i, ''), 10) || 0;

    if (!byVerse.has(verseRef)) byVerse.set(verseRef, []);
    byVerse.get(verseRef).push({ w: word, lemma, morph, strong: strongNum });
  }

  return byVerse;
}

// ── Парсинг Zefania XML ──────────────────────────────────────────

/**
 * Парсит Zefania XML.
 * Возвращает Map<verseKey, [{text, strongs}]>
 *   где verseKey = "bookNum|chapter|verse"
 */
function parseZefaniaXML(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf-8');
  const result = new Map();

  const bookRegex = /<BIBLEBOOK bnumber="(\d+)"[^>]*>(.*?)<\/BIBLEBOOK>/gs;
  let bookMatch;

  while ((bookMatch = bookRegex.exec(xml)) !== null) {
    const bookNum = parseInt(bookMatch[1]);
    if (bookNum < 40 || bookNum > 66) continue;

    const bookXml = bookMatch[2];
    const chRegex = /<CHAPTER cnumber="(\d+)">(.*?)<\/CHAPTER>/gs;
    let chMatch;

    while ((chMatch = chRegex.exec(bookXml)) !== null) {
      const chapter = parseInt(chMatch[1]);
      const chXml = chMatch[2];
      const versRegex = /<VERS vnumber="(\d+)">(.*?)<\/VERS>/gs;
      let versMatch;

      while ((versMatch = versRegex.exec(chXml)) !== null) {
        const verse = parseInt(versMatch[1]);
        const verseXml = versMatch[2];

        const words = [];
        const grRegex = /<gr str="([^"]*)">(.*?)<\/gr>/g;
        let grMatch;

        while ((grMatch = grRegex.exec(verseXml)) !== null) {
          const strongStr = grMatch[1].trim();
          const wordText = grMatch[2].trim();

          if (!wordText && !strongStr) continue;

          const strongs = strongStr
            .split(/\s+/)
            .map(s => parseInt(s.trim()))
            .filter(s => s > 0 && !isNaN(s));

          words.push({ text: wordText, strongs });
        }

        const key = `${bookNum}|${chapter}|${verse}`;
        result.set(key, words);
      }
    }
  }

  return result;
}

// ── Сопоставление слов Zefania ↔ bolls.life ─────────────────────

/**
 * Нормализует слово для сравнения.
 */
function normalizeWord(w) {
  return cleanRuWord(w).toLowerCase();
}

/**
 * Жадно выравнивает два списка слов.
 * Возвращает Map<bollsIdx, zefIdx> для совпавших слов.
 *
 * Алгоритм: идём по обоим спискам, для каждого zef-слова ищем
 * ближайшее bolls-слово с таким же текстом в окне ±15 позиций.
 * Уже использованные bolls-слова пропускаются.
 */
function alignWordSequences(bollsWords, zefWords) {
  const normBolls = bollsWords.map(normalizeWord);
  const normZef = zefWords.map(w => normalizeWord(w.text));

  const used = new Set();
  const matches = new Map();   // bollsIdx → zefIdx

  let bollsPos = 0;
  for (let zIdx = 0; zIdx < normZef.length && bollsPos < normBolls.length; zIdx++) {
    const zWord = normZef[zIdx];
    if (!zWord) { bollsPos++; continue; }

    // Ищем в окне до 15 позиций вперёд
    let found = false;
    const searchStart = Math.max(bollsPos, 0);
    const searchEnd = Math.min(bollsPos + 15, normBolls.length);

    for (let bIdx = searchStart; bIdx < searchEnd; bIdx++) {
      if (used.has(bIdx)) continue;
      if (normBolls[bIdx] === zWord) {
        matches.set(bIdx, zIdx);
        used.add(bIdx);
        bollsPos = bIdx + 1;
        found = true;
        break;
      }
    }

    if (!found) {
      // Пробуем найти это слово раньше (могло быть пропущено)
      for (let bIdx = Math.max(0, bollsPos - 3); bIdx < bollsPos; bIdx++) {
        if (used.has(bIdx)) continue;
        if (normBolls[bIdx] === zWord) {
          matches.set(bIdx, zIdx);
          used.add(bIdx);
          found = true;
          break;
        }
      }
    }
  }

  return matches;
}

// ── Основная логика выравнивания ─────────────────────────────────

/**
 * Для одного стиха генерирует alignment, используя:
 *   1. Zefania Strong-номера (основной источник)
 *   2. Lexicon regex (fallback)
 */
function buildVerseAlignment(
  ruWords,            // [{word: string}] из bolls.life
  ruStrongMap,        // Map<ruIdx, number[]> — Strong numbers from Zefania
  grcTokens,          // [{w, lemma, morph, strong}] из SBLGNT
  lexEntries          // для fallback
) {
  // Индекс греческих токенов по Strong
  const grByStrong = {};
  for (let gIdx = 0; gIdx < grcTokens.length; gIdx++) {
    const s = grcTokens[gIdx].strong;
    if (s > 0) {
      if (!grByStrong[s]) grByStrong[s] = [];
      grByStrong[s].push({ grIdx: gIdx, consumed: false });
    }
  }

  // Счётчики использования Strong (последовательное потребление)
  const strongUsage = {};
  const alignment = [];

  for (let ruIdx = 0; ruIdx < ruWords.length; ruIdx++) {
    const ruWord = ruWords[ruIdx].word;
    const cleanW = cleanRuWord(ruWord);
    if (!cleanW) continue;

    // Источник 1: Zefania Strong numbers
    const zefStrongs = ruStrongMap.get(ruIdx);
    if (zefStrongs && zefStrongs.length > 0) {
      for (const s of zefStrongs) {
        const candidates = grByStrong[s];
        if (!candidates) continue;

        const pos = strongUsage[s] || 0;
        if (pos < candidates.length && !candidates[pos].consumed) {
          alignment.push({ ru: ruIdx, gr: candidates[pos].grIdx, src: 'z' });
          candidates[pos].consumed = true;
          strongUsage[s] = pos + 1;
        }
      }
      continue; // не используем fallback если Zefania дала Strong
    }

    // Источник 2: Lexicon regex (fallback)
    const lex = matchLexeme(cleanW, lexEntries);
    if (lex) {
      const candidates = grByStrong[lex.strong];
      if (!candidates) continue;

      const pos = strongUsage[lex.strong] || 0;
      if (pos < candidates.length && !candidates[pos].consumed) {
        alignment.push({ ru: ruIdx, gr: candidates[pos].grIdx, src: 'l' });
        candidates[pos].consumed = true;
        strongUsage[lex.strong] = pos + 1;
      }
    }
  }

  // ── Пост-обработка: дедупликация по ru и gr ──────────────────
  // Zefania иногда даёт одному русскому слову несколько греческих
  // токенов (или наоборот). Оставляем максимум 1 пару на каждый
  // индекс, выбирая по приоритету части речи.
  const MORPH_PRIORITY = {
    'noun': 4, 'verb': 4, 'adj': 4, 'adv': 4,
    'num': 3, 'pron': 3,
    'prep': 2, 'conj': 2, 'ptcl': 2,
    'det': 1, 'intj': 1,
  };
  const priority = (grIdx) => {
    const tok = grcTokens[grIdx];
    return tok ? (MORPH_PRIORITY[tok.morph] ?? 2) : 2;
  };

  // Шаг 1: каждый ru → один gr (лучший по приоритету)
  const byRu = {};
  for (const p of alignment) {
    if (!byRu[p.ru] || priority(p.gr) > priority(byRu[p.ru].gr)) {
      byRu[p.ru] = p;
    }
  }

  // Шаг 2: каждый gr → один ru (лучший по приоритету)
  const byGr = {};
  for (const p of Object.values(byRu)) {
    if (!byGr[p.gr] || priority(p.gr) > priority(byGr[p.gr].gr)) {
      byGr[p.gr] = p;
    }
  }

  return Object.values(byGr);
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  // 1. Парсим SBLGNT
  console.log('Парсим SBLGNT.tsv...');
  const sblgntByVerse = parseSblgnt(SBLGNT_TSV);
  console.log(`  ✓ ${sblgntByVerse.size} стихов`);

  // 2. Парсим Zefania XML
  console.log('Парсим Zefania XML (Russian NT Strongs)...');
  const zefByVerse = parseZefaniaXML(ZEFANIA_XML);
  const zefVersesCount = zefByVerse.size;
  let zefWordsTotal = 0, zefTaggedTotal = 0;
  for (const words of zefByVerse.values()) {
    zefWordsTotal += words.length;
    zefTaggedTotal += words.filter(w => w.strongs.length > 0).length;
  }
  console.log(`  ✓ ${zefVersesCount} стихов, ${zefWordsTotal} слов (${zefTaggedTotal} со Strong)`);

  // 3. Загружаем лексикон для fallback
  console.log('Загружаем лексикон...');
  const lexicon = JSON.parse(readFileSync(LEXICON_JSON, 'utf-8'));
  const lexEntries = precompileLexicon(lexicon);
  console.log(`  ✓ ${lexEntries.length} записей`);

  // 4. Загружаем манифест книг
  const booksMeta = JSON.parse(readFileSync(BOOKS_JSON, 'utf-8'));

  // 5. Обрабатываем каждую книгу
  const totalStats = {
    versesTotal: 0,
    versesWithZefania: 0,
    versesWithLexicon: 0,
    wordsTotal: 0,
    wordsFromZefania: 0,
    wordsFromLexicon: 0,
    pairsTotal: 0,
    byBook: {}
  };

  for (const bookMeta of booksMeta) {
    const bookId = bookMeta.id;
    const bookNum = BOOK_NUM_BY_ID[bookId];
    if (!bookNum) {
      console.log(`  ⚠ Книга "${bookId}" не найдена в BOOK_NUM_BY_ID`);
      continue;
    }

    const synPath = resolve(SYN_DIR, `${bookId}.json`);
    let synData;
    try {
      synData = JSON.parse(readFileSync(synPath, 'utf-8'));
    } catch (e) {
      console.log(`  ⚠ ${bookId}.json не найден, пропускаем`);
      continue;
    }

    let bookVersesZef = 0, bookVersesLex = 0, bookVersesTotal = 0;
    let bookWordsZef = 0, bookWordsLex = 0, bookWordsTotal = 0;
    let bookPairs = 0;

    for (const chapter of synData.chapters) {
      for (const verse of chapter.verses) {
        bookVersesTotal++;
        totalStats.versesTotal++;

        // Разбиваем русский текст bolls.life на слова
        const ruWords = verse.text.split(/\s+/).filter(w => w.length > 0);
        const ruWordObjs = ruWords.map(w => ({ word: w }));
        bookWordsTotal += ruWords.length;
        totalStats.wordsTotal += ruWords.length;

        // Получаем Zefania-слова для этого стиха
        const zefKey = `${bookNum}|${chapter.n}|${verse.n}`;
        const zefWords = zefByVerse.get(zefKey) || [];

        let ruStrongMap = new Map(); // ruIdx → [strong numbers]

        if (zefWords.length > 0) {
          // Сопоставляем слова между Zefania и bolls.life
          const wordMatches = alignWordSequences(ruWords, zefWords);

          for (const [ruIdx, zefIdx] of wordMatches) {
            const zefStrongs = zefWords[zefIdx].strongs;
            if (zefStrongs.length > 0) {
              ruStrongMap.set(ruIdx, zefStrongs);
            }
          }
        }

        // Если есть хотя бы одно совпадение — стих покрыт Zefania
        if (ruStrongMap.size > 0) {
          bookVersesZef++;
          totalStats.versesWithZefania++;
          bookWordsZef += ruStrongMap.size;
          totalStats.wordsFromZefania += ruStrongMap.size;
        }

        // Получаем греческие токены
        const verseRef = `${String(bookNum).padStart(2, '0')}${String(chapter.n).padStart(3, '0')}${String(verse.n).padStart(3, '0')}`;
        const grcTokens = sblgntByVerse.get(verseRef) || [];

        // Генерируем alignment
        const alignment = buildVerseAlignment(ruWordObjs, ruStrongMap, grcTokens, lexEntries);

        // Подсчитываем, сколько из lexicon
        const zefRuIndices = new Set(ruStrongMap.keys());
        let lexCount = 0;
        for (const pair of alignment) {
          if (!zefRuIndices.has(pair.ru)) {
            lexCount++;
          }
        }
        if (lexCount > 0) {
          bookVersesLex++;
          totalStats.versesWithLexicon++;
          bookWordsLex += lexCount;
          totalStats.wordsFromLexicon += lexCount;
        }

        bookPairs += alignment.length;
        totalStats.pairsTotal += alignment.length;

        // Записываем alignment в стих
        verse.alignment = alignment;
        // verse._alignSrc = ruStrongMap.size > 0 ? 'zefania+lexicon' : 'lexicon';
      }
    }

    // Сохраняем обновлённый syn JSON
    writeFileSync(synPath, JSON.stringify(synData, null, 2), 'utf-8');

    const pct = bookWordsTotal > 0
      ? ((bookWordsZef + bookWordsLex) / bookWordsTotal * 100).toFixed(1)
      : 0;
    const zefPct = bookWordsTotal > 0
      ? (bookWordsZef / bookWordsTotal * 100).toFixed(1)
      : 0;

    totalStats.byBook[bookId] = {
      verses: bookVersesTotal,
      versesZef: bookVersesZef,
      versesLex: bookVersesLex,
      words: bookWordsTotal,
      wordsZef: bookWordsZef,
      wordsLex: bookWordsLex,
      pairs: bookPairs,
      coveragePct: pct,
      zefCoveragePct: zefPct
    };

    console.log(`  ${bookId.padEnd(18)} стихов ${String(bookVersesZef).padStart(4)}/${String(bookVersesTotal).padStart(4)} Zef  слов ${String(bookWordsZef).padStart(5)}/${String(bookWordsTotal).padStart(5)} (${zefPct}%)  пар ${bookPairs}`);
  }

  // ── Итоговая статистика ──
  console.log('\n═══ ИТОГОВАЯ СТАТИСТИКА ═══');
  console.log(`Всего стихов: ${totalStats.versesTotal}`);
  console.log(`Покрыто Zefania: ${totalStats.versesWithZefania} стихов (${(totalStats.versesWithZefania / totalStats.versesTotal * 100).toFixed(1)}%)`);
  console.log(`Покрыто Lexicon: ${totalStats.versesWithLexicon} стихов (${(totalStats.versesWithLexicon / totalStats.versesTotal * 100).toFixed(1)}%)`);
  console.log(`Всего слов: ${totalStats.wordsTotal}`);
  console.log(`Слов из Zefania: ${totalStats.wordsFromZefania} (${(totalStats.wordsFromZefania / totalStats.wordsTotal * 100).toFixed(1)}%)`);
  console.log(`Слов из Lexicon: ${totalStats.wordsFromLexicon} (${(totalStats.wordsFromLexicon / totalStats.wordsTotal * 100).toFixed(1)}%)`);
  console.log(`Всего alignment-пар: ${totalStats.pairsTotal}\n`);

  console.log('По книгам:');
  for (const [bookId, bs] of Object.entries(totalStats.byBook)) {
    console.log(`  ${bookId.padEnd(18)} Zef:${String(bs.wordsZef).padStart(5)}/${String(bs.words).padStart(5)} (${bs.zefCoveragePct}%)  Lex:${String(bs.wordsLex).padStart(4)}  пар:${String(bs.pairs).padStart(5)}  общ:${bs.coveragePct}%`);
  }
}

main();
