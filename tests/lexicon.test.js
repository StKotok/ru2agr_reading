import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadJSON(relativePath) {
  const fullPath = resolve(__dirname, '..', relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

describe('core lexicon', () => {
  it('exists and has 5468 entries', () => {
    const data = loadJSON('assets/data/lexicon/core.json');
    expect(data.items.length).toBe(5468);
    expect(data.schema).toBe('lexicon-core-v2');
  });

  it('each entry has a unique lexemeId', () => {
    const data = loadJSON('assets/data/lexicon/core.json');
    const ids = data.items.map(i => i.lexemeId);
    expect(new Set(ids).size).toBe(5468);
  });

  it('each entry has a unique lexemeSlug', () => {
    const data = loadJSON('assets/data/lexicon/core.json');
    const slugs = data.items.map(i => i.lexemeSlug).filter(Boolean);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('key lemmas are present', () => {
    const data = loadJSON('assets/data/lexicon/core.json');
    const lemmas = new Set(data.items.map(i => i.lemma));
    expect(lemmas.has('λόγος')).toBe(true);
    expect(lemmas.has('θεός')).toBe(true);
    expect(lemmas.has('κύριος')).toBe(true);
  });

  it('has legacyKeys without conflicts', () => {
    const data = loadJSON('assets/data/lexicon/core.json');
    const legacyMap = new Map();
    const conflicts = new Set();
    for (const item of data.items) {
      for (const lk of item.legacyKeys || []) {
        if (legacyMap.has(lk) && legacyMap.get(lk) !== item.lexemeId) {
          conflicts.add(lk);
        } else {
          legacyMap.set(lk, item.lexemeId);
        }
      }
    }
    expect(conflicts.size).toBe(0);
  });

  it('has dictionary.json with entries', () => {
    const data = loadJSON('assets/data/lexicon/dictionary.json');
    expect(Object.keys(data).length).toBeGreaterThan(5000);
  });
});
