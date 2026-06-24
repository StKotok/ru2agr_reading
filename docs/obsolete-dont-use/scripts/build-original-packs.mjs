#!/usr/bin/env node

/**
 * build-original-packs.mjs — Canonical tokens → nested original book packs.
 *
 * Reads generated/canonical/sblgnt-macula/{tokens.jsonl,verses.json}
 * and produces assets/data/originals/sblgnt-macula/books/{bookId}.json
 * in the original-book-v1 schema.
 *
 * Usage: node scripts/build-original-packs.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildLexemeKeyMap, formatLexemeKeyReport } from './macula/lib/lexeme-key.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CANONICAL_DIR = resolve(ROOT, 'generated', 'canonical', 'sblgnt-macula');
const OUT_DIR = resolve(ROOT, 'assets', 'data', 'originals', 'sblgnt-macula', 'books');
const CORE_PATH = resolve(ROOT, 'docs', 'sources', 'locales', 'ru', 'core.json');

// Book metadata (must match build-macula.mjs)
const NT_BOOKS = [
  { id: 'matthew', title: 'ΚΑΤΑ ΜΑΘΘΑΙΟΝ', chapters: 28 },
  { id: 'mark', title: 'ΚΑΤΑ ΜΑΡΚΟΝ', chapters: 16 },
  { id: 'luke', title: 'ΚΑΤΑ ΛΟΥΚΑΝ', chapters: 24 },
  { id: 'john', title: 'ΚΑΤΑ ΙΩΑΝΝΗΝ', chapters: 21 },
  { id: 'acts', title: 'ΠΡΑΞΕΙΣ ΑΠΟΣΤΟΛΩΝ', chapters: 28 },
  { id: 'romans', title: 'ΠΡΟΣ ΡΩΜΑΙΟΥΣ', chapters: 16 },
  { id: '1corinthians', title: 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Α', chapters: 16 },
  { id: '2corinthians', title: 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Β', chapters: 13 },
  { id: 'galatians', title: 'ΠΡΟΣ ΓΑΛΑΤΑΣ', chapters: 6 },
  { id: 'ephesians', title: 'ΠΡΟΣ ΕΦΕΣΙΟΥΣ', chapters: 6 },
  { id: 'philippians', title: 'ΠΡΟΣ ΦΙΛΙΠΠΗΣΙΟΥΣ', chapters: 4 },
  { id: 'colossians', title: 'ΠΡΟΣ ΚΟΛΟΣΣΑΕΙΣ', chapters: 4 },
  { id: '1thessalonians', title: 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Α', chapters: 5 },
  { id: '2thessalonians', title: 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Β', chapters: 3 },
  { id: '1timothy', title: 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ Α', chapters: 6 },
  { id: '2timothy', title: 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ Β', chapters: 4 },
  { id: 'titus', title: 'ΠΡΟΣ ΤΙΤΟΝ', chapters: 3 },
  { id: 'philemon', title: 'ΠΡΟΣ ΦΙΛΗΜΟΝΑ', chapters: 1 },
  { id: 'hebrews', title: 'ΠΡΟΣ ΕΒΡΑΙΟΥΣ', chapters: 13 },
  { id: 'james', title: 'ΙΑΚΩΒΟΥ', chapters: 5 },
  { id: '1peter', title: 'ΠΕΤΡΟΥ Α', chapters: 5 },
  { id: '2peter', title: 'ΠΕΤΡΟΥ Β', chapters: 3 },
  { id: '1john', title: 'ΙΩΑΝΝΟΥ Α', chapters: 5 },
  { id: '2john', title: 'ΙΩΑΝΝΟΥ Β', chapters: 1 },
  { id: '3john', title: 'ΙΩΑΝΝΟΥ Γ', chapters: 1 },
  { id: 'jude', title: 'ΙΟΥΔΑ', chapters: 1 },
  { id: 'revelation', title: 'ΑΠΟΚΑΛΥΨΙΣ ΙΩΑΝΝΟΥ', chapters: 22 },
];

function loadJSONL(path) {
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return [];
  return raw.split('\n').map(line => JSON.parse(line));
}

console.log('=== build-original-packs ===\n');

// Load canonical data
console.log('Loading canonical data...');
const tokens = loadJSONL(resolve(CANONICAL_DIR, 'tokens.jsonl'));
const canonicalVerses = JSON.parse(readFileSync(resolve(CANONICAL_DIR, 'verses.json'), 'utf8'));
const canonicalLexemes = JSON.parse(readFileSync(resolve(CANONICAL_DIR, 'lexemes.json'), 'utf8'));
const curatedEntries = JSON.parse(readFileSync(CORE_PATH, 'utf8'));

console.log(`  Tokens: ${tokens.length}`);
console.log(`  Verses: ${canonicalVerses.length}`);
console.log(`  Lexemes: ${canonicalLexemes.length}`);
console.log(`  Curated entries: ${curatedEntries.length}`);

// Build lexemeKey map
console.log('\nBuilding lexemeKey map...');
const { map: lexemeKeyMap, report: keyReport } = buildLexemeKeyMap(canonicalLexemes, curatedEntries);
console.log(formatLexemeKeyReport(keyReport));

// Build verse text lookup
const verseTextMap = new Map();
for (const v of canonicalVerses) {
  verseTextMap.set(v.ref, v.text);
}

// Build token lookup by (bookId, chapter, verse)
const tokensByRef = new Map();
for (const token of tokens) {
  if (!tokensByRef.has(token.ref)) tokensByRef.set(token.ref, []);
  tokensByRef.get(token.ref).push(token);
}

// Build per-book output
console.log('\nGenerating original book packs...');

const FUNCTION_WORD_POS = new Set([
  'article', 'preposition', 'conjunction', 'particle', 'pronoun', 'determiner',
]);

let totalTokensOut = 0;
let totalVersesOut = 0;

for (const book of NT_BOOKS) {
  const chapters = [];
  for (let c = 1; c <= book.chapters; c++) {
    const verses = [];
    for (let v = 1; ; v++) {
      const ref = `${book.id} ${c}:${v}`;
      const verseTokens = tokensByRef.get(ref);
      if (!verseTokens || verseTokens.length === 0) break;

      const verseText = verseTextMap.get(ref) || '';
      const tokenObjs = verseTokens.map(t => {
        const lexemeKey = lexemeKeyMap.get(t.lexemeId) || t.lexemeId || t.lemma || '?';
        const strongs = Array.isArray(t.strong) ? t.strong : (t.strong ? [String(t.strong)] : []);
        const isFw = FUNCTION_WORD_POS.has(t.pos?.category) || t.isFunctionWord || false;

        return {
          id: t.id,
          i: t.tokenIndex || 0,
          s: t.surface || '',
          lemma: t.lemma || '',
          lexemeKey,
          maculaLexemeId: t.lexemeId || '',
          morph: t.morphology?.code || '',
          strongs,
          fw: isFw,
        };
      });

      verses.push({
        ref,
        n: v,
        text: verseText,
        tokens: tokenObjs,
      });

      totalTokensOut += tokenObjs.length;
    }
    if (verses.length > 0) {
      chapters.push({ n: c, verses });
      totalVersesOut += verses.length;
    }
  }

  const pack = {
    schema: 'original-book-v1',
    originalId: 'sblgnt-macula',
    bookId: book.id,
    title: book.title,
    chapters,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, `${book.id}.json`);
  writeFileSync(outPath, JSON.stringify(pack));
  console.log(`  ${book.id}.json: ${chapters.length} chapters, ${totalVersesOut} verses`);
}

console.log(`\nTotal output tokens: ${totalTokensOut}`);
console.log(`Total output verses: ${totalVersesOut}`);
console.log('Done.');
