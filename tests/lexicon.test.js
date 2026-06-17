import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadJSON(relativePath) {
  const fullPath = resolve(__dirname, '..', relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

describe('top1000 lexicon', () => {
  it('exists and has 1000 entries', () => {
    const data = loadJSON('assets/data/lexicon/top1000.core.json');
    expect(data.items).toHaveLength(1000);
    expect(data.schema).toBe('top1000-lexicon-core-v1');
  });

  it('each entry has a unique lexemeKey', () => {
    const data = loadJSON('assets/data/lexicon/top1000.core.json');
    const keys = data.items.map(i => i.lexemeKey);
    expect(new Set(keys).size).toBe(1000);
  });

  it('key lemmas are present', () => {
    const data = loadJSON('assets/data/lexicon/top1000.core.json');
    const lemmas = new Set(data.items.map(i => i.lemma));
    expect(lemmas.has('λόγος')).toBe(true);
    expect(lemmas.has('θεός')).toBe(true);
    expect(lemmas.has('κύριος')).toBe(true);
  });
});

describe('locale ru', () => {
  it('top1000 overlay exists', () => {
    const data = loadJSON('assets/data/lexicon/locales/ru/top1000.json');
    expect(data.schema).toBe('top1000-locale-overlay-v1');
    expect(data.items.length).toBeGreaterThan(0);
  });

  it('core overlay exists and has key entries', () => {
    const data = loadJSON('assets/data/lexicon/locales/ru/core.json');
    expect(data.schema).toBe('core-locale-overlay-v1');
    const keys = new Set(data.items.map(i => i.lexemeKey));
    expect(keys.has('logos')).toBe(true);
    expect(keys.has('theos')).toBe(true);
    expect(keys.has('kurios')).toBe(true);
  });
});
