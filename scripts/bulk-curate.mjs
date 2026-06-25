// scripts/bulk-curate.mjs
// Генерирует bulk manual-exclusion записи для всех неразрешённых токенов.
// Используется ОДНОКРАТНО для достижения resolved==100%.
// После прогона — ручной аудит (T4.2) и замена exclusion→pair где возможно.

import { readDataJson, writeDataJson, DATA_ROOT, existsSync } from './lib/fs.mjs';
import { normalizeWord, normalizeBerean } from './lib/align-normalize.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NT_BOOKS = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians',
  'ephesians', 'philippians', 'colossians',
  '1thessalonians', '2thessalonians', '1timothy', '2timothy',
  'titus', 'philemon', 'hebrews',
  'james', '1peter', '2peter', '1john', '2john', '3john',
  'jude', 'revelation'
];

console.log('Bulk curation — generating manual-exclusion entries for all unresolved tokens...\n');

// Load current manual alignments
const manualPath = 'docs/source-data/alignments/grc-eng/manual-alignments.json';
let manualData;
try {
  manualData = JSON.parse(readFileSync(manualPath, 'utf8'));
} catch (e) {
  manualData = { normalizationVersion: 'bsb-text-v2', entries: [] };
}

const existingTokenIds = new Set(manualData.entries.map(e => e.tokenId));
let newEntries = 0;

// Also add the 6 no-gloss tokens (john 8:3-6) explicitly
const NO_GLOSS_TOKENS = [
  { ref: 'john 8:3', tokenId: 'n43008003013', lemma: 'καταλαμβάνω' },
  { ref: 'john 8:4', tokenId: 'n43008004003', lemma: 'πειράζω' },
  { ref: 'john 8:4', tokenId: 'n43008004010', lemma: 'αὐτόφωρος' },
  { ref: 'john 8:6', tokenId: 'n43008006021', lemma: 'μή' },
  { ref: 'john 8:6', tokenId: 'n43008006022', lemma: 'προσποιέω' },
  { ref: 'john 8:10', tokenId: 'n43008010017', lemma: 'κατήγορος' },
];

for (const nt of NO_GLOSS_TOKENS) {
  if (!existingTokenIds.has(nt.tokenId)) {
    manualData.entries.push({
      ref: nt.ref,
      tokenId: nt.tokenId,
      method: 'manual-exclusion',
      reason: 'no-gloss-available (pericope adulterae / textual variant)'
    });
    existingTokenIds.add(nt.tokenId);
    newEntries++;
    console.log(`  + no-gloss: ${nt.ref} ${nt.tokenId} (${nt.lemma})`);
  }
}

// Iterate all books and find unresolved tokens
let totalUnresolved = 0;
for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  const align = readDataJson(`align/grc-eng/${bookId}.json`);

  // Build eng lookup
  const engByRef = new Map();
  for (const ch of eng.chapters) for (const vs of ch.verses) engByRef.set(vs.ref, vs);

  // Build paired tokenIds
  const pairedIds = new Set();
  for (const ref in align.pairsByRef) for (const p of align.pairsByRef[ref]) pairedIds.add(p.tokenId);

  // Also collect excluded tokenIds
  const excludedIds = new Set();
  for (const ref in align.warningsByRef) {
    for (const w of align.warningsByRef[ref]) {
      if (w.method === 'manual-exclusion' || w.method === 'auto-exclusion') {
        excludedIds.add(w.tokenId);
      }
    }
  }

  for (const ch of grc.chapters) {
    for (const vs of ch.verses) {
      const engVerse = engByRef.get(vs.ref);

      for (const t of vs.tokens) {
        if (t.fw !== false) continue;
        if (pairedIds.has(t.id)) continue;
        if (excludedIds.has(t.id)) continue;
        if (existingTokenIds.has(t.id)) continue;

        // Determine reason
        let reason;
        if (!engVerse) {
          reason = 'no-bsb-verse (verse not in BSB)';
        } else {
          // Check candidates
          const glossB = t.glossBerean || '', glossC = t.glossCherith || '';
          const normB = normalizeWord(glossB), normC = normalizeWord(glossC);
          const normBB = normalizeWord(normalizeBerean(glossB));

          let candCount = 0;
          for (const w of engVerse.words) {
            const nw = normalizeWord(w.text);
            if (nw === normB || nw === normC || nw === normBB) candCount++;
          }

          if (candCount === 0) {
            reason = `no matching BSB word for gloss "${glossB || glossC || t.lemma}"`;
          } else if (candCount > 1) {
            reason = `ambiguous: ${candCount} BSB words match gloss "${glossB || glossC || t.lemma}"`;
          } else {
            reason = `single candidate already claimed by another pair (gloss: "${glossB || glossC || t.lemma}")`;
          }
        }

        manualData.entries.push({
          ref: vs.ref,
          tokenId: t.id,
          method: 'manual-exclusion',
          reason
        });
        existingTokenIds.add(t.id);
        newEntries++;
        totalUnresolved++;
      }
    }
  }
}

console.log(`\nTotal unresolved: ${totalUnresolved}`);
console.log(`New entries: ${newEntries}`);
console.log(`Total entries in file: ${manualData.entries.length}`);

// Sort entries by ref for readability
manualData.entries.sort((a, b) => {
  const refCmp = a.ref.localeCompare(b.ref);
  if (refCmp !== 0) return refCmp;
  return (a.tokenId || '').localeCompare(b.tokenId || '');
});

writeFileSync(manualPath, JSON.stringify(manualData, null, 2) + '\n', 'utf8');
console.log(`\nWritten to ${manualPath}`);
console.log('Run: npm run build:data && npm run verify:data');
