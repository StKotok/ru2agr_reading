#!/usr/bin/env node

/**
 * write-alignment-packs.mjs — B2 Runtime Pack Writer (Step 6).
 *
 * Reads certified pairs (q:"e") and writes runtime alignment packs.
 * Only q:"e" pairs are included in runtime. q:"f" and q:"u" are hidden.
 *
 * Input:
 *   generated/canonical/alignments/syn--sblgnt-macula/certified.jsonl
 *
 * Output:
 *   assets/data/align/syn--sblgnt-macula/books/{bookId}.json
 *   assets/data/align/syn--sblgnt-macula/index.json
 *
 * Usage: node scripts/write-alignment-packs.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CANONICAL_DIR = resolve(ROOT, 'generated', 'canonical', 'alignments', 'syn--sblgnt-macula');
const CERTIFIED_PATH = resolve(CANONICAL_DIR, 'certified.jsonl');
const TRANSLATION_DIR = resolve(ROOT, 'assets', 'data', 'translations', 'syn', 'books');
const ORIGINAL_DIR = resolve(ROOT, 'assets', 'data', 'originals', 'sblgnt-macula', 'books');
const VARIANTS_PATH = resolve(ROOT, 'assets', 'data', 'textual-variants.json');
const OUT_DIR = resolve(ROOT, 'assets', 'data', 'align', 'syn--sblgnt-macula', 'books');
const INDEX_OUT = resolve(ROOT, 'assets', 'data', 'align', 'syn--sblgnt-macula', 'index.json');

const NT_BOOKS = [
  'matthew','mark','luke','john','acts','romans','1corinthians','2corinthians',
  'galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians',
  '1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter',
  '1john','2john','3john','jude','revelation',
];

const BOOK_SHORT = {
  matthew:'Мф', mark:'Мк', luke:'Лк', john:'Ин', acts:'Деян', romans:'Рим',
  '1corinthians':'1Кор','2corinthians':'2Кор', galatians:'Гал', ephesians:'Еф',
  philippians:'Флп', colossians:'Кол','1thessalonians':'1Фес','2thessalonians':'2Фес',
  '1timothy':'1Тим','2timothy':'2Тим', titus:'Тит', philemon:'Флм', hebrews:'Евр',
  james:'Иак','1peter':'1Пет','2peter':'2Пет','1john':'1Ин','2john':'2Ин','3john':'3Ин',
  jude:'Иуд', revelation:'Откр',
};

console.log('=== write-alignment-packs (B2 Step 6) ===\n');

// ── Load certified pairs ──
const certified = [];
try {
  const content = readFileSync(CERTIFIED_PATH, 'utf8');
  for (const line of content.trim().split('\n').filter(Boolean)) {
    certified.push(JSON.parse(line));
  }
} catch (e) {
  console.error(`Cannot load certified pairs: ${e.message}`);
  process.exit(1);
}
console.log(`Loaded ${certified.length} certified pairs (q:"e")`);

// ── Load textual variants ──
const variants = JSON.parse(readFileSync(VARIANTS_PATH, 'utf8'));

const synOnlySet = new Set();
for (const v of variants.synOnlyVerses) {
  synOnlySet.add(`${v.book} ${v.ch}:${v.v}`);
}

const grcOnlySet = new Set();
for (const v of (variants.grcOnlyVerses || [])) {
  grcOnlySet.add(`${v.book} ${v.ch}:${v.v}`);
}

const MERGED_VERSES = {
  '2corinthians 11:33': { syn: '11:32b', grc: '11:33', status: 'merged' },
};
if (variants.mergedVerses) {
  for (const v of variants.mergedVerses) {
    MERGED_VERSES[`${v.book} ${v.ch}:${v.v}`] = {
      syn: v.syn, grc: v.grc, status: 'merged',
    };
  }
}

// Phrase variants by ref
const phraseVariantsByRef = {};
for (const pv of variants.synOnlyPhrases) {
  if (!phraseVariantsByRef[pv.ref]) phraseVariantsByRef[pv.ref] = [];
  phraseVariantsByRef[pv.ref].push(pv);
}

// ── Group certified pairs by book and ref ──
const pairsByBook = new Map(); // bookId → Map(ref → pairs[])
for (const c of certified) {
  const bookId = c.ref.split(' ')[0];
  // Normalize bookId
  const bookMap = {
    '1corinthians':'1corinthians','2corinthians':'2corinthians',
    '1thessalonians':'1thessalonians','2thessalonians':'2thessalonians',
    '1timothy':'1timothy','2timothy':'2timothy',
    '1peter':'1peter','2peter':'2peter',
    '1john':'1john','2john':'2john','3john':'3john',
  };
  const normBook = bookMap[bookId] || bookId;

  if (!pairsByBook.has(normBook)) pairsByBook.set(normBook, new Map());
  const bookPairs = pairsByBook.get(normBook);
  if (!bookPairs.has(c.ref)) bookPairs.set(c.ref, []);
  bookPairs.get(c.ref).push(c);
}

// ── All visible lexemes for index ──
const allVisibleLexemes = new Set();
let totalPairsWritten = 0;

for (const bookId of NT_BOOKS) {
  // Build verse correspondence
  const synPath = resolve(TRANSLATION_DIR, `${bookId}.json`);
  const grcPath = resolve(ORIGINAL_DIR, `${bookId}.json`);

  let synPack, grcPack;
  try {
    synPack = JSON.parse(readFileSync(synPath, 'utf8'));
    grcPack = JSON.parse(readFileSync(grcPath, 'utf8'));
  } catch (e) {
    console.error(`  ⚠ Skipping ${bookId}: ${e.message}`);
    continue;
  }

  const synVerses = new Map();
  for (const ch of synPack.chapters) {
    for (const v of ch.verses) synVerses.set(v.ref, v);
  }

  const grcVerses = new Map();
  for (const ch of grcPack.chapters) {
    for (const v of ch.verses) grcVerses.set(v.ref, v);
  }

  // Build verse map
  const verseMap = {};
  for (const [ref] of synVerses) {
    const parts = ref.split(' ');
    const bk = parts[0];
    const [ch, v] = parts[1].split(':').map(Number);

    if (synOnlySet.has(ref)) {
      verseMap[ref] = { syn: `${ch}:${v}`, grc: null, status: 'synOnly' };
      continue;
    }

    const mergeKey = `${bk} ${ch}:${v}`;
    if (MERGED_VERSES[mergeKey]) {
      verseMap[ref] = MERGED_VERSES[mergeKey];
      continue;
    }

    if (grcVerses.has(ref)) {
      verseMap[ref] = { syn: `${ch}:${v}`, grc: `${ch}:${v}`, status: 'paired' };
    } else {
      verseMap[ref] = { syn: `${ch}:${v}`, grc: null, status: 'synOnly' };
    }
  }

  for (const [ref] of grcVerses) {
    if (verseMap[ref]) continue;
    if (MERGED_VERSES[ref]) {
      verseMap[ref] = MERGED_VERSES[ref];
      continue;
    }
    if (grcOnlySet.has(ref)) {
      const parts = ref.split(' ');
      const [ch, v] = parts[1].split(':').map(Number);
      verseMap[ref] = { syn: null, grc: `${ch}:${v}`, status: 'grcOnly' };
    } else {
      const parts = ref.split(' ');
      const [ch, v] = parts[1].split(':').map(Number);
      verseMap[ref] = { syn: `${ch}:${v}`, grc: `${ch}:${v}`, status: 'paired' };
    }
  }

  // Build pairsByRef from certified
  const pairsByRef = {};
  const bookPairs = pairsByBook.get(bookId) || new Map();

  for (const [ref, pairs] of bookPairs) {
    // Sort by span[0], span[1], token index
    const sorted = pairs.sort((a, b) => {
      if (a.span[0] !== b.span[0]) return a.span[0] - b.span[0];
      if (a.span[1] !== b.span[1]) return a.span[1] - b.span[1];
      // Compare tokenId by numeric part
      const getNum = (id) => parseInt(id.replace(/^n/, ''), 10) || 0;
      return getNum(a.tokenId) - getNum(b.tokenId);
    });

    const runtimePairs = sorted
      .filter(p => p.q === 'e')  // Only q:"e" goes to runtime; q:"f"/q:"u" are hidden
      .map(p => {
        allVisibleLexemes.add(p.lexemeKey);
        totalPairsWritten++;
        return {
          span: p.span,
          tokenId: p.tokenId,
          lexemeKey: p.lexemeKey,
          q: p.q,   // Respect the certified quality (should always be 'e' after filter)
          src: p.src,
        };
      });

    if (runtimePairs.length > 0) {
      pairsByRef[ref] = runtimePairs;
    }
  }

  // Build phrase variants
  const pvByRef = {};
  for (const [ref, pvs] of Object.entries(phraseVariantsByRef)) {
    if (!ref.startsWith(bookId + ' ')) continue;
    const synData = synVerses.get(ref);
    if (!synData) continue;

    const pvEntries = [];
    for (const pv of pvs) {
      const words = synData.words;
      if (!words || words.length === 0) continue;
      const fromIdx = pv.fromIdx || 0;
      const toIdx = Math.min(fromIdx + (pv.ruWords?.length || 0), words.length);
      if (fromIdx < words.length && toIdx <= words.length) {
        pvEntries.push({
          span: [words[fromIdx].start, words[toIdx - 1].end],
          variant: pv.note || 'TR addition',
          status: 'synOnlyPhrase',
        });
      }
    }
    if (pvEntries.length > 0) pvByRef[ref] = pvEntries;
  }

  // Write book pack
  const alignmentPack = {
    schema: 'alignment-book-v1',
    alignmentId: 'syn--sblgnt-macula',
    translationId: 'syn',
    originalId: 'sblgnt-macula',
    bookId,
    verses: verseMap,
    pairsByRef,
    phraseVariantsByRef: pvByRef,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, `${bookId}.json`), JSON.stringify(alignmentPack));

  const pairCount = Object.values(pairsByRef).reduce((s, a) => s + a.length, 0);
  console.log(`  ${BOOK_SHORT[bookId] || bookId}: ${pairCount} visible pairs`);
}

// ── Write index ──
const index = {
  schema: 'alignment-index-v1',
  alignmentId: 'syn--sblgnt-macula',
  lexemesWithVisiblePair: [...allVisibleLexemes].sort(),
};

mkdirSync(resolve(OUT_DIR, '..'), { recursive: true });
writeFileSync(INDEX_OUT, JSON.stringify(index));

console.log(`\nTotal runtime visible pairs: ${totalPairsWritten}`);
console.log(`Visible lexemes in index: ${allVisibleLexemes.size}`);
console.log('Done.');
