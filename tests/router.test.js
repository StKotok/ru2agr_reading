import { describe, it, expect } from 'vitest';
import { parse } from '../src/router.js';

// Все 27 книг НЗ
const ALL_BOOKS = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians', 'ephesians',
  'philippians', 'colossians', '1thessalonians', '2thessalonians',
  '1timothy', '2timothy', 'titus', 'philemon', 'hebrews',
  'james', '1peter', '2peter', '1john', '2john', '3john', 'jude', 'revelation'
];

describe('router parse', () => {
  describe('read routes', () => {
    it('парсит #/read/john', () => {
      const r = parse('#/read/john');
      expect(r.screen).toBe('reading');
      expect(r.params.book).toBe('john');
    });

    it('все 27 bookId матчатся', () => {
      for (const bookId of ALL_BOOKS) {
        const r = parse(`#/read/${bookId}`);
        expect(r.screen).toBe('reading');
        expect(r.params.book).toBe(bookId);
      }
    });

    it('книги с цифрами в начале: 1corinthians', () => {
      const r = parse('#/read/1corinthians');
      expect(r.screen).toBe('reading');
      expect(r.params.book).toBe('1corinthians');
    });

    it('книги с цифрами в начале: 3john', () => {
      const r = parse('#/read/3john');
      expect(r.screen).toBe('reading');
      expect(r.params.book).toBe('3john');
    });

    it('книги с цифрами в начале: 1peter', () => {
      const r = parse('#/read/1peter');
      expect(r.screen).toBe('reading');
      expect(r.params.book).toBe('1peter');
    });

    it('книги с цифрами в начале: 2corinthians', () => {
      const r = parse('#/read/2corinthians');
      expect(r.screen).toBe('reading');
      expect(r.params.book).toBe('2corinthians');
    });
  });

  describe('named routes', () => {
    it('#/dictionary → dictionary', () => {
      const r = parse('#/dictionary');
      expect(r.screen).toBe('dictionary');
      expect(r.params).toEqual({});
    });

    it('#/progress → progress', () => {
      const r = parse('#/progress');
      expect(r.screen).toBe('progress');
      expect(r.params).toEqual({});
    });

    it('#/settings → settings', () => {
      const r = parse('#/settings');
      expect(r.screen).toBe('settings');
      expect(r.params).toEqual({});
    });

    it('#/onboarding → onboarding', () => {
      const r = parse('#/onboarding');
      expect(r.screen).toBe('onboarding');
      expect(r.params).toEqual({});
    });

    it('#/about → about', () => {
      const r = parse('#/about');
      expect(r.screen).toBe('about');
      expect(r.params).toEqual({});
    });
  });

  describe('default/fallback', () => {
    it('#/ → reading с john', () => {
      const r = parse('#/');
      expect(r.screen).toBe('reading');
      expect(r.params.book).toBe('john');
    });

    it('неизвестный маршрут → дефолт на reading', () => {
      const r = parse('#/unknown/route');
      expect(r.screen).toBe('reading');
      expect(r.params.book).toBe('john');
    });
  });
});
