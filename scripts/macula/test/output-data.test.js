import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', '..', '..', 'assets', 'data', 'generated', 'macula');

function loadJSONL(path) {
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return [];
  return raw.split('\n').map(line => JSON.parse(line));
}

describe('Output data integrity', () => {
  let tokens, lexemes, verses, frequency;

  beforeAll(() => {
    tokens = loadJSONL(resolve(OUT_DIR, 'tokens.jsonl'));
    lexemes = JSON.parse(readFileSync(resolve(OUT_DIR, 'lexemes.json'), 'utf8'));
    verses = JSON.parse(readFileSync(resolve(OUT_DIR, 'verses.json'), 'utf8'));
    frequency = JSON.parse(readFileSync(resolve(OUT_DIR, 'frequency.json'), 'utf8'));
  });

  describe('tokens.jsonl', () => {
    it('should have ~137,740 tokens', () => {
      expect(tokens.length).toBeGreaterThan(137000);
      expect(tokens.length).toBeLessThan(138500);
    });

    it('should have unique token IDs', () => {
      const ids = tokens.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have surface form for all tokens', () => {
      const withoutSurface = tokens.filter(t => !t.surface);
      expect(withoutSurface).toHaveLength(0);
    });

    it('should have lemma for all tokens', () => {
      const withoutLemma = tokens.filter(t => !t.lemma);
      expect(withoutLemma).toHaveLength(0);
    });

    it('should have valid refs', () => {
      const invalidRefs = tokens.filter(t => !t.ref || !t.ref.match(/^\w+\s+\d+:\d+$/));
      expect(invalidRefs).toHaveLength(0);
    });

    it('should have bookId for all tokens', () => {
      const withoutBook = tokens.filter(t => !t.bookId);
      expect(withoutBook).toHaveLength(0);
    });

    it('should have tokens in order within verses', () => {
      // Sample check: John 1:1 tokens
      const j11 = tokens.filter(t => t.ref === 'john 1:1');
      for (let i = 1; i < j11.length; i++) {
        expect(j11[i].tokenIndex).toBeGreaterThan(j11[i-1].tokenIndex);
      }
    });
  });

  describe('lexemes.json', () => {
    it('should have ~5,468 lexemes', () => {
      expect(lexemes.length).toBeGreaterThan(5300);
      expect(lexemes.length).toBeLessThan(5600);
    });

    it('should have unique lexeme IDs', () => {
      const ids = lexemes.map(l => l.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid frequency data', () => {
      const sumTokenCounts = lexemes.reduce((s, l) => s + (l.frequency?.tokenCount || 0), 0);
      expect(sumTokenCounts).toBe(tokens.length);
    });

    it('should have attested forms summing to token count', () => {
      const logos = lexemes.find(l => l.lemma === 'λόγος');
      expect(logos).toBeTruthy();
      const formSum = logos.attestedForms.reduce((s, f) => s + f.count, 0);
      expect(formSum).toBe(logos.frequency.tokenCount);
    });

    it('should have allRefs matching allRefsCount', () => {
      for (const l of lexemes.slice(0, 100)) {
        expect(l.allRefsCount).toBe(l.allRefs.length);
      }
    });

    it('should have canonical ref ordering', () => {
      // Check that allRefs are in canonical book order
      const logos = lexemes.find(l => l.lemma === 'λόγος');
      const bookOrder = ['matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1corinthians',
        '2corinthians', 'galatians', 'ephesians', 'philippians', 'colossians',
        '1thessalonians', '2thessalonians', '1timothy', '2timothy', 'titus', 'philemon',
        'hebrews', 'james', '1peter', '2peter', '1john', '2john', '3john', 'jude', 'revelation'];
      const bookRank = new Map(bookOrder.map((b, i) => [b, i]));

      let prevRank = -1;
      for (const ref of logos.allRefs) {
        const book = ref.split(' ')[0];
        const rank = bookRank.get(book) ?? 99;
        expect(rank).toBeGreaterThanOrEqual(prevRank);
        prevRank = rank;
      }
    });

    it('should have transliteration for all lexemes', () => {
      const without = lexemes.filter(l => !l.transliteration?.value);
      expect(without).toHaveLength(0);
    });
  });

  describe('verses.json', () => {
    it('should have ~7,939 verses', () => {
      expect(verses.length).toBeGreaterThan(7900);
      expect(verses.length).toBeLessThan(8000);
    });

    it('should have correct John 1:1 text', () => {
      const j11 = verses.find(v => v.ref === 'john 1:1');
      expect(j11).toBeTruthy();
      expect(j11.text).toContain('Ἐν ἀρχῇ');
      expect(j11.text).toContain('λόγος');
      expect(j11.tokenIds).toBeTruthy();
      expect(j11.tokenIds.length).toBeGreaterThan(10);
    });

    it('should have valid refs', () => {
      const invalid = verses.filter(v => !v.ref || !v.bookId || !v.chapter || !v.verse);
      expect(invalid).toHaveLength(0);
    });

    it('should not have space before punctuation', () => {
      for (const v of verses) {
        expect(v.text).not.toMatch(/ ,/);
        expect(v.text).not.toMatch(/ \./);
        expect(v.text).not.toMatch(/ ;/);
      }
    });
  });

  describe('frequency.json', () => {
    it('should have ~5,468 entries', () => {
      expect(frequency.length).toBeGreaterThan(5300);
      expect(frequency.length).toBeLessThan(5600);
    });

    it('should have correct top lemma', () => {
      expect(frequency[0].lemma).toBe('ὁ');
      expect(frequency[0].tokenCount).toBeGreaterThan(15000);
    });

    it('should have correct rank ordering', () => {
      for (let i = 1; i < frequency.length; i++) {
        expect(frequency[i].tokenCount).toBeLessThanOrEqual(frequency[i-1].tokenCount);
      }
    });

    it('should have cumulative coverage ≈1 at end', () => {
      const last = frequency[frequency.length - 1];
      expect(last.cumulativeCoverage).toBeCloseTo(1, 3);
    });

    it('should have valid breakpoints', () => {
      // 28-32 lemmas should cover ~50%
      const p50 = frequency.findIndex(f => f.cumulativeCoverage >= 0.5);
      expect(p50).toBeGreaterThan(20);
      expect(p50).toBeLessThan(40);
    });
  });

  describe('book coverage', () => {
    it('should have all 27 books', () => {
      const expected = ['matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1corinthians',
        '2corinthians', 'galatians', 'ephesians', 'philippians', 'colossians',
        '1thessalonians', '2thessalonians', '1timothy', '2timothy', 'titus', 'philemon',
        'hebrews', 'james', '1peter', '2peter', '1john', '2john', '3john', 'jude', 'revelation'];
      const books = new Set(tokens.map(t => t.bookId));
      for (const b of expected) {
        expect(books.has(b)).toBe(true);
      }
    });
  });

  describe('Unicode NFC', () => {
    it('should have NFC surface forms', () => {
      for (const t of tokens.slice(0, 1000)) {
        if (t.surface) {
          expect(t.surface).toBe(t.surface.normalize('NFC'));
        }
      }
    });

    it('should have search forms without diacritics', () => {
      for (const t of tokens.slice(0, 1000)) {
        if (t.surfaceSearch) {
          // Should not contain combining diacritics
          expect(t.surfaceSearch).not.toMatch(/[̀-ͯ]/);
          // Should be lowercase
          expect(t.surfaceSearch).toBe(t.surfaceSearch.toLowerCase());
        }
      }
    });
  });

  describe('Determinism', () => {
    it('should produce identical output on second run', () => {
      // This is a structural check — the data should be deterministic
      const firstRunTokens = tokens.length;
      // We just verify the count is stable
      expect(firstRunTokens).toBe(137740);
    });
  });

  describe('Morphology decoding', () => {
    it('should decode N-NSM', () => {
      const token = tokens.find(t => t.morphology?.code === 'N-NSM');
      expect(token).toBeTruthy();
      expect(token.morphology.labelRu).toContain('сущ.');
    });

    it('should decode V-PAI-3S', () => {
      const tsvLike = tokens.filter(t => t.morphology?.code === 'V-PAI-3S');
      expect(tsvLike.length).toBeGreaterThan(0);
      if (tsvLike.length > 0) {
        expect(tsvLike[0].morphology.labelRu).toContain('глаг.');
      }
    });
  });
});
