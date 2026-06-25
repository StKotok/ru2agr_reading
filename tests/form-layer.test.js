import { describe, it, expect } from 'vitest';
import { applyFormLayer, buildDictByLexemeId } from '../src/engine/form-layer.js';

// Test data in v2 format

// Greek tokens for Mark 1:1 (simplified)
const mk1_1_grcTokens = [
  { id: 'n41001001001', i: 1, s: 'Ἀρχὴ', lemma: 'ἀρχή', lexemeId: 'grc-arche-abc', lexemeKey: 'arche', morph: 'N-NSF', strongs: ['746'], fw: false },
  { id: 'n41001001002', i: 2, s: 'τοῦ', lemma: 'ὁ', lexemeId: 'grc-ho-677c59', lexemeKey: 'ho', morph: 'T-GSN', strongs: ['3588'], fw: true },
  { id: 'n41001001003', i: 3, s: 'εὐαγγελίου', lemma: 'εὐαγγέλιον', lexemeId: 'grc-euangelion-def', lexemeKey: 'euangelion', morph: 'N-GSN', strongs: ['2098'], fw: false },
  { id: 'n41001001004', i: 4, s: 'Ἰησοῦ', lemma: 'Ἰησοῦς', lexemeId: 'grc-iesous-ghi', lexemeKey: 'iesous', morph: 'N-GSM', strongs: ['2424'], fw: false },
  { id: 'n41001001005', i: 5, s: 'Χριστοῦ', lemma: 'Χριστός', lexemeId: 'grc-christos-jkl', lexemeKey: 'christos', morph: 'N-GSM', strongs: ['5547'], fw: false },
];

const mk1_1_verseText = 'The beginning of the gospel of Jesus Christ,';
const mk1_1_words = [
  { i: 0, text: 'The', start: 0, end: 3 },
  { i: 1, text: 'beginning', start: 4, end: 13 },
  { i: 2, text: 'of', start: 14, end: 16 },
  { i: 3, text: 'the', start: 17, end: 20 },
  { i: 4, text: 'gospel', start: 21, end: 27 },
  { i: 5, text: 'of', start: 28, end: 30 },
  { i: 6, text: 'Jesus', start: 31, end: 36 },
  { i: 7, text: 'Christ', start: 37, end: 43 },
];

// Alignment pairs (span-based, v2 format)
const mk1_1_alignment = [
  { span: [4, 13], tokenId: 'n41001001001', lexemeId: 'grc-arche-abc', q: 'a', method: 'gloss-exact' },
  { span: [21, 27], tokenId: 'n41001001003', lexemeId: 'grc-euangelion-def', q: 'a', method: 'gloss-exact' },
  { span: [31, 36], tokenId: 'n41001001004', lexemeId: 'grc-iesous-ghi', q: 'a', method: 'gloss-exact' },
  { span: [37, 43], tokenId: 'n41001001005', lexemeId: 'grc-christos-jkl', q: 'a', method: 'gloss-exact' },
];

describe('applyFormLayer', () => {
  it('replaces aligned words with Greek surface forms', () => {
    const dictByKey = buildDictByLexemeId([
      { lexemeId: 'grc-arche-abc', lexemeKey: 'arche', status: 'known', intensityPct: 100, forms: 'form' },
      { lexemeId: 'grc-euangelion-def', lexemeKey: 'euangelion', status: 'known', intensityPct: 100, forms: 'form' },
      { lexemeId: 'grc-iesous-ghi', lexemeKey: 'iesous', status: 'known', intensityPct: 100, forms: 'form' },
      { lexemeId: 'grc-christos-jkl', lexemeKey: 'christos', status: 'known', intensityPct: 100, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThanOrEqual(2);

    // Check specific forms
    const euangelionSeg = formSegs.find(s => s.lexemeId === 'grc-euangelion-def');
    expect(euangelionSeg).toBeDefined();
    expect(euangelionSeg.greek.toLowerCase()).toBe('εὐαγγελίου');
  });

  it('uses lemma instead of surface form when forms=lemma', () => {
    const dictByKey = buildDictByLexemeId([
      { lexemeId: 'grc-euangelion-def', lexemeKey: 'euangelion', status: 'known', intensityPct: 100, forms: 'lemma' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    const euangelionSeg = formSegs.find(s => s.lexemeId === 'grc-euangelion-def');
    expect(euangelionSeg).toBeDefined();
    expect(euangelionSeg.greek.toLowerCase()).toBe('εὐαγγέλιον');
  });

  it('skips u (uncertain) pairs', () => {
    const alignmentWithU = [
      { span: [21, 27], tokenId: 'n41001001003', lexemeId: 'grc-euangelion-def', q: 'u', method: 'unmatched' },
    ];
    const dictByKey = buildDictByLexemeId([
      { lexemeId: 'grc-euangelion-def', lexemeKey: 'euangelion', status: 'known', intensityPct: 100, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, alignmentWithU, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBe(0);
  });

  it('handles missing dict entry gracefully', () => {
    const dictByKey = buildDictByLexemeId([]);
    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    // All words shown as plain since no dict entries
    const plainSegs = segments.filter(s => s.plain !== undefined);
    expect(plainSegs.length).toBeGreaterThan(0);
  });

  it('respects intensity with hash-based decision', () => {
    const dictByKey = buildDictByLexemeId([
      { lexemeId: 'grc-euangelion-def', lexemeKey: 'euangelion', status: 'new', intensityPct: 0, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    // intensityPct=0 with status=new → never replaces
    expect(formSegs.length).toBe(0);
  });

  it('always replaces known words regardless of intensity', () => {
    const dictByKey = buildDictByLexemeId([
      { lexemeId: 'grc-euangelion-def', lexemeKey: 'euangelion', status: 'known', intensityPct: 0, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThan(0);
  });

  it('marks functional pairs with quality=f class', () => {
    const fAlignment = [
      { span: [31, 36], tokenId: 'n41001001004', lexemeId: 'grc-iesous-ghi', q: 'f', method: 'fuzzy' },
    ];
    const dictByKey = buildDictByLexemeId([
      { lexemeId: 'grc-iesous-ghi', lexemeKey: 'iesous', status: 'known', intensityPct: 100, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, fAlignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const fSeg = segments.find(s => s.kind === 'form' && s.lexemeId === 'grc-iesous-ghi');
    expect(fSeg).toBeDefined();
    expect(fSeg.quality).toBe('f');
  });

  it('returns plain text when no alignment data', () => {
    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, [], new Map(), { seedPrefix: 'test' });
    expect(segments.length).toBe(1);
    expect(segments[0].plain).toBe(mk1_1_verseText);
  });
});
