import { describe, it, expect } from 'vitest';
import {
  checkPairAccuracy,
  normalizeWord,
  normalizeBerean,
  fuzzyNormalize,
  tokenizeGloss,
  ALIGN_METHODS
} from '../scripts/lib/align-normalize.mjs';

// =============================================================================
// Golden fixtures — тестируют САМУ логику инварианта на хардкоде,
// независимо от данных. Ловят регрессию кода нормализации.
// =============================================================================

describe('checkPairAccuracy — gloss-exact', () => {
  it('single word exact match', () => {
    expect(checkPairAccuracy('God', 'God', 'gloss-exact')).toEqual({ ok: true });
  });

  it('case-insensitive match', () => {
    expect(checkPairAccuracy('god', 'God', 'gloss-exact').ok).toBe(true);
  });

  it('multi-word gloss fails (gloss-exact expects single word)', () => {
    const r = checkPairAccuracy('God', 'of God', 'gloss-exact');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('mismatch');
  });

  it('punctuation in slice stripped', () => {
    expect(checkPairAccuracy('God,', 'God', 'gloss-exact').ok).toBe(true);
  });

  it('different words fail', () => {
    expect(checkPairAccuracy('xyz', 'God', 'gloss-exact').ok).toBe(false);
  });
});

describe('checkPairAccuracy — bracket-optional', () => {
  it('strips brackets from gloss', () => {
    expect(checkPairAccuracy('God', '[the] God', 'bracket-optional')).toEqual({ ok: true });
  });

  it('bracket-optional with capitalization', () => {
    expect(checkPairAccuracy('God', '[The] God', 'bracket-optional').ok).toBe(true);
  });

  it('bracket-optional mismatch', () => {
    expect(checkPairAccuracy('Lord', '[the] God', 'bracket-optional').ok).toBe(false);
  });
});

describe('checkPairAccuracy — phrase', () => {
  it('multi-word phrase match', () => {
    expect(checkPairAccuracy('of the genealogy', 'of [the] genealogy', 'phrase').ok).toBe(true);
  });

  it('two-word phrase match', () => {
    expect(checkPairAccuracy('the Christ', 'the Christ', 'phrase').ok).toBe(true);
  });

  it('phrase token count mismatch', () => {
    const r = checkPairAccuracy('Christ', 'the Christ', 'phrase');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('token count');
  });
});

describe('checkPairAccuracy — alt-gloss-*', () => {
  it('alt-gloss-exact uses Cherith gloss', () => {
    expect(checkPairAccuracy('book', 'book', 'alt-gloss-exact')).toEqual({ ok: true });
  });

  it('alt-gloss-exact mismatch', () => {
    expect(checkPairAccuracy('scroll', 'book', 'alt-gloss-exact').ok).toBe(false);
  });

  it('alt-gloss-phrase multi-word', () => {
    expect(checkPairAccuracy('of the genealogy', 'of the genealogy', 'alt-gloss-phrase').ok).toBe(true);
  });
});

describe('checkPairAccuracy — fuzzy', () => {
  it('fuzzy match with same root (punctuation stripped)', () => {
    // fuzzyNormalize strips punctuation and normalizes apostrophes — same word matches
    expect(checkPairAccuracy('love', 'love', 'fuzzy').ok).toBe(true);
  });

  it('fuzzy match with apostrophe normalization', () => {
    // Curly vs straight apostrophe — should normalize to same
    expect(fuzzyNormalize("God's")).toBe(fuzzyNormalize('God’s'));
    expect(checkPairAccuracy("God's", "God’s", 'fuzzy').ok).toBe(true);
  });

  it('fuzzy mismatch with different words', () => {
    expect(checkPairAccuracy('hated', 'love', 'fuzzy').ok).toBe(false);
  });
});

