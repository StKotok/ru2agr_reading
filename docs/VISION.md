# VISION: Clean-Data Migration

> **Назначение:** стабильный документ с видением, архитектурными решениями и контрактами данных.
> **Для кого:** для понимания «что и зачем» перед чтением планов реализации.
> **Планы реализации:** `IMPL-PIPELINE.md`, `IMPL-RUNTIME.md`.

---

## 1. Что мы делаем

Переводим приложение «Греческая читалка Нового Завета» на данные с чистыми лицензиями. Первый язык данных — английский (BSB). UI остаётся русским.

### Почему

- Старый пайплайн использовал UBS-данные с лицензией «used with permission only for MACULA» — это неприемлемо для нас
- Старые скрипты (23 файла) завязаны на UBS и не могут быть использованы
- `assets/data/` не существует — приложение в нерабочем состоянии
- Все данные с чистыми лицензиями уже собраны в `docs/source-data/`

### Результат

Приложение, которое:
- Показывает английский текст BSB (public domain)
- Даёт греческий слой с пословным выравниванием (5 режимов чтения)
- Работает полностью офлайн (PWA)
- Не нарушает ни одной лицензии

---

## 2. Ключевые архитектурные решения

| Решение | Выбор | Обоснование |
|---|---|---|
| Первый язык данных | Английский (BSB) | Public domain, не требует разрешений |
| Греческий текст | SBLGNT/MACULA (CC-BY 4.0, без UBS) | Уже очищен, 27 книг, морфология |
| Пословные глоссы | Berean (PD) + Cherith (CC-BY 4.0) | Уже привязаны к каждому греческому токену |
| Выравнивание | Span-based: глоссы → слова BSB | Строится алгоритмически при сборке |
| Язык UI | Русский | Меняются только строки с названием перевода (~20 строк) |
| App-ready данные | Коммитятся в `assets/data/` | Соответствует AGENTS.md, упрощает dev-цикл |
| Канонический ключ лексемы | `lexemeId` из enriched (`grc-biblos-9adfa6`) | Стабильный, MACULA-derived |
| IndexedDB | Ключи совместимы, миграция словарных ключей через `legacyKeys` | Пользователь не теряет прогресс |

---

## 3. Откуда данные

```
docs/source-data/
├── enriched/books/*.json             ← греческие токены + глоссы + морфология (152 MB)
├── enriched/lexemes.json             ← 5468 лемм: все формы, все ссылки, частотность
├── enriched/frequency.json           ← ранги частотности
├── translations/bsb-complete.json    ← BSB (66 книг, typed-content формат)
├── strongs/strongs-dictionary.json   ← Strong's определения (англ., PD)
├── strongs/strongs-ru-alignment.json ← русские соответствия Strong's
├── lexicon/top1000.core.json         ← проект: 204 леммы с рус. глоссами
├── app-config/alphabet.json          ← греческий алфавит
├── app-config/books.json             ← метаданные книг
└── app-config/schema/                ← JSON-схемы
```

---

## 4. Куда генерируем

```
assets/data/
├── bibles/grc/{book}.json            ← греческий текст (27 файлов)
├── bibles/eng/{book}.json            ← BSB английский (27 файлов)
├── align/grc-eng/{book}.json         ← span-based alignment (27 файлов)
├── align/grc-eng/build-report.json   ← отчёт о качестве выравнивания
├── lexicon/core.json                 ← словарь: 5468 лемм
├── lexicon/dictionary.json           ← Strong's определения + рус. соответствия
├── alphabet.json                     ← копия из source-data
├── books.json                        ← копия из source-data
└── data-manifest.json                ← манифест: версия, файлы, хеши
```

---

## 5. Форматы данных (контракты)

### 5.1 Греческая книга

```json
{
  "schema": "original-book-v2",
  "bookId": "matthew",
  "title": "ΚΑΤΑ ΜΑΘΘΑΙΟΝ",
  "chapters": [{
    "n": 1,
    "verses": [{
      "n": 1,
      "ref": "matthew 1:1",
      "tokens": [{
        "i": 1,
        "id": "n40001001001",
        "s": "Βίβλος",
        "lemma": "βίβλος",
        "lexemeId": "grc-biblos-9adfa6",
        "lexemeSlug": "biblos",
        "translit": "Biblos",
        "morph": "N-NSF",
        "morphLabelRu": "сущ., им. падеж, ед. ч., жен. род",
        "strongs": ["976"],
        "glossBerean": "[The] book",
        "glossCherith": "book",
        "pos": "noun",
        "posLabelRu": "существительное",
        "freqRank": 1064,
        "fw": false
      }]
    }]
  }]
}
```

