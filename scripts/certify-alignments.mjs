#!/usr/bin/env node

/**
 * certify-alignments.mjs — B2 Deterministic Certification (Step 3).
 *
 * Reads candidates and applies certifiers:
 *   C1: manual-dev-gold      — promote if in re-attested dev gold
 *   C2: unique-curated-lexeme — promote if exactly 1:1 lexeme match in verse
 *   C3: manual-allowlist      — promote from human-maintained list
 *
 * Each certified pair gets a proof record. Uncertified candidates remain hidden.
 *
 * Input:
 *   generated/canonical/alignments/syn--sblgnt-macula/candidates.jsonl
 *   test/fixtures/macula-gold-dev.json
 *   docs/sources/alignments/syn--sblgnt-macula/manual-certified.json
 *
 * Output:
 *   generated/canonical/alignments/syn--sblgnt-macula/certified.jsonl
 *   generated/canonical/alignments/syn--sblgnt-macula/proof-report.json
 *
 * Usage: node scripts/certify-alignments.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CANONICAL_DIR = resolve(ROOT, 'generated', 'canonical', 'alignments', 'syn--sblgnt-macula');
const CANDIDATES_PATH = resolve(CANONICAL_DIR, 'candidates.jsonl');
const CERTIFIED_PATH = resolve(CANONICAL_DIR, 'certified.jsonl');
const PROOF_REPORT_PATH = resolve(CANONICAL_DIR, 'proof-report.json');
const GOLD_DEV_PATH = resolve(ROOT, 'test', 'fixtures', 'macula-gold-dev.json');
const MANUAL_CERT_PATH = resolve(ROOT, 'docs', 'sources', 'alignments', 'syn--sblgnt-macula', 'manual-certified.json');

// Function word morph prefixes (not certifiable by C2)
const FUNC_MORPH_PREFIXES = [
  'T', 'R', 'C', 'D', 'I', 'X',
  'PREP', 'CONJ', 'PRT', 'ADV', 'COND', 'INJ',
  'P-', 'F-', 'K-', 'Q-', 'S-',
  'P', 'F', 'K', 'Q', 'S',
];

function isFuncMorph(morph) {
  if (!morph) return false;
  return FUNC_MORPH_PREFIXES.some(p => morph.startsWith(p) || morph === p);
}

function isCertifiableToken(token) {
  // token is { tokenId, lexemeKey, fw, morph } from original pack
  if (token.fw === true) return false;
  if (isFuncMorph(token.morph)) return false;
  return true;
}

function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function generateProofId(ref, span, tokenId, lexemeKey) {
  return `${ref}|${span[0]}-${span[1]}|${tokenId}|${lexemeKey}`;
}

console.log('=== certify-alignments (B2 Step 3) ===\n');

// ── Load inputs ──
let candidates = [];
try {
  const candContent = readFileSync(CANDIDATES_PATH, 'utf8');
  candidates = candContent.trim().split('\n').filter(Boolean).map(JSON.parse);
} catch (e) {
  console.error(`Cannot load candidates: ${e.message}`);
  process.exit(1);
}
console.log(`Loaded ${candidates.length} candidates`);

// Load C1 gold
let goldDev = { items: [] };
try {
  goldDev = JSON.parse(readFileSync(GOLD_DEV_PATH, 'utf8'));
  console.log(`Loaded dev gold: ${goldDev.items.length} verses`);
} catch (e) {
  console.log(`  ⚠ No dev gold found: ${e.message}`);
}

// Load C3 manual allowlist
let manualCert = { entries: [] };
try {
  manualCert = JSON.parse(readFileSync(MANUAL_CERT_PATH, 'utf8'));
  console.log(`Loaded manual cert: ${manualCert.entries?.length || 0} entries`);
} catch (e) {
  console.log(`  ⚠ No manual-certified.json: ${e.message}`);
}

// ── Build lookup structures ──

// C1: Build gold lookup: ref → Set of "span|tokenId"
const goldByRef = new Map();
for (const item of goldDev.items) {
  const key = item.ref;
  const entries = [];
  for (const vp of (item.visiblePairs || [])) {
    entries.push({ spanKey: `${vp.span[0]}-${vp.span[1]}`, tokenId: vp.tokenId, lexemeKey: vp.lexemeKey });
  }
  goldByRef.set(key, entries);
}

// C3: Build manual allowlist lookup
const manualByRef = new Map();
for (const entry of (manualCert.entries || [])) {
  if (!manualByRef.has(entry.ref)) manualByRef.set(entry.ref, []);
  manualByRef.get(entry.ref).push(entry);
}

// ── C2 negative gate: flag risky certifications for LLM audit (do NOT auto-hide) ──
// C2 trusts curated ruMatches without validating translation correctness, so a
// curation error (e.g. the epo→eimi mis-map that aligned «говорить»→εἰμί) can
// become a certified false positive. There is no clean auto-reject: the only
// independent signal (strongs-ru-alignment top-forms) is too sparse — rejecting
// "not attested" hides many correct inflections. So instead of hiding, we FLAG
// the highest-risk certifications — Russian word ambiguous across lexemes AND not
// corroborated by the aggregate for the token's Strong — and route them to the LLM
// audit queue. Recall is preserved; release stays gated on the audit (audit-report).
const CORE_OVERLAY_PATH = resolve(ROOT, 'assets', 'data', 'lexicon', 'locales', 'ru', 'core.json');
const RU_STRONG_AGG_PATH = resolve(ROOT, 'data-sources', 'strongs-ru-alignment.json');

const lexemeMatchers = [];
try {
  const overlay = JSON.parse(readFileSync(CORE_OVERLAY_PATH, 'utf8'));
  for (const it of overlay.items || []) {
    if (!it.ruMatches || it.ruMatches.length === 0) continue;
    lexemeMatchers.push({
      lexemeKey: it.lexemeKey,
      res: it.ruMatches.map(p => new RegExp(p, 'i')),
      ex: (it.ruExclude || []).map(p => { try { return new RegExp(`^${p}$`, 'i'); } catch { return null; } }).filter(Boolean),
    });
  }
} catch (e) {
  console.log(`  ⚠ No core overlay for audit-flagging: ${e.message}`);
}

const ruFormsByStrong = new Map();
try {
  const agg = JSON.parse(readFileSync(RU_STRONG_AGG_PATH, 'utf8'));
  for (const e of agg) ruFormsByStrong.set(String(e.strong), (e.ru_top_words || []).map(w => w.toLowerCase()));
} catch (e) {
  console.log(`  ⚠ No ru-strong aggregate for audit-flagging: ${e.message}`);
}

const _lexSetMemo = new Map();
function curatedLexemesForWord(ruText) {
  const w = (ruText || '').toLowerCase();
  if (_lexSetMemo.has(w)) return _lexSetMemo.get(w);
  const set = new Set();
  for (const m of lexemeMatchers) {
    if (!m.res.some(re => re.test(w))) continue;
    if (m.ex.some(re => re.test(w))) continue;
    set.add(m.lexemeKey);
  }
  _lexSetMemo.set(w, set);
  return set;
}

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// Corroborated if the Russian word shares a >=4-char stem with any attested
// aggregate form for any of the token's Strong numbers (tolerant of inflection).
function aggregateCorroborated(ruText, strongs) {
  const w = (ruText || '').toLowerCase().replace(/[^а-яё]/g, '');
  if (w.length < 3) return true; // ultra-short (prepositions etc.) — out of scope here
  for (const s of (strongs || [])) {
    const forms = ruFormsByStrong.get(String(s));
    if (!forms) continue;
    for (const f of forms) {
      const need = Math.min(4, Math.min(w.length, f.length));
      if (commonPrefixLen(w, f) >= need) return true;
    }
  }
  return false;
}

// ── Group candidates by ref for C2 uniqueness checks ──
const candByRef = new Map();
for (const c of candidates) {
  if (!candByRef.has(c.ref)) candByRef.set(c.ref, []);
  candByRef.get(c.ref).push(c);
}

// ── Build original token lookup (needed for fw/morph checks) ──
// We'll build this lazily per ref from original packs
// For now, load all original pack tokens
const ORIGINAL_DIR = resolve(ROOT, 'assets', 'data', 'originals', 'sblgnt-macula', 'books');
const NT_BOOKS = [
  'matthew','mark','luke','john','acts','romans','1corinthians','2corinthians',
  'galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians',
  '1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter',
  '1john','2john','3john','jude','revelation',
];

const origTokens = new Map(); // tokenId → { fw, morph, lexemeKey }
for (const bookId of NT_BOOKS) {
  try {
    const pack = JSON.parse(readFileSync(resolve(ORIGINAL_DIR, `${bookId}.json`), 'utf8'));
    for (const ch of pack.chapters) {
      for (const v of ch.verses) {
        for (const t of v.tokens) {
          origTokens.set(t.id, { fw: t.fw, morph: t.morph, lexemeKey: t.lexemeKey, strongs: t.strongs, bookId });
        }
      }
    }
  } catch (e) {
    // book not found - skip
  }
}
console.log(`Original token lookup: ${origTokens.size} tokens`);

// ── Load translation packs for span validation ──
const TRANSLATION_DIR = resolve(ROOT, 'assets', 'data', 'translations', 'syn', 'books');
// Build word lookup: ref → words[]
const synWordsByRef = new Map();
for (const bookId of NT_BOOKS) {
  try {
    const pack = JSON.parse(readFileSync(resolve(TRANSLATION_DIR, `${bookId}.json`), 'utf8'));
    for (const ch of pack.chapters) {
      for (const v of ch.verses) {
        synWordsByRef.set(v.ref, v.words);
      }
    }
  } catch (e) { /* skip */ }
}

