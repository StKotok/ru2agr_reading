import { describe, it, expect } from 'vitest';
import { composeVerse } from '../src/engine/compose.js';

describe('composeVerse', () => {
  it('mode 1 applies letter layer', () => {
    const segments = composeVerse('тест', {
      mode: 1,
      intensity: 100,
      progressLetters: {
        'τ': { status: 'known' },
        'ε': { status: 'known' },
        'σ': { status: 'known' }
      },
      seedPrefix: 'test'
    });
    const text = segments.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('τεστ');
  });

  it('empty letter progress leaves text untouched', () => {
    const segments = composeVerse('текст', {
      mode: 1, intensity: 100,
      progressLetters: {},
      seedPrefix: 'test'
    });
    const text = segments.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('текст');
  });

  // ── Mode 2 via alignment tests (MACULA v3 format) ──

  const grcTokens = [
    { id: 'n43001001001', i: 1, s: 'Ἐν', lemma: 'ἐν', lexemeKey: 'en', morph: 'PREP', strongs: ['1722'], fw: true },
    { id: 'n43001001002', i: 2, s: 'ἀρχῇ', lemma: 'ἀρχή', lexemeKey: 'arche', morph: 'N-DSF', strongs: ['746'], fw: false },
    { id: 'n43001001003', i: 3, s: 'ἦν', lemma: 'εἰμί', lexemeKey: 'eimi', morph: 'V-IAI-3S', strongs: ['1510'], fw: true },
    { id: 'n43001001005', i: 5, s: 'λόγος', lemma: 'λόγος', lexemeKey: 'logos', morph: 'N-NSM', strongs: ['3056'], fw: false },
  ];
  const words = [
    { i: 0, text: 'В', start: 0, end: 1 },
    { i: 1, text: 'начале', start: 2, end: 8 },
    { i: 2, text: 'было', start: 9, end: 13 },
    { i: 3, text: 'Слово', start: 14, end: 19 },
  ];
  const wordEntryLogos = {
    lexemeKey: 'logos', lexemeId: 'logos', lemma: 'λόγος',
    regexps: [/(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])/iu],
    excludeRegexps: [], intensityPct: 100, status: 'known', forms: 'lemma'
  };
  const mode2Ctx = {
    mode: 2, intensity: 0, progressLetters: {},
    seedPrefix: 't', wordEntries: [wordEntryLogos]
  };

  it('mode 2: замена на лемму, не на форму', () => {
    const segs = composeVerse('В начале было Слово', {
      ...mode2Ctx,
      words,
      grcTokens,
      alignment: [{ span: [14, 19], tokenId: 'n43001001005', lexemeKey: 'logos', q: 'e', src: 'ruMatch' }]
    });
    expect(segs.some(s => s.greek && s.greek.toLowerCase() === 'λόγος')).toBe(true);
    expect(segs.some(s => s.greek && s.greek.toLowerCase() === 'λόγον')).toBe(false);
  });

  it('mode 2: слово без выравнивания не заменяется', () => {
    const segs = composeVerse('В начале было Слово', {
      ...mode2Ctx,
      words,
      grcTokens,
      alignment: [{ span: [0, 1], tokenId: 'n43001001001', lexemeKey: 'en', q: 'e', src: 'ruMatch' }]
    });
    const text = segs.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('В начале было Слово');
  });

  it('mode 2: нет grcTokens/alignment — словарных замен нет', () => {
    const segs = composeVerse('Слово', mode2Ctx);
    const text = segs.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('Слово');
  });

  it('mode 2: без alignment замен нет', () => {
    const segs = composeVerse('В начале был свет', mode2Ctx);
    const text = segs.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('В начале был свет');
  });

  it('mode 2: детерминизм', () => {
    const ctx = {
      ...mode2Ctx,
      words,
      grcTokens,
      alignment: [{ span: [14, 19], tokenId: 'n43001001005', lexemeKey: 'logos', q: 'e', src: 'ruMatch' }]
    };
    const r1 = composeVerse('В начале было Слово', ctx);
    const r2 = composeVerse('В начале было Слово', ctx);
    expect(r1).toEqual(r2);
  });

  it('is deterministic (mode 1)', () => {
    const opts = { mode: 1, intensity: 50, progressLetters: { 'α': { status: 'known' } }, seedPrefix: 'john' };
    const r1 = composeVerse('ааа', opts);
    const r2 = composeVerse('ааа', opts);
    expect(r1).toEqual(r2);
  });

  it('mode 3: невыровненные слова остаются русскими', () => {
    const verseText = 'В начале было Слово и Бог';
    const vWords = [
      { i: 0, text: 'В', start: 0, end: 1 },
      { i: 1, text: 'начале', start: 2, end: 8 },
      { i: 2, text: 'было', start: 9, end: 13 },
      { i: 3, text: 'Слово', start: 14, end: 19 },
      { i: 4, text: 'и', start: 20, end: 21 },
      { i: 5, text: 'Бог', start: 22, end: 25 },
    ];
    const vGrcTokens = [
      { id: 't1', i: 1, s: 'λόγος', lemma: 'λόγος', lexemeKey: 'logos', morph: 'N-NSM', strongs: ['3056'], fw: false },
    ];
    const vAlignment = [{ span: [14, 19], tokenId: 't1', lexemeKey: 'logos', q: 'e', src: 'ruMatch' }];

    const segments = composeVerse(verseText, {
      mode: 3, intensity: 0, progressLetters: {}, seedPrefix: 'test',
      words: vWords, grcTokens: vGrcTokens, alignment: vAlignment,
      wordEntries: [
        { lexemeKey: 'logos', lexemeId: 'logos', lemma: 'λόγος', forms: 'form',
          regexps: [new RegExp('(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])', 'iu')],
          excludeRegexps: [], intensityPct: 100, status: 'known' }
      ],
    });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThanOrEqual(1);
    const allText = segments.map(s => s.greek || s.plain || '').join('');
    expect(allText).toContain('Бог');
    expect(allText).not.toContain('θεός');
  });

  it('mode 3 без греческих данных не делает словарных замен', () => {
    const segments = composeVerse('В начале было Слово', {
      mode: 3, intensity: 0, progressLetters: {}, seedPrefix: 'test',
      wordEntries: [
        { lexemeKey: 'logos', lexemeId: 'logos', lemma: 'λόγος', forms: 'form',
          regexps: [new RegExp('(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])', 'iu')],
          excludeRegexps: [], intensityPct: 100, status: 'known' }
      ]
    });
    const text = segments.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('В начале было Слово');
  });

  it('explicit forms:lemma переопределяет глобальный wordLayer=form', () => {
    const vWords = [{ i: 0, text: 'Слово', start: 0, end: 5 }];
    const vGrcTokens = [
      { id: 't1', i: 1, s: 'λόγος', lemma: 'λόγος', lexemeKey: 'logos', morph: 'N-NSM', strongs: ['3056'], fw: false },
    ];
    const vAlign = [{ span: [0, 5], tokenId: 't1', lexemeKey: 'logos', q: 'e', src: 'ruMatch' }];
    const segments = composeVerse('Слово', {
      mode: 3, intensity: 0, progressLetters: {}, seedPrefix: 'test',
      words: vWords, grcTokens: vGrcTokens, alignment: vAlign,
      wordEntries: [
        { lexemeKey: 'logos', forms: 'lemma', intensityPct: 100, status: 'known' }
      ]
    });
    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThanOrEqual(1);
    if (formSegs.length > 0) {
      expect(formSegs[0].greek.toLowerCase()).toBe('λόγος');
    }
  });
});
