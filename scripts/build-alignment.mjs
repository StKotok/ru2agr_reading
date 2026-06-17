#!/usr/bin/env node

/**
 * build-alignment.mjs — Generate Synodal ↔ MACULA Greek alignment.
 *
 * Reads: translation packs (words + offsets), original packs (tokenId + strongs),
 *        locale/ru/core.json (ruMatches/ruExclude), textual-variants.json.
 *
 * Produces: assets/data/align/syn--sblgnt-macula/books/{bookId}.json (alignment-book-v1)
 *           assets/data/align/syn--sblgnt-macula/index.json (alignment-index-v1)
 *
 * Usage: node scripts/build-alignment.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TRANSLATION_DIR = resolve(ROOT, 'assets', 'data', 'translations', 'syn', 'books');
const ORIGINAL_DIR = resolve(ROOT, 'assets', 'data', 'originals', 'sblgnt-macula', 'books');
const CORE_PATH = resolve(ROOT, 'assets', 'data', 'lexicon', 'locales', 'ru', 'core.json');
const VARIANTS_PATH = resolve(ROOT, 'assets', 'data', 'textual-variants.json');
const OUT_DIR = resolve(ROOT, 'assets', 'data', 'align', 'syn--sblgnt-macula', 'books');
const INDEX_OUT = resolve(ROOT, 'assets', 'data', 'align', 'syn--sblgnt-macula', 'index.json');

// NT book list (in canonical order)
const NT_BOOKS = [
  'matthew','mark','luke','john','acts','romans','1corinthians','2corinthians',
  'galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians',
  '1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter',
  '1john','2john','3john','jude','revelation',
];

// Book short names for display
const BOOK_SHORT = {
  matthew:'Мф', mark:'Мк', luke:'Лк', john:'Ин', acts:'Деян', romans:'Рим',
  '1corinthians':'1Кор','2corinthians':'2Кор', galatians:'Гал', ephesians:'Еф',
  philippians:'Флп', colossians:'Кол','1thessalonians':'1Фес','2thessalonians':'2Фес',
  '1timothy':'1Тим','2timothy':'2Тим', titus:'Тит', philemon:'Флм', hebrews:'Евр',
  james:'Иак','1peter':'1Пет','2peter':'2Пет','1john':'1Ин','2john':'2Ин','3john':'3Ин',
  jude:'Иуд', revelation:'Откр',
};

// Function word POS categories
const FUNCTION_POS = new Set(['article','preposition','conjunction','particle','pronoun','determiner']);

console.log('=== build-alignment ===\n');

// Load core overlay (ruMatches/ruExclude by lexemeKey)
const coreOverlay = JSON.parse(readFileSync(CORE_PATH, 'utf8'));
const ruMatchesByKey = new Map();
const ruExcludeByKey = new Map();
for (const item of coreOverlay.items) {
  if (item.ruMatches && item.ruMatches.length > 0) {
    ruMatchesByKey.set(item.lexemeKey, item.ruMatches);
  }
  if (item.ruExclude && item.ruExclude.length > 0) {
    ruExcludeByKey.set(item.lexemeKey, item.ruExclude);
  }
}
console.log(`Core overlay: ${coreOverlay.items.length} entries, ${ruMatchesByKey.size} with ruMatches`);

// Load textual variants
const variants = JSON.parse(readFileSync(VARIANTS_PATH, 'utf8'));

// Build synOnly verse set
const synOnlySet = new Set();
for (const v of variants.synOnlyVerses) {
  synOnlySet.add(`${v.book} ${v.ch}:${v.v}`);
}

// Build grcOnly verse set
const grcOnlySet = new Set();
for (const v of (variants.grcOnlyVerses || [])) {
  grcOnlySet.add(`${v.book} ${v.ch}:${v.v}`);
}

// Build merged verse set (from textual-variants.json)
const mergedFromRegistry = new Set();
if (variants.mergedVerses) {
  for (const v of variants.mergedVerses) {
    mergedFromRegistry.add(`${v.book} ${v.ch}:${v.v}`);
  }
}

// Build phrase variants by ref
const phraseVariantsByRef = {};
for (const pv of variants.synOnlyPhrases) {
  if (!phraseVariantsByRef[pv.ref]) phraseVariantsByRef[pv.ref] = [];
  phraseVariantsByRef[pv.ref].push(pv);
}

// Merged verses: Greek verses whose content is merged into a different Synodal verse.
// Priority: hardcoded MERGED_VERSES + entries from textual-variants.json mergedVerses.
const MERGED_VERSES = {
  '2corinthians 11:33': { syn: '11:32b', grc: '11:33', status: 'merged' },
};
// Merge registry entries (textual-variants.json overrides hardcoded)
if (variants.mergedVerses) {
  for (const v of variants.mergedVerses) {
    const key = `${v.book} ${v.ch}:${v.v}`;
    MERGED_VERSES[key] = {
      syn: v.syn,
      grc: v.grc,
      status: 'merged',
    };
  }
}

// All visible lexemes across all books (for index)
const allVisibleLexemes = new Set();
let totalPairs = 0;
let totalE = 0, totalF = 0, totalU = 0;

for (const bookId of NT_BOOKS) {
  // Load packs
  const synPath = resolve(TRANSLATION_DIR, `${bookId}.json`);
  const grcPath = resolve(ORIGINAL_DIR, `${bookId}.json`);

  let synPack, grcPack;
  try {
    synPack = JSON.parse(readFileSync(synPath, 'utf8'));
    grcPack = JSON.parse(readFileSync(grcPath, 'utf8'));
  } catch (e) {
    console.error(`  ⚠ Skipping ${bookId}: ${e.message}`);
    continue;
  }

  // Build verse lookup
  const synVerses = new Map();
  const synVerseData = new Map(); // ref → { text, words }
  for (const ch of synPack.chapters) {
    for (const v of ch.verses) {
      synVerses.set(v.ref, v);
      synVerseData.set(v.ref, { text: v.text, words: v.words });
    }
  }

  const grcVerses = new Map();
  const grcTokensByRef = new Map();
  for (const ch of grcPack.chapters) {
    for (const v of ch.verses) {
      grcVerses.set(v.ref, v);
      grcTokensByRef.set(v.ref, v.tokens);
    }
  }

  // --- Build verse-level correspondence ---
  const verseMap = {};

  // Iterate all syn verses
  for (const [ref, synV] of synVerses) {
    const parts = ref.split(' ');
    const bk = parts[0];
    const [ch, v] = parts[1].split(':').map(Number);

    // Check synOnly
    if (synOnlySet.has(ref)) {
      verseMap[ref] = { syn: `${ch}:${v}`, grc: null, status: 'synOnly' };
      continue;
    }

    // Check merged
    const mergeKey = `${bk} ${ch}:${v}`;
    if (MERGED_VERSES[mergeKey]) {
      verseMap[ref] = MERGED_VERSES[mergeKey];
      continue;
    }

    // Normal paired
    const grcV = grcVerses.get(ref);
    if (grcV) {
      verseMap[ref] = { syn: `${ch}:${v}`, grc: `${ch}:${v}`, status: 'paired' };
    } else {
      // syn verse without corresponding grc verse → check if it's a synOnlyPhrase span
      verseMap[ref] = { syn: `${ch}:${v}`, grc: null, status: 'synOnly' };
    }
  }

  // Iterate grc-only verses
  for (const [ref, grcV] of grcVerses) {
    if (verseMap[ref]) continue;
    // MERGED_VERSES must take priority over grcOnlySet (anti-pattern §0.3)
    if (MERGED_VERSES[ref]) {
      verseMap[ref] = MERGED_VERSES[ref];
      continue;
    }
    if (grcOnlySet.has(ref)) {
      const parts = ref.split(' ');
      const [ch, v] = parts[1].split(':').map(Number);
      verseMap[ref] = { syn: null, grc: `${ch}:${v}`, status: 'grcOnly' };
    } else {
      // grc verse with no syn equivalent — paired (shouldn't happen for most)
      const parts = ref.split(' ');
      const [ch, v] = parts[1].split(':').map(Number);
      verseMap[ref] = { syn: `${ch}:${v}`, grc: `${ch}:${v}`, status: 'paired' };
    }
  }

  // --- Build pairsByRef ---
  const pairsByRef = {};

  // Build reverse index: syn ref → list of merged Greek refs
  const mergedGrcBySynRef = new Map(); // synRef → [{grcRef, mergeInfo}]
  for (const [grcRef, mergeInfo] of Object.entries(verseMap)) {
    if (mergeInfo.status !== 'merged') continue;
    const parts = grcRef.split(' ');
    const grcBook = parts[0];
    const grcChV = mergeInfo.syn;       // e.g. "11:32b"
    const grcCh = grcChV.replace(/[a-z]$/, ''); // "11:32"
    const synRef = `${grcBook} ${grcCh}`;
    if (!mergedGrcBySynRef.has(synRef)) mergedGrcBySynRef.set(synRef, []);
    mergedGrcBySynRef.get(synRef).push({ grcRef, mergeInfo });
  }

  for (const [ref, verseInfo] of Object.entries(verseMap)) {
    if (verseInfo.status !== 'paired' && verseInfo.status !== 'merged') continue;
    // Only build pairs for verses with both syn and grc text

    const synData = synVerseData.get(ref);
    if (!synData) continue;

    let grcTokens = grcTokensByRef.get(ref) || [];
    // Append tokens from Greek verses merged into this syn verse
    const mergedRefs = mergedGrcBySynRef.get(ref);
    if (mergedRefs) {
      for (const { grcRef } of mergedRefs) {
        const mergedTokens = grcTokensByRef.get(grcRef);
        if (mergedTokens) grcTokens = grcTokens.concat(mergedTokens);
      }
    }
    if (grcTokens.length === 0) continue;

    const { text: verseText, words: synWords } = synData;
    if (!synWords || synWords.length === 0) continue;

    const pairs = [];

    // Build lookup: Greek tokens by lexemeKey (for pairing)
    const grcByLexemeKey = new Map(); // lexemeKey → [token, ...]
    const grcByStrong = new Map();    // strong string → [token, ...]

    for (const t of grcTokens) {
      const lk = t.lexemeKey;
      if (lk) {
        if (!grcByLexemeKey.has(lk)) grcByLexemeKey.set(lk, []);
        grcByLexemeKey.get(lk).push(t);
      }
      if (t.strongs) {
        for (const s of t.strongs) {
          if (!grcByStrong.has(s)) grcByStrong.set(s, []);
          grcByStrong.get(s).push(t);
        }
      }
    }

    // Per-lexemeKey cursor for monotonic consumption
    const cursor = new Map(); // lexemeKey → index into grcByLexemeKey array

    // Build set of word indices that fall within phrase variant spans (should not be paired)
    const variantWordIndices = new Set();
    const pvsForRef = phraseVariantsByRef[ref] || [];
    for (const pv of pvsForRef) {
      const fromIdx = pv.fromIdx || 0;
      const toIdx = Math.min(fromIdx + (pv.ruWords?.length || 0), synWords.length);
      for (let wi = fromIdx; wi < toIdx; wi++) {
        variantWordIndices.add(wi);
      }
    }

    for (const w of synWords) {
      const ruWord = w.text.toLowerCase();

      // Skip words in phrase variant spans (TR additions without Greek source)
      if (variantWordIndices.has(w.i)) continue; // w.i is 0-based, variantWordIndices uses 0-based
      const span = [w.start, w.end];

      // Skip pure punctuation/non-lexical words
      if (ruWord.length === 0 || /^[.,;:!?…—\-"'«»()\[\]{}«»„"0-9\s]+$/.test(ruWord)) {
        continue;
      }

      // Find candidate lexemeKeys via ruMatches
      const candidateKeys = [];
      for (const [lexemeKey, patterns] of ruMatchesByKey) {
        for (const pat of patterns) {
          try {
            const re = new RegExp(pat, 'i');
            if (re.test(ruWord)) {
              // Check excludes
              const excludes = ruExcludeByKey.get(lexemeKey) || [];
              let excluded = false;
              for (const exPat of excludes) {
                try {
                  if (new RegExp(`^${exPat}$`, 'i').test(ruWord)) {
                    excluded = true;
                    break;
                  }
                } catch (_) { /* ignore bad regex */ }
              }
              if (!excluded) {
                candidateKeys.push(lexemeKey);
              }
              break; // First matching pattern suffices
            }
          } catch (_) { /* ignore bad regex */ }
        }
      }

      // If no ruMatch, best-effort: match by similar looking Greek token
      if (candidateKeys.length === 0) continue;

      // Try to find a Greek token for each candidate
      let bestToken = null;
      let bestKey = null;
      let bestQ = 'u';

      for (const lk of candidateKeys) {
        const candidates = grcByLexemeKey.get(lk);
        if (!candidates || candidates.length === 0) continue;

        // Monotonic cursor: for repeated lexemeKeys, consume in order
        if (!cursor.has(lk)) cursor.set(lk, 0);
        const idx = cursor.get(lk);
        if (idx >= candidates.length) continue; // exhausted

        const token = candidates[idx];
        cursor.set(lk, idx + 1); // advance cursor

        // Determine quality
        const isFunction = token.fw || false;
        const q = isFunction ? 'f' : 'e';

        bestToken = token;
        bestKey = lk;
        bestQ = q;
        break; // Use first matching candidate
      }

      if (bestToken) {
        // Additional check: if the word matches ruMatches but token is function word,
        // still use 'f' quality (visible but marked as functional)
        pairs.push({
          span,
          tokenId: bestToken.id,
          lexemeKey: bestKey,
          q: bestQ,
          src: bestQ === 'e' ? 'ruMatch' : 'ruMatch+func',
        });

        allVisibleLexemes.add(bestKey);
        totalPairs++;
        if (bestQ === 'e') totalE++;
        else if (bestQ === 'f') totalF++;
      }
    }

    if (pairs.length > 0) {
      pairsByRef[ref] = pairs;
    }
  }

  // --- Build phrase variants ---
  const pvByRef = {};
  for (const [ref, pvs] of Object.entries(phraseVariantsByRef)) {
    if (!ref.startsWith(bookId + ' ')) continue;
    const pvEntries = [];
    for (const pv of pvs) {
      // Find the span in the syn verse
      const synData = synVerseData.get(ref);
      if (!synData) continue;

      const words = synData.words;
      if (!words || words.length === 0) continue;

      // Use fromIdx to compute span
      const fromIdx = pv.fromIdx || 0;
      const toIdx = Math.min(fromIdx + pv.ruWords.length, words.length);

      if (fromIdx < words.length && toIdx <= words.length) {
        const spanStart = words[fromIdx].start;
        const spanEnd = words[toIdx - 1].end;
        pvEntries.push({
          span: [spanStart, spanEnd],
          variant: pv.note || 'TR addition',
          status: 'synOnlyPhrase',
        });
      }
    }
    if (pvEntries.length > 0) {
      pvByRef[ref] = pvEntries;
    }
  }

  // --- Write book alignment ---
  const alignmentPack = {
    schema: 'alignment-book-v1',
    alignmentId: 'syn--sblgnt-macula',
    translationId: 'syn',
    originalId: 'sblgnt-macula',
    bookId,
    verses: verseMap,
    pairsByRef,
    phraseVariantsByRef: pvByRef,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, `${bookId}.json`), JSON.stringify(alignmentPack));

  const pairCount = Object.values(pairsByRef).reduce((s, a) => s + a.length, 0);
  console.log(`  ${BOOK_SHORT[bookId] || bookId}: ${Object.keys(verseMap).length} verses, ${pairCount} pairs`);
}

// --- Write index ---
mkdirSync(resolve(OUT_DIR, '..'), { recursive: true });
const index = {
  schema: 'alignment-index-v1',
  alignmentId: 'syn--sblgnt-macula',
  lexemesWithVisiblePair: [...allVisibleLexemes].sort(),
};

writeFileSync(INDEX_OUT, JSON.stringify(index));

console.log(`\nTotal pairs: ${totalPairs} (e=${totalE}, f=${totalF}, u=${totalU})`);
console.log(`Visible lexemes: ${allVisibleLexemes.size}`);
console.log('Done.');
