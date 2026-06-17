/**
 * MARBLE semantic domain label mapping.
 *
 * Loads the domain label mapping from the MACULA sources directory
 * and provides a lookup from domain codes to English labels.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MACULA_ROOT = resolve(__dirname, '..', '..', '..', 'docs', 'macula-greek');
const DOMAIN_LABELS_PATH = resolve(MACULA_ROOT, 'sources', 'MARBLE', 'SDBG', 'marble-domain-label-mapping.json');

let _domainLabels = null;

/**
 * Load MARBLE domain label mapping.
 * Returns a Map from 6-digit domain codes (e.g. "033005") to English label (e.g. "Education").
 * @returns {Map<string, string>}
 */
export function loadDomainLabels() {
  if (_domainLabels) return _domainLabels;

  try {
    const raw = readFileSync(DOMAIN_LABELS_PATH, 'utf8');
    const json = JSON.parse(raw);
    _domainLabels = new Map(Object.entries(json));
    return _domainLabels;
  } catch (e) {
    console.warn(`Failed to load domain labels: ${e.message}`);
    _domainLabels = new Map();
    return _domainLabels;
  }
}

/**
 * Look up a domain label by code.
 * @param {string} code - 6-digit domain code (e.g. "033005")
 * @returns {string|null}
 */
export function lookupDomainLabel(code) {
  const labels = loadDomainLabels();
  return labels.get(code) || null;
}

/**
 * Look up a Louw-Nida code label.
 * LN codes are like "33.98" — the domain code is without the dot, padded to 6 digits.
 * e.g. "33.98" → codes "033" then "033005" (or similar)
 * @param {string} lnCode - e.g. "33.98"
 * @returns {{ domainCode: string|null, domainLabelEn: string|null, subdomainLabelEn: string|null }}
 */
export function lookupLouwNida(lnCode) {
  if (!lnCode) return { domainCode: null, domainLabelEn: null, subdomainLabelEn: null };

  const labels = loadDomainLabels();
  const parts = lnCode.split('.');
  if (parts.length < 2) {
    // Try as bare domain code padded to 6 digits
    const padded = lnCode.padEnd(6, '0');
    const label = labels.get(padded) || null;
    return { domainCode: lnCode, domainLabelEn: label, subdomainLabelEn: null };
  }

  const domainPart = parts[0].padStart(3, '0');
  const fullCode = `${domainPart}${parts[1].padStart(3, '0')}`;
  const subLabel = labels.get(fullCode) || null;

  // Also get the broader domain label
  const domainCode = domainPart + '000';
  const domainLabel = labels.get(domainCode) || null;

  return { domainCode: fullCode, domainLabelEn: domainLabel, subdomainLabelEn: subLabel };
}
