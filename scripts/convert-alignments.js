/**
 * Конвертер Clear-Bible Alignments → формат проекта.
 *
 * Из SBLGNT.tsv (греческие токены с номерами Стронга) генерирует:
 *   1. data/bibles/grc/*.json — греческий текст с токенами {w, lemma, morph, strong}
 *   2. Обновляет data/bibles/syn/*.json — добавляет alignment [{ru, gr}] к стихам
 *
 * Alignment строится через матчинг лексикона (core.json): для каждого русского
 * слова, совпавшего с regex-паттерном лексемы, ищется греческий токен с тем же
 * номером Стронга в том же стихе.
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
const LEXICON_JSON = resolve(ROOT, 'data', 'lexicon', 'core.json');
const BOOKS_JSON = resolve(ROOT, 'data', 'books.json');
const SYN_DIR = resolve(ROOT, 'data', 'bibles', 'syn');
const GRC_DIR = resolve(ROOT, 'data', 'bibles', 'grc');

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
 */
function parseSblgnt(filePath) {
  const byVerse = new Map();
  const text = readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  let skipped = 0;

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

    if (!byVerse.has(verseRef)) byVerse.set(verseRef, []);
    byVerse.get(verseRef).push(token);
  }

  return byVerse;
}

// ---------------------------------------------------------------------------
// Сборка греческих книг
// ---------------------------------------------------------------------------

/**
 * Группирует verseRef → tokens в структуру по книгам.
 */
function buildGrcBooks(byVerse) {
  const books = new Map(); // bookId → { bookNum, chapters: Map<chN, Map<vN, tokens[]>> }

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

/**
 * Сериализует книгу в JSON проекта.
 */
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
// Alignment через лексикон
// ---------------------------------------------------------------------------

/**
 * Строит alignment для стиха через матчинг лексикона.
 *
 * @param {string} verseText — русский текст стиха
 * @param {Array} grcTokens — греческие токены этого стиха
 * @param {Array} lexicon — массив записей лексикона
 * @returns {Array|null} [{ru: wordIndex, gr: tokenIndex}] или null
 */
function buildAlignment(verseText, grcTokens, lexicon) {
  if (!grcTokens || grcTokens.length === 0) return null;

  const words = verseText.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return null;

  // Индекс: Strong's → индекс первого токена с этим номером
  const strongToGrIdx = new Map();
  for (let i = 0; i < grcTokens.length; i++) {
    const s = grcTokens[i].strong;
    if (s && !strongToGrIdx.has(s)) {
      strongToGrIdx.set(s, i);
    }
  }

  const alignment = [];

  for (let wi = 0; wi < words.length; wi++) {
    // Очищаем от знаков препинания
    const cleanWord = words[wi].replace(/[.,;:!?—\-–"«»()\[\]']+$/g, '').replace(/^[«»"'(\[\]]+/g, '');
    if (cleanWord.length === 0) continue;

    for (const lexeme of lexicon) {
      const strong = lexeme.strong;
      if (!strong) continue;

      // Проверяем regex-паттерны лексемы
      let matched = false;
      for (const pattern of lexeme.ruMatches) {
        try {
          const re = new RegExp(pattern, 'iu');
          if (re.test(cleanWord)) {
            // Проверяем exclude
            let excluded = false;
            for (const excPattern of (lexeme.ruExclude || [])) {
              try {
                const excRe = new RegExp(excPattern, 'iu');
                if (excRe.test(cleanWord)) { excluded = true; break; }
              } catch (_) { /* skip broken regex */ }
            }
            if (!excluded) { matched = true; break; }
          }
        } catch (_) { /* skip broken regex */ }
      }
      if (!matched) continue;

      // Ищем греческий токен с тем же Strong's в этом стихе
      const grIdx = strongToGrIdx.get(strong);
      if (grIdx !== undefined) {
        alignment.push({ ru: wi, gr: grIdx });
        break; // первое совпадение (лексемы в core.json отсортированы по убыванию freqNT)
      }
    }
  }

  return alignment.length > 0 ? alignment : null;
}

// ---------------------------------------------------------------------------
// Обновление syn-файлов
// ---------------------------------------------------------------------------

/**
 * Обновляет syn-файлы: добавляет alignment к стихам, где нашлось соответствие.
 */
function updateSynWithAlignment(synDir, grcBooks, lexicon) {
  const files = readdirSync(synDir).filter(f => f.endsWith('.json'));
  let totalAligned = 0;
  let totalVerses = 0;

  for (const file of files) {
    const filePath = resolve(synDir, file);
    const synBook = JSON.parse(readFileSync(filePath, 'utf-8'));
    const bookId = synBook.id;
    const grcBook = grcBooks.get(bookId);

    // Карта "ch:v" → tokens для быстрого доступа
    // grcBook.chapters — это Map<chN, Map<vN, tokens[]>>
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
        const grcTokens = grcVerseMap.get(`${ch.n}:${verse.n}`);
        const alignment = buildAlignment(verse.text, grcTokens, lexicon);
        if (alignment) {
          verse.alignment = alignment;
          totalAligned++;
        }
        // Если alignment нет — поле не добавляется (verse остаётся без изменений)
      }
    }

    writeFileSync(filePath, JSON.stringify(synBook, null, 2), 'utf-8');
  }

  console.log(`  Стихов с alignment: ${totalAligned} / ${totalVerses}`);
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
  const byVerse = parseSblgnt(SBLGNT_TSV);
  console.log(`   Стихов с токенами: ${byVerse.size}`);

  const grcBooks = buildGrcBooks(byVerse);
  console.log(`   Книг: ${grcBooks.size}`);

  // 4. Генерируем data/bibles/grc/*.json
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

  // 5. Загружаем лексикон
  console.log('\n📚 Загрузка лексикона...');
  const lexicon = JSON.parse(readFileSync(LEXICON_JSON, 'utf-8'));
  console.log(`   Лексем: ${lexicon.length}`);

  // 6. Обновляем syn-данные с alignment
  console.log('\n🔗 Обновление syn-файлов с alignment...');
  updateSynWithAlignment(SYN_DIR, grcBooks, lexicon);

  // 7. Итоги
  console.log('\n✅ Конвертация завершена.');
  console.log(`   Греческие книги → ${GRC_DIR}/`);
  console.log(`   Syn с alignment → ${SYN_DIR}/`);
}

main();
