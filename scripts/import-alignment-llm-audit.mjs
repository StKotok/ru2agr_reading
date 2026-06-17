#!/usr/bin/env node

/**
 * import-alignment-llm-audit.mjs — B2 LLM Audit Import (Step 4).
 *
 * Validates and imports LLM audit outputs into the canonical audit layer.
 * Offline — reads JSON files produced by external LLM runs.
 *
 * Fail the import if any LLM output is invalid.
 *
 * Usage: node scripts/import-alignment-llm-audit.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CANONICAL_DIR = resolve(ROOT, 'generated', 'canonical', 'alignments', 'syn--sblgnt-macula');
const AUDIT_OUTPUTS_DIR = resolve(CANONICAL_DIR, 'llm-audit', 'outputs');
const IMPORT_REPORT_PATH = resolve(CANONICAL_DIR, 'llm-audit', 'import-report.json');
const AUDIT_REPORT_PATH = resolve(CANONICAL_DIR, 'audit-report.json');

console.log('=== import-alignment-llm-audit (B2 Step 4 stub) ===\n');

// Check if any LLM outputs exist
let hasOutputs = false;
try {
  if (existsSync(AUDIT_OUTPUTS_DIR)) {
    const entries = readdirSync(AUDIT_OUTPUTS_DIR);
    if (entries.length > 0) {
      hasOutputs = true;
      console.log(`Found ${entries.length} output directories`);
    }
  }
} catch (_) {}

if (!hasOutputs) {
  console.log('No LLM audit outputs found. This is expected for initial data prototype.');

  // Update audit report to reflect missing LLM audit
  if (existsSync(AUDIT_REPORT_PATH)) {
    const auditReport = JSON.parse(readFileSync(AUDIT_REPORT_PATH, 'utf8'));
    auditReport.releaseStatus = 'blocked:llm-audit-missing';
    if (!auditReport.blockers) auditReport.blockers = [];
    auditReport.blockers.push({
      code: 'blocked:llm-audit-missing',
      message: 'LLM audit outputs have not been imported. Run LLM audit first.',
    });
    writeFileSync(AUDIT_REPORT_PATH, JSON.stringify(auditReport, null, 2));
  }
} else {
  // In full implementation: validate each LLM output, merge findings
  console.log('Validating LLM outputs...');
}

// Write import report
const importReport = {
  schema: 'import-report-v1',
  alignmentId: 'syn--sblgnt-macula',
  generatedAt: new Date().toISOString(),
  outputsValidated: 0,
  outputsInvalid: 0,
  errors: [],
  status: hasOutputs ? 'partial' : 'missing',
};

writeFileSync(IMPORT_REPORT_PATH, JSON.stringify(importReport, null, 2));
console.log('Import report written.');
console.log('Done (stub).');
