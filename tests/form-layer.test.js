import { describe, it, expect } from 'vitest';
import { applyFormLayer, buildDictByLexemeKey } from '../src/engine/form-layer.js';

// Test data in MACULA v3 format

// Greek tokens for Mark 1:1 (simplified)
const mk1_1_grcTokens = [
  { id: 'n41001001001', i: 1, s: 'Ἀρχὴ', lemma: 'ἀρχή', lexemeKey: 'arche', morph: 'N-NSF', strongs: ['746'], fw: false },
  { id: 'n41001001002', i: 2, s: 'τοῦ', lemma: 'ὁ', lexemeKey: 'ho', morph: 'T-GSN', strongs: ['3588'], fw: true },
  { id: 'n41001001003', i: 3, s: 'εὐαγγελίου', lemma: 'εὐαγγέλιον', lexemeKey: 'euangelion', morph: 'N-GSN', strongs: ['2098'], fw: false },
  { id: 'n41001001004', i: 4, s: 'Ἰησοῦ', lemma: 'Ἰησοῦς', lexemeKey: 'iesous', morph: 'N-GSM', strongs: ['2424'], fw: false },
  { id: 'n41001001005', i: 5, s: 'Χριστοῦ', lemma: 'Χριστός', lexemeKey: 'christos', morph: 'N-GSM', strongs: ['5547'], fw: false },
];

const mk1_1_verseText = 'Начало Евангелия Иисуса Христа,';
const mk1_1_words = [
  { i: 0, text: 'Начало', start: 0, end: 6 },
  { i: 1, text: 'Евангелия', start: 7, end: 16 },
  { i: 2, text: 'Иисуса', start: 17, end: 23 },
  { i: 3, text: 'Христа', start: 24, end: 30 },
];

// Alignment pairs (span-based)
const mk1_1_alignment = [
  { span: [0, 6], tokenId: 'n41001001001', lexemeKey: 'arche', q: 'e', src: 'ruMatch' },
  { span: [7, 16], tokenId: 'n41001001003', lexemeKey: 'euangelion', q: 'e', src: 'ruMatch' },
  { span: [17, 23], tokenId: 'n41001001004', lexemeKey: 'iesous', q: 'e', src: 'ruMatch' },
  { span: [24, 30], tokenId: 'n41001001005', lexemeKey: 'christos', q: 'e', src: 'ruMatch' },
];

describe('applyFormLayer', () => {
  it('replaces aligned words with Greek surface forms', () => {
    const dictByKey = buildDictByLexemeKey([
      { lexemeKey: 'arche', status: 'known', intensityPct: 100, forms: 'form' },
      { lexemeKey: 'euangelion', status: 'known', intensityPct: 100, forms: 'form' },
      { lexemeKey: 'iesous', status: 'known', intensityPct: 100, forms: 'form' },
      { lexemeKey: 'christos', status: 'known', intensityPct: 100, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThanOrEqual(2);

    // Check specific forms
    const euangelionSeg = formSegs.find(s => s.lexemeKey === 'euangelion');
    expect(euangelionSeg).toBeDefined();
    expect(euangelionSeg.greek.toLowerCase()).toBe('εὐαγγελίου');
  });

  it('uses lemma instead of surface form when forms=lemma', () => {
    const dictByKey = buildDictByLexemeKey([
      { lexemeKey: 'euangelion', status: 'known', intensityPct: 100, forms: 'lemma' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    const euangelionSeg = formSegs.find(s => s.lexemeKey === 'euangelion');
    expect(euangelionSeg).toBeDefined();
    expect(euangelionSeg.greek.toLowerCase()).toBe('εὐαγγέλιον');
  });

  it('skips u (uncertain) pairs', () => {
    const alignmentWithU = [
      { span: [7, 16], tokenId: 'n41001001003', lexemeKey: 'euangelion', q: 'u', src: 'ruMatch' },
    ];
    const dictByKey = buildDictByLexemeKey([
      { lexemeKey: 'euangelion', status: 'known', intensityPct: 100, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, alignmentWithU, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBe(0);
  });

  it('handles missing dict entry gracefully', () => {
    const dictByKey = buildDictByLexemeKey([]);
    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    // All words shown as plain since no dict entries
    const plainSegs = segments.filter(s => s.plain !== undefined);
    expect(plainSegs.length).toBeGreaterThan(0);
  });

  it('respects intensity with hash-based decision', () => {
    const dictByKey = buildDictByLexemeKey([
      { lexemeKey: 'euangelion', status: 'new', intensityPct: 0, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    // intensityPct=0 with status=new → never replaces
    expect(formSegs.length).toBe(0);
  });

  it('always replaces known words regardless of intensity', () => {
    const dictByKey = buildDictByLexemeKey([
      { lexemeKey: 'euangelion', status: 'known', intensityPct: 0, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, mk1_1_alignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThan(0);
  });

  it('marks functional pairs with quality=f class', () => {
    const fAlignment = [
      { span: [17, 23], tokenId: 'n41001001004', lexemeKey: 'iesous', q: 'f', src: 'ruMatch+func' },
    ];
    const dictByKey = buildDictByLexemeKey([
      { lexemeKey: 'iesous', status: 'known', intensityPct: 100, forms: 'form' },
    ]);

    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, fAlignment, dictByKey, { seedPrefix: 'test', mode: 3 });

    const fSeg = segments.find(s => s.kind === 'form' && s.lexemeKey === 'iesous');
    expect(fSeg).toBeDefined();
    expect(fSeg.quality).toBe('f');
  });

  it('returns plain text when no alignment data', () => {
    const segments = applyFormLayer(mk1_1_verseText, mk1_1_words, mk1_1_grcTokens, [], new Map(), { seedPrefix: 'test' });
    expect(segments.length).toBe(1);
    expect(segments[0].plain).toBe(mk1_1_verseText);
  });
});
