// scripts/build-bibles.mjs
// Генерирует assets/data/bibles/grc/{book}.json (27 греческих книг)
// и assets/data/bibles/eng/{book}.json (27 BSB английских книг)

import { SOURCE_DATA_VERSION, NORMALIZATION_VERSION } from './lib/versions.mjs';
import { buildSlugMap } from './lib/lexeme-slug.mjs';
import { readSourceJson, readDataJson, writeDataJson, DATA_ROOT } from './lib/fs.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const NT_BOOKS = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians',
  'ephesians', 'philippians', 'colossians',
  '1thessalonians', '2thessalonians', '1timothy', '2timothy',
  'titus', 'philemon', 'hebrews',
  'james', '1peter', '2peter', '1john', '2john', '3john',
  'jude', 'revelation'
];

const BSB_TO_BOOKID = {
  MAT: 'matthew', MRK: 'mark', LUK: 'luke', JHN: 'john',
  ACT: 'acts', ROM: 'romans',
  '1CO': '1corinthians', '2CO': '2corinthians',
  GAL: 'galatians', EPH: 'ephesians', PHP: 'philippians',
  COL: 'colossians', '1TH': '1thessalonians', '2TH': '2thessalonians',
  '1TI': '1timothy', '2TI': '2timothy', TIT: 'titus',
  PHM: 'philemon', HEB: 'hebrews', JAS: 'james',
  '1PE': '1peter', '2PE': '2peter',
  '1JN': '1john', '2JN': '2john', '3JN': '3john',
  JUD: 'jude', REV: 'revelation'
};

// =============================================================================
// PART 1: Greek books (Task 1)
// =============================================================================

function loadGreekTitle(bookId) {
  const sourcePath = resolve(`docs/source-data/originals/sblgnt-macula/books/${bookId}.json`);
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (!source.title) throw new Error(`Missing Greek title for ${bookId}`);
  return source.title;
}

function buildGreekBooks() {
  console.log('=== Building Greek books ===');

  // Загрузить frequency.json
  const freqArray = readSourceJson('enriched/frequency.json');
  const freqMap = new Map();
  for (const f of freqArray) {
    if (f.lexemeId) freqMap.set(f.lexemeId, f);
  }

  // Построить slugMap: загружаем все леммы + curated top1000
  const allLexemes = readSourceJson('enriched/lexemes.json');
  let curatedItems = null;
  try {
    const curated = readSourceJson('lexicon/top1000.core.json');
    curatedItems = curated.items || [];
  } catch {
    console.warn('  top1000.core.json not found, using fallback slugs only');
    curatedItems = [];
  }
  const slugMap = buildSlugMap(allLexemes, curatedItems);

  for (const bookId of NT_BOOKS) {
    // Читаем плоский массив токенов
    const tokens = readSourceJson(`enriched/books/${bookId}.json`);
    if (!Array.isArray(tokens)) {
      throw new Error(`Expected array of tokens for ${bookId}, got ${typeof tokens}`);
    }

    // Группируем по chapter → verse
    const chapterMap = new Map(); // chapterNum → Map(verseNum → [tokens])
    for (const t of tokens) {
      const ch = t.chapter;
      const vs = t.verse;
      if (!chapterMap.has(ch)) chapterMap.set(ch, new Map());
      const verseMap = chapterMap.get(ch);
      if (!verseMap.has(vs)) verseMap.set(vs, []);
      verseMap.get(vs).push(t);
    }

    // Сортируем главы и внутри-стиховые токены
    const sortedChapters = [...chapterMap.keys()].sort((a, b) => a - b);
    const chapters = [];
    let totalTokenCount = 0;

    for (const chNum of sortedChapters) {
      const verseMap = chapterMap.get(chNum);
      const sortedVerses = [...verseMap.keys()].sort((a, b) => a - b);
      const verses = [];

      for (const vsNum of sortedVerses) {
        const verseTokens = verseMap.get(vsNum);
        // Сортируем по tokenIndex, fallback на исходный индекс
        verseTokens.sort((a, b) => (a.tokenIndex ?? a.i ?? 0) - (b.tokenIndex ?? b.i ?? 0));

        const mappedTokens = verseTokens.map((t, idx) => {
          const i = t.tokenIndex ?? t.i ?? (idx + 1);
          const freqEntry = freqMap.get(t.lexemeId);
          const lexemeSlug = slugMap.get(t.lexemeId) || null;
          const morphCode = t.morphology?.code ?? null;
          const morphLabelRu = t.morphology?.labelRu ?? null;
          const posSource = t.pos?.source ?? null;
          const posLabelRu = t.pos?.labelRu ?? null;
          const translit = typeof t.transliteration === 'object'
            ? (t.transliteration?.value ?? null)
            : (t.transliteration ?? null);

          return {
            i,
            id: t.id,
            s: t.surface,
            lemma: t.lemma,
            lexemeId: t.lexemeId,
            lexemeSlug,
            translit,
            morph: morphCode,
            morphLabelRu,
            strongs: t.strong || [],
            glossBerean: t.glossEn || null,
            glossCherith: t.english || null,
            pos: posSource,
            posLabelRu,
            freqRank: freqEntry?.rank ?? null,
            fw: t.isFunctionWord === true
          };
        });

        totalTokenCount += mappedTokens.length;
        verses.push({
          n: vsNum,
          ref: `${bookId} ${chNum}:${vsNum}`,
          tokens: mappedTokens
        });
      }

      chapters.push({ n: chNum, verses });
    }

    // Проверка: сумма токенов по всем стихам === длина исходного массива
    if (totalTokenCount !== tokens.length) {
      throw new Error(
        `Token count mismatch for ${bookId}: ${totalTokenCount} grouped vs ${tokens.length} source`
      );
    }

    const title = loadGreekTitle(bookId);

    writeDataJson(`bibles/grc/${bookId}.json`, {
      schema: 'original-book-v2',
      sourceDataVersion: SOURCE_DATA_VERSION,
      bookId,
      title,
      chapters
    });

    console.log(`  grc/${bookId}.json: ${tokens.length} tokens, ${chapters.length} chapters`);
  }
}

