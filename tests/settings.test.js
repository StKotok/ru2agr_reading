import { describe, it, expect } from 'vitest';
import { deriveComposeMode, shouldLoadGreek, COMPOSE_MODES } from '../src/state/settings.js';

describe('deriveComposeMode', () => {
  it('readingMode=greek → GREEK_ORIGINAL независимо от wordLayer и activeWordCount', () => {
    expect(deriveComposeMode({ readingMode: 'greek', wordLayer: 'off' }, 0)).toBe(COMPOSE_MODES.GREEK_ORIGINAL);
    expect(deriveComposeMode({ readingMode: 'greek', wordLayer: 'lemma' }, 5)).toBe(COMPOSE_MODES.GREEK_ORIGINAL);
    expect(deriveComposeMode({ readingMode: 'greek', wordLayer: 'form' }, 10)).toBe(COMPOSE_MODES.GREEK_ORIGINAL);
  });

  it('wordLayer=off → LETTERS_ONLY независимо от activeWordCount', () => {
    expect(deriveComposeMode({ readingMode: 'mixed', wordLayer: 'off' }, 0)).toBe(COMPOSE_MODES.LETTERS_ONLY);
    expect(deriveComposeMode({ readingMode: 'mixed', wordLayer: 'off' }, 5)).toBe(COMPOSE_MODES.LETTERS_ONLY);
  });

  it('wordLayer=lemma + activeWordCount=0 → LETTERS_ONLY', () => {
    expect(deriveComposeMode({ readingMode: 'mixed', wordLayer: 'lemma' }, 0)).toBe(COMPOSE_MODES.LETTERS_ONLY);
  });

  it('wordLayer=lemma + activeWordCount>0 → WORD_LEMMA', () => {
    expect(deriveComposeMode({ readingMode: 'mixed', wordLayer: 'lemma' }, 1)).toBe(COMPOSE_MODES.WORD_LEMMA);
    expect(deriveComposeMode({ readingMode: 'mixed', wordLayer: 'lemma' }, 5)).toBe(COMPOSE_MODES.WORD_LEMMA);
  });

  it('wordLayer=form + activeWordCount=0 → LETTERS_ONLY', () => {
    expect(deriveComposeMode({ readingMode: 'mixed', wordLayer: 'form' }, 0)).toBe(COMPOSE_MODES.LETTERS_ONLY);
  });

  it('wordLayer=form + activeWordCount>0 → WORD_FORM', () => {
    expect(deriveComposeMode({ readingMode: 'mixed', wordLayer: 'form' }, 1)).toBe(COMPOSE_MODES.WORD_FORM);
    expect(deriveComposeMode({ readingMode: 'mixed', wordLayer: 'form' }, 10)).toBe(COMPOSE_MODES.WORD_FORM);
  });
});

describe('shouldLoadGreek', () => {
  it('readingMode=greek → true всегда', () => {
    expect(shouldLoadGreek({ readingMode: 'greek', wordLayer: 'off' }, 0)).toBe(true);
    expect(shouldLoadGreek({ readingMode: 'greek', wordLayer: 'lemma' }, 0)).toBe(true);
  });

  it('wordLayer=off → false даже с activeWordCount>0', () => {
    expect(shouldLoadGreek({ readingMode: 'mixed', wordLayer: 'off' }, 0)).toBe(false);
    expect(shouldLoadGreek({ readingMode: 'mixed', wordLayer: 'off' }, 5)).toBe(false);
  });

  it('wordLayer=lemma + activeWordCount=0 → false (Greek не нужен)', () => {
    expect(shouldLoadGreek({ readingMode: 'mixed', wordLayer: 'lemma' }, 0)).toBe(false);
  });

  it('wordLayer=lemma + activeWordCount>0 → true', () => {
    expect(shouldLoadGreek({ readingMode: 'mixed', wordLayer: 'lemma' }, 1)).toBe(true);
  });

  it('wordLayer=form + activeWordCount=0 → false', () => {
    expect(shouldLoadGreek({ readingMode: 'mixed', wordLayer: 'form' }, 0)).toBe(false);
  });

  it('wordLayer=form + activeWordCount>0 → true', () => {
    expect(shouldLoadGreek({ readingMode: 'mixed', wordLayer: 'form' }, 1)).toBe(true);
  });
});
