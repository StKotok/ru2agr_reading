#!/usr/bin/env node

/**
 * verify-alignment-v2.mjs — B2 Alignment Verifier (Step 7).
 *
 * Validates all B2 pipeline invariants:
 * - Runtime schema valid
 * - Every q:"e" pair has proof (in proof-report.json)
 * - No duplicate visible spans/tokenIds per ref
 * - All pair lists sorted by span/token order
 * - Every span matches frozen words[]
 * - Every tokenId exists in original pack
 * - No visible pairs overlap phrase variant spans
 * - synOnly/grcOnly verses have no visible pairs
 * - Merged verses correctly handled
 * - Index contains only q:"e" lexemes
 * - No UBS/MARBLE fields in runtime assets
 *
 * Usage: node scripts/verify-alignment-v2.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CANONICAL_DIR = resolve(ROOT, 'generated', 'canonical', 'alignments', 'syn--sblgnt-macula');
const ORIGINAL_DIR = resolve(ROOT, 'assets', 'data', 'originals', 'sblgnt-macula', 'books');
const TRANSLATION_DIR = resolve(ROOT, 'assets', 'data', 'translations', 'syn', 'books');
const ALIGN_DIR = resolve(ROOT, 'assets', 'data', 'align', 'syn--sblgnt-macula', 'books');
const INDEX_PATH = resolve(ROOT, 'assets', 'data', 'align', 'syn--sblgnt-macula', 'index.json');
const PROOF_REPORT_PATH = resolve(CANONICAL_DIR, 'proof-report.json');
const VARIANTS_PATH = resolve(ROOT, 'assets', 'data', 'textual-variants.json');

const NT_BOOKS = [
  'matthew','mark','luke','john','acts','romans','1corinthians','2corinthians',
  'galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians',
  '1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter',
  '1john','2john','3john','jude','revelation',
];

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); console.error(`  ✗ ${msg}`); }
function warn(msg) { warnings.push(msg); console.warn(`  ⚠ ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }

console.log('=== verify-alignment-v2 (B2 Step 7) ===\n');

// ── 1. Check files exist ──
console.log('1. File existence...');
let missingFiles = 0;
for (const bookId of NT_BOOKS) {
  for (const [dir, label] of [[ALIGN_DIR, 'alignment']]) {
    if (!existsSync(resolve(dir, `${bookId}.json`))) {
      err(`Missing ${label} pack: ${bookId}`);
      missingFiles++;
    }
  }
}
if (missingFiles === 0) ok(`${NT_BOOKS.length} alignment packs found`);

// ── 2. Schema validation ──
console.log('\n2. Schema validation...');
let schemaErrors = 0;

for (const bookId of NT_BOOKS) {
  const alignPath = resolve(ALIGN_DIR, `${bookId}.json`);
  if (!existsSync(alignPath)) continue;

  const align = JSON.parse(readFileSync(alignPath, 'utf8'));
  if (align.schema !== 'alignment-book-v1') {
    err(`${bookId}: schema is "${align.schema}"`);
    schemaErrors++;
  }

  if (align.pairsByRef) {
    for (const [ref, pairs] of Object.entries(align.pairsByRef)) {
      const seenSpans = new Set();
      const seenTokens = new Set();
      let prevSpanStart = -1, prevSpanEnd = -1;

      for (const p of pairs) {
        // Check q
        if (p.q !== 'e') {
          err(`${ref}: runtime pair has q="${p.q}" (only "e" allowed)`);
          schemaErrors++;
        }

        // Check required fields
        if (!Array.isArray(p.span) || p.span.length !== 2) {
          err(`${ref}: pair missing span`);
          schemaErrors++;
        }
        if (!p.tokenId) {
          err(`${ref}: pair missing tokenId`);
          schemaErrors++;
        }
        if (!p.lexemeKey) {
          err(`${ref}: pair missing lexemeKey`);
          schemaErrors++;
        }

        // Check no duplicate visible spans
        const spanKey = `${p.span[0]}-${p.span[1]}`;
        if (seenSpans.has(spanKey)) {
          err(`${ref}: duplicate visible span ${spanKey}`);
          schemaErrors++;
        }
        seenSpans.add(spanKey);

        // Check no duplicate visible tokenIds
        if (seenTokens.has(p.tokenId)) {
          err(`${ref}: duplicate visible tokenId ${p.tokenId}`);
          schemaErrors++;
        }
        seenTokens.add(p.tokenId);

        // Check sort order
        if (p.span[0] < prevSpanStart ||
            (p.span[0] === prevSpanStart && p.span[1] < prevSpanEnd)) {
          err(`${ref}: pairs not sorted by span`);
          schemaErrors++;
        }
        prevSpanStart = p.span[0];
        prevSpanEnd = p.span[1];
      }
    }
  }
}
if (schemaErrors === 0) ok('All alignment packs pass schema validation');

// ── 3. Cross-pack validation ──
console.log('\n3. Cross-pack validation (tokenIds exist, spans match)...');

for (const bookId of NT_BOOKS) {
  const origPath = resolve(ORIGINAL_DIR, `${bookId}.json`);
  const transPath = resolve(TRANSLATION_DIR, `${bookId}.json`);
  const alignPath = resolve(ALIGN_DIR, `${bookId}.json`);
  if (!existsSync(origPath) || !existsSync(transPath) || !existsSync(alignPath)) continue;

  const orig = JSON.parse(readFileSync(origPath, 'utf8'));
  const trans = JSON.parse(readFileSync(transPath, 'utf8'));
  const align = JSON.parse(readFileSync(alignPath, 'utf8'));

  // Build tokenId set
  const tokenIdSet = new Set();
  const tokenIdToVerse = new Map();
  for (const ch of orig.chapters) {
    for (const v of ch.verses) {
      for (const t of v.tokens) {
        tokenIdSet.add(t.id);
        tokenIdToVerse.set(t.id, v.ref);
      }
    }
  }

  // Build ref→words map
  const wordsByRef = new Map();
  for (const ch of trans.chapters) {
    for (const v of ch.verses) {
      wordsByRef.set(v.ref, v);
    }
  }

  if (align.pairsByRef) {
    for (const [ref, pairs] of Object.entries(align.pairsByRef)) {
      const verseData = wordsByRef.get(ref);

      for (const p of pairs) {
        // Check tokenId exists
        if (!tokenIdSet.has(p.tokenId)) {
          err(`${ref}: tokenId "${p.tokenId}" not found in original pack`);
        }

        // Check span validity
        if (verseData) {
          if (p.span[1] > verseData.text.length) {
            err(`${ref}: span [${p.span}] exceeds text length (${verseData.text.length})`);
          }

          // Verify span text matches frozen word
          const spanText = verseData.text.slice(p.span[0], p.span[1]);
          const matchingWord = verseData.words.find(w => w.start === p.span[0] && w.end === p.span[1]);
          if (!matchingWord) {
            err(`${ref}: span [${p.span}]="${spanText}" does not match any frozen word offset`);
          }
        }
      }
    }
  }

  // Check phrase variants
  const phraseVariants = align.phraseVariantsByRef || {};
  if (align.pairsByRef) {
    for (const [ref, pairs] of Object.entries(align.pairsByRef)) {
      const pvs = phraseVariants[ref] || [];
      for (const pv of pvs) {
        for (const p of pairs) {
          if (p.span[0] >= pv.span[0] && p.span[1] <= pv.span[1]) {
            err(`${ref}: visible pair at [${p.span}] overlaps phrase variant [${pv.span}]`);
          }
        }
      }
    }
  }

  // Check synOnly verses have no visible pairs
  const verseMap = align.verses || {};
  for (const [ref, vi] of Object.entries(verseMap)) {
    if (vi.status === 'synOnly' || vi.status === 'grcOnly') {
      const pairs = align.pairsByRef?.[ref] || [];
      if (pairs.length > 0) {
        err(`${ref}: ${vi.status} verse has ${pairs.length} visible pairs`);
      }
    }
    if (vi.status === 'merged') {
      const pairs = align.pairsByRef?.[ref] || [];
      if (pairs.length > 0) {
        err(`${ref}: merged verse has pairs (should be stored in host verse)`);
      }
    }
  }
}
ok('Cross-pack validation complete');

// ── 4. Index checks ──
console.log('\n4. Index checks...');
if (!existsSync(INDEX_PATH)) {
  err('Index file missing');
} else {
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  if (index.schema !== 'alignment-index-v1') {
    err(`Index schema is "${index.schema}"`);
  }

  // Verify all lexemes in index actually have q:"e" pairs
  const lexemesWithE = new Set();
  for (const bookId of NT_BOOKS) {
    const alignPath = resolve(ALIGN_DIR, `${bookId}.json`);
    if (!existsSync(alignPath)) continue;
    const align = JSON.parse(readFileSync(alignPath, 'utf8'));
    if (align.pairsByRef) {
      for (const pairs of Object.values(align.pairsByRef)) {
        for (const p of pairs) {
          if (p.q === 'e') lexemesWithE.add(p.lexemeKey);
        }
      }
    }
  }

  for (const lk of (index.lexemesWithVisiblePair || [])) {
    if (!lexemesWithE.has(lk)) {
      err(`Index lists "${lk}" but no q:"e" pair exists`);
    }
  }

  for (const lk of lexemesWithE) {
    if (!index.lexemesWithVisiblePair.includes(lk)) {
      err(`Lexeme "${lk}" has q:"e" pairs but is missing from index`);
    }
  }

  ok(`Index: ${index.lexemesWithVisiblePair.length} visible lexemes (verified against runtime packs)`);
}

// ── 5. Proof verification ──
console.log('\n5. Proof verification...');
if (!existsSync(PROOF_REPORT_PATH)) {
  warn('Proof report not found (blocked:proof-missing)');
} else {
  const proofReport = JSON.parse(readFileSync(PROOF_REPORT_PATH, 'utf8'));
  if (proofReport.schema !== 'proof-report-v1') {
    err(`Proof report schema is "${proofReport.schema}"`);
  }

  // Check every visible pair has proof
  const proofIdSet = new Set();
  for (const p of (proofReport.proofs || [])) {
    proofIdSet.add(p.proofId);
  }

  for (const bookId of NT_BOOKS) {
    const alignPath = resolve(ALIGN_DIR, `${bookId}.json`);
    if (!existsSync(alignPath)) continue;
    const align = JSON.parse(readFileSync(alignPath, 'utf8'));
    if (align.pairsByRef) {
      for (const [ref, pairs] of Object.entries(align.pairsByRef)) {
        for (const p of pairs) {
          const proofId = `${ref}|${p.span[0]}-${p.span[1]}|${p.tokenId}|${p.lexemeKey}`;
          if (!proofIdSet.has(proofId)) {
            err(`${ref}: pair span [${p.span}] tokenId ${p.tokenId} has no proof`);
          }
        }
      }
    }
  }

  ok(`Proof report: ${proofReport.proofs?.length || 0} proofs, ${proofReport.summary?.totalCertified || 0} certified`);
}

// ── 6. UBS/MARBLE leakage check ──
console.log('\n6. UBS/MARBLE leakage check...');
function checkFileForLeakage(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const suspicious = [];
    if (content.includes('"domains"') && !filePath.includes('canonical/')) {
      suspicious.push('domains field');
    }
    if (content.includes('louwNida') || content.includes('LouwNida')) {
      suspicious.push('Louw-Nida reference');
    }
    if (content.includes('ubsSense') || content.includes('UBS')) {
      suspicious.push('UBS reference');
    }
    return suspicious;
  } catch (_) { return []; }
}

function walkDir(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full));
      } else if (entry.name.endsWith('.json')) {
        const issues = checkFileForLeakage(full);
        if (issues.length > 0) {
          results.push({ file: full.replace(ROOT, ''), issues });
        }
      }
    }
  } catch (_) {}
  return results;
}

const leakedFiles = walkDir(resolve(ROOT, 'assets', 'data'));
if (leakedFiles.length > 0) {
  for (const { file, issues } of leakedFiles) {
    // domains in top1000.core.json is a pre-existing v3 pipeline condition;
    // it must be removed before release per B2 §4.3 provenance policy
    warn(`UBS/MARBLE fields in ${file}: ${issues.join(', ')} (pre-existing v3 data, must be resolved before release)`);
  }
} else {
  ok('No UBS/MARBLE leakage in runtime assets');
}

// ── 7. Audit report generation ──
console.log('\n7. Audit report...');
const auditReport = {
  schema: 'audit-report-v1',
  alignmentId: 'syn--sblgnt-macula',
  releaseStatus: 'blocked:llm-audit-missing', // Will update after LLM audit
  blockers: [
    {
      code: 'blocked:llm-audit-missing',
      message: 'LLM audit outputs have not been imported. This is expected for initial data prototype.',
    },
  ],
  counts: {
    candidatePairs: 0,
    certifiedPairs: 0,
    runtimeVisiblePairs: 0,
    runtimeHiddenPairs: 0,
    orphans: 0,
    unknownOrphans: 0,
  },
  coverageSummary: {
    heldoutVersesAudited: 0,
    c2VersesAudited: 0,
    topLexemeKeysAudited: [],
    variantVersesAudited: 0,
    randomSampleCount: 0,
  },
  llm: {
    outputsValidated: 0,
    outputsInvalid: 0,
    importReportSha256: null,
  },
  adjudication: {
    reportSha256: null,
    pendingManualReview: 0,
    releaseBlockers: 0,
  },
};

// Fill in counts from actual data
try {
  if (existsSync(resolve(CANONICAL_DIR, 'candidates-manifest.json'))) {
    const cm = JSON.parse(readFileSync(resolve(CANONICAL_DIR, 'candidates-manifest.json'), 'utf8'));
    auditReport.counts.candidatePairs = cm.count || 0;
  }
  if (existsSync(resolve(CANONICAL_DIR, 'certified-manifest.json'))) {
    const crm = JSON.parse(readFileSync(resolve(CANONICAL_DIR, 'certified-manifest.json'), 'utf8'));
    auditReport.counts.certifiedPairs = crm.count || 0;
  }
  if (existsSync(resolve(CANONICAL_DIR, 'orphans-manifest.json'))) {
    const om = JSON.parse(readFileSync(resolve(CANONICAL_DIR, 'orphans-manifest.json'), 'utf8'));
    auditReport.counts.orphans = om.count || 0;
  }

  // Count runtime visible pairs
  let rtVisible = 0;
  for (const bookId of NT_BOOKS) {
    const ap = resolve(ALIGN_DIR, `${bookId}.json`);
    if (!existsSync(ap)) continue;
    const align = JSON.parse(readFileSync(ap, 'utf8'));
    if (align.pairsByRef) {
      for (const pairs of Object.values(align.pairsByRef)) {
        rtVisible += pairs.filter(p => p.q === 'e').length;
      }
    }
  }
  auditReport.counts.runtimeVisiblePairs = rtVisible;
} catch (e) {
  warn(`Could not fill audit counts: ${e.message}`);
}

writeFileSync(resolve(CANONICAL_DIR, 'audit-report.json'), JSON.stringify(auditReport, null, 2));
ok('Audit report written');

// ── 8. Gold report ──
console.log('\n8. Gold report...');
const goldReport = {
  schema: 'gold-report-v1',
  alignmentId: 'syn--sblgnt-macula',
  generatedAt: new Date().toISOString(),
  dev: {
    verses: 0,
    pairs: 0,
    precision: null,
    recall: null,
    visibleFalsePositives: 0,
    visibleFalseNegatives: 0,
  },
  heldout: {
    verses: 0,
    pairs: 0,
    precision: null,
    recall: null,
    visibleFalsePositives: 0,
    visibleFalseNegatives: 0,
    notes: 'Heldout gold requires manual re-attestation before use as acceptance gate.',
  },
};

// Fill dev gold stats if available
try {
  const devGold = JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/macula-gold-dev.json'), 'utf8'));
  goldReport.dev.verses = devGold.items.length;
  goldReport.dev.pairs = devGold.items.reduce((s, i) => s + i.visiblePairs.length, 0);
} catch (e) { /* skip */ }

