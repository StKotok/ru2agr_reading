import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const core = JSON.parse(readFileSync('assets/data/lexicon/core.json', 'utf8'));
const items = core.items;

describe('core.json', () => {
  it('has exactly 5468 items', () => {
    expect(items.length).toBe(5468);
  });

  it('freqRank present for all entries', () => {
    const nullRanks = items.filter(i => i.freqRank == null);
    expect(nullRanks.length).toBe(0);
  });

  it('first entry is most frequent (rank 1)', () => {
    const rank1 = items.find(i => i.freqRank === 1);
    expect(rank1).toBeTruthy();
    expect(rank1.freqTokenCount).toBeGreaterThan(0);
  });

  it('every item has required fields', () => {
    for (const item of items) {
      expect(item.lexemeId).toBeTruthy();
      expect(item.lexemeSlug).toBeTruthy();
      expect(item.lemma).toBeTruthy();
      expect(Array.isArray(item.strongs)).toBe(true);
      expect(typeof item.isFunctionWord).toBe('boolean');
      expect(Array.isArray(item.legacyKeys)).toBe(true);
    }
  });

  it('no duplicate lexemeIds', () => {
    const ids = items.map(i => i.lexemeId);
    expect(new Set(ids).size).toBe(5468);
  });

  it('top lemmas include common Greek words', () => {
    const lemmas = new Set(items.map(i => i.lemma));
    expect(lemmas.has('ὁ')).toBe(true);
    expect(lemmas.has('καί')).toBe(true);
    expect(lemmas.has('αὐτός')).toBe(true);
  });

  it('ruGloss present for curated entries', () => {
    const logos = items.find(i => i.lexemeSlug === 'logos');
    expect(logos).toBeTruthy();
    expect(logos.ruGloss).toBeTruthy();
  });
});
