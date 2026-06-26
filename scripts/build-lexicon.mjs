// scripts/build-lexicon.mjs
// Генерирует assets/data/lexicon/core.json (5468 лемм) и dictionary.json (Strong's)

import { buildSlugMap } from './lib/lexeme-slug.mjs';
import { readSourceJson, writeDataJson, DATA_ROOT } from './lib/fs.mjs';

console.log('build-lexicon.mjs');
console.log(`DATA_ROOT: ${DATA_ROOT}`);

// =============================================================================
// Load all inputs
// =============================================================================

const allLexemes = readSourceJson('enriched/lexemes.json');
if (!Array.isArray(allLexemes)) throw new Error('lexemes.json should be an array');
console.log(`  lexemes: ${allLexemes.length}`);

const freqArray = readSourceJson('enriched/frequency.json');
const freqMap = new Map();
for (const f of freqArray) {
  if (f.lexemeId) freqMap.set(f.lexemeId, f);
}
console.log(`  frequency: ${freqArray.length}`);

const strongsDict = readSourceJson('strongs/strongs-dictionary.json');
if (!Array.isArray(strongsDict)) throw new Error('strongs-dictionary.json should be an array');
console.log(`  strongs dictionary: ${strongsDict.length}`);

const strongsRuAlign = readSourceJson('strongs/strongs-ru-alignment.json');
if (!Array.isArray(strongsRuAlign)) throw new Error('strongs-ru-alignment.json should be an array');
console.log(`  strongs ru alignment: ${strongsRuAlign.length}`);

// top1000 curated + slug map
let curatedItems = [];
try {
  const curated = readSourceJson('lexicon/top1000.core.json');
  curatedItems = curated.items || [];
} catch {
  console.warn('  top1000.core.json not found');
}
console.log(`  curated top1000: ${curatedItems.length}`);

// Locale RU overlays
let ruCoreItems = [];
try {
  const ruCore = readSourceJson('lexicon/locales/ru/core.json');
  ruCoreItems = ruCore.items || [];
} catch { console.warn('  ru/core.json not found'); }
console.log(`  ru core overlay: ${ruCoreItems.length}`);

let ruTop1000Items = [];
try {
  const ruTop1000 = readSourceJson('lexicon/locales/ru/top1000.json');
  ruTop1000Items = ruTop1000.items || [];
} catch { console.warn('  ru/top1000.json not found'); }
console.log(`  ru top1000 overlay: ${ruTop1000Items.length}`);

// =============================================================================
// Build slug map (same source as build-bibles.mjs Task 1)
// =============================================================================

const slugMap = buildSlugMap(allLexemes, curatedItems);

// =============================================================================
// Build indexes
// =============================================================================

// strongs-ru index: Map<number, {ruPrimary, ruTopWords}>
const strongsRuIndex = new Map();
for (const item of strongsRuAlign) {
  if (item.strong != null) {
    strongsRuIndex.set(item.strong, {
      ruPrimary: item.ru_primary || null,
      ruTopWords: item.ru_top_words || []
    });
  }
}

// strongs dict index: Map<number, entry> for detail lookup per lexeme
const strongsDictByNum = new Map();
for (const entry of strongsDict) {
  if (entry.strong != null) {
    strongsDictByNum.set(entry.strong, entry);
  }
}

// curated ru index: Map<lexemeKey, {ruMatches, ruExclude, refs}>
const curatedRuIndex = new Map();
for (const item of ruCoreItems) {
  if (item.lexemeKey) {
    curatedRuIndex.set(item.lexemeKey, {
      ruMatches: item.ruMatches || [],
      ruExclude: item.ruExclude || [],
      refs: item.refs || []
    });
  }
}

// ru display index: Map<lexemeKey, {gloss, shortGloss}>
const ruDisplayIndex = new Map();
for (const item of ruTop1000Items) {
  if (item.lexemeKey) {
    ruDisplayIndex.set(item.lexemeKey, {
      gloss: item.gloss || null,
      shortGloss: item.shortGloss || null
    });
  }
}

// =============================================================================
// Build core.json records
// =============================================================================

const coreItems = [];

