#!/usr/bin/env node

/**
 * build-grc.mjs — скачивает/парсит греческий НЗ
 * Источник: Byzantine Majority Text (Robinson–Pierpont) с парсингом и Strong
 * из github.com/byztxt/byzantine-majority-text
 *
 * При отсутствии исходников в tools/sources/ — выводит инструкцию.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data', 'bibles', 'grc');
const SOURCES_DIR = resolve(__dirname, 'sources', 'byzantine-majority-text');

const BOOKS_MAP = [
  { id: 'matthew', file: '41-MAT.txt' },
  { id: 'mark', file: '42-MRK.txt' },
  { id: 'luke', file: '43-LUK.txt' },
  { id: 'john', file: '44-JHN.txt' },
  { id: 'acts', file: '45-ACT.txt' },
  { id: 'romans', file: '46-ROM.txt' },
  { id: '1corinthians', file: '47-1CO.txt' },
  { id: '2corinthians', file: '48-2CO.txt' },
  { id: 'galatians', file: '49-GAL.txt' },
  { id: 'ephesians', file: '50-EPH.txt' },
  { id: 'philippians', file: '51-PHP.txt' },
  { id: 'colossians', file: '52-COL.txt' },
  { id: '1thessalonians', file: '53-1TH.txt' },
  { id: '2thessalonians', file: '54-2TH.txt' },
  { id: '1timothy', file: '55-1TI.txt' },
  { id: '2timothy', file: '56-2TI.txt' },
  { id: 'titus', file: '57-TIT.txt' },
  { id: 'philemon', file: '58-PHM.txt' },
  { id: 'hebrews', file: '59-HEB.txt' },
  { id: 'james', file: '60-JAS.txt' },
  { id: '1peter', file: '61-1PE.txt' },
  { id: '2peter', file: '62-2PE.txt' },
  { id: '1john', file: '63-1JN.txt' },
  { id: '2john', file: '64-2JN.txt' },
  { id: '3john', file: '65-3JN.txt' },
  { id: 'jude', file: '66-JUD.txt' },
  { id: 'revelation', file: '67-REV.txt' },
];

function parseBMTLine(line) {
  // Формат: слово<TAB>код<TAB>морфология<TAB>лемма<TAB>strong
  // или: слово морф-код (вариации формата)
  const parts = line.split('\t');
  if (parts.length >= 5) {
    return { w: parts[0], lemma: parts[3], morph: parts[2], strong: parseInt(parts[4]) || 0 };
  }
  // Альтернативный формат
  return null;
}

function parseBMText(text) {
  const chapters = [];
  let currentChapter = null;
  let currentVerse = null;

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;

    // Заголовок главы
    const chMatch = line.match(/^CHAPTER\s+(\d+)/i);
    if (chMatch) {
      if (currentChapter) chapters.push(currentChapter);
      currentChapter = { n: parseInt(chMatch[1]), verses: [] };
      currentVerse = null;
      continue;
    }

    // Номер стиха
    const vsMatch = line.match(/^<(\d+)>\s*$/);
    if (vsMatch) {
      currentVerse = { n: parseInt(vsMatch[1]), tokens: [] };
      if (currentChapter) currentChapter.verses.push(currentVerse);
      continue;
    }

    // Токен
    if (currentVerse) {
      const token = parseBMTLine(line);
      if (token) {
        currentVerse.tokens.push(token);
      }
    }
  }

  if (currentChapter) chapters.push(currentChapter);
  return chapters;
}

function main() {
  if (!existsSync(SOURCES_DIR)) {
    console.log('Исходники не найдены. Скачайте Byzantine Majority Text:');
    console.log('  git clone https://github.com/byztxt/byzantine-majority-text.git tools/sources/byzantine-majority-text');
    console.log('Затем перезапустите скрипт.');
    return;
  }

  mkdirSync(DATA_DIR, { recursive: true });

  for (const book of BOOKS_MAP) {
    const filePath = resolve(SOURCES_DIR, book.file);
    if (!existsSync(filePath)) {
      console.warn(`Файл не найден: ${book.file}, пропускаем ${book.id}`);
      continue;
    }

    const text = readFileSync(filePath, 'utf-8');
    const chapters = parseBMText(text);

    const bookData = { id: book.id, chapters };
    const outPath = resolve(DATA_DIR, `${book.id}.json`);
    writeFileSync(outPath, JSON.stringify(bookData, null, 2), 'utf-8');
    console.log(`✓ ${book.id}.json (${chapters.length} глав)`);
  }
}

main();