// =============================================================================
// PART 2: BSB English books (Task 2)
// =============================================================================

function tokenizeWords(text) {
  // Разбить текст на слова, сохраняя UTF-16 code unit offsets.
  // Слово = последовательность букв (Unicode letter), цифр или апострофа.
  const words = [];
  const wordPattern = /[\p{L}\p{N}']+/gu;
  let match;
  while ((match = wordPattern.exec(text)) !== null) {
    words.push({
      i: words.length,
      text: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  return words;
}

function collectVerseContentText(contentArray) {
  // Собирает текст стиха из content-массива BSB typed-content формата.
  const parts = [];
  for (const el of contentArray) {
    if (typeof el === 'string') {
      parts.push(el);
    } else if (el && typeof el === 'object') {
      if ('text' in el && el.text != null) {
        parts.push(String(el.text));
      } else if ('lineBreak' in el) {
        parts.push(' ');
      } else if ('noteId' in el) {
        // сноски — пропустить
      } else {
        // неизвестный тип разметки — пропустить (защита)
      }
    }
  }
  return parts.join('');
}

function buildBsbBooks() {
  console.log('\n=== Building BSB books ===');

  const bsb = JSON.parse(readFileSync(
    resolve('docs/source-data/translations/bsb-complete.json'), 'utf8'
  ));

  for (const bookId of NT_BOOKS) {
    // Найти BSB_ID → bookId
    const bsbId = Object.entries(BSB_TO_BOOKID).find(([, bid]) => bid === bookId)?.[0];
    if (!bsbId) throw new Error(`No BSB mapping for ${bookId}`);

    const bsbBook = bsb.books.find(b => b.id === bsbId);
    if (!bsbBook) throw new Error(`BSB book ${bsbId} not found in bsb-complete.json`);

    const chapters = [];
    for (let ci = 0; ci < bsbBook.chapters.length; ci++) {
      const chObj = bsbBook.chapters[ci];
      const chapterNum = ci + 1;
      const content = chObj.chapter?.content;

      // Жёсткая проверка структуры
      if (!Array.isArray(content)) {
        throw new Error(`BSB shape changed: ${bookId} ch ${chapterNum} — chapter.content is not an array`);
      }

      const verses = [];
      for (const el of content) {
        if (el.type === 'verse') {
          const verseNum = el.number;
          const rawText = collectVerseContentText(el.content || []);
          // Нормализация пробелов
          const text = rawText.replace(/\s+/g, ' ').trim();
          const words = tokenizeWords(text);

          // Проверка offset'ов
          for (const w of words) {
            if (text.slice(w.start, w.end) !== w.text) {
              throw new Error(
                `Offset mismatch in ${bookId} ${chapterNum}:${verseNum}: ` +
                `"${text.slice(w.start, w.end)}" !== "${w.text}"`
              );
            }
          }

          verses.push({
            ref: `${bookId} ${chapterNum}:${verseNum}`,
            n: verseNum,
            text,
            words
          });
        }
        // heading, line_break, неизвестные типы — пропустить
      }

      chapters.push({ n: chapterNum, verses });
    }

    writeDataJson(`bibles/eng/${bookId}.json`, {
      schema: 'translation-book-v2',
      translationId: 'bsb',
      bookId,
      title: bsbBook.name || bsbBook.commonName || bookId,
      short: bsbBook.id || bsbId,
      normalizationVersion: NORMALIZATION_VERSION,
      license: 'Public domain',
      attribution: 'Berean Standard Bible, https://berean.bible/',
      chapters
    });

    const verseCount = chapters.reduce((sum, ch) => sum + ch.verses.length, 0);
    console.log(`  eng/${bookId}.json: ${chapters.length} chapters, ${verseCount} verses`);
  }
}

// =============================================================================
// Main
// =============================================================================

console.log('build-bibles.mjs');
console.log(`DATA_ROOT: ${DATA_ROOT}`);
console.log(`sourceDataVersion: ${SOURCE_DATA_VERSION}`);
console.log(`normalizationVersion: ${NORMALIZATION_VERSION}`);

buildGreekBooks();
buildBsbBooks();

console.log('\n✓ build-bibles.mjs complete');
