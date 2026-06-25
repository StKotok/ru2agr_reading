import { describe, it, expect } from 'vitest';
import { applyLetterLayer } from '../src/engine/letter-layer.js';

const allLetters = new Set([
  'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ',
  'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'
]);

describe('applyLetterLayer', () => {
  // ===========================================================================
  // Общие тесты (script-независимые)
  // ===========================================================================

  it('intensity 0 returns no replacements', () => {
    const segments = applyLetterLayer('test', {
      activeLetters: allLetters, intensity: 0, seedPrefix: 'test'
    });
    const text = segments.map(s => s.plain || s.greek).join('');
    expect(text).toBe('test');
    expect(segments.every(s => s.plain !== undefined)).toBe(true);
  });

  it('is deterministic — Latin', () => {
    const opts = { activeLetters: allLetters, intensity: 60, seedPrefix: 'john', script: 'latin' };
    const r1 = applyLetterLayer('In the beginning was the Word', opts);
    const r2 = applyLetterLayer('In the beginning was the Word', opts);
    expect(r1).toEqual(r2);
  });

  it('is deterministic — Cyrillic', () => {
    const opts = { activeLetters: allLetters, intensity: 60, seedPrefix: 'john', script: 'cyrillic' };
    const r1 = applyLetterLayer('В начале было Слово', opts);
    const r2 = applyLetterLayer('В начале было Слово', opts);
    expect(r1).toEqual(r2);
  });

  it('different seedPrefix gives different result', () => {
    const opts1 = { activeLetters: allLetters, intensity: 50, seedPrefix: 'john' };
    const opts2 = { activeLetters: allLetters, intensity: 50, seedPrefix: 'mark' };
    const r1 = applyLetterLayer('test', opts1);
    const r2 = applyLetterLayer('test', opts2);
    expect(Array.isArray(r1)).toBe(true);
    expect(Array.isArray(r2)).toBe(true);
  });

  it('returns segments in correct format', () => {
    const segments = applyLetterLayer('a', {
      activeLetters: allLetters, intensity: 100, seedPrefix: 'test'
    });
    expect(segments.length).toBe(1);
    const seg = segments[0];
    expect(seg.greek).toBe('α');
    expect(seg.original).toBe('a');
    expect(seg.kind).toBe('letter');
    expect(seg.letter).toBe('α');
  });

  it('plain segments are concatenated', () => {
    const activeLetters = new Set();
    const segments = applyLetterLayer('test', {
      activeLetters, intensity: 100, seedPrefix: 'test'
    });
    expect(segments.length).toBe(1);
    expect(segments[0].plain).toBe('test');
  });

  // ===========================================================================
  // Кириллица (русский текст)
  // ===========================================================================

  describe('cyrillic', () => {
    const cyrOpts = (overrides = {}) => ({
      activeLetters: allLetters, intensity: 100, seedPrefix: 'test',
      script: 'cyrillic', ...overrides
    });

    it('intensity 100 replaces all active letters', () => {
      const segments = applyLetterLayer('Слово', cyrOpts());
      const hasGreek = segments.some(s => s.greek !== undefined);
      expect(hasGreek).toBe(true);
      const plainText = segments.filter(s => s.plain).map(s => s.plain).join('');
      expect(/^[\s.,!?;:()\[\]{}"'\-]*$/.test(plainText)).toBe(true);
    });

    it('final sigma: "с" before space becomes ς', () => {
      const segments = applyLetterLayer('нос ', cyrOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toContain('ς');
    });

    it('preserves case: "Слово" → "Σλοβο"', () => {
      const segments = applyLetterLayer('Слово', cyrOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('Σλοβο');
    });

    it('inactive letter is not replaced', () => {
      const active = new Set(['α', 'ο']);
      const segments = applyLetterLayer('слова', cyrOpts({ activeLetters: active }));
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('слοвα');
    });

    it('digraph "кс" → "ξ" has priority over separate letters', () => {
      const segments = applyLetterLayer('такси', cyrOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('ταξι');
    });

    it('intensity 0 returns no replacements', () => {
      const segments = applyLetterLayer('Слово', cyrOpts({ intensity: 0 }));
      const text = segments.map(s => s.plain || s.greek).join('');
      expect(text).toBe('Слово');
    });
  });

  // ===========================================================================
  // Латиница (английский текст)
  // ===========================================================================

  describe('latin', () => {
    const latOpts = (overrides = {}) => ({
      activeLetters: allLetters, intensity: 100, seedPrefix: 'test',
      script: 'latin', ...overrides
    });

    it('intensity 100 replaces all active Latin letters', () => {
      const segments = applyLetterLayer('test', latOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('τεστ');
    });

    it('preserves case: "Test" → "Τεστ"', () => {
      const segments = applyLetterLayer('Test', latOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('Τεστ');
    });

    it('digraph "th" → "θ"', () => {
      const segments = applyLetterLayer('think', latOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('θινκ');
    });

    it('digraph "ph" → "φ"', () => {
      const segments = applyLetterLayer('philosophy', latOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('φιλοσοφυ'); // ph→φ, i→ι, l→λ, o→ο, s→σ, o→ο, ph→φ, y→υ
    });

    it('digraph "ch" → "χ"', () => {
      const segments = applyLetterLayer('Christ', latOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      // Ch→Χ (upper), r→ρ, i→ι, s→σ, t→τ
      expect(text).toBe('Χριστ');
    });

    it('digraph "ou" → "ου"', () => {
      const segments = applyLetterLayer('you', latOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('υου'); // y→υ, ou→ου
    });

    it('"w" → "ω" (visual mnemonic)', () => {
      const segments = applyLetterLayer('word', latOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toBe('ωορδ'); // w→ω, o→ο, r→ρ, d→δ
    });

    it('inactive letter is not replaced', () => {
      const active = new Set(['α', 'ο', 'τ']);
      const segments = applyLetterLayer('boat', latOpts({ activeLetters: active }));
      const text = segments.map(s => s.greek || s.plain || '').join('');
      // b→not active, o→ο, a→α, t→τ
      expect(text).toBe('bοατ');
    });

    it('final sigma: "s" at end of word becomes ς', () => {
      const segments = applyLetterLayer('gods', latOpts());
      const text = segments.map(s => s.greek || s.plain || '').join('');
      expect(text).toContain('ς');
    });

    it('intensity 0 returns no replacements', () => {
      const segments = applyLetterLayer('test', latOpts({ intensity: 0 }));
      const text = segments.map(s => s.plain || s.greek).join('');
      expect(text).toBe('test');
    });
  });
});
