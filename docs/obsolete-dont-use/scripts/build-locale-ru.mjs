#!/usr/bin/env node

/**
 * build-locale-ru.mjs — Transfer curated Russian locale data to overlays.
 *
 * Reads docs/sources/locales/ru/core.json (source of curation)
 * and produces:
 *   - assets/data/lexicon/locales/ru/top1000.json (top1000-locale-overlay-v1)
 *   - assets/data/lexicon/locales/ru/core.json (core-locale-overlay-v1)
 *
 * Fields transferred by lexemeKey:
 *   gloss→gloss, pos→pos, ruMatches→ruMatches, ruExclude→ruExclude,
 *   refs→refs/examples
 *
 * Form entries (mou, moi, me, etc.) have their ruMatches merged into
 * the parent lemma's entry.
 *
 * Usage: node scripts/build-locale-ru.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORM_TO_PARENT } from './macula/lib/lexeme-key.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE_PATH = resolve(ROOT, 'docs', 'sources', 'locales', 'ru', 'core.json');
const TOP1000_OUT = resolve(ROOT, 'assets', 'data', 'lexicon', 'locales', 'ru', 'top1000.json');
const CORE_OUT = resolve(ROOT, 'assets', 'data', 'lexicon', 'locales', 'ru', 'core.json');

console.log('=== build-locale-ru ===\n');

const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf8'));
console.log(`Source entries: ${source.length}`);

// Build lookup by id
const byId = new Map(source.map(e => [e.id, e]));

// Merge form entries' ruMatches into parent entries
// This mutates the parent entries in-place
for (const [formId, parentId] of Object.entries(FORM_TO_PARENT)) {
  const formEntry = byId.get(formId);
  const parentEntry = byId.get(parentId);

  if (!formEntry) {
    console.warn(`  ⚠ Form entry ${formId} not found in source`);
    continue;
  }
  if (!parentEntry) {
    console.warn(`  ⚠ Parent entry ${parentId} not found in source`);
    continue;
  }

  // Merge ruMatches
  if (formEntry.ruMatches && formEntry.ruMatches.length > 0) {
    if (!parentEntry._mergedRuMatches) {
      parentEntry._mergedRuMatches = [...(parentEntry.ruMatches || [])];
    }
    for (const pattern of formEntry.ruMatches) {
      if (!parentEntry._mergedRuMatches.includes(pattern)) {
        parentEntry._mergedRuMatches.push(pattern);
      }
    }
  }

  // Merge ruExclude
  if (formEntry.ruExclude && formEntry.ruExclude.length > 0) {
    if (!parentEntry._mergedRuExclude) {
      parentEntry._mergedRuExclude = [...(parentEntry.ruExclude || [])];
    }
    for (const pattern of formEntry.ruExclude) {
      if (!parentEntry._mergedRuExclude.includes(pattern)) {
        parentEntry._mergedRuExclude.push(pattern);
      }
    }
  }

  // Merge refs
  if (formEntry.refs && formEntry.refs.length > 0) {
    if (!parentEntry._mergedRefs) {
      parentEntry._mergedRefs = [...(parentEntry.refs || [])];
    }
    for (const ref of formEntry.refs) {
      if (!parentEntry._mergedRefs.includes(ref)) {
        parentEntry._mergedRefs.push(ref);
      }
    }
  }
}

// Build top1000 overlay (glosses)
const top1000Items = [];
const coreItems = [];

for (const entry of source) {
  // Skip form entries — they're merged into parents
  if (FORM_TO_PARENT[entry.id]) continue;

  const lexemeKey = entry.id; // old id = new lexemeKey

  // Use merged data if available
  const ruMatches = entry._mergedRuMatches || entry.ruMatches || [];
  const ruExclude = entry._mergedRuExclude || entry.ruExclude || [];
  const refs = entry._mergedRefs || entry.refs || [];

  // Top1000 overlay: gloss, shortGloss, explanation, searchAliases, examples
  const glossItem = {
    lexemeKey,
    gloss: entry.gloss || '',
  };

  if (entry.pos) glossItem.shortGloss = entry.gloss ? entry.gloss.split(',')[0].trim() : '';

  top1000Items.push(glossItem);

  // Core overlay: pos, ruMatches, ruExclude, refs
  const coreItem = {
    lexemeKey,
    pos: entry.pos || '',
    ruMatches,
    ruExclude,
    refs,
  };

  coreItems.push(coreItem);
}

// Write top1000 overlay
const top1000Output = {
  schema: 'top1000-locale-overlay-v1',
  localeId: 'ru',
  items: top1000Items,
};

mkdirSync(resolve(ROOT, 'assets', 'data', 'lexicon', 'locales', 'ru'), { recursive: true });
writeFileSync(TOP1000_OUT, JSON.stringify(top1000Output, null, 2));
console.log(`top1000.json: ${top1000Items.length} items`);

// Write core overlay
const coreOutput = {
  schema: 'core-locale-overlay-v1',
  localeId: 'ru',
  items: coreItems,
};

writeFileSync(CORE_OUT, JSON.stringify(coreOutput, null, 2));
console.log(`core.json: ${coreItems.length} items`);

// Verify key lemmas present
const checkKeys = ['logos', 'theos', 'kurios'];
for (const key of checkKeys) {
  const found = coreItems.find(i => i.lexemeKey === key);
  if (found) {
    console.log(`  ✓ ${key}: ruMatches=${found.ruMatches?.length || 0}, refs=${found.refs?.length || 0}`);
  } else {
    console.error(`  ✗ ${key}: NOT FOUND in output!`);
  }
}

// Count form-merged entries
const formCount = Object.keys(FORM_TO_PARENT).filter(fid => byId.has(fid)).length;
console.log(`\nForm entries merged into parents: ${formCount}`);
console.log('Done.');
