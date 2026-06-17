#!/usr/bin/env node

/**
 * build-alignment-candidates.mjs — B2 Candidate Generator (Step 2).
 *
 * Generates all alignment candidates as q:"u" (hidden).
 * Also writes orphan records for unmatched Russian words.
 *
 * Candidate sources:
 *   cand:ru-core-regex       — ruMatches from curated RU core
 *   cand:ru-strong-aggregate — weak candidates from strongs-ru-alignment.json
 *
 * Output:
 *   generated/canonical/alignments/syn--sblgnt-macula/candidates.jsonl
 *   generated/canonical/alignments/syn--sblgnt-macula/orphans.jsonl
 *   generated/canonical/alignments/syn--sblgnt-macula/candidates-manifest.json
 *   generated/canonical/alignments/syn--sblgnt-macula/orphans-manifest.json
 *
 * Usage: node scripts/build-alignment-candidates.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TRANSLATION_DIR = resolve(ROOT, 'assets', 'data', 'translations', 'syn', 'books');
const ORIGINAL_DIR = resolve(ROOT, 'assets', 'data', 'originals', 'sblgnt-macula', 'books');
const CORE_PATH = resolve(ROOT, 'assets', 'data', 'lexicon', 'locales', 'ru', 'core.json');
const VARIANTS_PATH = resolve(ROOT, 'assets', 'data', 'textual-variants.json');
const STRONG_AGG_PATH = resolve(ROOT, 'data-sources', 'strongs-ru-alignment.json');

const CANONICAL_DIR = resolve(ROOT, 'generated', 'canonical', 'alignments', 'syn--sblgnt-macula');
const CANDIDATES_PATH = resolve(CANONICAL_DIR, 'candidates.jsonl');
const ORPHANS_PATH = resolve(CANONICAL_DIR, 'orphans.jsonl');
const CAND_MANIFEST_PATH = resolve(CANONICAL_DIR, 'candidates-manifest.json');
const ORPH_MANIFEST_PATH = resolve(CANONICAL_DIR, 'orphans-manifest.json');

const NT_BOOKS = [
  'matthew','mark','luke','john','acts','romans','1corinthians','2corinthians',
  'galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians',
  '1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter',
  '1john','2john','3john','jude','revelation',
];

const BOOK_SHORT = {
  matthew:'Мф', mark:'Мк', luke:'Лк', john:'Ин', acts:'Деян', romans:'Рим',
  '1corinthians':'1Кор','2corinthians':'2Кор', galatians:'Гал', ephesians:'Еф',
  philippians:'Флп', colossians:'Кол','1thessalonians':'1Фес','2thessalonians':'2Фес',
  '1timothy':'1Тим','2timothy':'2Тим', titus:'Тит', philemon:'Флм', hebrews:'Евр',
  james:'Иак','1peter':'1Пет','2peter':'2Пет','1john':'1Ин','2john':'2Ин','3john':'3Ин',
  jude:'Иуд', revelation:'Откр',
};

// Blocker enum from spec
const BLOCKERS = {
  WEAK_SOURCE: 'weak-source:no-position-data',
  AMBIG_RU_SPANS: 'ambiguous:multiple-russian-spans',
  AMBIG_GR_TOKENS: 'ambiguous:multiple-greek-tokens',
  AMBIG_COMPETING_SPAN: 'ambiguous:competing-candidate-for-span',
  AMBIG_COMPETING_TOKEN: 'ambiguous:competing-candidate-for-token',
  VARIANT_PHRASE: 'variant:phrase-span',
  VARIANT_UNKNOWN: 'variant:unknown-span-status',
  VARIANT_SYN_ONLY: 'variant:syn-only-verse',
  VARIANT_GRC_ONLY: 'variant:grc-only-verse',
  FUNC_WORD: 'function-word:hidden-in-v2',
  MORPH_INCOMPATIBLE: 'morph:incompatible',
  LICENSE: 'source:license-not-cleared',
  PROOF_MISSING: 'proof:missing',
};

function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

console.log('=== build-alignment-candidates (B2 Step 2) ===\n');

// ── Load core overlay ──
const coreOverlay = JSON.parse(readFileSync(CORE_PATH, 'utf8'));
const ruMatchesByKey = new Map();
const ruExcludeByKey = new Map();
const curatedKeys = new Set();
for (const item of coreOverlay.items) {
  curatedKeys.add(item.lexemeKey);
  if (item.ruMatches && item.ruMatches.length > 0) {
    ruMatchesByKey.set(item.lexemeKey, item.ruMatches);
  }
  if (item.ruExclude && item.ruExclude.length > 0) {
    ruExcludeByKey.set(item.lexemeKey, item.ruExclude);
  }
}
console.log(`Core overlay: ${coreOverlay.items.length} entries, ${ruMatchesByKey.size} with ruMatches`);

// ── Load strongs-ru-alignment (weak source) ──
let strongAggByWord = new Map(); // normalized word → [{strong, weight}]
try {
  const strongAgg = JSON.parse(readFileSync(STRONG_AGG_PATH, 'utf8'));
  // The file is an array of entries with structure like { ru_primary, ru_top_words, strong, count }
  if (Array.isArray(strongAgg)) {
    for (const entry of strongAgg) {
      if (!entry.strong) continue;
      const words = [];
      if (entry.ru_primary) words.push(entry.ru_primary.toLowerCase());
      if (entry.ru_top_words && Array.isArray(entry.ru_top_words)) {
        for (const w of entry.ru_top_words) words.push(w.toLowerCase());
      }
      for (const w of words) {
        if (!strongAggByWord.has(w)) strongAggByWord.set(w, new Map());
        const inner = strongAggByWord.get(w);
        // Strong values in strongs-ru-alignment.json are numbers, but in packs they are strings
        const strongStr = String(entry.strong);
        inner.set(strongStr, (inner.get(strongStr) || 0) + (entry.count || 1));
      }
    }
  }
  console.log(`Strong aggregate: ${strongAggByWord.size} unique words → Strong mappings`);
} catch (e) {
  console.log(`  ⚠ strongs-ru-alignment.json not loaded: ${e.message}`);
}

// ── Load textual variants ──
const variants = JSON.parse(readFileSync(VARIANTS_PATH, 'utf8'));

const synOnlySet = new Set();
for (const v of variants.synOnlyVerses) {
  synOnlySet.add(`${v.book} ${v.ch}:${v.v}`);
}

const grcOnlySet = new Set();
for (const v of (variants.grcOnlyVerses || [])) {
  grcOnlySet.add(`${v.book} ${v.ch}:${v.v}`);
}

// Merged verses
const MERGED_VERSES = {
  '2corinthians 11:33': { syn: '11:32b', grc: '11:33', status: 'merged' },
};
if (variants.mergedVerses) {
  for (const v of variants.mergedVerses) {
    MERGED_VERSES[`${v.book} ${v.ch}:${v.v}`] = {
      syn: v.syn, grc: v.grc, status: 'merged',
    };
  }
}

// Phrase variants by ref
const phraseVariantsByRef = {};
for (const pv of variants.synOnlyPhrases) {
  if (!phraseVariantsByRef[pv.ref]) phraseVariantsByRef[pv.ref] = [];
  phraseVariantsByRef[pv.ref].push(pv);
}

// ── Open output streams ──
mkdirSync(CANONICAL_DIR, { recursive: true });
const candStream = createWriteStream(CANDIDATES_PATH);
const orphStream = createWriteStream(ORPHANS_PATH);

let totalCandidates = 0;
let totalOrphans = 0;
let totalFromCore = 0;
let totalFromStrong = 0;

function emitCandidate(rec) {
  candStream.write(JSON.stringify(rec) + '\n');
  totalCandidates++;
}

function emitOrphan(rec) {
  orphStream.write(JSON.stringify(rec) + '\n');
  totalOrphans++;
}

// ── Process each book ──
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

  // Build verse lookups
  const synVerses = new Map();   // ref → verse
  const grcVerses = new Map();   // ref → verse
  for (const ch of synPack.chapters) {
    for (const v of ch.verses) synVerses.set(v.ref, v);
  }
  for (const ch of grcPack.chapters) {
    for (const v of ch.verses) grcVerses.set(v.ref, v);
  }

  // Determine verse statuses
  const verseStatuses = {}; // ref → status/merged info
  for (const [ref] of synVerses) {
    const parts = ref.split(' ');
    const bk = parts[0];
    const [ch, v] = parts[1].split(':').map(Number);

    if (synOnlySet.has(ref)) {
      verseStatuses[ref] = { status: 'synOnly' };
      continue;
    }

    const mergeKey = `${bk} ${ch}:${v}`;
    if (MERGED_VERSES[mergeKey]) {
      verseStatuses[ref] = { status: 'merged', ...MERGED_VERSES[mergeKey] };
      continue;
    }

    if (grcVerses.has(ref)) {
      verseStatuses[ref] = { status: 'paired' };
    } else {
      verseStatuses[ref] = { status: 'synOnly' };
    }
  }

  // Handle grc-only verses
  for (const [ref] of grcVerses) {
    if (verseStatuses[ref]) continue;
    if (MERGED_VERSES[ref]) {
      verseStatuses[ref] = { status: 'merged', ...MERGED_VERSES[ref] };
      continue;
    }
    if (grcOnlySet.has(ref)) {
      verseStatuses[ref] = { status: 'grcOnly' };
    } else {
      verseStatuses[ref] = { status: 'paired' };
    }
  }

  // Build merged Greek tokens lookup: host syn ref → additional Greek tokens
  const mergedGrcBySynRef = new Map();
  for (const [grcRef, info] of Object.entries(verseStatuses)) {
    if (info.status !== 'merged') continue;
    const parts = grcRef.split(' ');
    const grcBook = parts[0];
    const grcChV = info.syn;
    const grcCh = grcChV.replace(/[a-z]$/, '');
    const synRef = `${grcBook} ${grcCh}`;
    if (!mergedGrcBySynRef.has(synRef)) mergedGrcBySynRef.set(synRef, []);
    mergedGrcBySynRef.get(synRef).push(grcRef);
  }

  // Process verses
  for (const [ref, synVerse] of synVerses) {
    const vStatus = verseStatuses[ref];
    if (!vStatus || vStatus.status === 'synOnly' || vStatus.status === 'grcOnly') {
      // Emit orphans for synOnly verses
      if (vStatus?.status === 'synOnly') {
        for (const w of synVerse.words) {
          if (/^[.,;:!?…—\-"'«»()\[\]{}„"0-9\s]+$/.test(w.text)) continue;
          emitOrphan({
            schema: 'alignment-orphan-v1',
            ref,
            span: [w.start, w.end],
            ruText: w.text,
            wordIndex: w.i,
            reason: 'textual-variant',
            blockers: [BLOCKERS.VARIANT_SYN_ONLY],
            candidateCount: 0,
            createdBy: 'scripts/build-alignment-candidates.mjs',
          });
        }
      }
      continue;
    }

    const synWords = synVerse.words;
    const verseText = synVerse.text;

    // Get Greek tokens (including merged)
    let grcTokens = [];
    const directGrc = grcVerses.get(ref);
    if (directGrc) grcTokens = directGrc.tokens;
    const mergedRefs = mergedGrcBySynRef.get(ref);
    if (mergedRefs) {
      for (const grcRef of mergedRefs) {
        const mergedGrc = grcVerses.get(grcRef);
        if (mergedGrc) grcTokens = grcTokens.concat(mergedGrc.tokens);
      }
    }

    if (grcTokens.length === 0 || synWords.length === 0) continue;

    // Build Greek token lookups
    const grcByLexemeKey = new Map();
    const grcByStrong = new Map();
    for (const t of grcTokens) {
      if (t.lexemeKey) {
        if (!grcByLexemeKey.has(t.lexemeKey)) grcByLexemeKey.set(t.lexemeKey, []);
        grcByLexemeKey.get(t.lexemeKey).push(t);
      }
      if (t.strongs) {
        for (const s of t.strongs) {
          if (!grcByStrong.has(s)) grcByStrong.set(s, []);
          grcByStrong.get(s).push(t);
        }
      }
    }

    // Phrase variant word indices (should not produce candidates)
    const variantWordIndices = new Set();
    const pvsForRef = phraseVariantsByRef[ref] || [];
    for (const pv of pvsForRef) {
      const fromIdx = pv.fromIdx || 0;
      const toIdx = Math.min(fromIdx + (pv.ruWords?.length || 0), synWords.length);
      for (let wi = fromIdx; wi < toIdx; wi++) variantWordIndices.add(wi);
    }

    // Process each Russian word
    for (const w of synWords) {
      const ruWord = w.text.toLowerCase();

      // Skip punctuation
      if (ruWord.length === 0 || /^[.,;:!?…—\-"'«»()\[\]{}«»„"0-9\s]+$/.test(ruWord)) {
        continue;
      }

      const span = [w.start, w.end];

      // Skip words in phrase variant spans
      if (variantWordIndices.has(w.i)) {
        emitOrphan({
          schema: 'alignment-orphan-v1',
          ref,
          span,
          ruText: w.text,
          wordIndex: w.i,
          reason: 'textual-variant',
          blockers: [BLOCKERS.VARIANT_PHRASE],
          candidateCount: 0,
          createdBy: 'scripts/build-alignment-candidates.mjs',
        });
        continue;
      }

      let foundCandidate = false;

      // ── Source 1: cand:ru-core-regex ──
      const matchedKeys = new Set();
      for (const [lexemeKey, patterns] of ruMatchesByKey) {
        for (const pat of patterns) {
          try {
            const re = new RegExp(pat, 'i');
            if (re.test(ruWord)) {
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
              if (!excluded) matchedKeys.add(lexemeKey);
              break;
            }
          } catch (_) { /* ignore bad regex */ }
        }
      }

      // Emit candidates for each matched lexemeKey
      for (const lk of matchedKeys) {
        const grcCandidates = grcByLexemeKey.get(lk);
        if (!grcCandidates || grcCandidates.length === 0) continue;

        const reasons = [];
        const blockers = [];

        // Check Russian multiplicity
        let ruMatchesForLexeme = 0;
        for (const w2 of synWords) {
          if (variantWordIndices.has(w2.i)) continue;
          const w2lower = w2.text.toLowerCase();
          for (const pat of (ruMatchesByKey.get(lk) || [])) {
            try {
              const re = new RegExp(pat, 'i');
              if (re.test(w2lower)) {
                const excludes = ruExcludeByKey.get(lk) || [];
                let ex = false;
                for (const exPat of excludes) {
                  try {
                    if (new RegExp(`^${exPat}$`, 'i').test(w2lower)) { ex = true; break; }
                  } catch (_) {}
                }
                if (!ex) ruMatchesForLexeme++;
                break;
              }
            } catch (_) {}
          }
        }

        if (ruMatchesForLexeme > 1) {
          blockers.push(BLOCKERS.AMBIG_RU_SPANS);
        }

        // Check Greek multiplicity
        if (grcCandidates.length > 1) {
          blockers.push(BLOCKERS.AMBIG_GR_TOKENS);
        }

        // For each matching Greek token, emit a candidate (with cursor tracking:
        // we consume each Greek token only once for a given lexemeKey in order)
        // But candidates are q:"u" and we can have multiple candidates per span.
        // We emit one candidate per matching Greek token position, with monotonic cursor.
        // Use a simple approach: one primary candidate per (span, lexemeKey) with all blockers.
        // Additional Greek tokens become separate candidates.
        let grIdx = 0;
        for (const grToken of grcCandidates) {
          // Determine per-token blockers
          const tokenBlockers = [...blockers];
          const isFunc = grToken.fw === true;
          const morph = grToken.morph || '';

          if (isFunc || /^(T|R|C|D|I|X|PREP|CONJ|PRT|ADV|COND|INJ|P-|F-|K-|Q-|S-)/.test(morph)) {
            tokenBlockers.push(BLOCKERS.FUNC_WORD);
          }

          const candidate = {
            schema: 'alignment-candidate-v1',
            ref,
            span,
            ruText: w.text,
            tokenId: grToken.id,
            tokenIndex: grToken.i,
            grText: grToken.s,
            lexemeKey: lk,
            q: 'u',
            src: 'cand:ru-core-regex',
            candidateReasons: reasons.length > 0 ? reasons : [`ruMatches: /${(ruMatchesByKey.get(lk) || ['?'])[0].substring(0, 30)}/`],
            blockers: tokenBlockers,
            createdBy: 'scripts/build-alignment-candidates.mjs',
          };
          emitCandidate(candidate);
          foundCandidate = true;
          totalFromCore++;
          grIdx++;
        }
      }

      // ── Source 2: cand:ru-strong-aggregate (weak) ──
      if (!foundCandidate && strongAggByWord.size > 0) {
        const aggEntries = strongAggByWord.get(ruWord);
        if (aggEntries) {
          for (const [strong, weight] of aggEntries) {
            const grcTokensForStrong = grcByStrong.get(strong);
            if (!grcTokensForStrong || grcTokensForStrong.length === 0) continue;

            for (const grToken of grcTokensForStrong) {
              const candidate = {
                schema: 'alignment-candidate-v1',
                ref,
                span,
                ruText: w.text,
                tokenId: grToken.id,
                tokenIndex: grToken.i,
                grText: grToken.s,
                lexemeKey: grToken.lexemeKey,
                q: 'u',
                src: 'cand:ru-strong-aggregate',
                candidateReasons: [`strongMatches: ${strong} (weight=${weight})`],
                blockers: [BLOCKERS.WEAK_SOURCE],
                createdBy: 'scripts/build-alignment-candidates.mjs',
              };
              emitCandidate(candidate);
              foundCandidate = true;
              totalFromStrong++;
            }
          }
        }
      }

      // ── Orphan if no candidate found ──
      if (!foundCandidate) {
        // Determine reason
        let reason = 'not-in-curated-core';
        const orphBlockers = [];
        // Check if it looks like a function word
        if (/^(и|в|на|с|к|от|из|по|до|за|у|о|об|не|ни|но|а|да|же|ли|бы|то|что|как|так|для|при|под|над|без|перед|чрез|ради|или|если|когда|потому|потом|теперь|уже|ещё|вот|там|здесь|тут|где|куда|откуда|всегда|очень|более|менее|только|даже|ведь|будто|словно|точно|почти|вдруг|опять|снова|тоже|также)$/i.test(ruWord)) {
          reason = 'function-word-hidden';
          orphBlockers.push(BLOCKERS.FUNC_WORD);
        }

        emitOrphan({
          schema: 'alignment-orphan-v1',
          ref,
          span,
          ruText: w.text,
          wordIndex: w.i,
          reason,
          blockers: orphBlockers,
          candidateCount: 0,
          createdBy: 'scripts/build-alignment-candidates.mjs',
        });
      }
    }

    // cand count already tracked via emitCandidate
  }

  console.log(`  ${BOOK_SHORT[bookId] || bookId}: ${synVerses.size} verses`);
}

