#!/usr/bin/env node

/**
 * build-syn.mjs — скачивает/валидирует Синодальный перевод НЗ
 * Источник: bolls.life API (перевод SYNOD, книги НЗ 40–66).
 * Результат: data/bibles/syn/{bookId}.json + data/books.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data', 'bibles', 'syn');

const NT_BOOKS = [
  { num: 40, id: 'matthew', title: 'От Матфея святое благовествование', short: 'Мф', chapters: 28 },
  { num: 41, id: 'mark', title: 'От Марка святое благовествование', short: 'Мк', chapters: 16 },
  { num: 42, id: 'luke', title: 'От Луки святое благовествование', short: 'Лк', chapters: 24 },
  { num: 43, id: 'john', title: 'От Иоанна святое благовествование', short: 'Ин', chapters: 21 },
  { num: 44, id: 'acts', title: 'Деяния святых апостолов', short: 'Деян', chapters: 28 },
  { num: 45, id: 'romans', title: 'Послание к Римлянам', short: 'Рим', chapters: 16 },
  { num: 46, id: '1corinthians', title: 'Первое послание к Коринфянам', short: '1 Кор', chapters: 16 },
  { num: 47, id: '2corinthians', title: 'Второе послание к Коринфянам', short: '2 Кор', chapters: 13 },
  { num: 48, id: 'galatians', title: 'Послание к Галатам', short: 'Гал', chapters: 6 },
  { num: 49, id: 'ephesians', title: 'Послание к Ефесянам', short: 'Еф', chapters: 6 },
  { num: 50, id: 'philippians', title: 'Послание к Филиппийцам', short: 'Флп', chapters: 4 },
  { num: 51, id: 'colossians', title: 'Послание к Колоссянам', short: 'Кол', chapters: 4 },
  { num: 52, id: '1thessalonians', title: 'Первое послание к Фессалоникийцам', short: '1 Фес', chapters: 5 },
  { num: 53, id: '2thessalonians', title: 'Второе послание к Фессалоникийцам', short: '2 Фес', chapters: 3 },
  { num: 54, id: '1timothy', title: 'Первое послание к Тимофею', short: '1 Тим', chapters: 6 },
  { num: 55, id: '2timothy', title: 'Второе послание к Тимофею', short: '2 Тим', chapters: 4 },
  { num: 56, id: 'titus', title: 'Послание к Титу', short: 'Тит', chapters: 3 },
  { num: 57, id: 'philemon', title: 'Послание к Филимону', short: 'Флм', chapters: 1 },
  { num: 58, id: 'hebrews', title: 'Послание к Евреям', short: 'Евр', chapters: 13 },
  { num: 59, id: 'james', title: 'Послание Иакова', short: 'Иак', chapters: 5 },
  { num: 60, id: '1peter', title: 'Первое послание Петра', short: '1 Пет', chapters: 5 },
  { num: 61, id: '2peter', title: 'Второе послание Петра', short: '2 Пет', chapters: 3 },
  { num: 62, id: '1john', title: 'Первое послание Иоанна', short: '1 Ин', chapters: 5 },
  { num: 63, id: '2john', title: 'Второе послание Иоанна', short: '2 Ин', chapters: 1 },
  { num: 64, id: '3john', title: 'Третье послание Иоанна', short: '3 Ин', chapters: 1 },
  { num: 65, id: 'jude', title: 'Послание Иуды', short: 'Иуд', chapters: 1 },
  { num: 66, id: 'revelation', title: 'Откровение Иоанна Богослова', short: 'Откр', chapters: 22 },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchChapter(bookNum, chapter) {
  const url = `https://bolls.life/get-text/SYNOD/${bookNum}/${chapter}/`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

function parseVerses(text) {
  // bolls.life возвращает текст с номерами стихов, например:
  // "1 В начале было Слово... 2 Оно было в начале у Бога..."
  // или иногда в формате JSON с массивом стихов
  const verses = [];
  if (Array.isArray(text)) {
    // Некоторые версии API возвращают массив [{verse: 1, text: "..."}]
    for (const item of text) {
      if (item.text) {
        verses.push({ n: item.verse || item.n || verses.length + 1, text: item.text.trim() });
      }
    }
    return verses;
  }

  // Текстовый формат: "1 текст... 2 текст..."
  const versePattern = /(\d+)\s+(.*?)(?=\s*\d+\s+|$)/gs;
  let match;
  while ((match = versePattern.exec(text)) !== null) {
    verses.push({ n: parseInt(match[1]), text: match[2].trim() });
  }

  // Если не разобрали — весь текст как один стих
  if (verses.length === 0 && text && text.trim()) {
    verses.push({ n: 1, text: text.trim() });
  }

  return verses;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const books = [];

  for (const book of NT_BOOKS) {
    const chapters = [];
    let totalVerses = 0;

    console.log(`Загружаем ${book.title} (${book.chapters} глав)...`);

    for (let ch = 1; ch <= book.chapters; ch++) {
      let data;
      try {
        data = await fetchChapter(book.num, ch);
      } catch (e) {
        console.error(`  Ошибка загрузки гл. ${ch}: ${e.message}`);
        // Повторная попытка
        await sleep(2000);
        try {
          data = await fetchChapter(book.num, ch);
        } catch (e2) {
          console.error(`  ПОВТОРНАЯ ОШИБКА гл. ${ch}: ${e2.message}`);
          process.exit(1);
        }
      }

      const verses = parseVerses(data);
      if (verses.length === 0) {
        console.error(`  ПУСТОЙ СТИХ в ${book.id} гл. ${ch}`);
        process.exit(1);
      }

      chapters.push({ n: ch, verses });
      totalVerses += verses.length;

      // Пауза между запросами
      await sleep(250);
    }

    // Валидация
    if (chapters.length !== book.chapters) {
      console.error(`  НЕВЕРНОЕ ЧИСЛО ГЛАВ: ${book.id}, ожидается ${book.chapters}, получено ${chapters.length}`);
      process.exit(1);
    }

    const bookData = {
      id: book.id,
      title: book.title,
      short: book.short,
      chapters
    };

    const filePath = resolve(DATA_DIR, `${book.id}.json`);
    writeFileSync(filePath, JSON.stringify(bookData, null, 2), 'utf-8');
    console.log(`  ✓ ${book.id}.json (${chapters.length} глав, ${totalVerses} стихов)`);

    books.push({
      id: book.id,
      title: book.title,
      short: book.short,
      chapters: book.chapters,
      order: book.num - 39
    });
  }

  // Пишем манифест
  const manifestPath = resolve(ROOT, 'data', 'books.json');
  writeFileSync(manifestPath, JSON.stringify(books, null, 2), 'utf-8');
  console.log(`\nВсего: ${books.length} книг. Манифест: ${manifestPath}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