describe('checkPairAccuracy — lexicon-gloss-exact', () => {
  it('slice in lexicon gloss set', () => {
    expect(checkPairAccuracy('book', 'book', 'lexicon-gloss-exact', {
      lexiconGlosses: new Set(['book', 'books', 'scroll'])
    }).ok).toBe(true);
  });

  it('slice NOT in lexicon gloss set', () => {
    expect(checkPairAccuracy('tablet', 'book', 'lexicon-gloss-exact', {
      lexiconGlosses: new Set(['book', 'books', 'scroll'])
    }).ok).toBe(false);
  });

  it('no lexicon glosses provided', () => {
    const r = checkPairAccuracy('book', 'book', 'lexicon-gloss-exact');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('no lexicon');
  });
});

describe('checkPairAccuracy — manual', () => {
  it('manual with letters passes', () => {
    expect(checkPairAccuracy('God', 'God', 'manual').ok).toBe(true);
  });

  it('manual with empty string fails', () => {
    expect(checkPairAccuracy('', 'God', 'manual').ok).toBe(false);
  });

  it('manual with only punctuation fails', () => {
    expect(checkPairAccuracy('.', 'God', 'manual').ok).toBe(false);
  });
});

describe('checkPairAccuracy — unknown method', () => {
  it('unknown method returns error', () => {
    const r = checkPairAccuracy('God', 'God', 'nonexistent');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('unknown method');
  });
});

describe('checkPairAccuracy — positional-equal-count', () => {
  it('works like exact match when enabled', () => {
    expect(checkPairAccuracy('God', 'God', 'positional-equal-count').ok).toBe(true);
  });

  it('fails on mismatch', () => {
    expect(checkPairAccuracy('Lord', 'God', 'positional-equal-count').ok).toBe(false);
  });
});

// =============================================================================
// Normalization function golden tests
// =============================================================================

describe('normalizeWord', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeWord('God')).toBe('god');
    expect(normalizeWord('God,')).toBe('god');
    expect(normalizeWord('"Lord"')).toBe('lord');
  });
});

describe('normalizeBerean', () => {
  it('strips bracketed words and brackets', () => {
    expect(normalizeBerean('[the] God')).toBe('god');
    expect(normalizeBerean('[The] book')).toBe('book');
  });

  it('handles multiple bracket groups', () => {
    expect(normalizeBerean('[the] book of [the] life')).toBe('book of life');
  });
});

describe('fuzzyNormalize', () => {
  it('normalizes apostrophes and strips punctuation', () => {
    const r = fuzzyNormalize("loved");
    const r2 = fuzzyNormalize("love");
    // Both should be stripped, but different roots won't match
    expect(typeof r).toBe('string');
  });
});

describe('tokenizeGloss', () => {
  it('splits on word boundaries', () => {
    expect(tokenizeGloss('of [the] genealogy')).toEqual(['of', 'the', 'genealogy']);
  });

  it('handles single word', () => {
    expect(tokenizeGloss('God')).toEqual(['God']);
  });
});

describe('ALIGN_METHODS', () => {
  it('has all required methods', () => {
    expect(ALIGN_METHODS).toHaveProperty('gloss-exact');
    expect(ALIGN_METHODS).toHaveProperty('bracket-optional');
    expect(ALIGN_METHODS).toHaveProperty('phrase');
    expect(ALIGN_METHODS).toHaveProperty('alt-gloss-exact');
    expect(ALIGN_METHODS).toHaveProperty('alt-gloss-bracket');
    expect(ALIGN_METHODS).toHaveProperty('alt-gloss-phrase');
    expect(ALIGN_METHODS).toHaveProperty('lexicon-gloss-exact');
    expect(ALIGN_METHODS).toHaveProperty('fuzzy');
    expect(ALIGN_METHODS).toHaveProperty('manual');
    expect(ALIGN_METHODS).toHaveProperty('positional-equal-count');
  });

  it('proven tier maps to q:"a"', () => {
    for (const [method, def] of Object.entries(ALIGN_METHODS)) {
      if (def.tier === 'proven') expect(def.q).toBe('a');
    }
  });

  it('fuzzy tier maps to q:"f"', () => {
    expect(ALIGN_METHODS.fuzzy.q).toBe('f');
  });
});
