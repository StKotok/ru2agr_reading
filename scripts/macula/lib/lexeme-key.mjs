/**
 * lexeme-key.mjs — Deterministic lexemeKey generation.
 *
 * Maps maculaLexemeId → lexemeKey (the app-level canonical key).
 *
 * Algorithm (per MACULA plan v3 §2.1):
 *   1. Curated entries (204 from core.json): match by Strong → lexemeKey = core.id
 *   2. Curated entries unmatched by Strong: match by NFC-normalized lemma
 *   3. Grammatical form entries: merge into parent curated entry
 *   4. Uncurated: lexemeKey = transliteration, with hash suffix for collisions
 *
 * 10 collision groups are known and handled:
 *   ou, tis, ara, pou, pōs, pote, Silas, Solomōn, syniēmi, pharmakos
 */

// Manual mapping: grammatical form entry id → parent curated entry id
// These are inflected forms whose Strong number differs from the lemma's
// Strong in MACULA, so they can't be auto-matched.
const FORM_TO_PARENT = {
  // 1st person singular/plural pronoun forms (ἐγώ)
  // All first-person forms share the same root concept
  mou: 'ego',    // genitive singular
  moi: 'ego',    // dative singular
  me: 'ego',     // accusative singular
  hemon: 'ego',  // genitive plural (ἡμῶν)
  hemin: 'ego',  // dative plural (ἡμῖν)
  hemas: 'ego',  // accusative plural (ἡμᾶς)
  // Note: 'ego' itself matches by NFC lemma

  // 2nd person pronoun forms (σύ covers all 2nd person in MACULA)
  hymin: 'sy',   // dative plural
  hymon: 'sy',   // genitive plural
  hymas: 'sy',   // accusative plural
  hymeis: 'sy',  // nominative plural (ὑμεῖς)
  soi: 'sy',     // dative singular
  se: 'sy',      // accusative singular
  // Note: 'sy' itself matches by NFC lemma

  // Demonstrative (οὗτος)
  touto: 'houtos',  // neuter nominative/accusative

  // εἰμί verb forms (all map to eimi)
  epo: 'eimi',      // (actually a different verb but curated as form)
  esti: 'eimi',     // 3rd sing. present
  esomai: 'eimi',   // future
  'on-2': 'eimi',   // present participle
  eisi: 'eimi',     // 3rd plur. present
  // Note: 'eimi' itself matches by NFC lemma

  // Additional form / lemma variant mappings
  'en-2': 'eimi',    // ἦν (imperfect of εἰμί) → eimi
  sou: 'sy',         // σοῦ (genitive of σύ) → sy
  tauta: 'houtos',   // ταῦτα (neuter plural of οὗτος) → houtos
  'heautou-2': 'heautou', // ἑαυτοῦ variant spelling → heautou
};

// Known curated entries that match by NFC lemma (not by Strong)
// These have different Strong numbers in MACULA vs old system
const LEMMA_MATCH_OVERRIDE = {
  protos: { maculaStrong: '4412' },     // πρῶτος: core strong 4413 → MACULA 4412
  heautou: { maculaStrong: '848' },     // ἑαυτοῦ: core strong 1438 → MACULA 848 (heautou-2)
  houtos: { maculaStrong: '5023' },     // οὗτος: core strong 3778 → MACULA 5023
  ego: { maculaStrong: '2257' },        // ἐγώ: core strong 1473 → MACULA 2257
  sy: { maculaStrong: '4675' },         // σύ: core strong 4771 → MACULA 4675
  eimi: { maculaStrong: '2258' },       // εἰμί: core strong 1510 → MACULA 2258
};

// 10 known collision groups (transliteration → expected lemmas)
const KNOWN_COLLISIONS = {
  ou: ['οὐ', 'οὔ'],
  tis: ['τίς', 'τις'],
  ara: ['ἄρα', 'ἆρα', 'ἀρά'],
  pou: ['ποῦ', 'πού'],
  pōs: ['πῶς', 'πώς'],
  pote: ['ποτέ', 'πότε'],
  Silas: ['Σίλας', 'Σιλᾶς'],
  Solomōn: ['Σολομών', 'Σολομῶν'],
  syniēmi: ['συνίημι', 'σύνιημι'],
  pharmakos: ['φαρμακός', 'φάρμακος'],
};

/**
 * Extract short hash from maculaLexemeId.
 * Format: grc-<translit>-<hash6> → returns <hash6>
 * If format doesn't match, returns full maculaLexemeId.
 */
