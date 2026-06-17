import { describe, it, expect } from 'vitest';
import { buildLexemeKeyMap, shortHash } from '../lib/lexeme-key.mjs';

// Minimal mock data matching the known collision groups
const mockLexemes = [
  // Collision group: ou
  { id: 'grc-ou-abc123', lemma: 'οὐ', transliteration: { value: 'ou' }, strong: ['3756'] },
  { id: 'grc-ou-def456', lemma: 'οὔ', transliteration: { value: 'ou' }, strong: ['3756'] },
  // Collision group: tis
  { id: 'grc-tis-111aaa', lemma: 'τίς', transliteration: { value: 'tis' }, strong: ['5101'] },
  { id: 'grc-tis-222bbb', lemma: 'τις', transliteration: { value: 'tis' }, strong: ['5100'] },
  // Curated: logos (should use curated key)
  { id: 'grc-logos-04b1f3', lemma: 'λόγος', transliteration: { value: 'logos' }, strong: ['3056'] },
  // Curated: theos
  { id: 'grc-theos-3f4df2', lemma: 'θεός', transliteration: { value: 'theos' }, strong: ['2316'] },
  // Curated: kurios
  { id: 'grc-kyrios-a1b2c3', lemma: 'κύριος', transliteration: { value: 'kyrios' }, strong: ['2962'] },
  // Non-curated, no collision
  { id: 'grc-biblos-9adfa6', lemma: 'βίβλος', transliteration: { value: 'biblos' }, strong: ['976'] },
  // Collision: ara
  { id: 'grc-ara-aaa111', lemma: 'ἄρα', transliteration: { value: 'ara' }, strong: ['686'] },
  { id: 'grc-ara-bbb222', lemma: 'ἆρα', transliteration: { value: 'ara' }, strong: ['687'] },
  { id: 'grc-ara-ccc333', lemma: 'ἀρά', transliteration: { value: 'ara' }, strong: ['685'] },
  // Collision: pou
  { id: 'grc-pou-111aaa', lemma: 'ποῦ', transliteration: { value: 'pou' }, strong: ['4226'] },
  { id: 'grc-pou-222bbb', lemma: 'πού', transliteration: { value: 'pou' }, strong: ['4225'] },
  // Collision: pōs
  { id: 'grc-pos-111aaa', lemma: 'πῶς', transliteration: { value: 'pōs' }, strong: ['4459'] },
  { id: 'grc-pos-222bbb', lemma: 'πώς', transliteration: { value: 'pōs' }, strong: ['4458'] },
  // Collision: pote
  { id: 'grc-pote-111aaa', lemma: 'ποτέ', transliteration: { value: 'pote' }, strong: ['4218'] },
  { id: 'grc-pote-222bbb', lemma: 'πότε', transliteration: { value: 'pote' }, strong: ['4219'] },
  // Collision: Silas
  { id: 'grc-silas-111aaa', lemma: 'Σίλας', transliteration: { value: 'Silas' }, strong: ['4609'] },
  { id: 'grc-silas-222bbb', lemma: 'Σιλᾶς', transliteration: { value: 'Silas' }, strong: ['4609'] },
  // Collision: Solomōn
  { id: 'grc-solomon-111aaa', lemma: 'Σολομών', transliteration: { value: 'Solomōn' }, strong: ['4672'] },
  { id: 'grc-solomon-222bbb', lemma: 'Σολομῶν', transliteration: { value: 'Solomōn' }, strong: ['4672'] },
  // Collision: syniēmi
  { id: 'grc-syniemi-111aaa', lemma: 'συνίημι', transliteration: { value: 'syniēmi' }, strong: ['4920'] },
  { id: 'grc-syniemi-222bbb', lemma: 'σύνιημι', transliteration: { value: 'syniēmi' }, strong: ['4920'] },
  // Collision: pharmakos
  { id: 'grc-pharmakos-111aaa', lemma: 'φαρμακός', transliteration: { value: 'pharmakos' }, strong: ['5332'] },
  { id: 'grc-pharmakos-222bbb', lemma: 'φάρμακος', transliteration: { value: 'pharmakos' }, strong: ['5333'] },
];

const mockCurated = [
  { id: 'logos', lemma: 'λόγος', strong: 3056 },
  { id: 'theos', lemma: 'θεός', strong: 2316 },
  { id: 'kurios', lemma: 'κύριος', strong: 2962 },
];

describe('shortHash', () => {
  it('extracts hash from maculaLexemeId', () => {
    expect(shortHash('grc-logos-04b1f3')).toBe('04b1f3');
    expect(shortHash('grc-ou-abc123')).toBe('abc123');
  });

  it('returns last 6 chars for non-standard ids', () => {
    expect(shortHash('simple-id-xyz')).toBe('xyz');
    expect(shortHash('abc')).toBe('abc');
  });
});

describe('buildLexemeKeyMap', () => {
  it('maps curated entries by Strong', () => {
    const { map } = buildLexemeKeyMap(mockLexemes, mockCurated);
    expect(map.get('grc-logos-04b1f3')).toBe('logos');
    expect(map.get('grc-theos-3f4df2')).toBe('theos');
    expect(map.get('grc-kyrios-a1b2c3')).toBe('kurios');
  });

  it('maps non-curated entries by transliteration', () => {
    const { map } = buildLexemeKeyMap(mockLexemes, mockCurated);
    expect(map.get('grc-biblos-9adfa6')).toBe('biblos');
  });

  it('resolves transliteration collisions with hash suffix', () => {
    const { map } = buildLexemeKeyMap(mockLexemes, mockCurated);
    // ou group: first gets 'ou', second gets 'ou-<hash>'
    expect(map.get('grc-ou-abc123')).toBe('ou');
    expect(map.get('grc-ou-def456')).toBe('ou-def456');
    // tis group
    expect(map.get('grc-tis-111aaa')).toBe('tis');
    expect(map.get('grc-tis-222bbb')).toBe('tis-222bbb');
  });

  it('resolves all 10 known collision groups', () => {
    const { report } = buildLexemeKeyMap(mockLexemes, mockCurated);
    expect(report.collisionGroupsResolved).toBeGreaterThanOrEqual(10);
    ['ou', 'tis', 'ara', 'pou', 'pōs', 'pote', 'Silas', 'Solomōn', 'syniēmi', 'pharmakos'].forEach(g => {
      expect(report.collisionGroups).toContain(g);
    });
  });

  it('ensures global uniqueness of keys', () => {
    const { map, report } = buildLexemeKeyMap(mockLexemes, mockCurated);
    const keys = [...map.values()];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
    expect(report.duplicates).toBe(0);
  });

  it('preserves curated keys', () => {
    const { map } = buildLexemeKeyMap(mockLexemes, mockCurated);
    // Curated keys should use human-readable IDs, not hash-based ones
    const curatedKeys = ['logos', 'theos', 'kurios'];
    curatedKeys.forEach(k => {
      expect([...map.values()]).toContain(k);
    });
  });
});
