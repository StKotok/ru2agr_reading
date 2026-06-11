import { describe, it, expect } from 'vitest';
import { hash01 } from '../src/engine/hash.js';

describe('hash01', () => {
  it('returns a value in [0, 1)', () => {
    for (const s of ['a', 'hello', 'test:1:a', '']) {
      const v = hash01(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic', () => {
    const v1 = hash01('hello:world:test');
    const v2 = hash01('hello:world:test');
    expect(v1).toBe(v2);
  });

  it('different inputs give different values', () => {
    const v1 = hash01('test:1:а');
    const v2 = hash01('test:2:а');
    const v3 = hash01('test:1:б');
    expect(v1).not.toBe(v2);
    expect(v1).not.toBe(v3);
    expect(v2).not.toBe(v3);
  });

  it('empty string returns valid value', () => {
    const v = hash01('');
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('distribution is roughly uniform (spot check)', () => {
    const results = [];
    for (let i = 0; i < 100; i++) {
      results.push(hash01(`key:${i}:test`));
    }
    const below50 = results.filter(r => r < 0.5).length;
    // Не строгий тест, но должно быть примерно 50
    expect(below50).toBeGreaterThan(30);
    expect(below50).toBeLessThan(70);
  });
});
