import { describe, it, expect } from 'vitest';
import { addWord, setWordSetting, setWordStatus, getActive, countActiveWords, isDictionaryEntry, sanitizeDictionary, migrateDictionaryData } from '../src/state/dictionary.js';

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

  describe('migrateDictionaryData', () => {
    // Mock core lexicon with real-looking items
    const coreLexicon = [
      {
        lexemeId: 'grc-iesoys-2fba61',
        lexemeSlug: 'iesous',
        lexemeKey: 'iesous',
        legacyKeys: ['iesous', 'freq-2424'],
        lemma: 'Ἰησοῦς',
        translit: 'Iēsous',
        strongs: ['2424']
      },
      {
        lexemeId: 'grc-logos-04b1f3',
        lexemeSlug: 'logos',
        lexemeKey: 'logos',
        legacyKeys: ['logos', 'freq-3056'],
        lemma: 'λόγος',
        translit: 'logos',
        strongs: ['3056']
      },
      {
        lexemeId: 'grc-theos-3f4df2',
        lexemeSlug: 'theos',
        lexemeKey: 'theos',
        legacyKeys: ['theos', 'freq-2316'],
        lemma: 'θεός',
        translit: 'theos',
        strongs: ['2316']
      },
      {
        lexemeId: 'grc-agape-aa1d2f',
        lexemeSlug: 'agape',
        lexemeKey: 'agape',
        legacyKeys: ['agape', 'freq-26'],
        lemma: 'ἀγάπη',
        translit: 'agapē',
        strongs: ['26']
      },
      // This one shares a legacyKey with another to test ambiguity
      {
        lexemeId: 'grc-pneuma-5bc3d1',
        lexemeSlug: 'pneuma',
        lexemeKey: 'pneuma',
        legacyKeys: ['pneuma', 'freq-4151'],
        lemma: 'πνεῦμα',
        translit: 'pneuma',
        strongs: ['4151']
      }
    ];

    // A second core item sharing 'pneuma' key for ambiguity test
    const coreWithConflict = [
      ...coreLexicon,
      {
        lexemeId: 'grc-pneuma-other-xxxxx',
        lexemeSlug: 'pneuma-alt',
        lexemeKey: 'pneuma-alt',
        legacyKeys: ['pneuma'], // conflict!
        lemma: 'πνεῦμα',
        translit: 'pneuma',
        strongs: ['9999']
      }
    ];

    it('переносит slug-ключ → lexemeId', () => {
      const dict = {
        iesous: { status: 'known', showInText: true, addedAt: '2025-01-01' }
      };
      const progress = { reading: { lastBook: 'john' }, wordsToday: { date: '', added: [] } };
      const result = migrateDictionaryData(dict, progress, coreLexicon);
      expect(result.dictionary['grc-iesoys-2fba61']).toBeDefined();
      expect(result.dictionary['grc-iesoys-2fba61'].status).toBe('known');
      expect(result.dictionary.iesous).toBeUndefined(); // old key removed
      expect(result.warnings.length).toBe(0);
    });

    it('переносит freq-* ключ → lexemeId', () => {
      const dict = {
        'freq-3056': { status: 'learning', showInText: true, addedAt: '2025-02-01' }
      };
      const progress = { wordsToday: { date: '', added: [] } };
      const result = migrateDictionaryData(dict, progress, coreLexicon);
      expect(result.dictionary['grc-logos-04b1f3']).toBeDefined();
      expect(result.dictionary['grc-logos-04b1f3'].status).toBe('learning');
      expect(result.dictionary['freq-3056']).toBeUndefined();
    });

    it('canonical lexemeId passes through unchanged', () => {
      const dict = {
        'grc-theos-3f4df2': { status: 'known', showInText: true, addedAt: '2025-03-01' }
      };
      const progress = { wordsToday: { date: '', added: [] } };
      const result = migrateDictionaryData(dict, progress, coreLexicon);
      expect(result.dictionary['grc-theos-3f4df2']).toBeDefined();
      expect(result.dictionary['grc-theos-3f4df2'].status).toBe('known');
    });

    it('неоднозначный legacy-ключ помечается _legacy:true и НЕ удаляется', () => {
      const dict = {
        pneuma: { status: 'new', showInText: true, addedAt: '2025-04-01' }
      };
      const progress = { wordsToday: { date: '', added: [] } };
      const result = migrateDictionaryData(dict, progress, coreWithConflict);
      // pneuma is ambiguous (2 lexemes share it) → stays with _legacy:true
      expect(result.dictionary.pneuma).toBeDefined();
      expect(result.dictionary.pneuma._legacy).toBe(true);
      expect(result.dictionary.pneuma.status).toBe('new');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].key).toBe('pneuma');
    });

    it('идемпотентен: повторный вызов не меняет результат', () => {
      const dict = {
        iesous: { status: 'known', showInText: true, addedAt: '2025-01-01' },
        'freq-3056': { status: 'learning', showInText: true, addedAt: '2025-02-01' },
        'grc-theos-3f4df2': { status: 'known', showInText: true, addedAt: '2025-03-01' }
      };
      const progress = { wordsToday: { date: '', added: ['iesous'] } };
      const result1 = migrateDictionaryData(dict, progress, coreLexicon);
      const result2 = migrateDictionaryData(result1.dictionary, result1.progress, coreLexicon);
      expect(Object.keys(result2.dictionary)).toEqual(Object.keys(result1.dictionary));
      expect(result2.warnings.length).toBe(0);
    });

    it('мигрирует progress.wordsToday.added ключи', () => {
      const dict = {};
      const progress = {
        wordsToday: { date: '2025-06-01', added: ['iesous', 'freq-3056', 'unknown-key'] }
      };
      const result = migrateDictionaryData(dict, progress, coreLexicon);
      expect(result.progress.wordsToday.added).toContain('grc-iesoys-2fba61');
      expect(result.progress.wordsToday.added).toContain('grc-logos-04b1f3');
      expect(result.progress.wordsToday.added).toContain('unknown-key'); // unmapped passes through
    });

    it('не-словарные записи: строки пропускаются, объекты без маппинга → _legacy', () => {
      const dict = {
        iesous: { status: 'known', showInText: true, addedAt: '2025-01-01' },
        __meta: { version: 1 },           // passes isDictionaryEntry → no mapping → _legacy:true
        _schema: 'dict-v1'                 // string → fails isDictionaryEntry → skipped
      };
      const progress = { wordsToday: { date: '', added: [] } };
      const result = migrateDictionaryData(dict, progress, coreLexicon);
      expect(result.dictionary['grc-iesoys-2fba61']).toBeDefined();
      // __meta — объект без маппинга, получает _legacy:true
      expect(result.dictionary.__meta).toBeDefined();
      expect(result.dictionary.__meta._legacy).toBe(true);
      // _schema — строка, isDictionaryEntry=false → пропущена
      expect(result.dictionary._schema).toBeUndefined();
    });

    it('пустой словарь → пустой результат без warnings', () => {
      const result = migrateDictionaryData({}, { wordsToday: { date: '', added: [] } }, coreLexicon);
      expect(Object.keys(result.dictionary).length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    it('merge: при коллизии canonical-ключа выбирает свежайшую запись', () => {
      const dict = {
        'freq-2424': { status: 'known', showInText: true, addedAt: '2025-01-01', updatedAt: '2025-01-01' },
        'grc-iesoys-2fba61': { status: 'new', showInText: true, addedAt: '2024-06-01' }
      };
      const progress = { wordsToday: { date: '', added: [] } };
      const result = migrateDictionaryData(dict, progress, coreLexicon);
      // Both map to grc-iesoys-2fba61 — the fresher (2025-01-01) wins
      expect(result.dictionary['grc-iesoys-2fba61'].status).toBe('known');
      expect(Object.keys(result.dictionary).length).toBe(1); // only one entry survives
    });
  });
});
