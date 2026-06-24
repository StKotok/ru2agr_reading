import { describe, it, expect } from 'vitest';
import { parseMorphCode, formatMorphFull, formatMorphShort, buildLabelRu } from '../lib/morphology-decoder.mjs';

describe('parseMorphCode', () => {
  it('should parse N-NSM (noun, nominative singular masculine)', () => {
    const result = parseMorphCode('N-NSM');
    expect(result.pos).toBe('существительное');
    expect(result.case).toBe('именительный');
    expect(result.number).toBe('единственное');
    expect(result.gender).toBe('мужской');
  });

  it('should parse V-PAI-3S (verb, present active indicative 3rd singular)', () => {
    const result = parseMorphCode('V-PAI-3S');
    expect(result.pos).toBe('глагол');
    expect(result.tense).toBe('настоящее');
    expect(result.voice).toBe('действительный');
    expect(result.mood).toBe('изъявительное');
    expect(result.person).toBe('3-е');
    expect(result.number).toBe('единственное');
  });

  it('should parse PREP (indeclinable)', () => {
    const result = parseMorphCode('PREP');
    expect(result.pos).toBe('предлог');
    expect(result.isUninflected).toBe(true);
  });

  it('should parse CONJ (indeclinable)', () => {
    const result = parseMorphCode('CONJ');
    expect(result.pos).toBe('союз');
    expect(result.isUninflected).toBe(true);
  });

  it('should parse A-GSF (adjective, genitive singular feminine)', () => {
    const result = parseMorphCode('A-GSF');
    expect(result.pos).toBe('прилагательное');
    expect(result.case).toBe('родительный');
    expect(result.number).toBe('единственное');
    expect(result.gender).toBe('женский');
  });

  it('should parse T-NSM (article)', () => {
    const result = parseMorphCode('T-NSM');
    expect(result.pos).toBe('артикль');
  });

  it('should handle null/empty', () => {
    expect(parseMorphCode(null).pos).toBe(null);
    expect(parseMorphCode('---').pos).toBe(null);
  });

  it('should mark unknown codes', () => {
    const result = parseMorphCode('ZZ-XXX');
    expect(result.unknown).toBe(true);
  });
});

describe('formatMorphFull', () => {
  it('should format noun morphology', () => {
    const parsed = parseMorphCode('N-NSM');
    const result = formatMorphFull(parsed);
    expect(result).toContain('существительное');
    expect(result).toContain('именительный');
    expect(result).toContain('единственное');
    expect(result).toContain('мужской');
  });
});

describe('formatMorphShort', () => {
  it('should format noun morphology short', () => {
    const parsed = parseMorphCode('N-NSM');
    const result = formatMorphShort(parsed);
    expect(result).toContain('сущ.');
    expect(result).toContain('им. падеж');
  });

  it('should format indeclinable', () => {
    const parsed = parseMorphCode('PREP');
    const result = formatMorphShort(parsed);
    expect(result).toContain('предл.');
    expect(result).toContain('неизм.');
  });

  it('should format verb morphology short', () => {
    const parsed = parseMorphCode('V-PAI-3S');
    const result = formatMorphShort(parsed);
    expect(result).toContain('глаг.');
    expect(result).toContain('наст. вр.');
  });
});

describe('buildLabelRu', () => {
  it('should build readable label', () => {
    const parsed = parseMorphCode('N-NSM');
    const label = buildLabelRu(parsed);
    expect(label).toContain('сущ.');
  });
});