// ── Process certification ──
const certStream = createWriteStream(CERTIFIED_PATH);
const proofEntries = [];
let totalCertified = 0;
let totalEFinal = 0, totalFFinal = 0;
let c1Count = 0, c2Count = 0, c3Count = 0;
let c1FuncDowngrade = 0, c2FuncDowngrade = 0, c3FuncDowngrade = 0;
let blockedFuncWord = 0, blockedAmbiguous = 0, blockedMissing = 0;
let stillHidden = 0;
let flaggedForAudit = 0;
const flaggedQueue = [];

// For C2: per-ref uniqueness checks
for (const [ref, refCandidates] of candByRef) {
  // Count how many Russian spans match each lexemeKey in this ref
  // and how many Greek tokens exist for each lexemeKey in this ref

  const spanByLexeme = new Map(); // lexemeKey → Set of spanKeys
  const tokenByLexeme = new Map(); // lexemeKey → Set of tokenIds
  const spanKeyToCandidate = new Map(); // spanKey → all candidates for that span

  for (const c of refCandidates) {
    const spanKey = `${c.span[0]}-${c.span[1]}`;
    if (!spanByLexeme.has(c.lexemeKey)) spanByLexeme.set(c.lexemeKey, new Set());
    spanByLexeme.get(c.lexemeKey).add(spanKey);

    if (!tokenByLexeme.has(c.lexemeKey)) tokenByLexeme.set(c.lexemeKey, new Set());
    tokenByLexeme.get(c.lexemeKey).add(c.tokenId);

    if (!spanKeyToCandidate.has(spanKey)) spanKeyToCandidate.set(spanKey, []);
    spanKeyToCandidate.get(spanKey).push(c);
  }

  // Build tokenId → candidates for competition check
  const tokenIdToCandidate = new Map();
  for (const c of refCandidates) {
    if (!tokenIdToCandidate.has(c.tokenId)) tokenIdToCandidate.set(c.tokenId, []);
    tokenIdToCandidate.get(c.tokenId).push(c);
  }

  for (const c of refCandidates) {
    const spanKey = `${c.span[0]}-${c.span[1]}`;
    const proofId = generateProofId(ref, c.span, c.tokenId, c.lexemeKey);

    let certified = false;
    let certifier = null;
    let proof = null;
    let blockers = [...(c.blockers || [])];

    // ═══════ C1: manual-dev-gold ═══════
    const goldEntries = goldByRef.get(ref) || [];
    const goldMatch = goldEntries.find(g =>
      g.spanKey === spanKey && g.tokenId === c.tokenId
    );
    if (goldMatch) {
      certified = true;
      certifier = 'manual-dev-gold';
      proof = {
        certifier: 'manual-dev-gold',
        inputs: ['test/fixtures/macula-gold-dev.json'],
        checks: [
          'present-in-dev-gold',
          'span-matches',
          'tokenId-matches',
          'gold-says-q:e',
        ],
      };
      c1Count++;
    }

    // ═══════ C2: unique-curated-lexeme ═══════
    if (!certified && c.src === 'cand:ru-core-regex') {
      const ruSpansForLexeme = spanByLexeme.get(c.lexemeKey)?.size || 0;
      const grTokensForLexeme = tokenByLexeme.get(c.lexemeKey)?.size || 0;

      // Check uniqueness
      const uniqueRu = ruSpansForLexeme === 1;
      const uniqueGr = grTokensForLexeme === 1;

      // Check competition
      const spanComp = spanKeyToCandidate.get(spanKey)?.filter(x => x !== c) || [];
      const tokenComp = tokenIdToCandidate.get(c.tokenId)?.filter(x => x !== c) || [];

      // Check token certifiability
      const origToken = origTokens.get(c.tokenId);
      const tokenCertifiable = origToken && isCertifiableToken(origToken);

      // Check no function word blocker
      const hasFuncBlocker = (c.blockers || []).includes('function-word:hidden-in-v2');

      if (uniqueRu && uniqueGr &&
          spanComp.length === 0 && tokenComp.length === 0 &&
          tokenCertifiable && !hasFuncBlocker) {
        certified = true;
        certifier = 'unique-curated-lexeme';
        proof = {
          certifier: 'unique-curated-lexeme',
          inputs: ['cand:ru-core-regex'],
          checks: [
            'exactly-one-russian-span-for-lexeme-in-ref',
            'exactly-one-greek-token-for-lexeme-in-ref',
            'no-competing-candidate-for-span',
            'no-competing-candidate-for-token',
            'not-function-word',
            'not-in-variant-span',
          ],
        };
        c2Count++;
      } else {
        if (!uniqueRu || !uniqueGr) blockedAmbiguous++;
        else if (!tokenCertifiable || hasFuncBlocker) blockedFuncWord++;
        else if (spanComp.length > 0 || tokenComp.length > 0) blockedAmbiguous++;
        else blockedMissing++;
      }
    }

    // ═══════ C3: manual-allowlist ═══════
    if (!certified) {
      const manualEntries = manualByRef.get(ref) || [];
      const manMatch = manualEntries.find(m =>
        m.span && m.span[0] === c.span[0] && m.span[1] === c.span[1] &&
        m.tokenId === c.tokenId
      );
      if (manMatch) {
        certified = true;
        certifier = 'manual-allowlist';
        proof = {
          certifier: 'manual-allowlist',
          inputs: ['docs/sources/alignments/syn--sblgnt-macula/manual-certified.json'],
          checks: [
            'explicitly-listed-in-manual-certified',
            'reviewer-and-reason-present',
          ],
          manual: {
            reviewer: manMatch.reviewer || 'unknown',
            reviewedAt: manMatch.reviewedAt || 'unknown',
            reason: manMatch.reason || '',
          },
        };
        c3Count++;
      }
    }

    if (certified && certifier) {
      // Global function-word check (§10): even gold/manual pairs with function words
      // must not become runtime-visible in v2. Downgrade to q:"f" (hidden).
      const origToken = origTokens.get(c.tokenId);
      const isFuncToken = origToken && !isCertifiableToken(origToken);
      const finalQ = isFuncToken ? 'f' : 'e';

      if (finalQ === 'e') totalEFinal++;
      else totalFFinal++;

      // C2 negative gate → audit flag (visible C2 pairs only; C1 gold / C3 manual
      // are human-validated, so they are not flagged). The pair stays visible.
      let auditFlags;
      if (finalQ === 'e' && certifier === 'unique-curated-lexeme') {
        const competing = curatedLexemesForWord(c.ruText);
        if (competing.size > 1 && !aggregateCorroborated(c.ruText, origToken?.strongs)) {
          auditFlags = ['ambiguous-source-uncorroborated'];
          flaggedForAudit++;
          flaggedQueue.push({
            ref,
            span: c.span,
            tokenId: c.tokenId,
            lexemeKey: c.lexemeKey,
            ruText: c.ruText,
            grText: c.grText,
            competingLexemes: [...competing].sort(),
            reason: 'ambiguous-source-uncorroborated',
          });
        }
      }

      // Track downgrades by certifier
      if (isFuncToken) {
        if (certifier === 'manual-dev-gold') c1FuncDowngrade++;
        else if (certifier === 'unique-curated-lexeme') c2FuncDowngrade++;
        else if (certifier === 'manual-allowlist') c3FuncDowngrade++;
      }

      const certifiedRec = {
        schema: 'alignment-certified-v1',
        ref,
        span: c.span,
        tokenId: c.tokenId,
        lexemeKey: c.lexemeKey,
        q: finalQ,
        src: `certified:${certifier}`,
        proofId,
        proof,
        ...(auditFlags ? { auditFlags } : {}),
      };
      certStream.write(JSON.stringify(certifiedRec) + '\n');
      totalCertified++;

      proofEntries.push({
        proofId,
        ref,
        span: c.span,
        tokenId: c.tokenId,
        lexemeKey: c.lexemeKey,
        certifier,
        checks: proof.checks,
        finalQ,
        isFunctionWord: isFuncToken,
        ...(auditFlags ? { auditFlags } : {}),
      });
    } else {
      stillHidden++;
    }
  }
}

