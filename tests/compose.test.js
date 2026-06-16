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
    // Заменяются только введённые буквы: пустой прогресс → чистый русский текст
    const text = segments.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('текст');
  });

  // ── Mode 2 via alignment tests ──

  const grcTokens = [
    { w: 'Ἐν', lemma: 'ἐν', morph: 'PREP', strong: 1722 },
    { w: 'ἀρχῇ', lemma: 'ἀρχή', morph: 'N-DSF', strong: 746 },
    { w: 'ἦν', lemma: 'εἰμί', morph: 'V-IAI-3S', strong: 1510 },
    { w: 'λόγον', lemma: 'λόγος', morph: 'N-ASM', strong: 3056 },
  ];
  const wordEntryLogos = {
    lexemeId: 'logos', lemma: 'λόγος', strongNum: 3056,
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
      grcVerse: { tokens: grcTokens },
      alignment: [{ ru: 3, gr: 3 }]  // «Слово» → λόγος
    });
    // Есть замена с леммой λόγος (с заглавной буквы — «Слово»)
    expect(segs.some(s => s.greek && s.greek.toLowerCase() === 'λόγος')).toBe(true);
    // НЕТ замены с формой λόγον (forms: 'lemma' — показываем лемму)
    expect(segs.some(s => s.greek && s.greek.toLowerCase() === 'λόγον')).toBe(false);
  });

  it('mode 2: слово без выравнивания не заменяется, даже если регулярка матчит', () => {
    // «Слово» не выровнено (alignment ссылается на другое русское слово)
    const segs = composeVerse('В начале было Слово', {
      ...mode2Ctx,
      grcVerse: { tokens: grcTokens },
      alignment: [{ ru: 0, gr: 0 }]  // выровнено только «В» (явная ошибка выравнивания)
    });
    const text = segs.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('В начале было Слово');
  });

  it('mode 2: нет grcVerse/alignment — словарных замен нет', () => {
    const segs = composeVerse('Слово', mode2Ctx);
    const text = segs.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('Слово');
  });

  it('mode 2: guard ruMatches — «свет» выровненный с λόγον не заменяется', () => {
    const verseText = 'В начале был свет';
    const tokensWithLogos = [
      { w: 'λόγον', lemma: 'λόγος', morph: 'N-ASM', strong: 3056 },
    ];
    // «свет» выровнен с λόγον — ошибка выравнивания, guard должен отклонить
    const segs = composeVerse(verseText, {
      ...mode2Ctx,
      grcVerse: { tokens: tokensWithLogos },
      alignment: [{ ru: 3, gr: 0 }]
    });
    const text = segs.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('В начале был свет');
  });

  it('mode 2: детерминизм', () => {
    const ctx = {
      ...mode2Ctx,
      grcVerse: { tokens: grcTokens },
      alignment: [{ ru: 3, gr: 3 }]
    };
    const r1 = composeVerse('В начале было Слово', ctx);
    const r2 = composeVerse('В начале было Слово', ctx);
    expect(r1).toEqual(r2);
  });

  it('is deterministic', () => {
    const opts = { mode: 1, intensity: 50, progressLetters: { 'α': { status: 'known' } }, seedPrefix: 'john' };
    const r1 = composeVerse('ааа', opts);
    const r2 = composeVerse('ааа', opts);
    expect(r1).toEqual(r2);
  });

  it('mode 3: невыровненные слова остаются русскими', () => {
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
      mode: 3,
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

    // «Бог» НЕ должно быть заменено — оно не выровнено (нет в alignment)
    const allText = segments.map(s => s.greek || s.plain || '').join('');
    expect(allText).toContain('Бог');
    expect(allText).not.toContain('θεός');
  });

  it('mode 3 без греческих данных не делает словарных замен', () => {
    const verseText = 'В начале было Слово';
    const segments = composeVerse(verseText, {
      mode: 3,
      intensity: 0,
      progressLetters: {},
      seedPrefix: 'test',
      wordEntries: [
        {
          lexemeId: 'logos', lemma: 'λόγος', strongNum: 3056,
          regexps: [new RegExp('(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])', 'iu')],
          excludeRegexps: [],
          intensityPct: 100, status: 'known', forms: 'all'
        }
      ]
    });
    // Без grcVerse/alignment — только буквенный слой
    const text = segments.map(s => s.greek || s.plain || '').join('');
    expect(text).toBe('В начале было Слово');
  });
});
