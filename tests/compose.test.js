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

  it('empty progress returns plain text', () => {
    const segments = composeVerse('текст', {
      mode: 1, intensity: 100,
      progressLetters: {},
      seedPrefix: 'test'
    });
    expect(segments.length).toBe(1);
    expect(segments[0].plain).toBe('текст');
  });

  it('is deterministic', () => {
    const opts = { mode: 1, intensity: 50, progressLetters: { 'α': { status: 'known' } }, seedPrefix: 'john' };
    const r1 = composeVerse('ааа', opts);
    const r2 = composeVerse('ааа', opts);
    expect(r1).toEqual(r2);
  });
});
