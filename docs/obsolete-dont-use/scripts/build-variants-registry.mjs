#!/usr/bin/env node

/**
 * build-variants-registry.mjs
 *
 * Генерирует assets/data/textual-variants.json из данных syn/grc.
 *
 * Использование:
 *   node scripts/build-variants-registry.mjs
 *
 * Источники данных:
 *   - synOnlyVerses / grcOnlyVerses — автоматически из diff инвентарей стихов по n
 *   - synOnlyPhrases — человек указывает ссылки в конфиге ниже, скрипт читает слова
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SYN_DIR = resolve(ROOT, 'assets/data/bibles/syn');
const GRC_DIR = resolve(ROOT, 'assets/data/bibles/grc');
const OUT = resolve(ROOT, 'assets/data/textual-variants.json');

// ---------------------------------------------------------------------------
// Конфиг: человек указывает ссылки для внутристиховых TR-плюсов
// Скрипт читает реальный текст из syn JSON и фиксирует ruWords + fromIdx
// ---------------------------------------------------------------------------

const PHRASE_REFS = [
  { ref: '1john 5:7', fromIdx: 3, toIdx: 15, note: 'Comma Johanneum — absent in critical text (NA/SBLGNT)' },
  { ref: 'matthew 6:13', fromIdx: 11, note: 'Doxology of Lord\'s Prayer — absent in critical text' },
  { ref: 'revelation 13:1', fromIdx: 0, toIdx: 7, note: 'First words of Synodal 13:1 («И стал я на песке морском») = Greek 12:18. Greek verse 12:18 is unreachable in UI.' },
  { ref: 'acts 9:5', fromIdx: 13, toIdx: 18, note: '«Трудно тебе идти против рожна» — TR addition absent in NA' },
  { ref: 'mark 6:11', fromIdx: 23, note: '«Истинно говорю вам: отраднее будет Содому…» — TR addition' },
  { ref: 'luke 4:4', fromIdx: 13, toIdx: 17, note: '«но всяким словом Божиим» — TR expansion absent in NA' },
  { ref: 'romans 8:1', fromIdx: 10, toIdx: 17, note: '«живут не по плоти, но по духу» — TR addition absent in NA' },
];

// ---------------------------------------------------------------------------

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function getVerseSet(chapter) {
  const verses = new Set();
  for (const v of chapter.verses) {
    verses.add(v.n);
  }
  return verses;
}

function main() {
  const synFiles = readdirSync(SYN_DIR).filter(f => f.endsWith('.json'));
  const grcFiles = new Set(readdirSync(GRC_DIR).filter(f => f.endsWith('.json')));

  const synOnly = [];
  const grcOnly = [];

  // 1. Автоматический diff инвентарей
  for (const file of synFiles) {
    const bookId = file.replace('.json', '');
    const synBook = loadJson(resolve(SYN_DIR, file));

    let grcBook = null;
    if (grcFiles.has(file)) {
      grcBook = loadJson(resolve(GRC_DIR, file));
    }

    for (const synCh of synBook.chapters) {
      const grcCh = grcBook
        ? grcBook.chapters.find(c => c.n === synCh.n)
        : null;

      const synVerses = getVerseSet(synCh);
      const grcVerses = grcCh ? getVerseSet(grcCh) : new Set();

      for (const vn of synVerses) {
        if (!grcVerses.has(vn)) {
          synOnly.push({ book: bookId, ch: synCh.n, v: vn });
        }
      }

      if (grcCh) {
        for (const vn of grcVerses) {
          if (!synVerses.has(vn)) {
            grcOnly.push({ book: bookId, ch: grcCh.n, v: vn });
          }
        }
      }
    }
  }

  synOnly.sort((a, b) => a.book.localeCompare(b.book) || a.ch - b.ch || a.v - b.v);
  grcOnly.sort((a, b) => a.book.localeCompare(b.book) || a.ch - b.ch || a.v - b.v);

  // 2. Извлечение слов для synOnlyPhrases
  const synOnlyPhrases = [];
  for (const cfg of PHRASE_REFS) {
    const [bookId, chv] = cfg.ref.split(' ');
    const [chStr, vStr] = chv.split(':');
    const chN = parseInt(chStr, 10);
    const vN = parseInt(vStr, 10);

    const synPath = resolve(SYN_DIR, `${bookId}.json`);
    if (!existsSync(synPath)) {
      console.warn(`⚠ Книга не найдена: ${bookId}`);
      continue;
    }

    const synBook = loadJson(synPath);
    const ch = synBook.chapters.find(c => c.n === chN);
    if (!ch) {
      console.warn(`⚠ Глава не найдена: ${cfg.ref}`);
      continue;
    }

    const verse = ch.verses.find(v => v.n === vN);
    if (!verse) {
      console.warn(`⚠ Стих не найден: ${cfg.ref}`);
      continue;
    }

    const words = verse.text.split(/\s+/);
    // Берём слова с fromIdx до toIdx (или до конца стиха)
    const ruWords = words.slice(cfg.fromIdx, cfg.toIdx);

    synOnlyPhrases.push({
      ref: cfg.ref,
      fromIdx: cfg.fromIdx,
      ruWords,
      note: cfg.note
    });

    console.log(`  ${cfg.ref}: «${ruWords.slice(0, 6).join(' ')}…» (${ruWords.length} слов)`);
  }

  // 3. grcOnlyNotes
  const grcOnlyNotes = [];

  // Откр 12:18 = начало syn 13:1
  const rev12_18 = grcOnly.find(e => e.book === 'revelation' && e.ch === 12 && e.v === 18);
  if (rev12_18) {
    grcOnlyNotes.push({
      ref: 'revelation 12:18',
      note: 'Absent from Synodal versification. Content = first words of Synodal 13:1. Unreachable in UI (verse Map by n will never request it).'
    });
  }

  // 4. Сборка и запись
  const registry = {
    _note: 'Generated by scripts/build-variants-registry.mjs. Do not edit by hand.',
    synOnlyVerses: synOnly,
    grcOnlyVerses: grcOnly,
    synOnlyPhrases,
    grcOnlyNotes,
  };

  const outDir = dirname(OUT);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(OUT, JSON.stringify(registry, null, 2), 'utf-8');

  console.log(`\n✅ Реестр записан: ${OUT}`);
  console.log(`   synOnlyVerses: ${synOnly.length}`);
  console.log(`   grcOnlyVerses: ${grcOnly.length}`);
  console.log(`   synOnlyPhrases: ${synOnlyPhrases.length}`);
  console.log(`   grcOnlyNotes: ${grcOnlyNotes.length}`);
}

main();
