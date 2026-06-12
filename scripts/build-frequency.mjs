import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { transliterateGreek } from './lib/greek-translit.mjs';

const GRC_DIR = 'assets/data/bibles/grc';
const SYN_DIR = 'assets/data/bibles/syn';
const OUT = 'assets/data/lexicon/frequency.json';
const TOP_LIMIT = 1000;

// ── Шаг 1: подсчёт частот лемм по Strong ──
const counts = new Map(); // strong (string) → Map(lemma → count)

for (const file of readdirSync(GRC_DIR).filter(f => f.endsWith('.json')).sort()) {
  const book = JSON.parse(readFileSync(path.join(GRC_DIR, file), 'utf8'));
  for (const ch of book.chapters) {
    for (const v of ch.verses) {
      for (const t of (v.tokens || [])) {
        if (!t.strong || !t.lemma) continue;
        const key = String(t.strong);
        if (!counts.has(key)) counts.set(key, new Map());
        const lemmas = counts.get(key);
        lemmas.set(t.lemma, (lemmas.get(t.lemma) || 0) + 1);
      }
    }
  }
}

const all = [...counts.entries()].map(([strong, lemmas]) => {
  const count = [...lemmas.values()].reduce((a, b) => a + b, 0);
  // Самая частотная лемма для Strong; tie-break по алфавиту (детерминизм)
  const lemma = [...lemmas.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el'))[0][0];
  return { strong: Number(strong), lemma, count };
});

all.sort((a, b) => b.count - a.count || a.strong - b.strong);

// ── Шаг 2: hasAlignment — участвует ли Strong в alignment-парах ──
const alignedStrongs = new Set();

// alignment в syn/*.json, греческие токены (со Strong) в grc/*.json
const synFiles = readdirSync(SYN_DIR).filter(f => f.endsWith('.json')).sort();
for (const file of synFiles) {
  const synBook = JSON.parse(readFileSync(path.join(SYN_DIR, file), 'utf8'));
  let grcBook;
  try {
    grcBook = JSON.parse(readFileSync(path.join(GRC_DIR, file), 'utf8'));
  } catch (e) { continue; }

  for (let ci = 0; ci < synBook.chapters.length; ci++) {
    const ch = synBook.chapters[ci];
    const grcCh = grcBook.chapters[ci];
    if (!grcCh) continue;
    for (const v of ch.verses) {
      const alignment = v.alignment;
      if (!alignment) continue;
      const grcVerse = grcCh.verses.find(gv => gv.n === v.n);
      if (!grcVerse || !grcVerse.tokens) continue;
      for (const a of alignment) {
        if (a.gr < grcVerse.tokens.length) {
          const s = grcVerse.tokens[a.gr].strong;
          if (s) alignedStrongs.add(String(s));
        }
      }
    }
  }
}

// ── Инварианты корпуса ──
if (all.length < 5000 || all.length > 6000) {
  throw new Error(`инвариант: уникальных Strong ${all.length}, ожидалось 5000-6000`);
}
if (all[0].strong !== 3588 || all[0].count < 15000) {
  throw new Error(`инвариант: топ-1 должен быть ὁ (G3588, ~19.8k), получено G${all[0].strong}:${all[0].count}`);
}

const items = all.slice(0, TOP_LIMIT).map((it, i) => ({
  rank: i + 1,
  ...it,
  translit: transliterateGreek(it.lemma),
  hasAlignment: alignedStrongs.has(String(it.strong))
}));

writeFileSync(OUT, JSON.stringify(items));

// Статистика для отладки
const withAlign = items.filter(i => i.hasAlignment).length;
const withoutAlign = items.filter(i => !i.hasAlignment).length;
const disabledTop10 = items.slice(0, 10).filter(i => !i.hasAlignment).map(i => i.lemma);
console.log(`frequency.json: ${items.length} лемм из ${all.length} Strong`);
console.log(`hasAlignment=true: ${withAlign}, false: ${withoutAlign}`);
console.log(`Топ-10 без alignment: [${disabledTop10.join(', ')}]`);
console.log(`Топ-3: ${items.slice(0, 3).map(i => `${i.lemma} (G${i.strong}, ${i.count}, align=${i.hasAlignment})`).join(', ')}`);