for (const lex of allLexemes) {
  const lexemeId = lex.id;
  if (!lexemeId) continue;

  // Basic fields
  const translit = lex.transliteration?.value ?? null;
  const pos = lex.pos?.primary ?? null;
  const posLabelRu = lex.pos?.labelRu ?? null;
  const strongs = lex.strong || [];
  const isFunctionWord = lex.isFunctionWord === true;
  const slug = slugMap.get(lexemeId) || null;

  // Frequency
  const freqEntry = freqMap.get(lexemeId);
  const freqRank = freqEntry?.rank ?? null;
  const freqTokenCount = freqEntry?.tokenCount ?? null;
  const freqVerseCount = freqEntry?.verseCount ?? null;

  // RU glosses from Strong's (number cast!)
  let ruGloss = null;
  let ruTopWords = [];
  for (const s of strongs) {
    const num = Number(s);
    if (!Number.isNaN(num)) {
      const hit = strongsRuIndex.get(num);
      if (hit) {
        ruGloss = ruGloss || hit.ruPrimary;
        ruTopWords = hit.ruTopWords;
        break;
      }
    }
  }

  // Detail from Strong's dictionary (definition, derivation, pronunciation)
  let detail = null;
  for (const s of strongs) {
    const num = Number(s);
    if (!Number.isNaN(num)) {
      const sd = strongsDictByNum.get(num);
      if (sd) {
        detail = {
          definition: sd.strongs_def || null,
          derivation: sd.strongs_derivation || null,
          pronunciation: sd.pronunciation || null
        };
        break;
      }
    }
  }

  // RU display from curated top1000 (приоритетнее Strong's)
  if (slug) {
    const ruDisplay = ruDisplayIndex.get(slug);
    if (ruDisplay) {
      if (ruDisplay.shortGloss) ruGloss = ruDisplay.shortGloss;
      else if (ruDisplay.gloss) ruGloss = ruDisplay.gloss;
    }
  }

  // RU guards from curated core
  let ruMatches = [];
  let ruExclude = [];
  let refs = [];
  if (slug) {
    const ruByKey = curatedRuIndex.get(slug);
    if (ruByKey) {
      ruMatches = ruByKey.ruMatches;
      ruExclude = ruByKey.ruExclude;
      refs = ruByKey.refs;
    }
  }

  // legacyKeys: [slug] + ['freq-' + strong] for each strong
  const legacyKeys = [];
  if (slug) legacyKeys.push(slug);
  for (const s of strongs) {
    legacyKeys.push(`freq-${s}`);
  }

  coreItems.push({
    lexemeId,
    lexemeSlug: slug,
    lemma: lex.lemma,
    translit,
    pos,
    posLabelRu,
    strongs,
    freqRank,
    freqTokenCount,
    freqVerseCount,
    glossesBerean: lex.glossesEn || [],
    glossesCherith: lex.englishGlosses || [],
    allRefs: lex.allRefs || [],
    allRefsCount: lex.allRefsCount || 0,
    autoSelectedRefs: lex.autoSelectedRefs || [],
    // Strip source-only search fields (normalized, surfaceSearch) from attestedForms (F1.4)
    attestedForms: (lex.attestedForms || []).map(({ normalized, surfaceSearch, ...keep }) => keep),
    ruGloss,
    ruTopWords,
    ruMatches,
    ruExclude,
    refs,
    legacyKeys,
    isFunctionWord,
    detail
  });
}

console.log(`  core items built: ${coreItems.length}`);

// =============================================================================
// Resolve legacyKey collisions
// =============================================================================

const legacyKeyMap = new Map(); // key → [lexemeIds]
for (const item of coreItems) {
  for (const lk of item.legacyKeys) {
    if (!legacyKeyMap.has(lk)) legacyKeyMap.set(lk, []);
    legacyKeyMap.get(lk).push(item.lexemeId);
  }
}

const conflictKeys = new Set();
for (const [lk, ids] of legacyKeyMap) {
  if (ids.length > 1) {
    conflictKeys.add(lk);
  }
}

// Remove conflicting legacy keys
for (const item of coreItems) {
  item.legacyKeys = item.legacyKeys.filter(lk => !conflictKeys.has(lk));
}

if (conflictKeys.size > 0) {
  console.log(`  legacyKey conflicts resolved: ${conflictKeys.size} keys dropped`);
}

// Write core.json
writeDataJson('lexicon/core.json', {
  schema: 'lexicon-core-v2',
  items: coreItems
});
console.log(`  ✓ lexicon/core.json written (${coreItems.length} items)`);

// =============================================================================
// Build dictionary.json
// =============================================================================

const dictObj = {};
for (const entry of strongsDict) {
  const strongNum = entry.strong;
  if (strongNum == null) continue;
  const strongKey = String(strongNum);
  const ruHit = strongsRuIndex.get(strongNum);

  dictObj[strongKey] = {
    definition: entry.strongs_def || null,
    derivation: entry.strongs_derivation || null,
    pronunciation: entry.pronunciation || null,
    greek: entry.lemma || null,
    translit: entry.translit || null,
    ruPrimary: ruHit?.ruPrimary || null,
    ruTopWords: ruHit?.ruTopWords || []
  };
}

writeDataJson('lexicon/dictionary.json', dictObj);
console.log(`  ✓ lexicon/dictionary.json written (${Object.keys(dictObj).length} entries)`);

console.log('\n✓ build-lexicon.mjs complete');
