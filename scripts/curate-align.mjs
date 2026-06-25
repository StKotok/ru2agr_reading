// scripts/curate-align.mjs
// Read-only кураторский инструмент для ручного выравнивания.
// Печатает контекст стиха с индексами слов и кандидатами.
//
// Использование:
//   node scripts/curate-align.mjs "john 1:1" [tokenId]
//   node scripts/curate-align.mjs --top 50

import { readDataJson, DATA_ROOT } from './lib/fs.mjs';
import { normalizeWord, normalizeBerean } from './lib/align-normalize.mjs';
import { readFileSync } from 'node:fs';
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

function parseRef(ref) {
  const m = ref.match(/^(\d?\s?\w+)\s+(\d+):(\d+)$/i);
  if (!m) return null;
  return { bookId: m[1].toLowerCase().replace(/\s/g, ''), ch: parseInt(m[2]), vs: parseInt(m[3]) };
}

function loadVerse(ref) {
  const parsed = parseRef(ref);
  if (!parsed) return null;

  // Map common book names to bookIds
  const bookId = parsed.bookId;
  if (!NT_BOOKS.includes(bookId)) return null;

  try {
    const eng = readDataJson(`bibles/eng/${bookId}.json`);
    const grc = readDataJson(`bibles/grc/${bookId}.json`);

    let engVerse = null;
    for (const ch of eng.chapters) {
      if (ch.n !== parsed.ch) continue;
      for (const vs of ch.verses) {
        if (vs.n === parsed.vs) { engVerse = vs; break; }
      }
    }

    let grcVerse = null;
    let prevGrcVerse = null, nextGrcVerse = null;
    for (let ci = 0; ci < grc.chapters.length; ci++) {
      const ch = grc.chapters[ci];
      if (ch.n !== parsed.ch) continue;
      for (let vi = 0; vi < ch.verses.length; vi++) {
        const vs = ch.verses[vi];
        if (vs.n === parsed.vs) {
          grcVerse = vs;
          if (vi > 0) prevGrcVerse = ch.verses[vi - 1];
          if (vi < ch.verses.length - 1) nextGrcVerse = ch.verses[vi + 1];
        }
      }
    }

    return { bookId, eng: engVerse, grc: grcVerse, prevGrc: prevGrcVerse, nextGrc: nextGrcVerse };
  } catch (e) {
    console.error(`Error loading ${ref}: ${e.message}`);
    return null;
  }
}

