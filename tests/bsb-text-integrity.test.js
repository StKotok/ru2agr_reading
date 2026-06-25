import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ENG_DIR = resolve('assets/data/bibles/eng');
const engFiles = readdirSync(ENG_DIR).filter(f => f.endsWith('.json'));

/** @type {Map<string, {ref: string, text: string, words: Array<{i: number, text: string, start: number, end: number}>}>} */
const allVerses = new Map();
for (const file of engFiles) {
  const book = JSON.parse(readFileSync(resolve(ENG_DIR, file), 'utf8'));
  for (const ch of book.chapters) {
    for (const v of ch.verses) {
      allVerses.set(v.ref, v);
    }
  }
}

// ===========================================================================
// Level 1 — Snapshots of previously-broken verses
// ===========================================================================

const BROKEN_REF_LIST = [
  'john 1:5',
  'john 1:26',
  '2corinthians 9:9',
  'acts 27:37',
  '1corinthians 11:21',
  '1peter 2:23',
];

describe('BSB text integrity — snapshots of previously-broken verses', () => {
  for (const ref of BROKEN_REF_LIST) {
    it(ref, () => {
      const v = allVerses.get(ref);
      expect(v).toBeTruthy();
      expect(v.text).toMatchSnapshot();
    });
  }
});

// ===========================================================================
// Level 2 — Comprehensive sweep: no letter-digit glue or letter-punct-letter
// ===========================================================================

// Allowlist for legitimate intra-word capitals (e.g. names like "LaSalle").
// Currently empty — every hit after T0.1 is a bug.
const ALLOWLIST = new Set([
  // Legitimate em-dash usage in BSB (typographic convention — no spaces around em-dash)
  'hand—Paul',       // 1cor 16:21 — "in my own hand—Paul."
  'ther—Jesu',       // 1john 2:1 — "Father—Jesus Christ"
  'dead—Jesu',       // 1thes 1:10 — "from the dead—Jesus"
  'ange—I sp',       // 2cor 6:13 — "in exchange—I speak"
  ' you—I, P',       // 2cor 10:1 — "appeal to you—I, Paul"
  'hand—Paul',       // 2thes 3:17 — same as 1cor 16:21
  'hand—Paul',       // col 4:18 — same formula
  's us—One ',       // heb 7:26 — "for us—One who"
  'told—Jesu',       // john 1:45 — "Moses told—Jesus"
  'bout—He i',       // john 3:26 — "baptizing, and everyone is going to Him." — wait, this is about—He
  'ther—He w',       // john 15:26 — "from the Father—He will"
  'cold—I am',       // rev 3:16 — "nor cold—I am about"
  'arth—Gog ',       // rev 20:8 — "of the earth—Gog and"
]);

// Lowercase letter + optional 1 punct char + uppercase letter
const GLUE_PATTERN_1 = /[a-z][,.;:!?–—]?[A-Z]/g;
// Digit-letter or letter-digit glue
const GLUE_PATTERN_2 = /[a-z][0-9]|[0-9][a-z]/gi;

describe('BSB text integrity — comprehensive sweep', () => {
  it('no lower→Upper glue across all verses', () => {
    const hits = [];
    for (const v of allVerses.values()) {
      let match;
      GLUE_PATTERN_1.lastIndex = 0;
      while ((match = GLUE_PATTERN_1.exec(v.text)) !== null) {
        const fragment = v.text.slice(Math.max(0, match.index - 3), match.index + match[0].length + 3);
        if (![...ALLOWLIST].some(tok => fragment.includes(tok))) {
          hits.push(`${v.ref}: "${fragment}"`);
        }
      }
    }
    if (hits.length > 0) {
      console.log(`\nGlue hits (${hits.length}):\n${hits.slice(0, 20).join('\n')}`);
    }
    expect(hits).toEqual([]);
  });

  it('no digit↔letter glue across all verses', () => {
    const hits = [];
    for (const v of allVerses.values()) {
      let match;
      GLUE_PATTERN_2.lastIndex = 0;
      while ((match = GLUE_PATTERN_2.exec(v.text)) !== null) {
        const fragment = v.text.slice(Math.max(0, match.index - 2), match.index + match[0].length + 2);
        hits.push(`${v.ref}: "${fragment}"`);
      }
    }
    if (hits.length > 0) {
      console.log(`\nDigit-glue hits (${hits.length}):\n${hits.slice(0, 20).join('\n')}`);
    }
    expect(hits).toEqual([]);
  });
});

// ===========================================================================
// Level 3 — Curly apostrophe ’ should NOT split words across two tokens
// ===========================================================================

describe('BSB text integrity — curly apostrophe tokenization', () => {
  it('no [A-Za-z]’[A-Za-z] split across two words[] tokens', () => {
    const hits = [];
    for (const v of allVerses.values()) {
      const text = v.text;
      // Find occurrences of letter-’-letter
      const APOS_PATTERN = /[A-Za-z]’[A-Za-z]/g;
      let match;
      while ((match = APOS_PATTERN.exec(text)) !== null) {
        const pos = match.index + 1; // position of ’
        // Check that there is exactly one word token spanning this position
        const covering = v.words.filter(w => w.start <= pos && w.end > pos);
        if (covering.length !== 1) {
          hits.push(`${v.ref}: "${match[0]}" at ${pos}, covered by ${covering.length} token(s): ${JSON.stringify(covering.map(w => w.text))}`);
        }
      }
    }
    if (hits.length > 0) {
      console.log(`\nApostrophe-split hits (${hits.length}):\n${hits.slice(0, 20).join('\n')}`);
    }
    expect(hits).toEqual([]);
  });
});
