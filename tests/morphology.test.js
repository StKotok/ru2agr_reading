import { describe, it, expect } from 'vitest';
import { parseMorph, formatMorphRu } from '../src/engine/morphology.js';

describe('parseMorph', () => {
  it('parses N-NSM correctly', () => {
    const m = parseMorph('N-NSM');
    expect(m.pos).toBe('существительное');
    expect(m.case).toBe('именительный');
    expect(m.number).toBe('единственное');
    expect(m.gender).toBe('мужской');
  });

  it('parses V-PAI-3S correctly', () => {
    const m = parseMorph('V-PAI-3S');
    expect(m.pos).toBe('глагол');
    expect(m.tense).toBe('настоящее');
    expect(m.voice).toBe('действительный');
    expect(m.mood).toBe('изъявительное');
    expect(m.person).toBe('3 лицо');
    expect(m.number).toBe('единственное');
  });

  it('parses V-AAI-3S correctly', () => {
    const m = parseMorph('V-AAI-3S');
    expect(m.tense).toBe('аорист');
    expect(m.voice).toBe('действительный');
    expect(m.mood).toBe('изъявительное');
  });

  it('parses N-DSF correctly', () => {
    const m = parseMorph('N-DSF');
    expect(m.case).toBe('дательный');
    expect(m.number).toBe('единственное');
    expect(m.gender).toBe('женский');
  });

  it('parses T-NSM correctly', () => {
    const m = parseMorph('T-NSM');
    expect(m.pos).toBe('артикль');
    expect(m.gender).toBe('мужской');
  });

  it('parses A-GSF correctly', () => {
    const m = parseMorph('A-GSF');
    expect(m.pos).toBe('прилагательное');
    expect(m.case).toBe('родительный');
    expect(m.gender).toBe('женский');
  });

  it('parses PREP correctly', () => {
    const m = parseMorph('PREP');
    expect(m.pos).toBe('предлог');
  });

  it('handles unknown code gracefully', () => {
    const m = parseMorph('XYZ-123');
    expect(m.raw).toBe('XYZ-123');
  });
});

describe('formatMorphRu', () => {
  it('formats N-NSM as Russian string', () => {
    const result = formatMorphRu('N-NSM');
    expect(result).toContain('существительное');
    expect(result).toContain('мужской');
  });

  it('formats V-PAI-3S as Russian string', () => {
    expect(formatMorphRu('V-PAI-3S')).toContain('глагол');
    expect(formatMorphRu('V-PAI-3S')).toContain('настоящее');
  });
});
