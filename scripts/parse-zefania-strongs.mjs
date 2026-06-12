#!/usr/bin/env node

/**
 * parse-zefania-strongs.mjs — парсит Zefania XML с номерами Стронга
 * и генерирует прямое выравнивание с греческими токенами SBLGNT.
 *
 * Вход:
 *   Zefania XML: /tmp/rus_nt_strongs.xml (или указан в --input)
 *   SBLGNT.tsv:  docs/clear-bible-alignments/SBLGNT.tsv
 *
 * Выход:
 *   assets/data/alignments/zefania-strongs.json — все данные выравнивания
 *   плюс статистика покрытия по книгам.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'assets', 'data', 'alignments');

// Карта номеров книг (40-66 = bolls.life numbering = Zefania XML numbering)
const NT_BOOKS = [
  { num: 40, id: 'matthew', chapters: 28 },
  { num: 41, id: 'mark', chapters: 16 },
  { num: 42, id: 'luke', chapters: 24 },
  { num: 43, id: 'john', chapters: 21 },
  { num: 44, id: 'acts', chapters: 28 },
  { num: 45, id: 'romans', chapters: 16 },
  { num: 46, id: '1corinthians', chapters: 16 },
  { num: 47, id: '2corinthians', chapters: 13 },
  { num: 48, id: 'galatians', chapters: 6 },
  { num: 49, id: 'ephesians', chapters: 6 },
  { num: 50, id: 'philippians', chapters: 4 },
  { num: 51, id: 'colossians', chapters: 4 },
  { num: 52, id: '1thessalonians', chapters: 5 },
  { num: 53, id: '2thessalonians', chapters: 3 },
  { num: 54, id: '1timothy', chapters: 6 },
  { num: 55, id: '2timothy', chapters: 4 },
  { num: 56, id: 'titus', chapters: 3 },
  { num: 57, id: 'philemon', chapters: 1 },
  { num: 58, id: 'hebrews', chapters: 13 },
  { num: 59, id: 'james', chapters: 5 },
  { num: 60, id: '1peter', chapters: 5 },
  { num: 61, id: '2peter', chapters: 3 },
  { num: 62, id: '1john', chapters: 5 },
  { num: 63, id: '2john', chapters: 1 },
  { num: 64, id: '3john', chapters: 1 },
  { num: 65, id: 'jude', chapters: 1 },
  { num: 66, id: 'revelation', chapters: 22 },
];

const BOOK_BY_NUM = Object.fromEntries(NT_BOOKS.map(b => [b.num, b]));

// ── Парсинг SBLGNT.tsv ──────────────────────────────────────────
function parseSBLGNT(tsvPath) {
  const text = readFileSync(tsvPath, 'utf-8');
  const lines = text.trim().split('\n');
  // Пропускаем заголовок
  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 4) continue;
    const tokenId = cols[0].trim();          // nBBCCCVVVWWW
    const grText = cols[2].trim();
    const strongStr = cols[3].trim();
    if (!strongStr || strongStr === '0') continue;

    // Разбор tokenId
    const bookNum = parseInt(tokenId.substring(1, 3));   // BB
    const chapter = parseInt(tokenId.substring(3, 6));    // CCC
    const verse = parseInt(tokenId.substring(6, 9));      // VVV
    const wordPos = parseInt(tokenId.substring(9, 12));   // WWW

    if (bookNum < 40 || bookNum > 66) continue; // только НЗ

    const strongs = strongStr.split(',')
      .map(s => s.trim().replace(/^G/i, ''))
      .map(s => parseInt(s))
      .filter(s => s > 0 && !isNaN(s));
    if (strongs.length === 0) continue;

    const key = `${bookNum}|${chapter}|${verse}`;
    if (!data[key]) data[key] = [];
    data[key].push({ idx: wordPos - 1, text: grText, strongs });
  }
  return data;
}

// ── Парсинг Zefania XML ─────────────────────────────────────────
function parseZefaniaXML(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf-8');

  // Извлекаем каждую книгу
  const bookRegex = /<BIBLEBOOK bnumber="(\d+)"[^>]*>(.*?)<\/BIBLEBOOK>/gs;
  const result = {};

  let bookMatch;
  while ((bookMatch = bookRegex.exec(xml)) !== null) {
    const bookNum = parseInt(bookMatch[1]);
    if (bookNum < 40 || bookNum > 66) continue;

    const bookXml = bookMatch[2];
    const data = {};
    result[bookNum] = data;

    // Извлекаем главы
    const chRegex = /<CHAPTER cnumber="(\d+)">(.*?)<\/CHAPTER>/gs;
    let chMatch;
    while ((chMatch = chRegex.exec(bookXml)) !== null) {
      const chapter = parseInt(chMatch[1]);
      const chXml = chMatch[2];
      const verses = {};
      data[chapter] = verses;

      // Извлекаем стихи
      const versRegex = /<VERS vnumber="(\d+)">(.*?)<\/VERS>/gs;
      let versMatch;
      while ((versMatch = versRegex.exec(chXml)) !== null) {
        const verse = parseInt(versMatch[1]);
        const verseXml = versMatch[2];

        // Извлекаем слова с номерами Стронга
        const words = [];
        // Разбираем содержимое стиха: <gr str="...">текст</gr> или обычный текст
        let pos = 0;
        const grRegex = /<gr str="([^"]*)">(.*?)<\/gr>/g;
        let grMatch;

        while ((grMatch = grRegex.exec(verseXml)) !== null) {
          const strongStr = grMatch[1].trim();
          const wordText = grMatch[2].replace(/^\s+|\s+$/g, ''); // trim

          if (!wordText && !strongStr) continue;

          const strongs = strongStr
            .split(/\s+/)
            .map(s => parseInt(s.trim()))
            .filter(s => s > 0 && !isNaN(s));

          words.push({
            text: wordText,
            raw: grMatch[2],
            strongs,
          });
        }

        verses[verse] = words;
      }
    }
  }

  return result;
}

// ── Генерация выравнивания ──────────────────────────────────────
function generateAlignment(zefData, sblgntData) {
  const alignment = {};
  const stats = {
    totalVerses: 0,
    versesWithAlignment: 0,
    totalRuWords: 0,
    alignedRuWords: 0,
    totalStrongPairs: 0,
    byBook: {},
  };

  for (const [bookNum, bookData] of Object.entries(zefData)) {
    const bookId = BOOK_BY_NUM[parseInt(bookNum)]?.id || `book${bookNum}`;
    const bookAlign = {};
    alignment[bookNum] = bookAlign;

    let bookVerses = 0;
    let bookAligned = 0;
    let bookWords = 0;
    let bookAlignedWords = 0;

    for (const [chapter, chData] of Object.entries(bookData)) {
      const chAlign = {};
      bookAlign[chapter] = chAlign;

      for (const [verse, ruWords] of Object.entries(chData)) {
        const key = `${bookNum}|${chapter}|${verse}`;
        const grTokens = sblgntData[key] || [];

        bookVerses++;
        stats.totalVerses++;
        bookWords += ruWords.length;
        stats.totalRuWords += ruWords.length;

        if (ruWords.length === 0 || grTokens.length === 0) {
          chAlign[verse] = [];
          continue;
        }

        // Строим индекс: Strong → список греческих токенов
        const grByStrong = {};
        for (const token of grTokens) {
          for (const s of token.strongs) {
            if (!grByStrong[s]) grByStrong[s] = [];
            grByStrong[s].push({ grIdx: token.idx, consumed: false });
          }
        }

        // Для каждого русского слова находим греческий токен по Strong
        const verseAlign = [];
        // Счётчики использования Strong
        const strongUsage = {};

        for (let ruIdx = 0; ruIdx < ruWords.length; ruIdx++) {
          const ruWord = ruWords[ruIdx];
          if (ruWord.strongs.length === 0) continue;

          // Ищем греческий токен для каждого Strong
          for (const s of ruWord.strongs) {
            const candidates = grByStrong[s];
            if (!candidates) continue;

            // Берём следующий неиспользованный токен с этим Strong
            const pos = strongUsage[s] || 0;
            if (pos < candidates.length) {
              const grToken = candidates[pos];
              if (!grToken.consumed) {
                verseAlign.push({ ru: ruIdx, gr: grToken.grIdx, strong: s });
                grToken.consumed = true;
                strongUsage[s] = pos + 1;
                stats.totalStrongPairs++;
              }
            }
          }
        }

        if (verseAlign.length > 0) {
          bookAligned++;
          stats.versesWithAlignment++;
          bookAlignedWords += new Set(verseAlign.map(a => a.ru)).size;
          stats.alignedRuWords += new Set(verseAlign.map(a => a.ru)).size;
        }

        chAlign[verse] = verseAlign;
      }
    }

    stats.byBook[bookId] = {
      verses: bookVerses,
      versesAligned: bookAligned,
      words: bookWords,
      wordsAligned: bookAlignedWords,
      coveragePct: bookWords > 0 ? ((bookAlignedWords / bookWords) * 100).toFixed(1) : 0,
    };
  }

  return { alignment, stats };
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const xmlPath = args.find(a => !a.startsWith('--')) || '/tmp/rus_nt_strongs.xml';
  const tsvPath = resolve(ROOT, 'docs', 'clear-bible-alignments', 'SBLGNT.tsv');

  console.log('Парсим SBLGNT.tsv...');
  const sblgntData = parseSBLGNT(tsvPath);
  const sblgntVerses = Object.keys(sblgntData).length;
  console.log(`  ✓ ${sblgntVerses} стихов с Strong-размеченными греческими токенами`);

  console.log('Парсим Zefania XML (Russian NT Strongs)...');
  const zefData = parseZefaniaXML(xmlPath);
  const zefBooks = Object.keys(zefData).length;
  const zefStats = { verses: 0, words: 0, taggedWords: 0 };
  for (const [bn, bd] of Object.entries(zefData)) {
    for (const [ch, cd] of Object.entries(bd)) {
      for (const [vs, words] of Object.entries(cd)) {
        zefStats.verses++;
        zefStats.words += words.length;
        zefStats.taggedWords += words.filter(w => w.strongs.length > 0).length;
      }
    }
  }
  console.log(`  ✓ ${zefBooks} книг, ${zefStats.verses} стихов, ${zefStats.words} слов (${zefStats.taggedWords} с номерами Стронга)`);

  console.log('Генерируем выравнивание...');
  const { alignment, stats } = generateAlignment(zefData, sblgntData);

  console.log('\n═══ СТАТИСТИКА ПОКРЫТИЯ ═══');
  console.log(`Всего стихов в Zefania: ${stats.totalVerses}`);
  console.log(`Стихов с выравниванием: ${stats.versesWithAlignment} (${(stats.versesWithAlignment / stats.totalVerses * 100).toFixed(1)}%)`);
  console.log(`Всего русских слов: ${stats.totalRuWords}`);
  console.log(`Выровнено русских слов: ${stats.alignedRuWords} (${(stats.alignedRuWords / stats.totalRuWords * 100).toFixed(1)}%)`);
  console.log(`Всего alignment-пар: ${stats.totalStrongPairs}\n`);

  console.log('По книгам:');
  for (const book of NT_BOOKS) {
    const bs = stats.byBook[book.id];
    if (!bs) continue;
    console.log(`  ${book.id.padEnd(20)} ${String(bs.versesAligned).padStart(4)}/${String(bs.verses).padStart(4)} стихов  ${String(bs.wordsAligned).padStart(5)}/${String(bs.words).padStart(5)} слов  ${bs.coveragePct}%`);
  }

  // Сохраняем результат
  mkdirSync(DATA_DIR, { recursive: true });

  const outPath = resolve(DATA_DIR, 'zefania-strongs.json');
  writeFileSync(outPath, JSON.stringify({ alignment, stats, generatedAt: new Date().toISOString() }, null, 2), 'utf-8');
  console.log(`\n✓ Результат сохранён: ${outPath}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
