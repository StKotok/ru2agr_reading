#!/usr/bin/env node

/**
 * build-macula.mjs — Main MACULA Greek data pipeline.
 *
 * Reads the MACULA Greek SBLGNT TSV, normalises, enriches, and generates
 * all data structures for the Greek NT reader application.
 *
 * Usage: node scripts/macula/build-macula.mjs
 * Output: assets/data/generated/macula/
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Library imports
import { toNfc, toSearchForm, stripAccents, normaliseTokenRows } from './lib/normalizer.mjs';
import { generateLexemeId, buildLexemeIdMap } from './lib/lexeme-id.mjs';
import { transliterateGreek } from './lib/transliteration.mjs';
import { detectAccent } from './lib/accent.mjs';
import { parseMorphCode, buildLabelRu } from './lib/morphology-decoder.mjs';
import { buildVersesByBook } from './lib/verse-reconstructor.mjs';
import { computeLemmaFrequencies, computeFormFrequencies, computeBreakpoints } from './lib/frequency.mjs';
import { selectAutoRefs, sortRefsCanonical, NT_BOOK_ORDER } from './lib/ref-selector.mjs';
import { loadDomainLabels, lookupLouwNida, lookupDomainLabel } from './lib/domain-labels.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const MACULA_ROOT = resolve(ROOT, 'docs', 'macula-greek');
const TSV_PATH = resolve(MACULA_ROOT, 'SBLGNT', 'tsv', 'macula-greek-SBLGNT.tsv');
const OUT_DIR = resolve(ROOT, 'assets', 'data', 'generated', 'macula');

// Canonical NT books with metadata
const NT_BOOKS = [
  { id: 'matthew', title: 'ΚΑΤΑ ΜΑΘΘΑΙΟΝ', chapters: 28 },
  { id: 'mark', title: 'ΚΑΤΑ ΜΑΡΚΟΝ', chapters: 16 },
  { id: 'luke', title: 'ΚΑΤΑ ΛΟΥΚΑΝ', chapters: 24 },
  { id: 'john', title: 'ΚΑΤΑ ΙΩΑΝΝΗΝ', chapters: 21 },
  { id: 'acts', title: 'ΠΡΑΞΕΙΣ ΑΠΟΣΤΟΛΩΝ', chapters: 28 },
  { id: 'romans', title: 'ΠΡΟΣ ΡΩΜΑΙΟΥΣ', chapters: 16 },
  { id: '1corinthians', title: 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Α', chapters: 16 },
  { id: '2corinthians', title: 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Β', chapters: 13 },
  { id: 'galatians', title: 'ΠΡΟΣ ΓΑΛΑΤΑΣ', chapters: 6 },
  { id: 'ephesians', title: 'ΠΡΟΣ ΕΦΕΣΙΟΥΣ', chapters: 6 },
  { id: 'philippians', title: 'ΠΡΟΣ ΦΙΛΙΠΠΗΣΙΟΥΣ', chapters: 4 },
  { id: 'colossians', title: 'ΠΡΟΣ ΚΟΛΟΣΣΑΕΙΣ', chapters: 4 },
  { id: '1thessalonians', title: 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Α', chapters: 5 },
  { id: '2thessalonians', title: 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Β', chapters: 3 },
  { id: '1timothy', title: 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ Α', chapters: 6 },
  { id: '2timothy', title: 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ Β', chapters: 4 },
  { id: 'titus', title: 'ΠΡΟΣ ΤΙΤΟΝ', chapters: 3 },
  { id: 'philemon', title: 'ΠΡΟΣ ΦΙΛΗΜΟΝΑ', chapters: 1 },
  { id: 'hebrews', title: 'ΠΡΟΣ ΕΒΡΑΙΟΥΣ', chapters: 13 },
  { id: 'james', title: 'ΙΑΚΩΒΟΥ', chapters: 5 },
  { id: '1peter', title: 'ΠΕΤΡΟΥ Α', chapters: 5 },
  { id: '2peter', title: 'ΠΕΤΡΟΥ Β', chapters: 3 },
  { id: '1john', title: 'ΙΩΑΝΝΟΥ Α', chapters: 5 },
  { id: '2john', title: 'ΙΩΑΝΝΟΥ Β', chapters: 1 },
  { id: '3john', title: 'ΙΩΑΝΝΟΥ Γ', chapters: 1 },
  { id: 'jude', title: 'ΙΟΥΔΑ', chapters: 1 },
  { id: 'revelation', title: 'ΑΠΟΚΑΛΥΨΙΣ ΙΩΑΝΝΟΥ', chapters: 22 },
];

const BOOK_CHAPTER_COUNTS = Object.fromEntries(NT_BOOKS.map(b => [b.id, b.chapters]));

// Config: which POS categories are function words
const FUNCTION_WORD_POS = new Set([
  'article', 'preposition', 'conjunction', 'particle', 'pronoun', 'determiner',
]);

// ================================================================
// Step 1: Parse TSV
// ================================================================

console.log('=== MACULA Build Pipeline ===\n');

const tsvRaw = readFileSync(TSV_PATH, 'utf8');
const tsvLines = tsvRaw.trim().split('\n');
const headerLine = tsvLines[0];
const headers = headerLine.split('\t');
console.log(`TSV columns (${headers.length}): ${headers.join(', ')}`);

// Parse all rows
const rows = [];
for (let i = 1; i < tsvLines.length; i++) {
  const cols = tsvLines[i].split('\t');
  if (cols.length < headers.length) continue; // skip truncated rows
  const row = {};
  for (let j = 0; j < headers.length; j++) {
    row[headers[j]] = cols[j] || '';
  }
  rows.push(row);
}

console.log(`Parsed ${rows.length} rows from TSV`);

// ================================================================
// Step 2: Unicode NFC normalisation
// ================================================================

normaliseTokenRows(rows);
console.log('Unicode NFC normalisation applied');

// ================================================================
// Step 3: Parse references and book structure
// ================================================================

const BOOK_ID_MAP = {
  'MAT': 'matthew', 'MRK': 'mark', 'LUK': 'luke', 'JHN': 'john',
  'ACT': 'acts', 'ROM': 'romans', '1CO': '1corinthians', '2CO': '2corinthians',
  'GAL': 'galatians', 'EPH': 'ephesians', 'PHP': 'philippians', 'COL': 'colossians',
  '1TH': '1thessalonians', '2TH': '2thessalonians', '1TI': '1timothy', '2TI': '2timothy',
  'TIT': 'titus', 'PHM': 'philemon', 'HEB': 'hebrews', 'JAS': 'james',
  '1PE': '1peter', '2PE': '2peter', '1JN': '1john', '2JN': '2john', '3JN': '3john',
  'JUD': 'jude', 'REV': 'revelation',
};

// Track per-book token counts for coverage report
const bookTokenCounts = new Map();

for (const row of rows) {
  // Parse ref: "MAT 1:1!1" → bookId, chapter, verse, tokenIndex
  const ref = row.ref || '';
  const refMatch = ref.match(/^(\w+)\s+(\d+):(\d+)!(\d+)$/);
  if (refMatch) {
    row._bookAbbr = refMatch[1];
    row._chapter = parseInt(refMatch[2]);
    row._verse = parseInt(refMatch[3]);
    row._tokenIndex = parseInt(refMatch[4]);
    row.bookId = BOOK_ID_MAP[row._bookAbbr] || row._bookAbbr.toLowerCase();
    row.chapter = row._chapter;
    row.verse = row._verse;
    row.tokenIndex = row._tokenIndex;
  } else {
    row.bookId = null;
    row.chapter = null;
    row.verse = null;
    row.tokenIndex = null;
  }

  // Track book counts
  if (row.bookId) {
    bookTokenCounts.set(row.bookId, (bookTokenCounts.get(row.bookId) || 0) + 1);
  }
}

// ================================================================
// Step 4: Generate lexeme IDs
// ================================================================

const uniqueLemmas = [...new Set(rows.filter(r => r.lemma).map(r => r.lemma))].sort();
console.log(`\nUnique lemmas: ${uniqueLemmas.length}`);

const { map: lexemeIdMap, collisions: lexemeCollisions } = buildLexemeIdMap(uniqueLemmas);
if (lexemeCollisions.length > 0) {
  console.error('LEXEME ID COLLISIONS:');
  lexemeCollisions.forEach(c => console.error('  ' + c));
  throw new Error('Lexeme ID collision detected');
}
console.log('Lexeme IDs generated, no collisions');

// ================================================================
// Step 5: Load domain labels and verse text
// ================================================================

loadDomainLabels();
console.log('Domain labels loaded');

const versesByBook = buildVersesByBook();
console.log(`Verse text reconstructed for ${versesByBook.size} books`);

// ================================================================
// Step 6: Build token records
// ================================================================

console.log('\nBuilding token records...');

const allTokens = [];
const tokensByLemma = new Map(); // lemma → { tokens: [...], verses: Set }
const strongToLemmas = new Map(); // strong → Set of lemmas
const unknownMorphCodes = new Set();
const unknownPosValues = new Set();
const unknownFeatureValues = {};

// Coverage counters
let tokensWithLemma = 0;
let tokensWithStrong = 0;
let tokensWithMorph = 0;
let tokensWithGloss = 0;
let tokensWithEnglish = 0;
let tokensWithLN = 0;
let tokensWithDomain = 0;
let tokensWithPOS = 0;

for (const row of rows) {
  if (!row.bookId) continue;

  const srcRef = row.ref || '';
  const appRef = `${row.bookId} ${row.chapter}:${row.verse}`;

  // Parse morphology
  const morphParsed = parseMorphCode(row.morph || null);
  const labelRu = buildLabelRu(morphParsed);

  // Track unknowns
  if (morphParsed.unknown) unknownMorphCodes.add(row.morph);
  if (morphParsed.unknownPos) unknownPosValues.add(row.pos || row.morph);

  // Lookup Louw-Nida domain labels from MARBLE domain codes
  const lnInfo = lookupLouwNida(row.ln || '');
  // Direct domain code lookup (more reliable)
  const domainCodes = row.domain ? row.domain.split(/\s+/).filter(Boolean) : [];
  const domainLabels = domainCodes.map(c => lookupDomainLabel(c)).filter(Boolean);

  // Strong numbers
  const strongList = row.strong ? row.strong.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Glosses
  const glossEn = row.gloss || null;
  const english = row.english || null;

  // POS from MACULA
  const maculaClass = row.class || null;
  const maculaType = row.type || null;
  const maculaRole = row.role || null;

  const posCategory = morphParsed.posCategory || 'other';
  const isFunctionWord = FUNCTION_WORD_POS.has(posCategory);

  // Surface form
  const surface = row.text || '';
  const normalized = row.normalized || surface;
  const lemma = row.lemma || null;
  const lexemeId = lemma ? lexemeIdMap.get(lemma) : null;

  // Transliteration and accent
  const translit = surface ? transliterateGreek(surface) : null;
  const lemmaTranslit = lemma ? transliterateGreek(lemma) : null;
  const accentInfo = detectAccent(surface);

  const token = {
    id: row['xml:id'] || '',
    sourceId: row['xml:id'] || '',
    lexemeId,
    ref: appRef,
    sourceRef: srcRef,
    bookId: row.bookId,
    chapter: row.chapter,
    verse: row.verse,
    tokenIndex: row.tokenIndex,

    surface: surface || null,
    surfaceNfc: surface ? toNfc(surface) : null,
    surfaceSearch: surface ? toSearchForm(surface) : null,
    normalized: normalized || null,
    lemma,
    lemmaSearch: lemma ? toSearchForm(lemma) : null,

    strong: strongList.length > 0 ? strongList : [],

    pos: {
      source: maculaClass || null,
      code: row.morph ? row.morph.split('-')[0] : null,
      category: posCategory,
      labelRu: morphParsed.pos || null,
    },

    morphology: {
      code: row.morph || null,
      person: row.person || null,
      number: row.number || null,
      gender: row.gender || null,
      case: row.case || null,
      tense: row.tense || null,
      voice: row.voice || null,
      mood: row.mood || null,
      degree: row.degree || null,
      labelRu,
    },

    semantic: {
      louwNida: row.ln || null,
      domainCode: domainCodes.length > 0 ? domainCodes : [],
      domainLabelEn: domainLabels.length > 0 ? domainLabels : [],
      subdomainLabelEn: lnInfo.subdomainLabelEn || null,
    },

    glossEn,
    english,

    transliteration: translit?.value || null,
    accent: accentInfo,

    maculaSource: {
      class: maculaClass,
      type: maculaType,
      role: maculaRole,
      frame: row.frame || null,
      subjref: row.subjref || null,
      referent: row.referent || null,
    },

    isFunctionWord,
  };

  allTokens.push(token);

  // Coverage counting
  if (lemma) tokensWithLemma++;
  if (strongList.length > 0) tokensWithStrong++;
  if (row.morph) tokensWithMorph++;
  if (glossEn) tokensWithGloss++;
  if (english) tokensWithEnglish++;
  if (row.ln) tokensWithLN++;
  if (row.domain) tokensWithDomain++;
  if (maculaClass) tokensWithPOS++;

  // Group by lemma
  if (lemma) {
    if (!tokensByLemma.has(lemma)) {
      tokensByLemma.set(lemma, { tokens: [], verses: new Set() });
    }
    const group = tokensByLemma.get(lemma);
    group.tokens.push(token);
    group.verses.add(appRef);

    // Strong → lemma mapping
    for (const s of strongList) {
      if (!strongToLemmas.has(s)) strongToLemmas.set(s, new Set());
      strongToLemmas.get(s).add(lemma);
    }
  }
}

console.log(`Built ${allTokens.length} token records`);
console.log(`  with lemma: ${tokensWithLemma}/${allTokens.length}`);
console.log(`  with Strong: ${tokensWithStrong}/${allTokens.length}`);
console.log(`  with morph: ${tokensWithMorph}/${allTokens.length}`);
console.log(`  with gloss: ${tokensWithGloss}/${allTokens.length}`);

// ================================================================
// Step 7: Build verse records
// ================================================================

console.log('\nBuilding verse records...');

const allVerses = [];
for (const [bookId, verses] of versesByBook) {
  for (const v of verses) {
    allVerses.push({
      ref: v.ref,
      bookId,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
      tokenIds: v.tokenIds,
    });
  }
}

console.log(`Built ${allVerses.length} verse records`);

// ================================================================
// Step 8: Compute frequencies
// ================================================================

console.log('\nComputing frequencies...');

const totalLexicalTokens = allTokens.length;

const lemmaFreqs = computeLemmaFrequencies(tokensByLemma, totalLexicalTokens);
const breakpoints = computeBreakpoints(lemmaFreqs);

console.log(`Lemma frequencies computed: ${lemmaFreqs.length} lemmas`);
console.log(`  Top 3: ${lemmaFreqs.slice(0, 3).map(e => `${e.lemma} (${e.tokenCount}, ${(e.coveragePercent).toFixed(2)}%)`).join(', ')}`);

// ================================================================
// Step 9: Build lexeme records (aggregated per lemma)
// ================================================================

console.log('\nBuilding lexeme records...');

const lexemes = [];
const lemmaFreqMap = new Map(lemmaFreqs.map(f => [f.lemma, f]));

for (const [lemma, group] of tokensByLemma) {
  const freqInfo = lemmaFreqMap.get(lemma);
  const lexemeId = lexemeIdMap.get(lemma);
  const firstToken = group.tokens[0];

  // Attested forms
  const formMap = new Map(); // surface → { count, refs: Set, morphCodes: Set, tokens: [...] }
  for (const token of group.tokens) {
    const sf = token.surface || '';
    if (!formMap.has(sf)) {
      formMap.set(sf, { count: 0, refs: new Set(), morphCodes: new Set(), tokens: [] });
    }
    const f = formMap.get(sf);
    f.count++;
    f.refs.add(token.ref);
    if (token.morphology.code) f.morphCodes.add(token.morphology.code);
    f.tokens.push(token);
  }

  const attestedForms = [];
  for (const [surface, fdata] of formMap) {
    attestedForms.push({
      surface,
      normalized: surface ? toNfc(surface) : null,
      surfaceSearch: surface ? toSearchForm(surface) : null,
      count: fdata.count,
      morphCodes: [...fdata.morphCodes].sort(),
      verseCount: fdata.refs.size,
      refs: sortRefsCanonical([...fdata.refs]),
      firstRef: sortRefsCanonical([...fdata.refs])[0] || null,
    });
  }
  attestedForms.sort((a, b) => b.count - a.count);

  // All refs sorted canonically
  const allRefsArr = sortRefsCanonical([...group.verses]);

  // Auto-selected example refs
  const autoRefs = selectAutoRefs({ lemma }, attestedForms, allRefsArr);

  // Aggregated semantic domains
  const semanticDomains = [];
  const seenDomains = new Set();
  for (const token of group.tokens) {
    const codes = token.semantic.domainCode;
    if (codes && Array.isArray(codes)) {
      for (const code of codes) {
        if (code && !seenDomains.has(code)) {
          seenDomains.add(code);
          const label = lookupDomainLabel(code);
          semanticDomains.push({
            louwNida: token.semantic.louwNida,
            domainCode: code,
            domainLabelEn: label || null,
            subdomainLabelEn: token.semantic.subdomainLabelEn,
          });
        }
      }
    } else if (codes && !seenDomains.has(codes)) {
      seenDomains.add(codes);
      const label = lookupDomainLabel(codes);
      semanticDomains.push({
        louwNida: token.semantic.louwNida,
        domainCode: codes,
        domainLabelEn: label || null,
        subdomainLabelEn: token.semantic.subdomainLabelEn,
      });
    }
  }

  // Aggregated glosses
  const glossSet = new Set();
  for (const token of group.tokens) {
    if (token.glossEn) glossSet.add(token.glossEn);
  }

  // Aggregated English glosses
  const englishSet = new Set();
  for (const token of group.tokens) {
    if (token.english) englishSet.add(token.english);
  }

  // POS: take the most common POS for this lemma
  const posCounts = new Map();
  for (const token of group.tokens) {
    const cat = token.pos.category;
    posCounts.set(cat, (posCounts.get(cat) || 0) + 1);
  }
  const primaryPos = [...posCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

  // Lemma-level accent
  const lemmaAccent = detectAccent(lemma);
  const lemmaTranslit = transliterateGreek(lemma);

  const lexeme = {
    id: lexemeId,
    lemma,
    lemmaSearch: toSearchForm(lemma),

    transliteration: lemmaTranslit,

    accent: lemmaAccent,

    strong: firstToken?.strong || [],

    pos: {
      categories: [...new Set(group.tokens.map(t => t.pos.category))],
      primary: primaryPos,
      labelRu: firstToken?.pos.labelRu || null,
    },

    isFunctionWord: FUNCTION_WORD_POS.has(primaryPos),

    frequency: freqInfo ? {
      tokenCount: freqInfo.tokenCount,
      verseCount: freqInfo.verseCount,
      rank: freqInfo.rank,
      denseRank: freqInfo.denseRank,
      coverage: freqInfo.coverage,
      coveragePercent: freqInfo.coveragePercent,
      cumulativeCoverage: freqInfo.cumulativeCoverage,
    } : null,

    attestedForms,

    allRefs: allRefsArr,
    allRefsCount: allRefsArr.length,

    firstRef: allRefsArr[0] || null,
    autoSelectedRefs: autoRefs,

    semanticDomains,

    glossesEn: [...glossSet].sort(),
    englishGlosses: [...englishSet].sort(),
  };

  lexemes.push(lexeme);
}

console.log(`Built ${lexemes.length} lexeme records`);

// ================================================================
// Step 10: Build frequency.json
// ================================================================

const frequencyEntries = lemmaFreqs.map(f => {
  const lexeme = lexemes.find(l => l.lemma === f.lemma);
  return {
    rank: f.rank,
    denseRank: f.denseRank,
    lexemeId: lexemeIdMap.get(f.lemma),
    lemma: f.lemma,
    tokenCount: f.tokenCount,
    verseCount: f.verseCount,
    coverage: f.coverage,
    coveragePercent: f.coveragePercent,
    cumulativeCoverage: f.cumulativeCoverage,
    strong: lexeme?.strong || [],
    pos: lexeme?.pos.primary || null,
    isFunctionWord: lexeme?.isFunctionWord || false,
    glossesEn: lexeme?.glossesEn || [],
    transliteration: lexeme?.transliteration?.value || null,
    firstRef: lexeme?.firstRef || null,
  };
});

// ================================================================
// Step 11: Output files
// ================================================================

console.log('\nWriting output files...');

// Ensure output directories
mkdirSync(resolve(OUT_DIR, 'schema'), { recursive: true });
mkdirSync(resolve(OUT_DIR, 'books'), { recursive: true });

// tokens.jsonl — one JSON object per line
const tokensPath = resolve(OUT_DIR, 'tokens.jsonl');
const tokensLines = allTokens.map(t => JSON.stringify(t)).join('\n');
writeFileSync(tokensPath, tokensLines + '\n');
console.log(`  tokens.jsonl: ${allTokens.length} records`);

// lexemes.json
const lexemesPath = resolve(OUT_DIR, 'lexemes.json');
writeFileSync(lexemesPath, JSON.stringify(lexemes, null, 2));
console.log(`  lexemes.json: ${lexemes.length} records`);

// verses.json
const versesPath = resolve(OUT_DIR, 'verses.json');
writeFileSync(versesPath, JSON.stringify(allVerses, null, 2));
console.log(`  verses.json: ${allVerses.length} records`);

// frequency.json
const freqPath = resolve(OUT_DIR, 'frequency.json');
writeFileSync(freqPath, JSON.stringify(frequencyEntries, null, 2));
console.log(`  frequency.json: ${frequencyEntries.length} records`);

// Books (per-book token files)
console.log('\nWriting per-book files...');
for (const book of NT_BOOKS) {
  const bookTokens = allTokens.filter(t => t.bookId === book.id);
  if (bookTokens.length === 0) continue;
  const bookPath = resolve(OUT_DIR, 'books', `${book.id}.json`);
  writeFileSync(bookPath, JSON.stringify(bookTokens, null, 2));
}
console.log(`  Books written: ${NT_BOOKS.filter(b => bookTokenCounts.has(b.id)).length}/27`);

// ================================================================
// Step 12: Source manifest
// ================================================================

const tsvHash = createHash('sha256').update(tsvRaw).digest('hex');

const manifest = {
  dataset: 'MACULA Greek',
  corpus: 'SBLGNT',
  sourcePath: 'docs/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv',
  sourceFileSha256: tsvHash,
  generatedAt: new Date().toISOString(),
  generatorVersion: '1.0.0',
  schemaVersion: '1.0.0',
  license: 'CC BY 4.0',
  attribution: 'MACULA Greek Linguistic Datasets, available at https://github.com/Clear-Bible/macula-greek/',
  additionalLicenses: [
    'SBLGNT: © 2010 Society of Biblical Literature and Logos Bible Software, CC-BY 4.0',
    'Berean Interlinear Bible glosses: Public domain (as of April 30, 2023)',
    'Cherith Glosses: © 2023 Cherith Analytics, CC BY 4.0',
    'MARBLE word sense data: Used with permission, United Bible Societies',
  ],
};

const manifestPath = resolve(OUT_DIR, 'source-manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('\n  source-manifest.json written');

// ================================================================
// Step 13: Build report
// ================================================================

const totalRows = rows.length;
const totalTokens = allTokens.length;
const totalVerses = allVerses.length;
const totalBooks = new Set(allTokens.map(t => t.bookId)).size;
const totalLemmas = uniqueLemmas.length;
const uniqueSurfaceForms = new Set(allTokens.map(t => t.surface)).size;

const coverageFields = [
  { name: 'surface', count: totalTokens, total: totalTokens, pct: 100 },
  { name: 'lemma', count: tokensWithLemma, total: totalTokens, pct: (tokensWithLemma / totalTokens * 100).toFixed(1) },
  { name: 'strong', count: tokensWithStrong, total: totalTokens, pct: (tokensWithStrong / totalTokens * 100).toFixed(1) },
  { name: 'morph', count: tokensWithMorph, total: totalTokens, pct: (tokensWithMorph / totalTokens * 100).toFixed(1) },
  { name: 'gloss', count: tokensWithGloss, total: totalTokens, pct: (tokensWithGloss / totalTokens * 100).toFixed(1) },
  { name: 'english', count: tokensWithEnglish, total: totalTokens, pct: (tokensWithEnglish / totalTokens * 100).toFixed(1) },
  { name: 'louwNida', count: tokensWithLN, total: totalTokens, pct: (tokensWithLN / totalTokens * 100).toFixed(1) },
  { name: 'domain', count: tokensWithDomain, total: totalTokens, pct: (tokensWithDomain / totalTokens * 100).toFixed(1) },
  { name: 'pos', count: tokensWithPOS, total: totalTokens, pct: (tokensWithPOS / totalTokens * 100).toFixed(1) },
];

const problems = [];
// Check for duplicate token IDs
const tokenIds = new Set();
const dupIds = [];
for (const t of allTokens) {
  if (tokenIds.has(t.id)) dupIds.push(t.id);
  tokenIds.add(t.id);
}
if (dupIds.length > 0) problems.push(`Duplicate token IDs: ${dupIds.join(', ')}`);

// Check lexeme ID collisions
if (lexemeCollisions.length > 0) problems.push(`Lexeme ID collisions: ${lexemeCollisions.length}`);

// Check frequency sum
const freqSum = lexemes.reduce((s, l) => s + (l.frequency?.tokenCount || 0), 0);
if (freqSum !== totalTokens) problems.push(`Frequency sum mismatch: ${freqSum} vs ${totalTokens} total tokens`);

// Check last cumulative coverage
if (lemmaFreqs.length > 0) {
  const lastCuml = lemmaFreqs[lemmaFreqs.length - 1].cumulativeCoverage;
  if (Math.abs(lastCuml - 1) > 0.001) {
    problems.push(`Last cumulative coverage not ≈1: ${lastCuml}`);
  }
}

const buildReport = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalTsvRows: totalRows,
    totalTokens,
    totalVerses,
    totalBooks,
    totalLemmas,
    uniqueSurfaceForms,
    breakpoints,
  },
  coverage: {
    fields: coverageFields,
    bookTokenCounts: Object.fromEntries(bookTokenCounts),
  },
  unknownValues: {
    morphCodes: [...unknownMorphCodes].slice(0, 100),
    posValues: [...unknownPosValues].slice(0, 50),
    unknownMorphCodeCount: unknownMorphCodes.size,
    unknownPosCount: unknownPosValues.size,
  },
  problems,
  sourceFiles: {
    tsv: 'docs/macula-greek/SBLGNT/tsv/macula-greek-SBLGNT.tsv',
    tsvSha256: tsvHash,
    teiDir: 'docs/macula-greek/SBLGNT/tei/',
    domainLabels: 'docs/macula-greek/sources/MARBLE/SDBG/marble-domain-label-mapping.json',
  },
};

const reportJsonPath = resolve(OUT_DIR, 'build-report.json');
writeFileSync(reportJsonPath, JSON.stringify(buildReport, null, 2));
console.log('  build-report.json written');

// Build human-readable markdown report
let md = '# MACULA Build Report\n\n';
md += `**Generated:** ${buildReport.generatedAt}\n`;
md += `**Source TSV SHA-256:** \`${tsvHash}\`\n\n`;

md += '## Summary\n\n';
md += `| Metric | Value |\n|---|---|\n`;
md += `| TSV rows | ${totalRows} |\n`;
md += `| **Tokens** | **${totalTokens}** |\n`;
md += `| **Verses** | **${totalVerses}** |\n`;
md += `| **Books** | **${totalBooks}** / 27 |\n`;
md += `| **Unique lemmas** | **${totalLemmas}** |\n`;
md += `| **Unique surface forms** | **${uniqueSurfaceForms}** |\n`;

md += '\n## Field Coverage\n\n';
md += '| Field | Filled | Total | Coverage |\n|---|---|---|---|\n';
for (const f of coverageFields) {
  md += `| ${f.name} | ${f.count} | ${f.total} | ${f.pct}% |\n`;
}

md += '\n## Frequency Breakpoints\n\n';
md += '| Percentile | Lemmas needed | Cumulative coverage |\n|---|---|---|\n';
for (const [key, val] of Object.entries(breakpoints)) {
  md += `| ${key} | ${val.lemmasNeeded} | ${(val.cumulativeCoverage * 100).toFixed(1)}% |\n`;
}

md += '\n## Top 20 Lemmas\n\n';
md += '| Rank | Lemma | Count | Coverage | Cumulative |\n|---|---|---|---|---|\n';
for (const f of lemmaFreqs.slice(0, 20)) {
  md += `| ${f.rank} | ${f.lemma} | ${f.tokenCount} | ${(f.coveragePercent).toFixed(2)}% | ${(f.cumulativeCoverage * 100).toFixed(1)}% |\n`;
}

if (lexemeCollisions.length > 0) {
  md += '\n## ⚠️ Lexeme ID Collisions\n\n';
  for (const c of lexemeCollisions) md += `- ${c}\n`;
}

if (problems.length > 0) {
  md += '\n## ⚠️ Problems\n\n';
  for (const p of problems) md += `- ${p}\n`;
}

if (unknownMorphCodes.size > 0) {
  md += '\n## Unknown Morph Codes\n\n';
  md += `Total unique unknown codes: ${unknownMorphCodes.size}\n\n`;
  md += '```\n';
  for (const c of [...unknownMorphCodes].slice(0, 50)) md += `${c}\n`;
  md += '```\n';
}

md += '\n## Data Sources\n\n';
md += '| Field | Source | Type |\n|---|---|---|\n';
md += '| surface | MACULA `text` | direct |\n';
md += '| lemma | MACULA `lemma` | direct |\n';
md += '| morph | MACULA `morph` | direct |\n';
md += '| strong | MACULA `strong` | direct |\n';
md += '| gloss | MACULA `gloss` (Berean) | direct |\n';
md += '| english | MACULA `english` (Cherith) | direct |\n';
md += '| louwNida | MACULA `ln` (MARBLE) | direct |\n';
md += '| domain | MACULA `domain` (MARBLE) | direct |\n';
md += '| tokenCount | aggregation | derived |\n';
md += '| rank | frequency sort | derived |\n';
md += '| coverage | computation | derived |\n';
md += '| transliteration | algorithm (sbl-like) | derived |\n';
md += '| accent | Unicode analysis | derived |\n';
md += '| morphology.labelRu | decoder | derived |\n';
md += '| isFunctionWord | POS mapping | derived |\n';
md += '| allRefs | aggregation | derived |\n';
md += '| autoSelectedRefs | heuristic | derived |\n';
md += '| lexemeId | deterministic hash | derived |\n';
md += '| surfaceSearch | Unicode strip | derived |\n';

md += '\n## License & Attribution\n\n';
md += '```\n';
md += 'MACULA Greek Linguistic Datasets, available at\n';
md += 'https://github.com/Clear-Bible/macula-greek/\n\n';
md += 'Licensed under CC BY 4.0.\n\n';
md += 'Additional source attributions:\n';
for (const attr of manifest.additionalLicenses) {
  md += `- ${attr}\n`;
}
md += '```\n';

md += '\n## Fields NOT Generated\n\n';
md += 'The following fields are intentionally not generated by this pipeline\n';
md += '(they require external data sources or manual curation):\n\n';
md += '- Russian glosses (glossRu)\n';
md += '- Russian definitions\n';
md += '- Etymology\n';
md += '- IPA pronunciation\n';
md += '- Russian transcription\n';
md += '- Audio files\n';
md += '- Syllable breaks\n';
md += '- Declension/conjugation type\n';
md += '- Full theoretical paradigm (only attestedForms provided)\n';
md += '- Verb transitivity\n';
md += '- Adjective type\n';
md += '- Alignment with Synodal/KJV/other translations\n';
md += '- Translation variants per translation\n';
md += '- Editorially curated "key verses"\n';
md += '- ruMatches / ruExclude regex patterns\n';

const reportMdPath = resolve(OUT_DIR, 'build-report.md');
writeFileSync(reportMdPath, md);
console.log('  build-report.md written');

// ================================================================
// Step 14: JSON Schemas
// ================================================================

// Token schema
const tokenSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'GreekToken',
  description: 'A single Greek word token from SBLGNT via MACULA',
  type: 'object',
  required: ['id', 'ref', 'bookId', 'chapter', 'verse', 'surface'],
  properties: {
    id: { type: 'string' },
    sourceId: { type: 'string' },
    lexemeId: { type: ['string', 'null'] },
    ref: { type: 'string', description: 'Canonical reference: "bookId chapter:verse"' },
    sourceRef: { type: 'string' },
    bookId: { type: 'string' },
    chapter: { type: 'integer' },
    verse: { type: 'integer' },
    tokenIndex: { type: ['integer', 'null'] },
    surface: { type: ['string', 'null'] },
    surfaceNfc: { type: ['string', 'null'] },
    surfaceSearch: { type: ['string', 'null'] },
    normalized: { type: ['string', 'null'] },
    lemma: { type: ['string', 'null'] },
    lemmaSearch: { type: ['string', 'null'] },
    strong: { type: 'array', items: { type: 'string' } },
    isFunctionWord: { type: 'boolean' },
  },
};

const lexemeSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'GreekLexeme',
  description: 'Aggregated lexeme record for a Greek lemma',
  type: 'object',
  required: ['id', 'lemma'],
  properties: {
    id: { type: 'string' },
    lemma: { type: 'string' },
    lemmaSearch: { type: 'string' },
    transliteration: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        system: { type: 'string' },
        verified: { type: 'boolean' },
      },
    },
    accent: {
      type: 'object',
      properties: {
        hasAccent: { type: 'boolean' },
        type: { type: ['string', 'null'] },
        grapheme: { type: ['string', 'null'] },
        graphemeIndex: { type: 'integer' },
        codePointIndex: { type: 'integer' },
      },
    },
    strong: { type: 'array', items: { type: 'string' } },
    pos: {
      type: 'object',
      properties: {
        categories: { type: 'array', items: { type: 'string' } },
        primary: { type: 'string' },
        labelRu: { type: ['string', 'null'] },
      },
    },
    isFunctionWord: { type: 'boolean' },
    frequency: {
      type: 'object',
      properties: {
        tokenCount: { type: 'integer' },
        verseCount: { type: 'integer' },
        rank: { type: 'integer' },
        denseRank: { type: 'integer' },
        coverage: { type: 'number' },
        coveragePercent: { type: 'number' },
        cumulativeCoverage: { type: 'number' },
      },
    },
    attestedForms: { type: 'array' },
    allRefs: { type: 'array', items: { type: 'string' } },
    allRefsCount: { type: 'integer' },
    firstRef: { type: ['string', 'null'] },
    autoSelectedRefs: { type: 'array' },
    semanticDomains: { type: 'array' },
    glossesEn: { type: 'array', items: { type: 'string' } },
    englishGlosses: { type: 'array', items: { type: 'string' } },
  },
};

const verseSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'GreekVerse',
  description: 'A reconstructed verse from SBLGNT TEI XML',
  type: 'object',
  required: ['ref', 'bookId', 'chapter', 'verse', 'text'],
  properties: {
    ref: { type: 'string' },
    bookId: { type: 'string' },
    chapter: { type: 'integer' },
    verse: { type: 'integer' },
    text: { type: 'string' },
    tokenIds: { type: 'array', items: { type: 'string' } },
  },
};

const reportSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'BuildReport',
  description: 'MACULA pipeline build report',
  type: 'object',
  properties: {
    generatedAt: { type: 'string' },
    summary: { type: 'object' },
    coverage: { type: 'object' },
    unknownValues: { type: 'object' },
    problems: { type: 'array', items: { type: 'string' } },
    sourceFiles: { type: 'object' },
  },
};

writeFileSync(resolve(OUT_DIR, 'schema', 'token.schema.json'), JSON.stringify(tokenSchema, null, 2));
writeFileSync(resolve(OUT_DIR, 'schema', 'lexeme.schema.json'), JSON.stringify(lexemeSchema, null, 2));
writeFileSync(resolve(OUT_DIR, 'schema', 'verse.schema.json'), JSON.stringify(verseSchema, null, 2));
writeFileSync(resolve(OUT_DIR, 'schema', 'build-report.schema.json'), JSON.stringify(reportSchema, null, 2));
console.log('\n  JSON schemas written');

// ================================================================
// Final summary
// ================================================================

console.log('\n=== Pipeline Complete ===');
console.log(`Tokens:     ${totalTokens}`);
console.log(`Verses:     ${totalVerses}`);
console.log(`Books:      ${totalBooks}/27`);
console.log(`Lemmas:     ${totalLemmas}`);
console.log(`Forms:      ${uniqueSurfaceForms}`);
console.log(`Output:     ${OUT_DIR}`);
console.log(`Problems:   ${problems.length}`);
if (problems.length > 0) {
  for (const p of problems) console.log(`  ⚠️  ${p}`);
}
console.log('');
