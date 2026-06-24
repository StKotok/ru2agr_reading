import { describe, it, expect } from 'vitest';
import { toNfc, toSearchForm, stripAccents } from '../lib/normalizer.mjs';

describe('toNfc', () => {
  it('should return same string if already NFC', () => {
    expect(toNfc('λόγος')).toBe('λόγος');
  });

  it('should normalise NFD to NFC', () => {
    const nfd = 'λόγος'; // combining acute
    const nfc = toNfc(nfd);
    expect(nfc).toBe('λόγος');
  });

  it('should handle empty string', () => {
    expect(toNfc('')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(toNfc(null)).toBe(null);
    expect(toNfc(undefined)).toBe(undefined);
  });
});

describe('toSearchForm', () => {
  it('should strip accents', () => {
    expect(toSearchForm('λόγος')).toBe('λογοσ');
  });

  it('should strip breathings', () => {
    expect(toSearchForm('ἁμαρτία')).toBe('αμαρτια');
    expect(toSearchForm('ὁ')).toBe('ο');
  });

  it('should lowercase', () => {
    expect(toSearchForm('Λόγος')).toBe('λογοσ');
  });

  it('should convert final sigma', () => {
    // ς → σ: λόγος (NFC: ends with ς U+03C2) → λογοσ (ends with σ U+03C3)
    expect(toSearchForm('λόγος')).toBe('λογοσ');
  });

  it('should strip iota subscript', () => {
    expect(toSearchForm('ᾅδης')).toBe('αδησ');
  });

  it('should handle empty string', () => {
    expect(toSearchForm('')).toBe('');
  });
});

describe('stripAccents', () => {
  it('should remove accents but keep diaeresis', () => {
    expect(stripAccents('λόγος')).toBe('λογος');
  });

  it('should remove breathings', () => {
    expect(stripAccents('ὁ')).toBe('ο');
  });
});
