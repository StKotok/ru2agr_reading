#!/usr/bin/env node

/**
 * build-syn-packs.mjs — Synodal source snapshot → translation book packs.
 *
 * Reads docs/sources/translations/syn/ (committed clean text)
 * and produces:
 *   - assets/data/translations/syn/books/{bookId}.json (translation-book-v1)
 *   - assets/data/books.json (runtime book list)
 *
 * Words are tokenized once with ru-tokenizer and frozen into the pack.
 * Runtime NEVER re-tokenizes text.
 *
 * Usage: node scripts/build-syn-packs.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenizeRussianVerse, verifyTokenOffsets } from './macula/lib/ru-tokenizer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE_DIR = resolve(ROOT, 'docs', 'sources', 'translations', 'syn');
const OUT_DIR = resolve(ROOT, 'assets', 'data', 'translations', 'syn', 'books');
const BOOKS_OUT = resolve(ROOT, 'assets', 'data', 'books.json');

// Book metadata (order must match the NT order)
const NT_BOOKS = [
  { id: 'matthew', title: 'От Матфея святое благовествование', short: 'Мф', chapters: 28, order: 1 },
  { id: 'mark', title: 'От Марка святое благовествование', short: 'Мк', chapters: 16, order: 2 },
  { id: 'luke', title: 'От Луки святое благовествование', short: 'Лк', chapters: 24, order: 3 },
  { id: 'john', title: 'От Иоанна святое благовествование', short: 'Ин', chapters: 21, order: 4 },
  { id: 'acts', title: 'Деяния святых апостолов', short: 'Деян', chapters: 28, order: 5 },
  { id: 'romans', title: 'Послание к Римлянам', short: 'Рим', chapters: 16, order: 6 },
  { id: '1corinthians', title: 'Первое послание к Коринфянам', short: '1 Кор', chapters: 16, order: 7 },
  { id: '2corinthians', title: 'Второе послание к Коринфянам', short: '2 Кор', chapters: 13, order: 8 },
  { id: 'galatians', title: 'Послание к Галатам', short: 'Гал', chapters: 6, order: 9 },
  { id: 'ephesians', title: 'Послание к Ефесянам', short: 'Еф', chapters: 6, order: 10 },
  { id: 'philippians', title: 'Послание к Филиппийцам', short: 'Флп', chapters: 4, order: 11 },
  { id: 'colossians', title: 'Послание к Колоссянам', short: 'Кол', chapters: 4, order: 12 },
  { id: '1thessalonians', title: 'Первое послание к Фессалоникийцам', short: '1 Фес', chapters: 5, order: 13 },
  { id: '2thessalonians', title: 'Второе послание к Фессалоникийцам', short: '2 Фес', chapters: 3, order: 14 },
  { id: '1timothy', title: 'Первое послание к Тимофею', short: '1 Тим', chapters: 6, order: 15 },
  { id: '2timothy', title: 'Второе послание к Тимофею', short: '2 Тим', chapters: 4, order: 16 },
  { id: 'titus', title: 'Послание к Титу', short: 'Тит', chapters: 3, order: 17 },
  { id: 'philemon', title: 'Послание к Филимону', short: 'Флм', chapters: 1, order: 18 },
  { id: 'hebrews', title: 'Послание к Евреям', short: 'Евр', chapters: 13, order: 19 },
  { id: 'james', title: 'Послание Иакова', short: 'Иак', chapters: 5, order: 20 },
  { id: '1peter', title: 'Первое послание Петра', short: '1 Пет', chapters: 5, order: 21 },
  { id: '2peter', title: 'Второе послание Петра', short: '2 Пет', chapters: 3, order: 22 },
  { id: '1john', title: 'Первое послание Иоанна', short: '1 Ин', chapters: 5, order: 23 },
  { id: '2john', title: 'Второе послание Иоанна', short: '2 Ин', chapters: 1, order: 24 },
  { id: '3john', title: 'Третье послание Иоанна', short: '3 Ин', chapters: 1, order: 25 },
  { id: 'jude', title: 'Послание Иуды', short: 'Иуд', chapters: 1, order: 26 },
  { id: 'revelation', title: 'Откровение Иоанна Богослова', short: 'Откр', chapters: 22, order: 27 },
];

const bookMeta = Object.fromEntries(NT_BOOKS.map(b => [b.id, b]));

console.log('=== build-syn-packs ===\n');

// Generate translation packs
let totalVerses = 0;
let totalWords = 0;
const errors = [];

for (const book of NT_BOOKS) {
  const sourcePath = resolve(SOURCE_DIR, `${book.id}.json`);
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

  const chapters = [];
  for (const ch of source.chapters) {
    const verses = [];
    for (const v of ch.verses) {
      const ref = `${book.id} ${ch.n}:${v.n}`;
      const words = tokenizeRussianVerse(v.text);

      // Verify offsets
      const offsetErrors = verifyTokenOffsets(v.text, words);
      if (offsetErrors.length > 0) {
        errors.push(...offsetErrors.map(e => `${ref}: ${e}`));
      }

      verses.push({
        ref,
        n: v.n,
        text: v.text,
        words,
      });
      totalWords += words.length;
    }
    chapters.push({ n: ch.n, verses });
    totalVerses += verses.length;
  }

  const pack = {
    schema: 'translation-book-v1',
    translationId: 'syn',
    bookId: book.id,
    title: book.title,
    short: book.short,
    chapters,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, `${book.id}.json`), JSON.stringify(pack));
}

console.log(`Generated ${NT_BOOKS.length} translation packs`);
console.log(`Total verses: ${totalVerses}`);
console.log(`Total words: ${totalWords}`);

if (errors.length > 0) {
  console.error(`\n⚠️  ${errors.length} offset errors:`);
  errors.slice(0, 20).forEach(e => console.error(`  ${e}`));
  if (errors.length > 20) console.error(`  ... and ${errors.length - 20} more`);
}

// Generate books.json manifest
const booksManifest = NT_BOOKS.map(b => ({
  id: b.id,
  title: b.title,
  short: b.short,
  chapters: b.chapters,
  order: b.order,
}));

writeFileSync(BOOKS_OUT, JSON.stringify(booksManifest, null, 2));
console.log(`\nbooks.json: ${booksManifest.length} books`);

console.log('Done.');