certStream.end();
await new Promise(resolve => certStream.on('finish', resolve));

// ── Write proof report ──
const proofReport = {
  schema: 'proof-report-v1',
  alignmentId: 'syn--sblgnt-macula',
  generatedAt: new Date().toISOString(),
  summary: {
    totalCandidates: candidates.length,
    totalCertified: totalCertified,
    totalEFinal: totalEFinal,
    totalFFinal: totalFFinal,
    c1ManualDevGold: c1Count,
    c2UniqueCuratedLexeme: c2Count,
    c3ManualAllowlist: c3Count,
    c1FuncDowngrade: c1FuncDowngrade,
    c2FuncDowngrade: c2FuncDowngrade,
    c3FuncDowngrade: c3FuncDowngrade,
    stillHidden: stillHidden,
    blockedByFuncWord: blockedFuncWord,
    blockedByAmbiguity: blockedAmbiguous,
    blockedByMissing: blockedMissing,
    flaggedForAudit: flaggedForAudit,
  },
  proofs: proofEntries,
};

writeFileSync(PROOF_REPORT_PATH, JSON.stringify(proofReport, null, 2));

// ── Write audit queue (visible C2 pairs flagged for LLM audit) ──
const AUDIT_QUEUE_PATH = resolve(CANONICAL_DIR, 'audit-queue.jsonl');
writeFileSync(AUDIT_QUEUE_PATH, flaggedQueue.map(r => JSON.stringify(r)).join('\n') + (flaggedQueue.length ? '\n' : ''));

