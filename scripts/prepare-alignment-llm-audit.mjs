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

// Write a scale report placeholder — full LLM audit would generate prompt JSONs here
const scaleReport = {
  schema: 'audit-scale-report-v1',
  alignmentId: 'syn--sblgnt-macula',
  generatedAt: new Date().toISOString(),
  status: 'stub',
  message: 'LLM audit inputs not yet generated. This is a placeholder for the full implementation.',
  estimatedPromptFiles: certVerses.size * 5, // 5 roles per verse
};

writeFileSync(resolve(CANONICAL_DIR, 'llm-audit', 'audit-scale-report.json'), JSON.stringify(scaleReport, null, 2));
console.log('Scale report written.');
console.log('Done (stub).');
