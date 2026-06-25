// scripts/audit-claimed.mjs
// Расследование auto-deferred/already-claimed: слово матчит глоссу токена, но
// занято ДРУГОЙ парой. Это потенциальный мис-пэйринг порядка проходов (ранняя пара
// могла занять слово, которое следовало отдать текущему токену).
// Печатает: ref | deferred-токен (lemma, morph, gloss) | конкурирующая пара (lemma, method, slice).

import { readDataJson } from './lib/fs.mjs';
import { normalizeWord, normalizeBerean } from './lib/align-normalize.mjs';

const NT_BOOKS = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians',
  'ephesians', 'philippians', 'colossians',
  '1thessalonians', '2thessalonians', '1timothy', '2timothy',
  'titus', 'philemon', 'hebrews',
  'james', '1peter', '2peter', '1john', '2john', '3john',
  'jude', 'revelation'
];

let total = 0;
let sameLemmaConflict = 0; // competing pair has SAME lexemeId → genuinely two Greek words, one English → benign
let crossLemmaConflict = 0; // competing pair DIFFERENT lexemeId → potential mispairing → inspect
const samples = [];

for (const bookId of NT_BOOKS) {
  const grc = readDataJson(`bibles/grc/${bookId}.json`);
  const eng = readDataJson(`bibles/eng/${bookId}.json`);
  const align = readDataJson(`align/grc-eng/${bookId}.json`);

  const tokensById = new Map();
  for (const ch of grc.chapters) for (const vs of ch.verses) for (const t of vs.tokens) tokensById.set(t.id, t);
  const engByRef = new Map();
  for (const ch of eng.chapters) for (const vs of ch.verses) engByRef.set(vs.ref, vs);

  for (const ref in (align.exclusionsByRef || {})) {
    for (const e of align.exclusionsByRef[ref]) {
      if (!(e.kind === 'auto-deferred' && e.reason === 'already-claimed')) continue;
      total++;
      const token = tokensById.get(e.tokenId);
      const engVs = engByRef.get(ref);
      if (!token || !engVs) continue;

      const glossB = token.glossBerean || '', glossC = token.glossCherith || '';
      const normB = normalizeWord(glossB), normC = normalizeWord(glossC);
      const normBB = normalizeWord(normalizeBerean(glossB));

      // Find the single matching word
      let matchWord = null;
      for (const w of engVs.words) {
        const nw = normalizeWord(w.text);
        if ((normB && nw === normB) || (normC && nw === normC) || (normBB && nw === normBB)) { matchWord = w; break; }
      }
      if (!matchWord) continue;

      // Find the pair whose span covers that word
      const pairs = align.pairsByRef?.[ref] || [];
      const competing = pairs.find(p => !(matchWord.end <= p.span[0] || matchWord.start >= p.span[1]));
      if (!competing) continue;

      const compToken = tokensById.get(competing.tokenId);
      const sameLemma = compToken && compToken.lexemeId === token.lexemeId;
      if (sameLemma) sameLemmaConflict++; else crossLemmaConflict++;

      if (!sameLemma && samples.length < 40) {
        samples.push(
          `${ref} | deferred ${token.lemma} (${token.morph || ''}) gloss="${glossB || glossC}" ` +
          `→ word "${matchWord.text}" taken by ${compToken?.lemma || '?'} [${competing.method}] slice="${eng && (engVs.text.slice(competing.span[0], competing.span[1]))}"`
        );
      }
    }
  }
}

console.log(`=== auto-deferred / already-claimed audit ===`);
console.log(`Total already-claimed: ${total}`);
console.log(`  same-lexeme conflict (benign — two Greek tokens of same lexeme, one English word): ${sameLemmaConflict}`);
console.log(`  cross-lexeme conflict (INSPECT — different lexemes competing): ${crossLemmaConflict}`);
console.log(`\n--- cross-lexeme samples (up to 40) ---`);
for (const s of samples) console.log(s);