function printContext(ref, tokenId) {
  const data = loadVerse(ref);
  if (!data) {
    console.error(`Verse ${ref} not found`);
    return;
  }

  const { bookId, eng, grc, prevGrc, nextGrc } = data;

  if (!eng) {
    console.error(`Eng verse ${ref} not found (may be in no-bsb-verse list)`);
    if (grc) {
      console.log('\nGreek tokens in this verse:');
      for (const t of grc.tokens) {
        const fw = t.fw ? 'FW' : 'NF';
        console.log(`  [${t.i}] ${t.lemma} (${t.glossBerean || '-'} / ${t.glossCherith || '-'}) ${fw} id=${t.id}`);
      }
    }
    return;
  }

  console.log(`\n=== ${ref} ===`);
  console.log(`Book: ${bookId}`);

  // Print context (previous verse)
  if (prevGrc) {
    const prevText = prevGrc.tokens.map(t => t.s).join('');
    console.log(`\n[Prev grc] ${prevGrc.ref}: ${prevText.slice(0, 100)}`);
  }

  // Print English text with word indices
  console.log(`\n--- BSB English (word indices) ---`);
  console.log(eng.text);
  console.log();
  for (const w of eng.words) {
    process.stdout.write(`[${w.i}]${w.text} `);
  }
  console.log('\n');

  // Print Greek tokens table
  console.log(`--- Greek tokens (${grc.tokens.length} total) ---`);
  console.log(' i  | lemma              | glossBerean         | glossCherith        | fw   | tokenId');
  console.log('----|--------------------|---------------------|---------------------|------|----------');
  for (const t of grc.tokens) {
    const lemma = (t.lemma || '').padEnd(18).slice(0, 18);
    const gB = (t.glossBerean || '-').padEnd(20).slice(0, 20);
    const gC = (t.glossCherith || '-').padEnd(20).slice(0, 20);
    const fw = t.fw ? 'FW' : 'NF ';
    console.log(` ${String(t.i).padEnd(3)}| ${lemma} | ${gB} | ${gC} | ${fw} | ${t.id}`);
  }

  // If tokenId specified, find candidates
  if (tokenId) {
    const token = grc.tokens.find(t => t.id === tokenId);
    if (!token) {
      console.error(`\nToken ${tokenId} not found in ${ref}`);
      return;
    }
    console.log(`\n--- Candidates for token ${tokenId} (lemma: ${token.lemma}) ---`);
    console.log(`glossBerean: "${token.glossBerean}"`);
    console.log(`glossCherith: "${token.glossCherith}"`);

    const normBerean = normalizeWord(token.glossBerean || '');
    const normCherith = normalizeWord(token.glossCherith || '');
    const normBereanBracket = normalizeWord(normalizeBerean(token.glossBerean || ''));

    console.log(`\nMatching BSB words:`);
    for (const w of eng.words) {
      const nw = normalizeWord(w.text);
      const matches = [];
      if (nw === normBerean) matches.push('exact(Berean)');
      if (nw === normCherith) matches.push('exact(Cherith)');
      if (nw === normBereanBracket) matches.push('bracket(Berean)');

      if (matches.length > 0) {
        console.log(`  word[${w.i}] "${w.text}" → ${matches.join(', ')}`);
      }
    }

    // Check if token already has a pair
    try {
      const align = readDataJson(`align/grc-eng/${bookId}.json`);
      const pairs = align.pairsByRef?.[ref] || [];
      const existingPair = pairs.find(p => p.tokenId === tokenId);
      if (existingPair) {
        const slice = eng.text.slice(existingPair.span[0], existingPair.span[1]);
        console.log(`\nAlready paired: span=[${existingPair.span[0]},${existingPair.span[1]}] "${slice}" method=${existingPair.method} q=${existingPair.q}`);
      }
    } catch (e) { /* no align file yet */ }
  }

  // Print next verse context
  if (nextGrc) {
    const nextText = nextGrc.tokens.map(t => t.s).join('');
    console.log(`\n[Next grc] ${nextGrc.ref}: ${nextText.slice(0, 100)}`);
  }
}

function printTopN(n) {
  try {
    const report = readDataJson('align/grc-eng/build-report.json');
    const top = report.topUnalignedLexemes || [];

    if (top.length === 0) {
      console.log('No topUnalignedLexemes in build-report. Run build:data first.');
      return;
    }

    console.log(`\n=== Top ${Math.min(n, top.length)} Unaligned Lexemes ===\n`);
    for (let i = 0; i < Math.min(n, top.length); i++) {
      const item = top[i];
      const refs = (item.sampleRefs || []).slice(0, 3).join(', ');
      const candInfo = item.candidateCount != null ? ` (candidates: ${item.candidateCount})` : '';
      console.log(`${i + 1}. ${item.lexemeId} "${item.gloss}" — ${item.count} occurrences${candInfo}`);
      if (refs) console.log(`   refs: ${refs}`);
    }
  } catch (e) {
    console.error(`Cannot read build-report: ${e.message}`);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/curate-align.mjs <ref> [tokenId]');
  console.log('       node scripts/curate-align.mjs --top <N>');
  console.log();
  console.log('Examples:');
  console.log('  node scripts/curate-align.mjs "john 1:1"');
  console.log('  node scripts/curate-align.mjs "john 1:1" n43001001001');
  console.log('  node scripts/curate-align.mjs --top 50');
  process.exit(0);
}

if (args[0] === '--top') {
  const n = parseInt(args[1]) || 50;
  printTopN(n);
} else {
  const ref = args[0];
  const tokenId = args[1] || null;
  printContext(ref, tokenId);
}
