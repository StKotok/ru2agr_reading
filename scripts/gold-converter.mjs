#!/usr/bin/env node

/**
 * gold-converter.mjs — Convert old gold fixtures to macula-gold-v1 format.
 *
 * Old format: 0-based word/token indices, short hashes
 * New format: span-based Russian anchors, tokenId-based Greek anchors, SHA-256
 *
 * Usage: node scripts/gold-converter.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TRANSLATION_DIR = resolve(ROOT, 'assets', 'data', 'translations', 'syn', 'books');
const ORIGINAL_DIR = resolve(ROOT, 'assets', 'data', 'originals', 'sblgnt-macula', 'books');
const OLD_DEV_PATH = resolve(ROOT, 'test', 'fixtures', 'gold-dev.json');
const OLD_HELDOUT_PATH = resolve(ROOT, 'test', 'fixtures', 'gold-heldout.json');
const NEW_DEV_PATH = resolve(ROOT, 'test', 'fixtures', 'macula-gold-dev.json');
const NEW_HELDOUT_PATH = resolve(ROOT, 'test', 'fixtures', 'macula-gold-heldout.json');

// Build bookId from ref
function bookIdFromRef(ref) {
  const parts = ref.split(' ');
  const bookMap = {
    '1corinthians': '1corinthians', '2corinthians': '2corinthians',
    '1thessalonians': '1thessalonians', '2thessalonians': '2thessalonians',
    '1timothy': '1timothy', '2timothy': '2timothy',
    '1peter': '1peter', '2peter': '2peter',
    '1john': '1john', '2john': '2john', '3john': '3john',
  };
  const bk = parts[0].toLowerCase();
  return bookMap[bk] || bk;
}

function loadPack(dir, bookId) {
  const path = resolve(dir, `${bookId}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function findVerse(pack, ref) {
  for (const ch of pack.chapters) {
    for (const v of ch.verses) {
      if (v.ref === ref) return v;
    }
  }
  return null;
}

function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function convertGold(oldEntries, label, isHeldout) {
  const items = [];
  const warnings = [];

  for (const entry of oldEntries) {
    const ref = entry.ref;
    const bookId = bookIdFromRef(ref);

    let synPack, grcPack;
    try {
      synPack = loadPack(TRANSLATION_DIR, bookId);
      grcPack = loadPack(ORIGINAL_DIR, bookId);
    } catch (e) {
      warnings.push(`${ref}: cannot load packs — ${e.message}`);
      continue;
    }

    const synVerse = findVerse(synPack, ref);
    const grcVerse = findVerse(grcPack, ref);

    if (!synVerse) {
      warnings.push(`${ref}: syn verse not found in pack`);
      continue;
    }
    if (!grcVerse) {
      warnings.push(`${ref}: grc verse not found in pack`);
      continue;
    }

    const synWords = synVerse.words;
    const grcTokens = grcVerse.tokens;

    // Compute hashes
    const ruHash = `sha256:${sha256(synVerse.text + JSON.stringify(synWords))}`;
    const grHash = `sha256:${sha256(JSON.stringify(grcTokens.map(t => ({
      tokenId: t.id, s: t.s, lexemeKey: t.lexemeKey,
      strongs: t.strongs, morph: t.morph,
    }))))}`;

    // Build ruWords in new format
    const ruWords = synWords.map((w, i) => ({
      i,
      text: w.text,
      span: [w.start, w.end],
    }));

    // Build grTokens in new format
    const grTokensFormatted = grcTokens.map((t, i) => ({
      tokenId: t.id,
      i: i + 1, // 1-based to match old gold
      s: t.s,
      lemma: t.lemma || '',
      lexemeKey: t.lexemeKey,
      strongs: t.strongs || [],
      morph: t.morph || '',
    }));

    // Convert pairs: old uses 0-based ru index and 0-based gr index
    const visiblePairs = [];
    const hiddenOrphans = [];

    // Track which ru/gr indices are paired
    const pairedRu = new Set();
    const pairedGr = new Set();

    for (const oldPair of (entry.pairs || [])) {
      const ruIdx = oldPair.ru;
      const grIdx = oldPair.gr;

      if (ruIdx >= synWords.length) {
        warnings.push(`${ref}: ru index ${ruIdx} >= ${synWords.length} words`);
        continue;
      }
      if (grIdx >= grcTokens.length) {
        warnings.push(`${ref}: gr index ${grIdx} >= ${grcTokens.length} tokens`);
        continue;
      }

      const word = synWords[ruIdx];
      const token = grcTokens[grIdx];
      const q = oldPair.q || 'e';
      const src = oldPair.src || 'z';

      pairedRu.add(ruIdx);
      pairedGr.add(grIdx);

      visiblePairs.push({
        span: [word.start, word.end],
        tokenId: token.id,
        lexemeKey: token.lexemeKey,
        q,
        reason: `converted-from-old-${label}:${src}`,
        confidence: 'converted',
        originalSrc: src,
      });
    }

    // Find orphan Russian words (not paired)
    for (let i = 0; i < synWords.length; i++) {
      if (pairedRu.has(i)) continue;
      const word = synWords[i];
      // Skip punctuation
      if (/^[.,;:!?…—\-"'«»()\[\]{}„"0-9\s]+$/.test(word.text)) continue;

      hiddenOrphans.push({
        span: [word.start, word.end],
        text: word.text,
        reason: 'not-in-old-gold',
      });
    }

    const notes = [];
    if (entry.notes || entry.note) {
      notes.push(entry.notes || entry.note);
    }
    if (isHeldout) {
      notes.push('Converted from old heldout. REQUIRES MANUAL RE-ATTESTATION before use as acceptance gold.');
    } else {
      notes.push('Converted from old dev gold. Review before use as certifier C1 input.');
    }

    items.push({
      ref,
      ruHash,
      grHash,
      ruWords,
      grTokens: grTokensFormatted,
      visiblePairs,
      hiddenOrphans,
      notes: notes.join(' '),
    });
  }

  return { items, warnings };
}

// ── Main ──
console.log('=== Gold Converter ===\n');

// Convert dev gold
console.log('Converting dev gold...');
const oldDev = JSON.parse(readFileSync(OLD_DEV_PATH, 'utf8'));
const devResult = convertGold(oldDev, 'dev', false);
const newDev = {
  schema: 'macula-gold-v1',
  createdFor: 'syn--sblgnt-macula',
  rules: {
    visibleQ: ['e'],
    fIsVisible: false,
    rusVzhAllowed: false,
  },
  items: devResult.items,
};

mkdirSync(resolve(ROOT, 'test', 'fixtures'), { recursive: true });
writeFileSync(NEW_DEV_PATH, JSON.stringify(newDev, null, 2));
console.log(`  ✓ Wrote ${devResult.items.length} verses to macula-gold-dev.json`);
console.log(`  Pairs: ${devResult.items.reduce((s, i) => s + i.visiblePairs.length, 0)}`);
if (devResult.warnings.length > 0) {
  console.log(`  ⚠ ${devResult.warnings.length} warnings:`);
  for (const w of devResult.warnings) console.log(`    - ${w}`);
}

// Convert heldout gold (marked for re-attestation)
console.log('\nConverting heldout gold...');
const oldHeldout = JSON.parse(readFileSync(OLD_HELDOUT_PATH, 'utf8'));
const heldoutResult = convertGold(oldHeldout, 'heldout', true);
const newHeldout = {
  schema: 'macula-gold-v1',
  createdFor: 'syn--sblgnt-macula',
  rules: {
    visibleQ: ['e'],
    fIsVisible: false,
    rusVzhAllowed: false,
  },
  items: heldoutResult.items,
};

writeFileSync(NEW_HELDOUT_PATH, JSON.stringify(newHeldout, null, 2));
console.log(`  ✓ Wrote ${heldoutResult.items.length} verses to macula-gold-heldout.json`);
console.log(`  Pairs: ${heldoutResult.items.reduce((s, i) => s + i.visiblePairs.length, 0)}`);
if (heldoutResult.warnings.length > 0) {
  console.log(`  ⚠ ${heldoutResult.warnings.length} warnings:`);
  for (const w of heldoutResult.warnings) console.log(`    - ${w}`);
}

console.log('\nDone. Heldout gold REQUIRES MANUAL RE-ATTESTATION before use as acceptance gate.');