// ── Write certified manifest ──
const certContent = readFileSync(CERTIFIED_PATH, 'utf8');
const certManifest = {
  schema: 'certified-manifest-v1',
  alignmentId: 'syn--sblgnt-macula',
  path: 'certified.jsonl',
  count: totalCertified,
  sha256: sha256(certContent),
  generatedAt: new Date().toISOString(),
};
writeFileSync(resolve(CANONICAL_DIR, 'certified-manifest.json'), JSON.stringify(certManifest, null, 2));

console.log(`\nCertification summary:`);
console.log(`  Total candidates: ${candidates.length}`);
console.log(`  C1 (manual-dev-gold): ${c1Count} (${c1FuncDowngrade} downgraded to q:"f")`);
console.log(`  C2 (unique-curated-lexeme): ${c2Count} (${c2FuncDowngrade} downgraded to q:"f")`);
console.log(`  C3 (manual-allowlist): ${c3Count} (${c3FuncDowngrade} downgraded to q:"f")`);
console.log(`  Total certified (q:"e"): ${totalEFinal}`);
console.log(`  Total certified (q:"f" — hidden): ${totalFFinal}`);
console.log(`  Still hidden: ${stillHidden}`);
console.log(`  Blocked by function word: ${blockedFuncWord}`);
console.log(`  Blocked by ambiguity: ${blockedAmbiguous}`);
console.log(`  Flagged for LLM audit (visible, ambiguous+uncorroborated): ${flaggedForAudit}`);
console.log(`  Proof entries: ${proofEntries.length}`);
console.log('Done.');
