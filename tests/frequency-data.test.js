import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const items = JSON.parse(readFileSync('assets/data/lexicon/frequency.json', 'utf8'));

describe('frequency.json', () => {
  it('ровно 1000 записей с непрерывным rank с 1', () => {
    expect(items.length).toBe(1000);
    items.forEach((it, i) => expect(it.rank).toBe(i + 1));
  });

  it('отсортирован по count по убыванию', () => {
    for (let i = 1; i < items.length; i++) {
      expect(items[i].count).toBeLessThanOrEqual(items[i - 1].count);
    }
  });

  it('strong уникальны и положительны', () => {
    const seen = new Set(items.map(i => i.strong));
    expect(seen.size).toBe(items.length);
    items.forEach(i => expect(i.strong).toBeGreaterThan(0));
  });

  it('леммы греческие и непустые', () => {
    items.forEach(i => expect(i.lemma).toMatch(/^[Ͱ-Ͽἀ-῿]/));
  });

  it('translit присутствует и непустой у всех записей', () => {
    items.forEach(i => {
      expect(typeof i.translit).toBe('string');
      expect(i.translit.length).toBeGreaterThan(0);
    });
  });

  it('hasAlignment — булево поле', () => {
    items.forEach(i => expect(typeof i.hasAlignment).toBe('boolean'));
  });

  it('топ-3 корпуса: ὁ, καί, αὐτός', () => {
    expect(items[0]).toMatchObject({ strong: 3588, lemma: 'ὁ' });
    expect(items[1]).toMatchObject({ strong: 2532, lemma: 'καί' });
    expect(items[2]).toMatchObject({ strong: 846, lemma: 'αὐτός' });
  });
});
