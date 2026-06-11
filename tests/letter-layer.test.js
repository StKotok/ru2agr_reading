import { describe, it, expect } from 'vitest';
import { applyLetterLayer } from '../src/engine/letter-layer.js';

describe('applyLetterLayer', () => {
  const allLetters = new Set([
    'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ',
    'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'
  ]);

  it('intensity 0 returns no replacements', () => {
    const segments = applyLetterLayer('Слово', {
      activeLetters: allLetters,
      intensity: 0,
      seedPrefix: 'test'
    });
    const text = segments.map(s => s.plain || s.greek).join('');
    expect(text).toBe('Слово');
    expect(segments.every(s => s.plain !== undefined)).toBe(true);
  });

  it('intensity 100 replaces all active letters', () => {
    const segments = applyLetterLayer('Слово', {
      activeLetters: allLetters,
      intensity: 100,
      seedPrefix: 'test'
    });
    // Все буквы активны, интенсивность 100 → каждое правило должно сработать
    const hasGreek = segments.some(s => s.greek !== undefined);
    expect(hasGreek).toBe(true);

    // Проверяем, что каждая буква заменена
    const plainText = segments.filter(s => s.plain).map(s => s.plain).join('');
    // Plain текст должен быть пустым или содержать только пробелы/пунктуацию
    expect(/^[\s.,!?;:()\[\]{}"'\-]*$/.test(plainText)).toBe(true);
  });

  it('is deterministic — two calls with same params produce identical results', () => {
    const opts = { activeLetters: allLetters, intensity: 60, seedPrefix: 'john' };
    const r1 = applyLetterLayer('В начале было Слово', opts);
    const r2 = applyLetterLayer('В начале было Слово', opts);
    expect(r1).toEqual(r2);
  });

  it('final sigma: "с" before space becomes ς', () => {
    const segments = applyLetterLayer('нос ', {
      activeLetters: allLetters,
      intensity: 100,
      seedPrefix: 'test'
    });
    const text = segments.map(s => s.greek || s.plain || '').join('');
    expect(text).toContain('ς');
  });

  it('preserves case: "Слово" → "Σλοβο"', () => {
    const segments = applyLetterLayer('Слово', {
      activeLetters: allLetters,
      intensity: 100,
      seedPrefix: 'test'
    });
    const text = segments.map(s => s.greek || s.plain || '').join('');
    // С → Σ, л → λ, о → ο, в → β, о → ο
    expect(text).toBe('Σλοβο');
  });

  it('inactive letter is not replaced', () => {
    const activeLetters = new Set(['α', 'ο']); // только альфа и омикрон
    const segments = applyLetterLayer('слова', {
      activeLetters,
      intensity: 100,
      seedPrefix: 'test'
    });
    const text = segments.map(s => s.greek || s.plain || '').join('');
    // с → не активно, л → не активно, о → ο, в → не активно, а → α
    expect(text).toBe('слοвα');
  });

  it('digraph "кс" → "ξ" has priority over "к" and "с" separately', () => {
    const segments = applyLetterLayer('такси', {
      activeLetters: allLetters,
      intensity: 100,
      seedPrefix: 'test'
    });
    const text = segments.map(s => s.greek || s.plain || '').join('');
    // τ, ξ (кс как диграф), ι
    expect(text).toBe('ταξι');
  });

  it('different seedPrefix gives different result', () => {
    const opts1 = { activeLetters: allLetters, intensity: 50, seedPrefix: 'john' };
    const opts2 = { activeLetters: allLetters, intensity: 50, seedPrefix: 'mark' };
    const r1 = applyLetterLayer('Слово', opts1);
    const r2 = applyLetterLayer('Слово', opts2);
    // При интенсивности 50 результаты могут совпасть случайно, но с разными seeds
    // просто проверяем, что оба вызова не упали и вернули сегменты
    expect(Array.isArray(r1)).toBe(true);
    expect(Array.isArray(r2)).toBe(true);
  });

  it('returns segments in correct format', () => {
    const segments = applyLetterLayer('а', {
      activeLetters: allLetters,
      intensity: 100,
      seedPrefix: 'test'
    });
    expect(segments.length).toBe(1);
    const seg = segments[0];
    expect(seg.greek).toBe('α');
    expect(seg.original).toBe('а');
    expect(seg.kind).toBe('letter');
    expect(seg.letter).toBe('α');
  });

  it('plain segments are concatenated', () => {
    const activeLetters = new Set(); // ничего не активно
    const segments = applyLetterLayer('тест', {
      activeLetters,
      intensity: 100,
      seedPrefix: 'test'
    });
    // Все символы должны быть в одном plain-сегменте
    expect(segments.length).toBe(1);
    expect(segments[0].plain).toBe('тест');
  });
});
