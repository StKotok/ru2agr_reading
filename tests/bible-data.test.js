import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadJSON(relativePath) {
  const fullPath = resolve(__dirname, '..', relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

describe('bible data', () => {
  it('books.json exists and has 27 books', () => {
    const books = loadJSON('assets/data/books.json');
    expect(books.length).toBe(27);
    // Проверяем структуру
    for (const book of books) {
      expect(book.id).toBeTruthy();
      expect(book.title).toBeTruthy();
      expect(book.short).toBeTruthy();
      expect(typeof book.chapters).toBe('number');
      expect(book.chapters).toBeGreaterThan(0);
    }
  });

  it('john.json exists and has correct structure', () => {
    const john = loadJSON('assets/data/bibles/syn/john.json');
    expect(john.id).toBe('john');
    expect(john.chapters.length).toBe(21);

    const ch1 = john.chapters[0];
    expect(ch1.n).toBe(1);
    expect(ch1.verses.length).toBeGreaterThan(0);

    const v1 = ch1.verses[0];
    expect(v1.n).toBe(1);
    expect(v1.text).toContain('В начале');
  });

  it('all syn books have correct chapter counts', () => {
    const books = loadJSON('assets/data/books.json');

    const expected = {
      matthew: 28, mark: 16, luke: 24, john: 21, acts: 28,
      romans: 16, '1corinthians': 16, '2corinthians': 13,
      galatians: 6, ephesians: 6, philippians: 4, colossians: 4,
      '1thessalonians': 5, '2thessalonians': 3,
      '1timothy': 6, '2timothy': 4, titus: 3, philemon: 1,
      hebrews: 13, james: 5, '1peter': 5, '2peter': 3,
      '1john': 5, '2john': 1, '3john': 1, jude: 1, revelation: 22
    };

    for (const book of books) {
      const exp = expected[book.id];
      expect(exp).toBeDefined();
      expect(book.chapters).toBe(exp);

      // Проверяем файл — данные обязаны быть в репозитории
      const bookData = loadJSON(`assets/data/bibles/syn/${book.id}.json`);
      expect(bookData).not.toBeNull();
      expect(bookData.chapters.length).toBe(exp);
      for (const ch of bookData.chapters) {
        expect(ch.verses.length).toBeGreaterThan(0);
        for (const v of ch.verses) {
          expect(v.text.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
