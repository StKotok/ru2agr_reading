// scripts/audit-align.mjs
// Детерминированный аудит точности выравнивания (уровень c — семантика).
// Фиксированный seed для воспроизводимости.
// Печатает: ref | lemma | morph | gloss | slice | method

import { readDataJson } from './lib/fs.mjs';
import { ALIGN_METHODS } from './lib/align-normalize.mjs';

const NT_BOOKS = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians',
  'ephesians', 'philippians', 'colossians',
  '1thessalonians', '2thessalonians', '1timothy', '2timothy',
  'titus', 'philemon', 'hebrews',
  'james', '1peter', '2peter', '1john', '2john', '3john',
  'jude', 'revelation'
];

// Fixed seed for reproducibility
const SEED = 42;

// Simple seeded random
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

console.log('Alignment Accuracy Audit');
console.log(`Seed: ${SEED}`);
console.log();
console.log('ref | lemma | morph | gloss(Berean/Cherith) | slice | method');
console.log('----|-------|-------|----------------------|-------|--------');

// Collect all pairs, organized by method
/** @type {Map<string, Array<{ref:string, lemma:string, morph:string, gloss:string, slice:string}>>} */
const pairsByMethod = new Map();

// Build token lookup
for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  const align = readDataJson(`align/grc-eng/${bookId}.json`);

  // Build token + eng lookup
  const tokensById = new Map();
  for (const ch of grc.chapters) for (const vs of ch.verses) for (const t of vs.tokens) tokensById.set(t.id, t);
  const engByRef = new Map();
  for (const ch of eng.chapters) for (const vs of ch.verses) engByRef.set(vs.ref, vs);

  for (const [ref, pairs] of Object.entries(align.pairsByRef || {})) {
    const verseText = engByRef.get(ref)?.text || '';
    for (const pair of pairs) {
      const token = tokensById.get(pair.tokenId);
      if (!token) continue;
      const slice = verseText.slice(pair.span[0], pair.span[1]);
      const gloss = pair.method?.startsWith('alt-gloss-') ? (token.glossCherith || '') : (token.glossBerean || '');

      const method = pair.method || 'unknown';
      if (!pairsByMethod.has(method)) pairsByMethod.set(method, []);
      pairsByMethod.get(method).push({
        ref,
        lemma: token.lemma || '',
        morph: token.morph || '',
        gloss,
        slice
      });
    }
  }
}

// Print summary
const rand = seededRandom(SEED);
let totalAudited = 0;

for (const [method, pairs] of Object.entries(pairsByMethod)) {
  const tier = ALIGN_METHODS[method]?.tier || 'unknown';
  let sample;

  if (tier === 'fuzzy' || tier === 'manual' || tier === 'proposal') {
    // 100% audit for fuzzy, manual, proposal
    sample = pairs;
  } else {
    // 50 per method for proven
    sample = shuffle(pairs, rand).slice(0, 50);
  }

  console.log(`\n--- ${method} (tier=${tier}, total=${pairs.length}, audit=${sample.length}) ---`);
  for (const p of sample) {
    console.log(`${p.ref} | ${p.lemma} | ${p.morph} | ${p.gloss.slice(0, 30)} | ${p.slice.slice(0, 30)} | ${method}`);
  }
  totalAudited += sample.length;
}

console.log(`\n=== Total audited: ${totalAudited} pairs ===`);
console.log(`Seed: ${SEED} (for reproducibility)`);

// Print quick stats
console.log('\n--- Method Distribution ---');
for (const [method, pairs] of Object.entries(pairsByMethod).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${method}: ${pairs.length}`);
}
