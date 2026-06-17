import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const core = JSON.parse(readFileSync('assets/data/lexicon/top1000.core.json', 'utf8'));
const items = core.items;

describe('top1000.core.json', () => {
  it('has exactly 1000 items', () => {
    expect(items.length).toBe(1000);
  });

  it('sorted by rank ascending', () => {
    for (let i = 1; i < items.length; i++) {
      expect(items[i].rank).toBeGreaterThanOrEqual(items[i - 1].rank);
    }
  });

  it('first entry is most frequent', () => {
    expect(items[0].rank).toBe(1);
    expect(items[0].count).toBeGreaterThan(0);
  });

  it('every item has required fields', () => {
    for (const item of items) {
      expect(item.lexemeKey).toBeTruthy();
      expect(item.maculaLexemeId).toBeTruthy();
      expect(item.lemma).toBeTruthy();
      expect(Array.isArray(item.strongs)).toBe(true);
      expect(typeof item.count).toBe('number');
      expect(typeof item.rank).toBe('number');
      expect(typeof item.isFunctionWord).toBe('boolean');
      expect(item.firstRef).toBeTruthy();
    }
  });

  it('no ru-fields leak into core', () => {
    for (const item of items) {
      expect(item.gloss).toBeUndefined();
      expect(item.ruMatches).toBeUndefined();
      expect(item.ruExclude).toBeUndefined();
      expect(item.hasAlignment).toBeUndefined();
    }
  });

  it('no duplicate lexemeKeys', () => {
    const keys = items.map(i => i.lexemeKey);
    expect(new Set(keys).size).toBe(1000);
  });

  it('top 3 lemmas are as expected', () => {
    const top3 = items.slice(0, 3).map(i => i.lemma);
    expect(top3).toContain('ὁ');
    expect(top3).toContain('καί');
  });
});
