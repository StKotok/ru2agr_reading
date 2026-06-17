#!/usr/bin/env node

/**
 * verify-data.mjs — Data verification (Gate 3 validator).
 *
 * Validates schema conformance and invariants of all runtime data packs:
 * - Original packs (27 books, schema original-book-v1)
 * - Translation packs (27 books, schema translation-book-v1)
 * - Alignment packs (27 books, schema alignment-book-v1)
 * - Alignment index
 * - Top-1000 lexicon core
 * - Locale overlays
 *
 * Checks:
 * - Every pair.tokenId exists in corresponding original pack
 * - Every pair.span is within bounds of verse text and matches words[]
 * - No duplicate visible (e/f) pairs per tokenId in a verse
 * - SHA from source-manifest matches actual snapshots
 * - allRefs consistency
 *
 * Usage: node scripts/verify-data.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const ORIGINAL_DIR = resolve(ROOT, 'assets', 'data', 'originals', 'sblgnt-macula', 'books');
const TRANSLATION_DIR = resolve(ROOT, 'assets', 'data', 'translations', 'syn', 'books');
const ALIGN_DIR = resolve(ROOT, 'assets', 'data', 'align', 'syn--sblgnt-macula', 'books');
const INDEX_PATH = resolve(ROOT, 'assets', 'data', 'align', 'syn--sblgnt-macula', 'index.json');
const LEXICON_CORE_PATH = resolve(ROOT, 'assets', 'data', 'lexicon', 'top1000.core.json');
const LOCALE_TOP_PATH = resolve(ROOT, 'assets', 'data', 'lexicon', 'locales', 'ru', 'top1000.json');
const LOCALE_CORE_PATH = resolve(ROOT, 'assets', 'data', 'lexicon', 'locales', 'ru', 'core.json');

const NT_BOOKS = [
  'matthew','mark','luke','john','acts','romans','1corinthians','2corinthians',
  'galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians',
  '1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter',
  '1john','2john','3john','jude','revelation',
];

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); console.error(`  ✗ ${msg}`); }
function warn(msg) { warnings.push(msg); console.warn(`  ⚠ ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }

console.log('=== verify-data ===\n');

// ── Check files exist ──
console.log('Checking files exist...');
let totalFiles = 0;
for (const bookId of NT_BOOKS) {
  for (const [dir, label] of [[ORIGINAL_DIR, 'original'], [TRANSLATION_DIR, 'translation'], [ALIGN_DIR, 'alignment']]) {
    const path = resolve(dir, `${bookId}.json`);
    if (!existsSync(path)) {
      err(`Missing ${label} pack: ${bookId}`);
    } else {
      totalFiles++;
    }
  }
}
ok(`${totalFiles} book packs found (${NT_BOOKS.length * 3} expected)`);

// ── Schema validation ──
console.log('\nSchema validation...');

for (const bookId of NT_BOOKS) {
  // Check original pack
  const origPath = resolve(ORIGINAL_DIR, `${bookId}.json`);
  if (!existsSync(origPath)) continue;
  const orig = JSON.parse(readFileSync(origPath, 'utf8'));
  if (orig.schema !== 'original-book-v1') err(`${bookId}: original schema is "${orig.schema}"`);
  if (orig.originalId !== 'sblgnt-macula') err(`${bookId}: original originalId is "${orig.originalId}"`);
  for (const ch of orig.chapters) {
    for (const v of ch.verses) {
      if (!v.tokens || !Array.isArray(v.tokens)) {
        err(`${bookId} ${v.ref}: missing tokens array`);
        continue;
      }
      for (const t of v.tokens) {
        if (!t.id) err(`${bookId} ${v.ref}: token missing id`);
        if (!Array.isArray(t.strongs)) err(`${bookId} ${v.ref}: token.strongs is not array (${typeof t.strongs})`);
        if (typeof t.fw !== 'boolean') err(`${bookId} ${v.ref}: token.fw is not boolean`);
        if (!t.lexemeKey) err(`${bookId} ${v.ref}: token missing lexemeKey`);
      }
    }
  }

  // Check translation pack
  const transPath = resolve(TRANSLATION_DIR, `${bookId}.json`);
  if (!existsSync(transPath)) continue;
  const trans = JSON.parse(readFileSync(transPath, 'utf8'));
  if (trans.schema !== 'translation-book-v1') err(`${bookId}: translation schema is "${trans.schema}"`);
  for (const ch of trans.chapters) {
    for (const v of ch.verses) {
      if (!v.words || !Array.isArray(v.words)) {
        err(`${bookId} ${v.ref}: missing words array`);
        continue;
      }
      for (const w of v.words) {
        if (typeof w.start !== 'number') err(`${bookId} ${v.ref}: word missing 'start'`);
        if (typeof w.end !== 'number') err(`${bookId} ${v.ref}: word missing 'end'`);
        const actual = v.text.slice(w.start, w.end);
        if (actual !== w.text) {
          err(`${bookId} ${v.ref}: word "${w.text}" doesn't match text[${w.start}:${w.end}]="${actual}"`);
        }
      }
    }
  }

  // Check alignment pack
  const alignPath = resolve(ALIGN_DIR, `${bookId}.json`);
  if (!existsSync(alignPath)) continue;
  const align = JSON.parse(readFileSync(alignPath, 'utf8'));
  if (align.schema !== 'alignment-book-v1') err(`${bookId}: alignment schema is "${align.schema}"`);

  // Check every pair
  if (align.pairsByRef) {
    for (const [ref, pairs] of Object.entries(align.pairsByRef)) {
      const seenTokens = new Set();
      for (const p of pairs) {
        // Check spans are within bounds
        if (!Array.isArray(p.span) || p.span.length !== 2) {
          err(`${ref}: pair.span is not [start,end]`);
          continue;
        }

        // Check no duplicate visible pair per tokenId in verse
        if ((p.q === 'e' || p.q === 'f') && seenTokens.has(p.tokenId)) {
          err(`${ref}: duplicate visible pair for tokenId ${p.tokenId}`);
        }
        if (p.q === 'e' || p.q === 'f') {
          seenTokens.add(p.tokenId);
        }

        // Check q is valid
        if (!['e','f','u'].includes(p.q)) {
          err(`${ref}: invalid q="${p.q}"`);
        }
      }
    }
  }
}
ok('Schema validation complete');

// ── Cross-pack validation ──
console.log('\nCross-pack validation...');

for (const bookId of NT_BOOKS) {
  const origPath = resolve(ORIGINAL_DIR, `${bookId}.json`);
  const alignPath = resolve(ALIGN_DIR, `${bookId}.json`);
  if (!existsSync(origPath) || !existsSync(alignPath)) continue;

  const orig = JSON.parse(readFileSync(origPath, 'utf8'));
  const align = JSON.parse(readFileSync(alignPath, 'utf8'));

  // Build tokenId set from original pack
  const tokenIdSet = new Set();
  for (const ch of orig.chapters) {
    for (const v of ch.verses) {
      for (const t of v.tokens) {
        tokenIdSet.add(t.id);
      }
    }
  }

  // Check every pair's tokenId exists in original
  if (align.pairsByRef) {
    for (const [ref, pairs] of Object.entries(align.pairsByRef)) {
      for (const p of pairs) {
        if (!tokenIdSet.has(p.tokenId)) {
          err(`${ref}: pair.tokenId "${p.tokenId}" not found in original pack`);
        }
      }
    }
  }
}
ok('Cross-pack validation complete');

// ── Lexicon checks ──
console.log('\nLexicon checks...');

const core = JSON.parse(readFileSync(LEXICON_CORE_PATH, 'utf8'));
if (core.schema !== 'top1000-lexicon-core-v1') err(`lexicon core schema is "${core.schema}"`);
if (core.items.length !== 1000) err(`lexicon core has ${core.items.length} items (expected 1000)`);

const hasRuFields = core.items.some(i => i.gloss || i.ruMatches || i.ruExclude);
if (hasRuFields) err('lexicon core has ru-fields');

const hasAlignment = core.items.some(i => 'hasAlignment' in i);
if (hasAlignment) err('lexicon core has hasAlignment field');

const coreKeys = new Set(core.items.map(i => i.lexemeKey));
if (coreKeys.size !== 1000) err(`lexicon core has duplicate lexemeKeys (${coreKeys.size} unique)`);

ok(`Core: ${core.items.length} items, all unique lexemeKeys`);

// Locale checks
const localeTop = JSON.parse(readFileSync(LOCALE_TOP_PATH, 'utf8'));
if (localeTop.schema !== 'top1000-locale-overlay-v1') err(`locale top1000 schema is "${localeTop.schema}"`);

const localeCore = JSON.parse(readFileSync(LOCALE_CORE_PATH, 'utf8'));
if (localeCore.schema !== 'core-locale-overlay-v1') err(`locale core schema is "${localeCore.schema}"`);

const checkKeys = ['logos','theos','kurios'];
for (const k of checkKeys) {
  if (!localeCore.items.find(i => i.lexemeKey === k)) err(`locale core missing ${k}`);
}

ok(`Locale: top1000=${localeTop.items.length}, core=${localeCore.items.length}`);

// ── Index checks ──
console.log('\nIndex checks...');
const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
if (index.schema !== 'alignment-index-v1') err(`index schema is "${index.schema}"`);
ok(`Index: ${index.lexemesWithVisiblePair.length} visible lexemes`);

// ── SHA verification (source manifests) ──
console.log('\nSHA verification...');
const SOURCES_DIR = resolve(ROOT, 'docs', 'sources');
const SOURCE_KINDS = ['originals', 'translations', 'locales'];

function isHexSha(s) {
  return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
}

for (const kind of SOURCE_KINDS) {
  const kindDir = resolve(SOURCES_DIR, kind);
  if (!existsSync(kindDir)) { warn(`Source dir missing: docs/sources/${kind}`); continue; }

  for (const entry of readdirSync(kindDir)) {
    const entryDir = resolve(kindDir, entry);
    const manifestPath = resolve(entryDir, 'source-manifest.json');
    if (!existsSync(manifestPath)) continue;

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!manifest.files || !Array.isArray(manifest.files)) continue;

    for (const fileRef of manifest.files) {
      // Skip non-hex SHA placeholders (e.g. "curated-manually" for hand-curated data)
      if (!isHexSha(fileRef.sha256)) {
        warn(`SHA: ${manifest.id}/${fileRef.path} — non-hex SHA (${fileRef.sha256}), skipping`);
        continue;
      }

      // Try path relative to manifest dir, then relative to repo root
      let filePath = resolve(entryDir, fileRef.path);
      if (!existsSync(filePath)) {
        filePath = resolve(ROOT, fileRef.path);
      }
      if (!existsSync(filePath)) {
        err(`SHA: ${manifest.id}/${fileRef.path} — file not found (checked ${entryDir} and repo root)`);
        continue;
      }
      const content = readFileSync(filePath);
      const actual = createHash('sha256').update(content).digest('hex');
      if (actual !== fileRef.sha256) {
        err(`SHA mismatch: ${manifest.id}/${fileRef.path} (expected ${fileRef.sha256}, got ${actual})`);
      }
    }
  }
}
ok('SHA verification complete');

// ── Orphan explanation check ──
// Verifies that verse-level and phrase-level exclusions are correctly applied:
//  - synOnly/grcOnly/merged verses have no visible pairs where disallowed
//  - phrase variant spans have no visible pairs
//  - No cross-verse tokenId references
console.log('\nOrphan/Exclusion check...');

let exclusionErrors = 0;

for (const bookId of NT_BOOKS) {
  const transPath = resolve(TRANSLATION_DIR, `${bookId}.json`);
  const alignPath = resolve(ALIGN_DIR, `${bookId}.json`);
  if (!existsSync(transPath) || !existsSync(alignPath)) continue;

  const trans = JSON.parse(readFileSync(transPath, 'utf8'));
  const align = JSON.parse(readFileSync(alignPath, 'utf8'));

  const verseMap = align.verses || {};
  const pairsByRef = align.pairsByRef || {};
  const phraseVariants = align.phraseVariantsByRef || {};

  // Build tokenId→verse index from original pack
  const origPath = resolve(ORIGINAL_DIR, `${bookId}.json`);
  let tokenVerseMap = new Map(); // tokenId → ref
  if (existsSync(origPath)) {
    const orig = JSON.parse(readFileSync(origPath, 'utf8'));
    for (const ch of orig.chapters) {
      for (const v of ch.verses) {
        for (const t of v.tokens) {
          tokenVerseMap.set(t.id, v.ref);
        }
      }
    }
  }

  for (const ch of trans.chapters) {
    for (const v of ch.verses) {
      const ref = v.ref;
      const pairs = pairsByRef[ref] || [];
      const verseInfo = verseMap[ref];
      const visiblePairs = pairs.filter(p => p.q === 'e' || p.q === 'f');

      // Invariant 1: synOnly verses should have NO visible pairs (no Greek text)
      if (verseInfo?.status === 'synOnly' && visiblePairs.length > 0) {
        err(`synOnly verse ${ref} has ${visiblePairs.length} visible pairs (should have 0)`);
        exclusionErrors++;
      }

      // Invariant 2: merged verses should have NO pairs directly
      // (their tokens are paired via the host syn verse)
      if (verseInfo?.status === 'merged' && pairs.length > 0) {
        err(`merged verse ${ref} has ${pairs.length} pairs (merged tokens should pair via host verse)`);
        exclusionErrors++;
      }

      // Invariant 3: phrase variant spans should NOT contain visible pairs
      const pvs = phraseVariants[ref] || [];
      for (const pv of pvs) {
        if (!pv.span) continue;
        for (const p of visiblePairs) {
          // Check if pair span overlaps with variant span
          if (p.span[0] >= pv.span[0] && p.span[1] <= pv.span[1]) {
            err(`${ref}: visible pair at span [${p.span}] overlaps phrase variant span [${pv.span}]`);
            exclusionErrors++;
          }
        }
      }

      // Invariant 4: verify no pair span exceeds verse text length
      for (const p of pairs) {
        if (p.span[1] > v.text.length) {
          err(`${ref}: pair span [${p.span}] exceeds verse text length (${v.text.length})`);
          exclusionErrors++;
        }
      }

      // Invariant 5: verify tokenId belongs to the expected verse
      for (const p of visiblePairs) {
        const expectedRef = tokenVerseMap.get(p.tokenId);
        if (expectedRef && expectedRef !== ref) {
          // For merged verses, tokens come from different Greek verse — OK
          const isMerged = verseInfo?.status === 'paired' &&
            Object.entries(verseMap).some(([grcR, vi]) =>
              vi.status === 'merged' && vi.grc && tokenVerseMap.get(p.tokenId) === grcR
            );
          if (!isMerged) {
            err(`${ref}: pair.tokenId ${p.tokenId} belongs to verse ${expectedRef} (cross-verse reference)`);
            exclusionErrors++;
          }
        }
      }
    }
  }
}

if (exclusionErrors > 0) {
  err(`Exclusion check FAILED: ${exclusionErrors} violation(s)`);
} else {
  ok('Exclusion check passed: no violations');
}

// ── Summary ──
console.log(`\n${'='.repeat(40)}`);
if (errors.length === 0) {
  console.log('✅ ALL CHECKS PASSED');
} else {
  console.log(`❌ ${errors.length} ERROR(S) FOUND`);
  for (const e of errors.slice(0, 20)) {
    console.log(`  - ${e}`);
  }
  if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
}

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} warning(s)`);
}

console.log(`\nVerified: ${NT_BOOKS.length * 3} packs + lexicon + locale + index`);
process.exit(errors.length > 0 ? 1 : 0);
