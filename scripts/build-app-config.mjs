// scripts/build-app-config.mjs
// Копирует alphabet.json, books.json и генерирует data-manifest.json.

import { SOURCE_DATA_VERSION, NORMALIZATION_VERSION } from './lib/versions.mjs';
import { readSourceJson, readDataJson, writeDataJson, DATA_ROOT } from './lib/fs.mjs';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

console.log('build-app-config.mjs');
console.log(`DATA_ROOT: ${DATA_ROOT}`);

// Copy alphabet.json
const alphabet = readSourceJson('app-config/alphabet.json');
writeDataJson('alphabet.json', alphabet);
console.log('  ✓ alphabet.json');

// Copy books.json (source of truth → app-ready copy), enrich with lexeme counts
const books = readSourceJson('app-config/books.json');

// Compute unique lexeme counts per book from already-built grc books
console.log('  computing lexeme counts per book...');
const bookLexemeCounts = {};
const allLexemesCrossBook = new Map(); // lexemeId → Set of bookIds
for (const book of books) {
  try {
    const grc = readDataJson(`bibles/grc/${book.id}.json`);
    const lexemes = new Set();
    for (const ch of grc.chapters) {
      for (const v of ch.verses) {
        for (const t of v.tokens) {
          lexemes.add(t.lexemeId);
        }
      }
    }
    bookLexemeCounts[book.id] = lexemes.size;
    for (const lid of lexemes) {
      if (!allLexemesCrossBook.has(lid)) allLexemesCrossBook.set(lid, new Set());
      allLexemesCrossBook.get(lid).add(book.id);
    }
  } catch {
    bookLexemeCounts[book.id] = 0;
  }
}

// Add counts to each book entry
for (const book of books) {
  book.lexemeCount = bookLexemeCounts[book.id] || 0;
  // Lexemes that appear ONLY in this book
  book.uniqueOnlyCount = 0;
  if (book.lexemeCount > 0) {
    for (const [lid, bookSet] of allLexemesCrossBook) {
      if (bookSet.size === 1 && bookSet.has(book.id)) {
        book.uniqueOnlyCount++;
      }
    }
  }
}

writeDataJson('books.json', books);
console.log(`  ✓ books.json (enriched with lexeme counts)`);

// Generate data-manifest.json
function collectFiles(dir, basePath = '') {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, relPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const stat = statSync(fullPath);
      const content = readFileSync(fullPath);
      const sha256 = createHash('sha256').update(content).digest('hex');
      results.push({
        path: relPath,
        size: stat.size,
        sha256
      });
    }
  }
  return results;
}

// Determine data types for each file
function getDataType(filePath) {
  if (filePath.startsWith('bibles/grc/')) return 'grc-bible';
  if (filePath.startsWith('bibles/eng/')) return 'eng-bible';
  if (filePath.startsWith('align/grc-eng/') && filePath.endsWith('build-report.json')) return 'alignment-report';
  if (filePath.startsWith('align/grc-eng/')) return 'alignment';
  if (filePath.startsWith('lexicon/core.json')) return 'lexicon-core';
  if (filePath.startsWith('lexicon/dictionary.json')) return 'lexicon-dict';
  if (filePath === 'alphabet.json') return 'alphabet';
  if (filePath === 'books.json') return 'books';
  return 'unknown';
}

const rawFiles = collectFiles(DATA_ROOT).filter(f => f.path !== 'data-manifest.json');
const files = rawFiles.map(f => ({
  path: f.path,
  type: getDataType(f.path),
  size: f.size,
  sha256: f.sha256
}));

const manifest = {
  schema: 'data-manifest-v2',
  version: '2.0.0',
  buildDate: new Date().toISOString(),
  sourceDataVersion: SOURCE_DATA_VERSION,
  normalizationVersion: NORMALIZATION_VERSION,
  dataTypes: ['grc-bible', 'eng-bible', 'alignment', 'alignment-report', 'lexicon-core', 'lexicon-dict', 'alphabet', 'books'],
  files
};

writeDataJson('data-manifest.json', manifest);
console.log(`  ✓ data-manifest.json (${files.length} files)`);

console.log('\n✓ build-app-config.mjs complete');
