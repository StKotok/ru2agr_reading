#!/usr/bin/env node

/**
 * build-lexicon-core.mjs — Canonical frequency → top1000.core.json.
 *
 * Reads generated/canonical/sblgnt-macula/{frequency.json,lexemes.json}
 * and produces assets/data/lexicon/top1000.core.json (top1000-lexicon-core-v1).
 *
 * NO hasAlignment, NO refs[], NO ru-fields.
 *
 * Usage: node scripts/build-lexicon-core.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLexemeKeyMap } from './macula/lib/lexeme-key.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CANONICAL_DIR = resolve(ROOT, 'generated', 'canonical', 'sblgnt-macula');
const OUT_PATH = resolve(ROOT, 'assets', 'data', 'lexicon', 'top1000.core.json');
const CORE_PATH = resolve(ROOT, 'docs', 'sources', 'locales', 'ru', 'core.json');

console.log('=== build-lexicon-core ===\n');

// Load canonical data
const frequency = JSON.parse(readFileSync(resolve(CANONICAL_DIR, 'frequency.json'), 'utf8'));
const lexemes = JSON.parse(readFileSync(resolve(CANONICAL_DIR, 'lexemes.json'), 'utf8'));
const curatedEntries = JSON.parse(readFileSync(CORE_PATH, 'utf8'));

console.log(`Frequency entries: ${frequency.length}`);
console.log(`Lexemes: ${lexemes.length}`);

// Build lexemeKey map
const { map: lexemeKeyMap } = buildLexemeKeyMap(lexemes, curatedEntries);

// Build lexeme lookup
const lexemeById = new Map(lexemes.map(l => [l.id, l]));

// Build top-1000 items
const top1000 = frequency.slice(0, 1000);
const items = [];

for (const f of top1000) {
  const lexeme = lexemeById.get(f.lexemeId);
  const lexemeKey = lexemeKeyMap.get(f.lexemeId) || f.transliteration || f.lexemeId;
  const searchForm = f.lemma ? stripAccentsForSearch(f.lemma) : '';

  // Build forms array from attested forms
  const forms = [];
  if (lexeme && lexeme.attestedForms) {
    for (const form of lexeme.attestedForms) {
      forms.push({
        s: form.surface,
        count: form.count,
        morph: form.morphCodes || [],
      });
    }
    // Sort by count descending
    forms.sort((a, b) => b.count - a.count);
  }

  // Domains from lexeme
  const domains = [];
  if (lexeme && lexeme.semanticDomains) {
    for (const d of lexeme.semanticDomains) {
      if (d.domainCode && !domains.includes(d.domainCode)) {
        domains.push(d.domainCode);
      }
    }
  }

  const item = {
    lexemeKey,
    maculaLexemeId: f.lexemeId,
    lemma: f.lemma,
    search: searchForm,
    translit: f.transliteration || '',
    strongs: Array.isArray(f.strong) ? f.strong : [String(f.strong)],
    rank: f.rank,
    count: f.tokenCount,
    verseCount: f.verseCount,
    pos: f.pos || 'other',
    isFunctionWord: f.isFunctionWord || false,
    sourceGlosses: { en: f.glossesEn || [] },
    forms,
    firstRef: f.firstRef || null,
    domains,
  };

  items.push(item);
}

// Build output
const output = {
  schema: 'top1000-lexicon-core-v1',
  originalId: 'sblgnt-macula',
  items,
};

// Verify constraints
const keySet = new Set(items.map(i => i.lexemeKey));
if (keySet.size !== items.length) {
  console.error(`ERROR: ${items.length - keySet.size} duplicate lexemeKeys!`);
}

const hasRuFields = items.some(i => i.gloss || i.shortGloss || i.ruMatches || i.ruExclude || i.explanation);
if (hasRuFields) {
  console.error('ERROR: top1000.core.json contains ru-fields!');
}

const hasAlignment = items.some(i => i.hasAlignment !== undefined);
if (hasAlignment) {
  console.error('ERROR: top1000.core.json contains hasAlignment!');
}

// Write
mkdirSync(resolve(ROOT, 'assets', 'data', 'lexicon'), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

console.log(`\nOutput: ${items.length} items`);
console.log(`Unique lexemeKeys: ${keySet.size}`);
console.log('Done.');

function stripAccentsForSearch(lemma) {
  // Remove Greek diacritics for search form
  return lemma
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[̓̔͂ͅ]/g, '')
    .toLowerCase();
}