function shortHash(maculaLexemeId) {
  const parts = maculaLexemeId.split('-');
  if (parts.length >= 3) {
    return parts[parts.length - 1]; // last segment is the hash
  }
  // Fallback: take last 6 chars
  return maculaLexemeId.slice(-6);
}

/**
 * Build the lexemeKey map: maculaLexemeId → lexemeKey.
 *
 * @param {Array} canonicalLexemes - from lexemes.json (has id=maculaLexemeId, lemma, strong, transliteration)
 * @param {Array} curatedEntries - from core.json (has id, lemma, strong as number)
 * @returns {Object} { map: Map<maculaLexemeId, lexemeKey>, report: {...} }
 */
export function buildLexemeKeyMap(canonicalLexemes, curatedEntries) {
  const map = new Map();
  const usedKeys = new Set();
  const report = {
    curatedMatchedStrong: 0,
    curatedMatchedLemma: 0,
    curatedFormMapped: 0,
    curatedUnmatched: [],
    curatedTotal: curatedEntries.length,
    uncuratedTotal: 0,
    collisions: [],
    collisionGroupsExpected: 10,
    collisionGroupsResolved: 0,
  };

  // Build lookup tables from canonical
  const strongIndex = new Map(); // strong string → [lexeme, ...]
  const lemmaIndex = new Map(); // NFC lemma → lexeme
  const maculaIdIndex = new Map(); // maculaLexemeId → lexeme

  for (const lex of canonicalLexemes) {
    const id = lex.id; // maculaLexemeId
    maculaIdIndex.set(id, lex);

    // Strong index
    const strongs = lex.strong || [];
    for (const s of strongs) {
      if (!strongIndex.has(s)) strongIndex.set(s, []);
      strongIndex.get(s).push(lex);
    }

    // Lemma index (NFC normalized)
    if (lex.lemma) {
      const lemmaNfc = lex.lemma.normalize('NFC');
      lemmaIndex.set(lemmaNfc, lex);
    }
  }

  // Build curated entry lookup
  const curatedById = new Map(curatedEntries.map(c => [c.id, c]));

  // --- Phase 1: Match curated entries ---
  const processedCurated = new Set(); // core.id entries that have been processed
  const formToParentKeys = new Map(); // maculaLexemeId → parent lexemeKey for form entries

  for (const entry of curatedEntries) {
    if (processedCurated.has(entry.id)) continue;

    // Check if this is a form entry that maps to a parent
    if (FORM_TO_PARENT[entry.id]) {
      const parentId = FORM_TO_PARENT[entry.id];
      const parentEntry = curatedById.get(parentId);
      if (!parentEntry) {
        report.curatedUnmatched.push(`${entry.id}: parent ${parentId} not found`);
        continue;
      }

      // Try to match the form entry to a MACULA lexeme
      // (by Strong or lemma), then map that lexeme to the PARENT key
      let formLexeme = null;
      const strongStr = String(entry.strong);
      if (strongIndex.has(strongStr)) {
        const candidates = strongIndex.get(strongStr);
        if (entry.lemma) {
          const entryLemmaNfc = entry.lemma.normalize('NFC');
          formLexeme = candidates.find(l => l.lemma && l.lemma.normalize('NFC') === entryLemmaNfc);
        }
        if (!formLexeme && candidates.length === 1) {
          formLexeme = candidates[0];
        }
      }

      // Try lemma match as fallback
      if (!formLexeme && entry.lemma) {
        const entryLemmaNfc = entry.lemma.normalize('NFC');
        if (lemmaIndex.has(entryLemmaNfc)) {
          formLexeme = lemmaIndex.get(entryLemmaNfc);
        }
      }

      if (formLexeme) {
        if (map.has(formLexeme.id)) {
          const existingKey = map.get(formLexeme.id);
          if (existingKey !== parentId) {
            report.curatedUnmatched.push(
              `${entry.id}: maculaLexemeId ${formLexeme.id} already mapped to ${existingKey} (wanted ${parentId})`
            );
          }
          // If already mapped to same parentId, it's fine — skip silently
        } else {
          // Map this MACULA lexeme to the PARENT's key
          map.set(formLexeme.id, parentId);
          usedKeys.add(parentId);
          processedCurated.add(entry.id);
          processedCurated.add(parentId);
          report.curatedFormMapped++;
        }
      } else {
        // Form entry couldn't be matched to any MACULA lexeme directly.
        // This is expected for entries with Strong numbers not in MACULA.
        // Their ruMatches are merged into the parent at the locale overlay level.
        processedCurated.add(entry.id);
        // Don't report as unmatched — handled at locale level
      }
      continue;
    }

    let matchedLexeme = null;
    let matchMethod = null;

    // 1a: Match by Strong
    const strongStr = String(entry.strong);
    if (strongIndex.has(strongStr)) {
      const candidates = strongIndex.get(strongStr);
      // Find the one whose lemma matches (NFC compare)
      if (entry.lemma) {
        const entryLemmaNfc = entry.lemma.normalize('NFC');
        matchedLexeme = candidates.find(l => l.lemma && l.lemma.normalize('NFC') === entryLemmaNfc);
      }
      if (!matchedLexeme && candidates.length === 1) {
        matchedLexeme = candidates[0];
      }
      if (matchedLexeme) {
        matchMethod = 'strong';
      }
    }

    // 1b: Match by NFC lemma (fallback for entries with different Strong in MACULA)
    if (!matchedLexeme && entry.lemma) {
      const entryLemmaNfc = entry.lemma.normalize('NFC');
      if (lemmaIndex.has(entryLemmaNfc)) {
        matchedLexeme = lemmaIndex.get(entryLemmaNfc);
        matchMethod = 'lemma';
      }
    }

    // 1c: Check LEMMA_MATCH_OVERRIDE (explicit strong mapping)
    if (!matchedLexeme && LEMMA_MATCH_OVERRIDE[entry.id]) {
      const override = LEMMA_MATCH_OVERRIDE[entry.id];
      if (strongIndex.has(override.maculaStrong)) {
        const candidates = strongIndex.get(override.maculaStrong);
        if (entry.lemma) {
          const entryLemmaNfc = entry.lemma.normalize('NFC');
          matchedLexeme = candidates.find(l => l.lemma && l.lemma.normalize('NFC') === entryLemmaNfc);
        }
        if (!matchedLexeme && candidates.length === 1) {
          matchedLexeme = candidates[0];
        }
        if (matchedLexeme) {
          matchMethod = 'strong-override';
        }
      }
    }

    if (matchedLexeme) {
      const lexemeKey = entry.id;
      if (map.has(matchedLexeme.id)) {
        const existingKey = map.get(matchedLexeme.id);
        if (existingKey !== lexemeKey) {
          report.curatedUnmatched.push(
            `${entry.id}: maculaLexemeId ${matchedLexeme.id} already mapped to ${existingKey}`
          );
        }
        // If already mapped to same key, it's fine — mark processed and continue
        processedCurated.add(entry.id);
        continue;
      }
      map.set(matchedLexeme.id, lexemeKey);
      usedKeys.add(lexemeKey);
      processedCurated.add(entry.id);

      if (matchMethod === 'strong') report.curatedMatchedStrong++;
      else if (matchMethod === 'strong-override') report.curatedMatchedStrong++;
      else report.curatedMatchedLemma++;
    } else {
      report.curatedUnmatched.push(
        `${entry.id}: lemma=${entry.lemma} strong=${entry.strong} — no MACULA match found`
      );
    }
  }

  // --- Phase 1d: Remaining form entries — try to match by parent's strong ---
  // This handles cases where the form entry itself couldn't match but the parent can
  for (const [formId, parentId] of Object.entries(FORM_TO_PARENT)) {
    if (processedCurated.has(formId)) continue; // already handled inline

    const parentEntry = curatedById.get(parentId);
    if (!parentEntry) continue;

    // Try matching through parent's Strong (form and parent share same root)
    let parentLexeme = null;
    const parentStrong = String(parentEntry.strong);
    if (strongIndex.has(parentStrong)) {
      const candidates = strongIndex.get(parentStrong);
      if (parentEntry.lemma) {
        const parentLemmaNfc = parentEntry.lemma.normalize('NFC');
        parentLexeme = candidates.find(l => l.lemma && l.lemma.normalize('NFC') === parentLemmaNfc);
      }
      if (!parentLexeme && candidates.length === 1) {
        parentLexeme = candidates[0];
      }
    }

    if (parentLexeme && !map.has(parentLexeme.id)) {
      map.set(parentLexeme.id, parentId);
      usedKeys.add(parentId);
      processedCurated.add(formId);
      processedCurated.add(parentId);
      report.curatedFormMapped++;
    } else if (parentLexeme && map.has(parentLexeme.id)) {
      report.curatedUnmatched.push(
        `${formId}: parent ${parentId} maculaLexemeId ${parentLexeme.id} already mapped to ${map.get(parentLexeme.id)}`
      );
    }
  }

  // --- Pre-populate seenTranslit from curated entries ---
  // This ensures transliterations used by curated entries don't conflict
  const seenTranslit = new Map(); // transliteration → first maculaLexemeId
  const collisionGroups = {};

  for (const [maculaId, lexemeKey] of map.entries()) {
    const lex = maculaIdIndex.get(maculaId);
    if (!lex) continue;
    const translit = lex.transliteration?.value || lex.transliteration || '';
    if (translit && !seenTranslit.has(translit)) {
      seenTranslit.set(translit, maculaId);
    }
  }

  // --- Phase 2: Uncurated lexemes ---
  // Sort by frequency rank (if available)
  const sortedLexemes = [...canonicalLexemes];

  for (const lex of sortedLexemes) {
    if (map.has(lex.id)) continue; // already mapped (curated)

    const translit = lex.transliteration?.value || lex.transliteration || '';
    if (!translit) {
      // No transliteration available — use maculaLexemeId as fallback
      map.set(lex.id, lex.id);
      usedKeys.add(lex.id);
      continue;
    }

    let key;
    if (!seenTranslit.has(translit)) {
      // First occurrence — use bare transliteration
      key = translit;
      seenTranslit.set(translit, lex.id);
    } else {
      // Collision — add hash suffix
      const hash = shortHash(lex.id);
      key = `${translit}-${hash}`;

      // Track collision group
      if (!collisionGroups[translit]) {
        collisionGroups[translit] = [seenTranslit.get(translit)];
      }
      collisionGroups[translit].push(lex.id);
    }

    // Assert global uniqueness
    if (usedKeys.has(key)) {
      // Fallback: use full maculaLexemeId
      key = lex.id;
      report.collisions.push(`DUPLICATE KEY: ${key} (maculaLexemeId=${lex.id})`);
    }

    map.set(lex.id, key);
    usedKeys.add(key);
  }

  report.uncuratedTotal = canonicalLexemes.length - processedCurated.size;
  report.collisionGroups = Object.keys(collisionGroups);
  report.collisionGroupsResolved = report.collisionGroups.length;

  // Verify known collisions are present
  for (const expected of Object.keys(KNOWN_COLLISIONS)) {
    if (!collisionGroups[expected]) {
      report.collisions.push(`Expected collision group "${expected}" NOT found`);
    }
  }

  // Check for form entries not processed
  for (const entry of curatedEntries) {
    if (!processedCurated.has(entry.id)) {
      report.curatedUnmatched.push(
        `${entry.id}: not matched (strong=${entry.strong}, lemma=${entry.lemma})`
      );
    }
  }

  report.mapSize = map.size;
  report.uniqueKeys = usedKeys.size;
  report.duplicates = map.size - usedKeys.size;

  return { map, report };
}

