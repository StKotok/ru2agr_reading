import { describe, it, expect } from 'vitest';
import { addWord, setWordSetting, setWordStatus, getActive, countActiveWords, isDictionaryEntry, sanitizeDictionary } from '../src/state/dictionary.js';

describe('dictionary', () => {
  describe('addWord', () => {
    it('создаёт запись со status, showInText, intensity, addedAt но без forms', () => {
      const dict = addWord('logos', {});
      expect(dict.logos).toBeDefined();
      expect(dict.logos.status).toBe('new');
      expect(dict.logos.showInText).toBe(true);
      expect(dict.logos.intensity).toBe('often');
      expect(dict.logos.addedAt).toBeDefined();
      expect(dict.logos.forms).toBeUndefined();
    });

    it('не перезаписывает существующие слова', () => {
      const existing = { logos: { status: 'known', showInText: false, intensity: 'rare', addedAt: '2026-01-01' } };
      const dict = addWord('theos', existing);
      expect(dict.logos.status).toBe('known');
      expect(dict.theos.status).toBe('new');
    });
  });

  describe('setWordSetting', () => {
    it('обновляет существующее поле', () => {
      const dict = { logos: { status: 'new', showInText: true, intensity: 'often', addedAt: '2026-01-01' } };
      const updated = setWordSetting('logos', 'intensity', 'rare', dict);
      expect(updated.logos.intensity).toBe('rare');
      // Остальные поля сохранены
      expect(updated.logos.status).toBe('new');
      expect(updated.logos.showInText).toBe(true);
    });

    it('value === undefined удаляет поле', () => {
      const dict = { logos: { status: 'new', showInText: true, forms: 'lemma', addedAt: '2026-01-01' } };
      const updated = setWordSetting('logos', 'forms', undefined, dict);
      expect(updated.logos.forms).toBeUndefined();
      expect(updated.logos.status).toBe('new');
      expect(updated.logos.showInText).toBe(true);
      expect(updated.logos.addedAt).toBe('2026-01-01');
    });

    it('удаление несуществующего поля не ломает запись', () => {
      const dict = { logos: { status: 'new', showInText: true } };
      const updated = setWordSetting('logos', 'forms', undefined, dict);
      expect(updated.logos.forms).toBeUndefined();
      expect(updated.logos.status).toBe('new');
    });

    it('не падает на отсутствующую запись', () => {
      const dict = { logos: { status: 'new' } };
      const updated = setWordSetting('nonexistent', 'forms', 'lemma', dict);
      expect(updated).toEqual(dict);
    });
  });

  describe('setWordStatus', () => {
    it('меняет статус слова', () => {
      const dict = { logos: { status: 'new' } };
      const updated = setWordStatus('logos', 'known', dict);
      expect(updated.logos.status).toBe('known');
    });
  });

  describe('getActive', () => {
    it('фильтрует записи с showInText=false', () => {
      const dict = {
        logos: { status: 'new', showInText: true },
        theos: { status: 'known', showInText: false }
      };
      const active = getActive(dict);
      expect(active).toHaveLength(1);
      expect(active[0].lexemeId).toBe('logos');
    });

    it('игнорирует metadata-ключи (не-объекты)', () => {
      const dict = {
        logos: { status: 'new', showInText: true },
        __schema: 1,
        __version: 'x'
      };
      const active = getActive(dict);
      expect(active).toHaveLength(1);
      expect(active[0].lexemeId).toBe('logos');
    });
  });

  describe('countActiveWords', () => {
    const coreLexicon = [
      { id: 'logos', lemma: 'λόγος', strong: 3056 }
    ];
    const frequencyList = [
      { strong: 3056, lemma: 'λόγος', rank: 1, count: 330 },
      { strong: 2316, lemma: 'θεός', rank: 2, count: 1300 }
    ];

    it('возвращает 0 для пустого словаря', () => {
      expect(countActiveWords({}, coreLexicon, frequencyList)).toBe(0);
      expect(countActiveWords(null, coreLexicon, frequencyList)).toBe(0);
    });

    it('считает core-слова с валидным статусом', () => {
      const dict = {
        logos: { status: 'known', showInText: true }
      };
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(1);
    });

    it('не считает слова с showInText=false', () => {
      const dict = {
        logos: { status: 'known', showInText: false }
      };
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(0);
    });

    it('не считает слова с невалидным статусом', () => {
      const dict = {
        logos: { status: 'archived', showInText: true }
      };
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(0);
    });

    it('считает freq-* слова', () => {
      const dict = {
        'freq-2316': { status: 'learning', showInText: true }
      };
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(1);
    });

    it('игнорирует metadata-ключи', () => {
      const dict = {
        logos: { status: 'known', showInText: true },
        __schema: 1
      };
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(1);
    });

    it('игнорирует null-значения записей', () => {
      const dict = {
        logos: null,
        theos: { status: 'known', showInText: true }
      };
      // theos не в coreLexicon и не freq-* → не считается
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(0);
    });

    it('не падает и не считает __schema: 1 как слово', () => {
      const dict = {
        logos: { status: 'known', showInText: true },
        __schema: 1
      };
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(1);
    });

    it('не падает на строковые metadata-значения', () => {
      const dict = {
        logos: { status: 'known', showInText: true },
        __version: '2.0'
      };
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(1);
    });

    it('сохраняет freq-* записи', () => {
      const dict = {
        'freq-2316': { status: 'learning', showInText: true },
        __schema: 1
      };
      expect(countActiveWords(dict, coreLexicon, frequencyList)).toBe(1);
    });
  });

  describe('isDictionaryEntry', () => {
    it('возвращает true для объектов', () => {
      expect(isDictionaryEntry({ status: 'new' })).toBe(true);
    });

    it('возвращает false для null', () => {
      expect(isDictionaryEntry(null)).toBe(false);
    });

    it('возвращает false для чисел', () => {
      expect(isDictionaryEntry(1)).toBe(false);
    });

    it('возвращает false для строк', () => {
      expect(isDictionaryEntry('x')).toBe(false);
    });

    it('возвращает false для массивов', () => {
      expect(isDictionaryEntry([])).toBe(false);
      expect(isDictionaryEntry([1, 2])).toBe(false);
    });

    it('возвращает false для функций', () => {
      expect(isDictionaryEntry(() => {})).toBe(false);
    });
  });

  describe('sanitizeDictionary', () => {
    it('возвращает пустой объект для null/undefined', () => {
      expect(sanitizeDictionary(null)).toEqual({});
      expect(sanitizeDictionary(undefined)).toEqual({});
    });

    it('возвращает пустой объект для массивов', () => {
      expect(sanitizeDictionary([])).toEqual({});
      expect(sanitizeDictionary([1, 2])).toEqual({});
    });

    it('возвращает пустой объект для примитивов', () => {
      expect(sanitizeDictionary(42)).toEqual({});
      expect(sanitizeDictionary('hello')).toEqual({});
    });

    it('удаляет __schema: 1 и __version: "x"', () => {
      const result = sanitizeDictionary({
        logos: { status: 'new', showInText: true },
        __schema: 1,
        __version: 'x'
      });
      expect(result).toEqual({
        logos: { status: 'new', showInText: true }
      });
      expect(result.__schema).toBeUndefined();
      expect(result.__version).toBeUndefined();
    });

    it('сохраняет freq-* записи', () => {
      const result = sanitizeDictionary({
        'freq-2316': { status: 'learning', showInText: true },
        __schema: 1
      });
      expect(result).toEqual({
        'freq-2316': { status: 'learning', showInText: true }
      });
    });

    it('не мутирует исходный объект', () => {
      const input = { logos: { status: 'new' }, __schema: 1 };
      const result = sanitizeDictionary(input);
      expect(input.__schema).toBe(1);
      expect(result.__schema).toBeUndefined();
    });

    it('отфильтровывает metadata-массивы (__meta: [])', () => {
      const result = sanitizeDictionary({
        logos: { status: 'new', showInText: true },
        __meta: []
      });
      expect(result).toEqual({
        logos: { status: 'new', showInText: true }
      });
      expect(result.__meta).toBeUndefined();
    });
  });

  describe('setWordSetting удаление поля', () => {
    it('value === undefined удаляет forms и сохраняет остальные поля', () => {
      const dict = { logos: { status: 'new', showInText: true, forms: 'lemma', addedAt: '2026-01-01' } };
      const updated = setWordSetting('logos', 'forms', undefined, dict);
      expect(updated.logos.forms).toBeUndefined();
      expect(updated.logos.status).toBe('new');
      expect(updated.logos.showInText).toBe(true);
      expect(updated.logos.addedAt).toBe('2026-01-01');
    });
  });
});
