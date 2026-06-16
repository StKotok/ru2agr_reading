import { describe, it, expect, beforeAll } from 'vitest';
import { applyFormLayer } from '../src/engine/form-layer.js';

// Загружаем реальные данные
let synMark = null;
let grcMark = null;

beforeAll(async () => {
  synMark = await import('../assets/data/bibles/syn/mark.json', { assert: { type: 'json' } });
  grcMark = await import('../assets/data/bibles/grc/mark.json', { assert: { type: 'json' } });
});

/**
 * Вспомогательная функция: находит стих Мк ch:v.
 */
function getVerse(chN, vN) {
  const ch = synMark.default.chapters.find(c => c.n === chN);
  if (!ch) return null;
  const verse = ch.verses.find(v => v.n === vN);
  if (!verse) return null;

  const grcCh = grcMark.default.chapters.find(c => c.n === chN);
  if (!grcCh) return null;
  const grcVerse = grcCh.verses.find(v => v.n === vN);
  if (!grcVerse) return null;

  return {
    verseText: verse.text,
    alignment: verse.alignment,
    grcTokens: grcVerse.tokens
  };
}

describe('applyFormLayer', () => {
  it('Мк 1:1 — forms=form: «Евангелия» → εὐαγγελίου (род. падеж, не лемма)', () => {
    const { verseText, alignment, grcTokens } = getVerse(1, 1);
    expect(alignment).toBeTruthy();
    expect(grcTokens).toBeTruthy();

    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098, intensityPct: 100, status: 'known', forms: 'form' }
    ], { seedPrefix: 'mark' });

    // Ищем сегмент с kind='form' и проверяем что это родительный падеж
    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThan(0);

    const euangelionSeg = formSegs.find(s => s.strong === 2098);
    expect(euangelionSeg).toBeDefined();
    // Реальная форма в Мк 1:1 — εὐαγγελίου (род. падеж)
    // form-layer сохраняет регистр: «Евангелия» → Εὐαγγελίου
    expect(euangelionSeg.greek.toLowerCase()).toBe('εὐαγγελίου');
    expect(euangelionSeg.greek).not.toBe('Εὐαγγέλιον');
  });

  it('Мк 1:1 — forms=lemma: «Евангелия» → εὐαγγέλιον (лемма)', () => {
    const { verseText, alignment, grcTokens } = getVerse(1, 1);
    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098, intensityPct: 100, status: 'known', forms: 'lemma' }
    ], { seedPrefix: 'mark' });

    const formSegs = segments.filter(s => s.kind === 'form');
    const euangelionSeg = formSegs.find(s => s.strong === 2098);
    expect(euangelionSeg).toBeDefined();
    // При forms=lemma должна быть лемма εὐαγγέλιον (с сохранением регистра)
    expect(euangelionSeg.greek.toLowerCase()).toBe('εὐαγγέλιον');
  });

  it('Мк 1:1 — слово не из словаря → plain', () => {
    const { verseText, alignment, grcTokens } = getVerse(1, 1);
    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      // Только Христос в словаре, без Евангелие
      { lexemeId: 'christos', lemma: 'Χριστός', strong: 5547, intensityPct: 100, status: 'known', forms: 'form' }
    ], { seedPrefix: 'mark' });

    // Проверяем что есть plain-сегменты для слов не из словаря
    const plainTexts = segments.filter(s => s.plain !== undefined).map(s => s.plain).join('');
    // «Начало» должно остаться в plain
    expect(plainTexts).toContain('Начало');
  });

  it('Мк 1:1 — несколько слов выровнено', () => {
    const { verseText, alignment, grcTokens } = getVerse(1, 1);
    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098, intensityPct: 100, status: 'known', forms: 'form' },
      { lexemeId: 'iesous', lemma: 'Ἰησοῦς', strong: 2424, intensityPct: 100, status: 'known', forms: 'form' },
      { lexemeId: 'theos', lemma: 'θεός', strong: 2316, intensityPct: 100, status: 'known', forms: 'form' }
    ], { seedPrefix: 'mark' });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThanOrEqual(2);

    // Проверяем что все формы — реальные словоформы
    for (const seg of formSegs) {
      expect(seg.greek).toBeTruthy();
      expect(seg.original).toBeTruthy();
      expect(seg.morph).toBeTruthy();
      expect(seg.strong).toBeGreaterThan(0);
    }
  });

  it('невыровненный стих (без alignment) → возвращает plain', () => {
    const segments = applyFormLayer('Тестовый стих', [], null, [
      { lexemeId: 'test', lemma: 'test', strong: 1, intensityPct: 100, status: 'known', forms: 'form' }
    ], { seedPrefix: 'test' });

    expect(segments.length).toBe(1);
    expect(segments[0].plain).toBe('Тестовый стих');
  });

  it('пустой alignment → возвращает plain', () => {
    const segments = applyFormLayer('Тестовый стих', [], [], [
      { lexemeId: 'test', lemma: 'test', strong: 1, intensityPct: 100, status: 'known', forms: 'form' }
    ], { seedPrefix: 'test' });

    expect(segments.length).toBe(1);
    expect(segments[0].plain).toBe('Тестовый стих');
  });

  it('учитывает intensity: status=known всегда заменяет', () => {
    const { verseText, alignment, grcTokens } = getVerse(1, 1);
    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098, intensityPct: 100, status: 'known', forms: 'form' }
    ], { seedPrefix: 'mark' });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThan(0);
  });

  it('status=new с high intensity заменяет часто, но не всегда (детерминизм)', () => {
    const { verseText, alignment, grcTokens } = getVerse(1, 1);
    const run1 = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098, intensityPct: 100, status: 'new', forms: 'form' }
    ], { seedPrefix: 'mark:test' });

    const run2 = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098, intensityPct: 100, status: 'new', forms: 'form' }
    ], { seedPrefix: 'mark:test' });

    // Детерминизм: одинаковый seed → одинаковый результат
    const form1 = run1.filter(s => s.kind === 'form');
    const form2 = run2.filter(s => s.kind === 'form');
    expect(form1.length).toBe(form2.length);
  });

  it('пунктуация: trailing punctuation отделяется как plain-сегмент', () => {
    const { verseText, alignment, grcTokens } = getVerse(1, 1);
    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'iesous', lemma: 'Ἰησοῦς', strong: 2424, intensityPct: 100, status: 'known', forms: 'form' }
    ], { seedPrefix: 'mark' });

    // Находим form-сегмент для Иисуса (у него нет trailing punct)
    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBeGreaterThan(0);

    // Проверяем что plain-сегменты содержат пунктуацию
    const plainTexts = segments.filter(s => s.plain !== undefined).map(s => s.plain);
    const allText = plainTexts.join('');
    // В стихе должна быть запятая
    expect(allText).toContain(',');
  });

  it('forms не указан (по умолчанию) → использует реальную форму', () => {
    const { verseText, alignment, grcTokens } = getVerse(1, 1);
    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098, intensityPct: 100, status: 'known' }
    ], { seedPrefix: 'mark' });

    const formSegs = segments.filter(s => s.kind === 'form');
    const seg = formSegs.find(s => s.strong === 2098);
    expect(seg).toBeDefined();
    // Без явного forms должен быть grToken.w (реальная форма)
    expect(seg.greek.toLowerCase()).toBe('εὐαγγελίου');
  });

  it('ruMatches-валидация: служебное слово «у» → λόγος НЕ заменяется', () => {
    // Симулируем ошибочный alignment: русское «у» выровнено на греческий λόγος
    const verseText = 'В начале было Слово и Слово было у Бога';
    const grcTokens = [
      { w: 'λόγος', lemma: 'λόγος', morph: 'N-NSM', strong: 3056 },
      { w: 'λόγος', lemma: 'λόγος', morph: 'N-NSM', strong: 3056 },
    ];
    // alignment: ru=7 («у») → gr=0 (λόγος)
    const alignment = [{ ru: 7, gr: 0 }];

    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      {
        lexemeId: 'logos', lemma: 'λόγος', strong: 3056,
        intensityPct: 100, status: 'known', forms: 'form',
        regexps: [new RegExp('(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])', 'iu')],
        excludeRegexps: [new RegExp('словно', 'iu'), new RegExp('условие', 'iu'), new RegExp('словарь', 'iu')],
      }
    ], { seedPrefix: 'test' });

    // «у» (ru=7) не матчится на «слово» → НЕ должен быть заменён
    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBe(0);
  });

  it('intensityPct=0 со статусом new никогда не заменяет', () => {
    const verseText = 'Начало Евангелия';
    const grcTokens = [
      { w: 'Ἀρχὴ', lemma: 'ἀρχή', morph: 'N-NSF', strong: 746 },
      { w: 'εὐαγγελίου', lemma: 'εὐαγγέλιον', morph: 'N-GSN', strong: 2098 },
    ];
    const alignment = [{ ru: 1, gr: 1 }]; // «Евангелия» → εὐαγγελίου

    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098,
        intensityPct: 0, status: 'new', forms: 'form' }
    ], { seedPrefix: 'mark' });

    // intensityPct=0, status='new' → shouldReplace всегда false
    expect(segments.every(s => s.greek === undefined)).toBe(true);
  });

  it('intensityPct=100 со статусом new заменяет', () => {
    const verseText = 'Начало Евангелия';
    const grcTokens = [
      { w: 'Ἀρχὴ', lemma: 'ἀρχή', morph: 'N-NSF', strong: 746 },
      { w: 'εὐαγγελίου', lemma: 'εὐαγγέλιον', morph: 'N-GSN', strong: 2098 },
    ];
    const alignment = [{ ru: 1, gr: 1 }]; // «Евангелия» → εὐαγγελίου

    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098,
        intensityPct: 100, status: 'new', forms: 'form' }
    ], { seedPrefix: 'mark' });

    // intensityPct=100, status='new' → hash01 * 100 < 100 всегда true
    // form-layer сохраняет регистр: «Евангелия» → Εὐαγγελίου
    expect(segments.some(s => s.greek && s.greek.toLowerCase() === 'εὐαγγελίου')).toBe(true);
  });

  it('ruMatches-валидация: «Слово» → λόγος — замена проходит', () => {
    const verseText = 'В начале было Слово';
    const grcTokens = [
      { w: 'λόγος', lemma: 'λόγος', morph: 'N-NSM', strong: 3056 },
    ];
    const alignment = [{ ru: 3, gr: 0 }]; // ru=3 = «Слово,»

    const segments = applyFormLayer(verseText, grcTokens, alignment, [
      {
        lexemeId: 'logos', lemma: 'λόγος', strong: 3056,
        intensityPct: 100, status: 'known', forms: 'form',
        regexps: [new RegExp('(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])', 'iu')],
        excludeRegexps: [new RegExp('словно', 'iu'), new RegExp('условие', 'iu'), new RegExp('словарь', 'iu')],
      }
    ], { seedPrefix: 'test' });

    const formSegs = segments.filter(s => s.kind === 'form');
    expect(formSegs.length).toBe(1);
    expect(formSegs[0].greek.toLowerCase()).toBe('λόγος');
  });
});
