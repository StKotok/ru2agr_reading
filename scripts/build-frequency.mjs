import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { transliterateGreek } from './lib/greek-translit.mjs';

const GRC_DIR = 'assets/data/bibles/grc';
const SYN_DIR = 'assets/data/bibles/syn';
const OUT = 'assets/data/lexicon/frequency.json';
const TOP_LIMIT = 1000;

// Нормализация орфографических вариантов лемм (одна лексема — одна запись).
// Только случаи, где разное написание не меняет значения.
const LEMMA_NORM = {
  'οὔ': 'οὐ',         // отрицание: проклитика vs ударная
  'Μαριάμ': 'Μαρία',  // имя: семитская vs эллинизированная форма
  'Σιλᾶς': 'Σίλας',   // имя: вариант ударения
  'Σολομῶν': 'Σολομών', // имя: вариант ударения
  'ἆρα': 'ἄρα',       // итак: вариант ударения (не ἀρά «проклятие»)
  'σύνιημι': 'συνίημι', // понимать: вариант ударения
};

function normalizeLemma(lemma) {
  return LEMMA_NORM[lemma] || lemma;
}

// ── Шаг 1: подсчёт частот по леммам (с агрегацией Strong) ──
const lemmaData = new Map(); // lemma → { count, strongs: Map(strong → count) }

for (const file of readdirSync(GRC_DIR).filter(f => f.endsWith('.json')).sort()) {
  const book = JSON.parse(readFileSync(path.join(GRC_DIR, file), 'utf8'));
  for (const ch of book.chapters) {
    for (const v of ch.verses) {
      for (const t of (v.tokens || [])) {
        if (!t.strong || !t.lemma) continue;
        const lemma = normalizeLemma(t.lemma);
        const strong = String(t.strong);
        if (!lemmaData.has(lemma)) {
          lemmaData.set(lemma, { count: 0, strongs: new Map() });
        }
        const entry = lemmaData.get(lemma);
        entry.count++;
        entry.strongs.set(strong, (entry.strongs.get(strong) || 0) + 1);
      }
    }
  }
}

const all = [...lemmaData.entries()].map(([lemma, { count, strongs }]) => {
  return { lemma, count, strongs };
});

all.sort((a, b) => b.count - a.count);

// Назначаем уникальные Strong: для каждой леммы — самый частотный Strong,
// который ещё не занят более высокоранговой леммой.
const usedStrongs = new Set();
for (const entry of all) {
  const sortedStrongs = [...entry.strongs.entries()]
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]));
  let picked = null;
  for (const [s] of sortedStrongs) {
    if (!usedStrongs.has(s)) { picked = s; break; }
  }
  if (!picked) {
    // Все Strong заняты — fallback на самый частотный
    picked = sortedStrongs[0][0];
  }
  usedStrongs.add(picked);
  entry.strong = Number(picked);
  entry._allStrongs = new Set(sortedStrongs.map(([s]) => s));
}

// ── Шаг 2: hasAlignment — участвует ли лемма в alignment-парах ──
const alignedStrongs = new Set();

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

// Лемма доступна, если хотя бы один её Strong участвует в alignment
function hasAlignment(strongs) {
  for (const s of strongs.keys()) {
    if (alignedStrongs.has(s)) return true;
  }
  return false;
}

// ── Инварианты корпуса ──
const uniqueLemmas = all.length;
if (uniqueLemmas < 5000 || uniqueLemmas > 6000) {
  throw new Error(`инвариант: уникальных лемм ${uniqueLemmas}, ожидалось 5000-6000`);
}
if (all[0].lemma !== 'ὁ' || all[0].count < 15000) {
  throw new Error(`инвариант: топ-1 должен быть ὁ (~19.8k), получено ${all[0].lemma}:${all[0].count}`);
}

const items = all.slice(0, TOP_LIMIT).map((it, i) => ({
  rank: i + 1,
  strong: it.strong,
  lemma: it.lemma,
  count: it.count,
  translit: transliterateGreek(it.lemma),
  hasAlignment: hasAlignment(it._allStrongs)
}));

writeFileSync(OUT, JSON.stringify(items));

// Статистика для отладки
const withAlign = items.filter(i => i.hasAlignment).length;
const withoutAlign = items.filter(i => !i.hasAlignment).length;
const disabledTop10 = items.slice(0, 10).filter(i => !i.hasAlignment).map(i => i.lemma);
console.log(`frequency.json: ${items.length} лемм из ${uniqueLemmas} уникальных лемм`);
console.log(`hasAlignment=true: ${withAlign}, false: ${withoutAlign}`);
console.log(`Топ-10 без alignment: [${disabledTop10.join(', ')}]`);
console.log(`Топ-3: ${items.slice(0, 3).map(i => `${i.lemma} (G${i.strong}, ${i.count}, align=${i.hasAlignment})`).join(', ')}`);
