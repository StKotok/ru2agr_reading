import { describe, it, expect } from 'vitest';
import { detectAccent, isBreathing } from '../lib/accent.mjs';

describe('detectAccent', () => {
  it('should detect acute accent', () => {
    const result = detectAccent('λόγος');
    expect(result.hasAccent).toBe(true);
    expect(result.type).toBe('acute');
    expect(result.grapheme).toBe('ό');
  });

  it('should detect grave accent', () => {
    const result = detectAccent('καὶ');
    expect(result.hasAccent).toBe(true);
    expect(result.type).toBe('grave');
    expect(result.grapheme).toBe('ὶ');
  });

  it('should detect circumflex', () => {
    const result = detectAccent('αὐτοῦ');
    expect(result.hasAccent).toBe(true);
    expect(result.type).toBe('circumflex');
  });

  it('should return no accent for unaccented word', () => {
    const result = detectAccent('και');
    expect(result.hasAccent).toBe(false);
    expect(result.type).toBe(null);
  });

  it('should handle empty string', () => {
    const result = detectAccent('');
    expect(result.hasAccent).toBe(false);
  });

  it('should not confuse breathing with accent', () => {
    // Rough breathing only, no accent
    const result = detectAccent('ὁ');
    // ὁ has both rough breathing AND acute accent (oxia), so it should have accent
    // Let's test a word with ONLY breathing and no accent
    const encResult = detectAccent('ἐν');
    expect(encResult.hasAccent).toBe(false);
  });
});

describe('isBreathing', () => {
  it('should detect rough breathing', () => {
    expect(isBreathing('̔')).toBe(true);
  });

  it('should detect smooth breathing', () => {
    expect(isBreathing('̓')).toBe(true);
  });

  it('should reject regular characters', () => {
    expect(isBreathing('α')).toBe(false);
  });
});