Поле `lexemeId` — канонический ключ. `lexemeSlug` — человекочитаемый дубликат для отображения и обратной совместимости.

### 5.2 Английская книга (BSB)

```json
{
  "schema": "translation-book-v2",
  "translationId": "bsb",
  "bookId": "matthew",
  "title": "Matthew",
  "short": "Matt",
  "license": "Public domain",
  "attribution": "Berean Standard Bible, https://berean.bible/",
  "chapters": [{
    "n": 1,
    "verses": [{
      "ref": "matthew 1:1",
      "n": 1,
      "text": "This is the record of the genealogy of Jesus Christ...",
      "words": [
        { "i": 0, "text": "This", "start": 0, "end": 4 }
      ]
    }]
  }]
}
```

Поле `words` — замороженные офсеты слов в `text`. Генерируются ПОСЛЕ финальной нормализации текста. Нормализация — часть контракта: любое её изменение требует bump `schema` и полной регенерации всех пакетов.

### 5.3 Alignment

```json
{
  "schema": "alignment-book-v2",
  "alignmentId": "grc-eng",
  "bookId": "matthew",
  "stats": {
    "tokenCount": 18329,
    "alignedTokenCount": 17000,
    "unalignedTokenCount": 1329,
    "warningCount": 0
  },
  "pairsByRef": {
    "matthew 1:1": [
      {
        "span": [0, 4],
        "tokenId": "n40001001001",
        "lexemeId": "grc-biblos-9adfa6",
        "q": "a",
        "method": "gloss-exact"
      }
    ]
  }
}
```

`q` (quality): `a` — accepted, `f` — fuzzy, `u` — unaligned, `x` — excluded.  
`method`: `gloss-exact`, `bracket-optional`, `fuzzy`, `lemma-gloss`, `unmatched`.

---

## 6. Alignment: как это работает

Задача: сопоставить Berean-глоссы (привязанные к греческим токенам в греческом порядке слов) со словами BSB (свободный английский перевод в английском порядке слов).

Это не «английский с английским», а **«подстрочник с переводом»**. Проблемы:
- Разный порядок слов (греческий SOV vs. английский SVO)
- Разный лексический выбор (глосс «book» vs. BSB «record»)
- Лишние слова в BSB (артикли, «this is», «the record of»)
- Не все греческие токены имеют прямой эквивалент в переводе

Алгоритм:
1. Для каждого стиха: взять BSB `verse.words` и греческие enriched-токены
2. Для каждого токена построить кандидаты: `glossBerean` (с опциональными скобками), `glossCherith`, лемма-глоссы
3. Сопоставить с BSB-словами через scoring (exact → bracket-optional → fuzzy → lemma)
4. Применить monotonic order bonus и distance penalty для разрешения неоднозначностей
5. Невыровненные токены пометить `q="u"`

Порог качества: ≥85% accepted non-function-token coverage, ≥95% стихов с ≥1 accepted парой.

---

## 7. Лицензионная политика

| Данные | Лицензия | Где атрибуция |
|---|---|---|
| SBLGNT/MACULA | CC BY 4.0 | Экран «О приложении» |
| Cherith Glosses | CC BY 4.0 | Экран «О приложении» |
| Berean Interlinear | Public domain | Не требуется |
| BSB | Public domain | Экран «О приложении» (источник) |
| Strong's Dictionary | Public domain | Не требуется |
| Project-curated data | project-owned | Как данные проекта |

Новые текстовые источники — только через обновление `docs/source-data/CATALOG.md`.

---

## 8. Что НЕ меняется

- UI-компоненты (bottom-sheet, nav, inspector, word-card и др.)
- State management (store, settings, progress, dictionary)
- IndexedDB (database name, store names, топология)
- Hash-роутер
- PWA-оболочка (index.html, vite.config.js, Workbox)
- CSS и шрифты
- 5 режимов чтения (логика engine адаптируется, но концепт неизменен)