// ── Close streams ──
candStream.end();
orphStream.end();

// Wait for streams to finish
await new Promise(resolve => {
  candStream.on('finish', resolve);
});

console.log(`\nTotal candidates: ${totalCandidates} (core: ${totalFromCore}, strong-agg: ${totalFromStrong})`);
console.log(`Total orphans: ${totalOrphans}`);

// ── Write manifests ──
const candContent = readFileSync(CANDIDATES_PATH, 'utf8');
const orphContent = readFileSync(ORPHANS_PATH, 'utf8');

const candManifest = {
  schema: 'candidates-manifest-v1',
  alignmentId: 'syn--sblgnt-macula',
  path: 'candidates.jsonl',
  count: totalCandidates,
  sha256: sha256(candContent),
  generatedAt: new Date().toISOString(),
};
writeFileSync(CAND_MANIFEST_PATH, JSON.stringify(candManifest, null, 2));

const orphManifest = {
  schema: 'orphans-manifest-v1',
  alignmentId: 'syn--sblgnt-macula',
  path: 'orphans.jsonl',
  count: totalOrphans,
  sha256: sha256(orphContent),
  generatedAt: new Date().toISOString(),
};
writeFileSync(ORPH_MANIFEST_PATH, JSON.stringify(orphManifest, null, 2));

console.log('Manifests written.');
console.log('Done.');
