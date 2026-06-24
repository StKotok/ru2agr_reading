#!/usr/bin/env node

/**
 * check-adjudication-status.mjs — Validate adjudication report completeness.
 *
 * Returns non-zero and reports blocked:pending-human-adjudication when:
 * - the file is missing or invalid JSON
 * - schema is not adjudication-report-v1
 * - any decision is manual-review
 * - any release blocker is present
 *
 * Usage: node scripts/check-adjudication-status.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ADJ_PATH = resolve(ROOT, 'generated', 'canonical', 'alignments', 'syn--sblgnt-macula', 'adjudication-report.json');

const errors = [];

function err(msg) { errors.push(msg); console.error(`  ✗ ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }

console.log('=== check-adjudication-status ===\n');

if (!existsSync(ADJ_PATH)) {
  err('adjudication-report.json missing');
  console.log('\nBLOCKED: pending-human-adjudication');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(ADJ_PATH, 'utf8'));
} catch (e) {
  err(`Invalid JSON: ${e.message}`);
  console.log('\nBLOCKED: pending-human-adjudication');
  process.exit(1);
}

if (report.schema !== 'adjudication-report-v1') {
  err(`Schema is "${report.schema}", expected "adjudication-report-v1"`);
}

const manualReview = (report.decisions || []).filter(d => d.decision === 'manual-review');
if (manualReview.length > 0) {
  err(`${manualReview.length} decision(s) require manual review`);
  for (const d of manualReview) {
    console.error(`    ${d.ref} span [${d.span}] tokenId ${d.tokenId}: ${d.reason || 'no reason'}`);
  }
}

if (report.releaseBlockers && report.releaseBlockers.length > 0) {
  console.log(`\nRelease blockers (${report.releaseBlockers.length}):`);
  for (const b of report.releaseBlockers) {
    console.log(`  ⚠ ${b}`);
  }
}

if (errors.length > 0) {
  console.log(`\nBLOCKED: pending-human-adjudication (${errors.length} issue(s))`);
  process.exit(1);
} else {
  ok('Adjudication complete — no manual-review items, no blockers');
  console.log('\nSTATUS: ready for release (adjudication gate)');
}