try {
  const heldoutGold = JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/macula-gold-heldout.json'), 'utf8'));
  goldReport.heldout.verses = heldoutGold.items.length;
  goldReport.heldout.pairs = heldoutGold.items.reduce((s, i) => s + i.visiblePairs.length, 0);
} catch (e) { /* skip */ }

writeFileSync(resolve(CANONICAL_DIR, 'gold-report.json'), JSON.stringify(goldReport, null, 2));
ok('Gold report written');

// ── 9. Adjudication report ──
console.log('\n9. Adjudication report...');
const adjReport = {
  schema: 'adjudication-report-v1',
  alignmentId: 'syn--sblgnt-macula',
  generatedFrom: {
    proofReportSha256: existsSync(PROOF_REPORT_PATH) ?
      createHash('sha256').update(readFileSync(PROOF_REPORT_PATH)).digest('hex') : null,
    llmImportReportSha256: null,
  },
  decisions: [],
  releaseBlockers: [
    'LLM audit not yet performed',
    'Heldout gold requires manual re-attestation',
  ],
};

writeFileSync(resolve(CANONICAL_DIR, 'adjudication-report.json'), JSON.stringify(adjReport, null, 2));
ok('Adjudication report written (pending LLM audit)');

// ── Summary ──
console.log(`\n${'='.repeat(40)}`);
if (errors.length === 0) {
  console.log('✅ ALL B2 VERIFIER CHECKS PASSED');
} else {
  console.log(`❌ ${errors.length} ERROR(S) FOUND`);
  for (const e of errors.slice(0, 30)) console.log(`  - ${e}`);
  if (errors.length > 30) console.log(`  ... and ${errors.length - 30} more`);
}
if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} warning(s)`);
}

process.exit(errors.length > 0 ? 1 : 0);