/**
 * Get a human-readable report string.
 */
export function formatLexemeKeyReport(report) {
  const lines = [];
  lines.push(`# LexemeKey Build Report`);
  lines.push('');
  lines.push('## Curated entries');
  lines.push(`- Total in core.json: ${report.curatedTotal}`);
  lines.push(`- Matched by Strong: ${report.curatedMatchedStrong}`);
  lines.push(`- Matched by NFC lemma: ${report.curatedMatchedLemma}`);
  lines.push(`- Form entries merged to parent: ${report.curatedFormMapped}`);
  if (report.curatedUnmatched.length > 0) {
    lines.push(`- **Unmatched: ${report.curatedUnmatched.length}**`);
    for (const u of report.curatedUnmatched) {
      lines.push(`  - ${u}`);
    }
  }
  lines.push('');
  lines.push('## Uncurated entries');
  lines.push(`- Total: ${report.uncuratedTotal}`);
  lines.push(`- Map size: ${report.mapSize}`);
  lines.push(`- Unique keys: ${report.uniqueKeys}`);
  lines.push('');
  lines.push('## Collision groups');
  lines.push(`- Expected: ${report.collisionGroupsExpected}`);
  lines.push(`- Found: ${report.collisionGroupsResolved}`);
  for (const g of report.collisionGroups) {
    lines.push(`  - ${g}`);
  }
  if (report.collisions.length > 0) {
    lines.push('');
    lines.push('## Collisions/Issues');
    for (const c of report.collisions) {
      lines.push(`- ${c}`);
    }
  }
  return lines.join('\n');
}

export { KNOWN_COLLISIONS, FORM_TO_PARENT, LEMMA_MATCH_OVERRIDE, shortHash };
