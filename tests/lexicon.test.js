import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadJSON(path) {
  const fullPath = resolve(__dirname, '..', path);
  if (!existsSync(fullPath)) return null;
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

describe('core lexicon', () => {
  const lexicon = loadJSON('public/data/lexicon/core.json');

  it('exists and has at least 40 entries', () => {
    expect(lexicon).not.toBeNull();
    if (lexicon) expect(lexicon.length).toBeGreaterThanOrEqual(40);
  });

  it('all entries have required fields', () => {
    if (!lexicon) return;
    for (const entry of lexicon) {
      expect(entry.id).toBeTruthy();
      expect(entry.lemma).toBeTruthy();
      expect(entry.translit).toBeTruthy();
      expect(typeof entry.strong).toBe('number');
      expect(entry.gloss).toBeTruthy();
      expect(Array.isArray(entry.ruMatches)).toBe(true);
      expect(entry.ruMatches.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.ruExclude)).toBe(true);
    }
  });

  it('all regexps compile', () => {
    if (!lexicon) return;
    for (const entry of lexicon) {
      for (const re of entry.ruMatches) {
        expect(() => new RegExp(re, 'iu')).not.toThrow();
      }
      for (const re of entry.ruExclude) {
        expect(() => new RegExp(re, 'iu')).not.toThrow();
      }
    }
  });

  it('logos matches "Слово" but not "словно"', () => {
    if (!lexicon) return;
    const logos = lexicon.find(e => e.id === 'logos');
    expect(logos).toBeDefined();
    const re = new RegExp(logos.ruMatches[0], 'iu');
    expect(re.test('Слово')).toBe(true);
    expect(re.test('слово')).toBe(true);
    expect(re.test('словом')).toBe(true);
    expect(re.test('словно')).toBe(false);
  });

  it('pistis matches "вера" but not "доверие"', () => {
    if (!lexicon) return;
    const pistis = lexicon.find(e => e.id === 'pistis');
    expect(pistis).toBeDefined();
    const re = new RegExp(pistis.ruMatches[0], 'iu');
    expect(re.test('вера')).toBe(true);
    expect(re.test('веры')).toBe(true);
    expect(re.test('вере')).toBe(true);
    expect(re.test('доверие')).toBe(false);
  });

  it('agape matches "любовь" but not "любить"', () => {
    if (!lexicon) return;
    const agape = lexicon.find(e => e.id === 'agape');
    expect(agape).toBeDefined();
    const re = new RegExp(agape.ruMatches[0], 'iu');
    expect(re.test('любовь')).toBe(true);
    expect(re.test('любви')).toBe(true);
    expect(re.test('любить')).toBe(false);
  });
});
