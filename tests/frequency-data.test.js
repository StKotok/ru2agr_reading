import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const items = JSON.parse(readFileSync('assets/data/lexicon/frequency.json', 'utf8'));
const core = Object.values(JSON.parse(readFileSync('assets/data/lexicon/core.json', 'utf8')));
const coreStrongs = new Set(core.map(e => e.strong));

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

  it('translit — чистый ASCII, непустой', () => {
    items.forEach(i => expect(i.translit).toMatch(/^[A-Za-z]+$/));
  });

  it('hasAlignment — булево поле', () => {
    items.forEach(i => expect(typeof i.hasAlignment).toBe('boolean'));
  });

  it('топ-3 корпуса: ὁ, καί, αὐτός', () => {
    expect(items[0]).toMatchObject({ strong: 3588, lemma: 'ὁ' });
    expect(items[1]).toMatchObject({ strong: 2532, lemma: 'καί' });
    expect(items[2]).toMatchObject({ strong: 846, lemma: 'αὐτός' });
  });

  // С переходом на Zefania Strong-выравнивание, alignment покрывает
  // все топ-1000 слов. Лексемы core.json, попавшие в топ-1000,
  // обязаны иметь hasAlignment=true.
  it('core.json ∩ frequency → hasAlignment=true', () => {
    const freqStrongs = new Set(items.map(i => i.strong));
    let covered = 0;
    for (const s of coreStrongs) {
      if (freqStrongs.has(s)) {
        const item = items.find(i => i.strong === s);
        expect(item.hasAlignment).toBe(true);
        covered++;
      }
    }
    // Минимум 100 из 104 лексем core.json должны быть в топ-1000
    expect(covered).toBeGreaterThanOrEqual(100);
  });

  it('все топ-1000 слов имеют alignment', () => {
    expect(items.filter(i => i.hasAlignment).length).toBe(1000);
  });
});
