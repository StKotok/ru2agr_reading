import { describe, it, expect } from 'vitest';
import { applyWordLayer } from '../src/engine/word-layer.js';

function prepareEntry(lexeme) {
  return {
    lexemeId: lexeme.id,
    lemma: lexeme.lemma,
    regexps: lexeme.ruMatches.map(r => new RegExp(r, 'iu')),
    excludeRegexps: (lexeme.ruExclude || []).map(r => new RegExp(r, 'iu')),
    intensityPct: 100,
    status: 'learning'
  };
}

describe('applyWordLayer', () => {
  const logosEntry = prepareEntry({
    id: 'logos', lemma: 'λόγος',
    ruMatches: ['(?<![а-яё])слов(о|а|у|е|ом)(?![а-яё])'],
    ruExclude: ['словно']
  });

  it('replaces "Слово" with λόγος and lexemeId', () => {
    const segments = applyWordLayer('Слово', [logosEntry], { seedPrefix: 't' });
    expect(segments.length).toBe(1);
    expect(segments[0].greek).toBe('Λόγος');
    expect(segments[0].original).toBe('Слово');
    expect(segments[0].kind).toBe('word');
    expect(segments[0].lexemeId).toBe('logos');
  });

  it('does not replace excluded word', () => {
    const segments = applyWordLayer('словно', [logosEntry], { seedPrefix: 't' });
    expect(segments[0].plain).toBe('словно');
  });

  it('word not in dictionary is not replaced', () => {
    const segments = applyWordLayer('просто текст', [logosEntry], { seedPrefix: 't' });
    expect(segments.length).toBe(1);
    expect(segments[0].plain).toBe('просто текст');
  });

  it('known status always replaces', () => {
    const entry = { ...logosEntry, status: 'known', intensityPct: 0 };
    const segments = applyWordLayer('Слово', [entry], { seedPrefix: 't' });
    expect(segments[0].greek).toBe('Λόγος');
  });

  it('is deterministic', () => {
    const entry = { ...logosEntry, intensityPct: 50 };
    const r1 = applyWordLayer('Слово', [entry], { seedPrefix: 'john' });
    const r2 = applyWordLayer('Слово', [entry], { seedPrefix: 'john' });
    expect(r1).toEqual(r2);
  });
});
