import { describe, it, expect } from 'vitest';
import { transliterateGreek, transliterateToStr } from '../lib/transliteration.mjs';

describe('transliterateGreek', () => {
  const fixtures = [
    { greek: 'λόγος', expected: 'logos' },
    { greek: 'Ἰησοῦς', expected: 'Iēsous' },
    { greek: 'ἁμαρτία', expected: 'hamartia' },
    { greek: 'ῥῆμα', expected: 'rhēma' },
    { greek: 'ἄγγελος', expected: 'angelos' },
    { greek: 'Χριστός', expected: 'Christos' },
    { greek: 'Μωϋσῆς', expected: 'Mōysēs' },
    { greek: 'ᾅδης', expected: 'hadēs' },
    { greek: 'θεός', expected: 'theos' },
    { greek: 'ψυχή', expected: 'psychē' },
  ];

  for (const { greek, expected } of fixtures) {
    it(`should transliterate ${greek} → ${expected}`, () => {
      const result = transliterateGreek(greek);
      expect(result.value).toBe(expected);
      expect(result.system).toBe('sbl-like');
      expect(result.verified).toBe(false);
    });
  }

  it('should handle empty string', () => {
    const result = transliterateGreek('');
    expect(result.value).toBe('');
  });

  it('should handle gamma nasal', () => {
    expect(transliterateGreek('ἄγγελος').value).toBe('angelos');
  });

  it('should handle rough breathing', () => {
    expect(transliterateGreek('ὁ').value).toBe('ho');
    expect(transliterateGreek('υἱός').value).toBe('hyios');
  });
});

describe('transliterateToStr', () => {
  it('should return string value', () => {
    expect(transliterateToStr('λόγος')).toBe('logos');
  });
});
