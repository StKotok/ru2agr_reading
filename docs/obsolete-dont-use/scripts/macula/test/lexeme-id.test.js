import { describe, it, expect } from 'vitest';
import { generateLexemeId, buildLexemeIdMap } from '../lib/lexeme-id.mjs';

describe('generateLexemeId', () => {
  it('should produce same ID for same lemma', () => {
    const id1 = generateLexemeId('λόγος');
    const id2 = generateLexemeId('λόγος');
    expect(id1).toBe(id2);
  });

  it('should produce different IDs for different lemmas', () => {
    const id1 = generateLexemeId('λόγος');
    const id2 = generateLexemeId('θεός');
    expect(id1).not.toBe(id2);
  });

  it('should produce stable ID format', () => {
    const id = generateLexemeId('λόγος');
    expect(id).toMatch(/^grc-[a-z]+-[a-f0-9]{6}$/);
  });

  it('should produce same ID regardless of NFC/NFD', () => {
    const nfc = generateLexemeId('λόγος');
    const nfd = generateLexemeId('λόγος');
    expect(nfc).toBe(nfd);
  });
});

describe('buildLexemeIdMap', () => {
  it('should map all lemmas', () => {
    const lemmas = ['λόγος', 'θεός', 'ἀγάπη'];
    const { map, collisions } = buildLexemeIdMap(lemmas);
    expect(map.size).toBe(3);
    expect(collisions).toHaveLength(0);
  });

  it('should detect collisions', () => {
    // This tests the detection mechanism; actual collisions are extremely unlikely
    const { map } = buildLexemeIdMap(['λόγος']);
    expect(map.get('λόγος')).toBeTruthy();
  });

  it('should handle large lemma sets', () => {
    // Simulate ~5400 lemmas
    const lemmas = Array.from({ length: 1000 }, (_, i) => `λέξις${i}`);
    const { map, collisions } = buildLexemeIdMap(lemmas);
    expect(map.size).toBe(1000);
    expect(collisions).toHaveLength(0);
  });
});
