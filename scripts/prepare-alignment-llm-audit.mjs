#!/usr/bin/env node

/**
 * prepare-alignment-llm-audit.mjs — B2 LLM Audit Input Builder (Step 4).
 *
 * Writes prompt input JSON files for LLM audit roles.
 * Offline — does not call any LLM API.
 *
 * Output: generated/canonical/alignments/syn--sblgnt-macula/llm-audit/inputs/*.json
 *
 * Usage: node scripts/prepare-alignment-llm-audit.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CANONICAL_DIR = resolve(ROOT, 'generated', 'canonical', 'alignments', 'syn--sblgnt-macula');
const AUDIT_INPUTS_DIR = resolve(CANONICAL_DIR, 'llm-audit', 'inputs');
const CERTIFIED_PATH = resolve(CANONICAL_DIR, 'certified.jsonl');

// This is a stub — real implementation would produce prompt payloads per verse
// for gold-curator, blind-aligner-a, blind-aligner-b, skeptic, and adjudicator roles.
// The full implementation is deferred until LLM audit strategy is finalized.

console.log('=== prepare-alignment-llm-audit (B2 Step 4 stub) ===\n');

mkdirSync(AUDIT_INPUTS_DIR, { recursive: true });

// Count verses with certified pairs
let certVerses = new Set();
try {
  if (existsSync(CERTIFIED_PATH)) {
    const content = readFileSync(CERTIFIED_PATH, 'utf8');
    for (const line of content.trim().split('\n').filter(Boolean)) {
      const c = JSON.parse(line);
      certVerses.add(c.ref);
    }
  }
} catch (e) {
  console.log(`  ⚠ Could not read certified: ${e.message}`);
}

console.log(`Certified verses: ${certVerses.size}`);

// ── Priority audit set: pairs flagged by the C2 negative gate ──
// (ambiguous source + not corroborated by the independent aggregate). These stay
// runtime-visible but must be confirmed by the audit before release.
const AUDIT_QUEUE_PATH = resolve(CANONICAL_DIR, 'audit-queue.jsonl');
let flaggedPairs = [];
try {
  if (existsSync(AUDIT_QUEUE_PATH)) {
    flaggedPairs = readFileSync(AUDIT_QUEUE_PATH, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  }
} catch (e) {
  console.log(`  ⚠ Could not read audit queue: ${e.message}`);
}
console.log(`Flagged-for-audit pairs (priority): ${flaggedPairs.length}`);

// Persist the priority set as a concrete audit input (full per-role prompt
// generation is still deferred, but the priority targets are now explicit).
writeFileSync(
  resolve(AUDIT_INPUTS_DIR, 'priority-flagged.json'),
  JSON.stringify({ schema: 'audit-priority-flagged-v1', count: flaggedPairs.length, pairs: flaggedPairs }, null, 2),
);

// Write a scale report placeholder — full LLM audit would generate prompt JSONs here
const scaleReport = {
  schema: 'audit-scale-report-v1',
  alignmentId: 'syn--sblgnt-macula',
  generatedAt: new Date().toISOString(),
  status: 'stub',
  message: 'LLM audit inputs not yet generated. Priority set (flagged pairs) is enumerated in inputs/priority-flagged.json.',
  flaggedPairs: flaggedPairs.length,
  estimatedPromptFiles: certVerses.size * 5, // 5 roles per verse
};

writeFileSync(resolve(CANONICAL_DIR, 'llm-audit', 'audit-scale-report.json'), JSON.stringify(scaleReport, null, 2));
console.log('Scale report written.');
console.log('Done (stub).');
