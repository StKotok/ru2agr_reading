import { describe, it, expect } from 'vitest';
import { composeVerse } from '../src/engine/compose.js';

describe('composeVerse', () => {
  it('mode 1 applies letter layer', () => {
    const segments = composeVerse('слово', {
      mode: 1,
      intensity: 100,
      progressLetters: {
        'σ': { status: 'known' },
        'λ': { status: 'known' },
        'ο': { status: 'known' },
        'β': { status: 'known' }
      },
      seedPrefix: 'test'
    });
    const text = segments.map(s => s.greek || s.plain || '').join('');
    // Все буквы заменены при intensity 100
    expect(text).toBe('σλοβο');
  });

  it('mode 2 applies letter layer (same as mode 1 for engine)', () => {
    const s1 = composeVerse('тест', {
      mode: 1, intensity: 100,
      progressLetters: { 'τ': { status: 'known' }, 'ε': { status: 'known' }, 'σ': { status: 'known' } },
      seedPrefix: 't'
    });
    const s2 = composeVerse('тест', {
      mode: 2, intensity: 100,
      progressLetters: { 'τ': { status: 'known' }, 'ε': { status: 'known' }, 'σ': { status: 'known' } },
      seedPrefix: 't'
    });
    expect(s1).toEqual(s2);
  });

  it('empty letter progress leaves text untouched', () => {
    const segments = composeVerse('текст', {
      mode: 1, intensity: 100,
      progressLetters: {},
      seedPrefix: 'test'
    });
    // Заменяются только введённые буквы: пустой прогресс → чистый русский текст
    const text = segments.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('текст');
  });

  it('is deterministic', () => {
    const opts = { mode: 1, intensity: 50, progressLetters: { 'α': { status: 'known' } }, seedPrefix: 'john' };
    const r1 = composeVerse('ааа', opts);
    const r2 = composeVerse('ааа', opts);
    expect(r1).toEqual(r2);
  });

  it('mode 4: word-layer fallback для невыровненных словарных слов', () => {
    // Стих с alignment только для «Слово», но не для «Бог»
    const verseText = 'В начале было Слово и Бог';
    const grcTokens = [
      { w: 'Ἐν', lemma: 'ἐν', morph: 'prep', strong: 1722 },
      { w: 'ἀρχῇ', lemma: 'ἀρχή', morph: 'noun', strong: 746 },
      { w: 'λόγος', lemma: 'λόγος', morph: 'noun', strong: 3056 },
      { w: 'θεός', lemma: 'θεός', morph: 'noun', strong: 2316 },
    ];
    // alignment: только «Слово» (ru=3) → λόγος (gr=2)
    const alignment = [{ ru: 3, gr: 2 }];

    const segments = composeVerse(verseText, {
      mode: 4,
      intensity: 0,
      progressLetters: {},
      seedPrefix: 'test',
      wordEntries: [
        {
          lexemeId: 'logos', lemma: 'λόγος', strongNum: 3056,
          regexps: [new RegExp('(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])', 'iu')],
          excludeRegexps: [],
          intensityPct: 100, status: 'known', forms: 'all'
        },
        {
          lexemeId: 'theos', lemma: 'θεός', strongNum: 2316,
          regexps: [new RegExp('(?<![а-яё])[Бб]ог(а|у|ом|е)?(?![а-яё])', 'iu')],
          excludeRegexps: [],
          intensityPct: 100, status: 'known', forms: 'lemma'
        }
      ],
      grcVerse: { tokens: grcTokens },
      alignment
    });

    // «Слово» должно быть заменено формой (kind='form'), с заглавной буквы
    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThanOrEqual(1);
    expect(formSegs.some(s => s.greek.toLowerCase() === 'λόγος')).toBe(true);

    // «Бог» должно быть заменено леммой через word-layer (kind='word')
    const wordSegs = segments.filter(s => s.kind === 'word');
    expect(wordSegs.some(s => s.greek.toLowerCase() === 'θεός')).toBe(true);
  });
});
