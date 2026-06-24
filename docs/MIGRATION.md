# Migration to Clean Data: Vision & Technical Plan

> **Status:** Принят. 2026-06-24. Обновлён после критического разбора (см. `docs/obsolete-dont-use/docs/MIGRATION-feedback.md`).
> **Цель:** Перевести приложение на новые данные с чистыми лицензиями. Первый язык — английский.

---

## 1. Текущее состояние vs. Целевое

| Измерение | Было (dev2 до чистки) | Стало (цель) |
|---|---|---|
| **Данные** | SBLGNT/MACULA с UBS-полями, Strong's, Синодальный перевод, alignment через старый пайплайн | SBLGNT/MACULA (без UBS), Cherith + Berean глоссы, Strong's, BSB. Всё — public domain или CC-BY |
| **Пайплайн** | 23 скрипта, частично завязанных на UBS | 5 скриптов: bibles, lexicon, align, app-config, verify |
| **Язык данных** | Русский (Синодальный) | Английский (BSB). UI остаётся русским, меняются данные и метки перевода |
| **App-ready данные** | Не существуют (`assets/data/` пуста) | Генерируются пайплайном из `docs/source-data/` |
| **Код** | `src/` — engine + UI + state + storage | UI сохраняется, engine/data-загрузчики адаптируются |

---

## 2. Почему английский первым

- BSB — public domain, не требует разрешений
- Cherith (CC-BY 4.0) + Berean (PD) глоссы — пословное греко-английское выравнивание
- Strong's Dictionary на английском (PD)
- Русские переводы (РБО, Десницкий, Кассиан) требуют разрешений → вторым этапом

---

## 3. Архитектура данных

### 3.1 Источники → App-ready

```
docs/source-data/
├── enriched/books/*.json           (27 книг, плоский список токенов)
├── enriched/lexemes.json           (5468 лемм)
├── enriched/frequency.json         (ранги частотности)
├── translations/bsb-complete.json   (66 книг → фильтруем до 27 НЗ)
├── translations/asv.json           (запасной буквальный)
├── translations/ult.json           (технический для сверки)
├── translations/oeb.json           (NT, запасной)
├── translations/web.json           (запасной, с апокрифами)
├── strongs/strongs-dictionary.json (PD, английские определения)
├── strongs/strongs-ru-alignment.json (русские соответствия Strong's)
├── lexicon/top1000.core.json       (проект: 204 леммы с русскими глоссами)
├── app-config/alphabet.json        (греческий алфавит)
├── app-config/books.json           (метаданные книг)
└── app-config/schema/              (JSON-схемы)

        ↓ ПАЙПЛАЙН (5 скриптов) ↓

assets/data/
├── bibles/grc/{book}.json          (греческий текст с глоссами)
├── bibles/eng/{book}.json          (BSB — основной английский)
├── lexicon/core.json               (словарь: лемма → всё)
├── lexicon/dictionary.json         (Strong's определения)
├── align/grc-eng/{book}.json       (span-based выравнивание)
├── alphabet.json                   (копия из source-data)
├── books.json                      (копия из source-data)
└── data-manifest.json              (генерируется)
```

### 3.2 App-ready формат: греческий текст

```json
// assets/data/bibles/grc/matthew.json
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
        "lexemeKey": "biblos",
        "translit": "Biblos",
        "morph": "N-NSF",
        "morphLabelRu": "сущ., им. падеж, ед. ч., жен. род",
        "strong": ["976"],
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

### 3.3 Таблица трансформации полей: enriched → app-ready

| Поле в enriched | Тип в enriched | Поле в app-ready | Тип в app-ready | Примечание |
|---|---|---|---|---|
| `id` | str | `id` | str | как есть |
| `surface` | str | `s` | str | переименовать |
| `lemma` | str | `lemma` | str | как есть |
| `lexemeId` | str | `lexemeKey` | str | в enriched имена, в app-ready ключи |
| `transliteration` | str | `translit` | str | как есть (уже готово) |
| `morphology.code` | str (внутри объекта) | `morph` | str | **извлечь** `.code` из объекта `morphology` |
| `morphology.labelRu` | str (внутри объекта) | `morphLabelRu` | str | **извлечь** `.labelRu` из `morphology` |
| `strong` | [str] | `strong` | [str] | как есть |
| `pos.labelRu` | str (внутри объекта) | `posLabelRu` | str | **извлечь** `.labelRu` из `pos` |
| `pos.primary` | str (внутри объекта) | `pos` | str | **извлечь** `.primary` из `pos` |
| `glossEn` | str | `glossBerean` | str | Berean Interlinear (PD) — с артиклями в скобках |
| `english` | str | `glossCherith` | str | Cherith Glosses (CC-BY 4.0) — простое слово |
| `isFunctionWord` | bool | `fw` | bool | переименовать |
| — (из frequency.json) | — | `freqRank` | int | join по `lexemeId` |

**Почему `glossEn` = Berean, а `english` = Cherith:** соответствие проверено по покрытию в build-report.md (Berean `gloss`: 99.4% ≈ enriched `glossEn`: 99.3%; Cherith `english`: 96.6% ≈ enriched `english`: 96.7%). Berean — интерлинеарный стиль с артиклями в скобках (`[The] book`). Cherith — простое слово (`book`).

### 3.4 App-ready формат: английский перевод (BSB)

```json
// assets/data/bibles/eng/matthew.json
{
  "schema": "translation-book-v2",
  "translationId": "BSB",
  "bookId": "matthew",
  "title": "Matthew",
  "license": "Public domain",
  "attribution": "Berean Standard Bible, https://berean.bible/",
  "chapters": [{
    "n": 1,
    "verses": [{
      "n": 1,
      "text": "This is the record of the genealogy of Jesus Christ, the son of David, the son of Abraham:"
    }]
  }]
}
```

**Конвертация BSB:** исходный формат — typed content array (`[{type: "heading"|"verse"|"line_break", ...}]`).

Правила конвертации:
- `type: "verse"` → `{n, text}`. Поле `content` — массив строк и объектов `{text, noteId}`. Строки конкатенируются, объекты с `noteId` пропускаются (сноски не сохраняем). `line_break` между кусками verse-контента → пробел.
- `type: "heading"` → **пропускается** (заголовки не включаются в app-ready формат)
- `type: "line_break"` → **пропускается** (не значим для построчного рендеринга)
- Фильтрация: только 27 книг НЗ. Маппинг ID: uppercase BSB (`MAT`, `MRK`, ...) → lowercase app-ready (`matthew`, `mark`, ...)

### 3.5 App-ready формат: alignment

```json
// assets/data/align/grc-eng/matthew.json
{
  "schema": "alignment-book-v2",
  "alignmentId": "grc-eng",
  "bookId": "matthew",
  "pairsByRef": {
    "matthew 1:1": [
      {"span": [0, 4], "tokenId": "n40001001001", "lexemeKey": "biblos"},
      {"span": [8, 12], "tokenId": "n40001001002", "lexemeKey": "genesis"},
      ...
    ]
  }
}
```

**Это НЕ простая переупаковка enriched-данных.** Enriched содержит пословные глоссы (каждому греческому токену — английское слово), но engine требует span-based alignment: для каждого слова английского текста — позиция `[start, end]` в `verseText` и привязка к греческому `tokenId`.

Однако для английского построение alignment **существенно проще**, чем для русского:
1. Глоссы enriched уже на английском (том же языке, что и перевод)
2. Алгоритм: токенизировать BSB-стих → для каждого английского слова найти соответствующий enriched-токен по совпадению глосса → вычислить span в тексте стиха
3. Не требуется кандидат-генерация, сертификация, LLM-аудит (как в старом `build:align`)

---

## 4. Пайплайн: 5 скриптов

### 4.1 Обзор

```
scripts/
├── build-bibles.mjs       — греческий текст + BSB
├── build-lexicon.mjs      — словарь (Strong's + частотность + русские глоссы)
├── build-align.mjs        — выравнивание греческий↔BSB (span-based)
├── build-app-config.mjs   — alphabet.json, books.json, data-manifest.json
├── build-data.mjs         — оркестратор
└── verify-data.mjs        — верификация сгенерированных данных
```

### 4.2 `build-bibles.mjs`

**Вход:**
- `docs/source-data/enriched/books/{book}.json` (27 файлов, плоский массив токенов)
- `docs/source-data/enriched/frequency.json` (ранги по lexemeId)
- `docs/source-data/translations/bsb-complete.json` (66 книг, typed content)

**Выход:**
- `assets/data/bibles/grc/{book}.json` (27 файлов, иерархический)
- `assets/data/bibles/eng/{book}.json` (27 файлов, BSB — только НЗ)

**Детальная логика:**

1. **Загрузка frequency:** прочитать `frequency.json` → Map `<lexemeId, rank>`

2. **Генерация греческих книг (grc):**
   ```
   для каждой книги из списка 27 НЗ:
     а. Прочитать enriched/books/{book}.json → плоский массив токенов
     б. Добавить freqRank: token.lexemeId → frequencyMap.get(lexemeId)?.rank ?? null
     в. Сгруппировать токены по chapter → verse:
        - Ключ группировки: token.chapter (int), token.verse (int)
        - В каждом стихе: отсортировать по tokenIndex
        - Проверить, что количество токенов не изменилось (sum = исходная длина массива)
     г. Для каждого токена применить маппинг полей (см. таблицу 3.3):
        - morphology.code → morph (плоская строка)
        - morphology.labelRu → morphLabelRu
        - transliteration (строка) → translit (как есть)
        - glossEn → glossBerean
        - english → glossCherith
        - isFunctionWord → fw
        - surface → s
        - id, lemma, strong → как есть
        - lexemeId → lexemeKey (переименовать, значение то же)
     д. Записать {schema, bookId, title, chapters: [{n, verses: [{n, ref, tokens}]}]}
   ```

3. **Генерация BSB-книг (eng):**
   ```
   загрузить bsb-complete.json
   маппинг ID книг: {MAT: matthew, MRK: mark, LUK: luke, JHN: john, ...}
   для каждой из 27 книг НЗ:
     а. Найти книгу в BSB по uppercase ID
     б. Для каждой главы:
        - Пройти по content-массиву
        - type="verse": собрать text из content (строки конкатенировать,
          объекты с noteId пропускать, line_break → пробел)
        - type="heading", type="line_break": пропустить
     в. Записать {schema, translationId, bookId, title, license,
        attribution, chapters: [{n, verses: [{n, text}]}]}
   ```

4. **Маппинг ID книг (BSB uppercase → app-ready lowercase):**
   ```
   MAT→matthew, MRK→mark, LUK→luke, JHN→john, ACT→acts,
   ROM→romans, 1CO→1corinthians, 2CO→2corinthians, GAL→galatians,
   EPH→ephesians, PHP→philippians, COL→colossians,
   1TH→1thessalonians, 2TH→2thessalonians, 1TI→1timothy,
   2TI→2timothy, TIT→titus, PHM→philemon, HEB→hebrews,
   JAS→james, 1PE→1peter, 2PE→2peter, 1JN→1john,
   2JN→2john, 3JN→3john, JUD→jude, REV→revelation
   ```

### 4.3 `build-lexicon.mjs`

**Вход:**
- `docs/source-data/enriched/lexemes.json` (5468 лемм)
- `docs/source-data/enriched/frequency.json` (ранги)
- `docs/source-data/strongs/strongs-dictionary.json` (PD, англ. определения по номерам Strong's)
- `docs/source-data/strongs/strongs-ru-alignment.json` (рус. соответствия по номерам Strong's)
- `docs/source-data/lexicon/top1000.core.json` (проект: 204 леммы с рус. глоссами, ruMatches, refs)

**Выход:**
- `assets/data/lexicon/core.json` — комбинированный словарь
- `assets/data/lexicon/dictionary.json` — Strong's определения

**Детальная логика:**

1. **core.json:**
   ```
   для каждой леммы из lexemes.json:
     - id, lemma, transliteration, pos, strong, frequency, allRefs,
       attestedForms, glossesEn (Berean), englishGlosses (Cherith) → как есть
     - добавить freqRank = frequency.rank (join по lexemeId)
     - если есть strong и strong есть в strongs-ru-alignment:
         добавить ruPrimary (основной русский глосс)
         добавить ruTopWords (русские альтернативы)
     - если lemma есть в top1000.core.json:
         добавить ruMatches, ruExclude, refs (примеры для показа)
   ```

2. **dictionary.json:**
   ```
   переупаковать strongs-dictionary.json:
     ключ = номер Strong's → { definitionEn, greekWord, translit }
   добавить из strongs-ru-alignment.json:
     ключ = номер Strong's → { ruPrimary, ruTopWords }
   ```

### 4.4 `build-align.mjs`

**Вход:**
- `docs/source-data/enriched/books/{book}.json` — токены с глоссами
- `assets/data/bibles/eng/{book}.json` — сгенерированный BSB (выход build-bibles)
- `assets/data/bibles/grc/{book}.json` — сгенерированный греческий (выход build-bibles)

**Выход:**
- `assets/data/align/grc-eng/{book}.json` — span-based alignment

**Алгоритм выравнивания (для каждого стиха):**

```
1. Взять BSB verse.text
2. Токенизировать verse.text в слова с позициями:
   words = tokenizeWithOffsets(verse.text)
   // words[i] = {text: "This", start: 0, end: 4}
3. Взять enriched-токены этого стиха (enrichedTokens)
4. Для каждого enriched-токена t:
   а. Взять t.glossEn (Berean) как searchGloss
   б. Очистить searchGloss от скобок: удалить '[', ']'
   в. Найти в words[i] слово, совпадающее с searchGloss
      (по lemma-нормализации: lowercase, убрать пунктуацию)
   г. Если найдено: создать alignment pair {
        span: [words[i].start, words[i].end],
        tokenId: t.id,
        lexemeKey: t.lexemeId
      }
   д. Если НЕ найдено: пометить q="u" (unaligned)
5. Записать pairsByRef[ref] = [alignment pairs]
```

**Ключевое отличие от старого alignment:** старый требовал candidates → certify → manual-certified → LLM-audit. Новый использует прямое сопоставление глоссов со словами BSB — алгоритмически, детерминированно. Не требуется база «золотых» пар и ручная сертификация.

### 4.5 `build-app-config.mjs`

**Вход:**
- `docs/source-data/app-config/alphabet.json`
- `docs/source-data/app-config/books.json`
- `docs/source-data/app-config/schema/*.json`

**Выход:**
- `assets/data/alphabet.json` (копия)
- `assets/data/books.json` (копия)
- `assets/data/data-manifest.json` (генерируется — список всех файлов в `assets/data/` с путями и размерами)

### 4.6 `verify-data.mjs`

**Проверки:**
1. Все 27 книг присутствуют в `bibles/grc/`, `bibles/eng/`, `align/grc-eng/`
2. Количество токенов в каждой сгенерированной grc-книге = количество enriched-токенов для этой книги (ни один не потерян при группировке)
3. Количество стихов в каждой eng-книге = ожидаемому (сверка с эталонным списком)
4. Для каждой alignment-книги: нет orphan-токенов без span (все q="u" залогированы)
5. `lexicon/core.json`: все 5468 лемм присутствуют
6. `data-manifest.json` соответствует фактическому содержимому `assets/data/`

### 4.7 `npm run build:data`

```json
{
  "scripts": {
    "build:bibles": "node scripts/build-bibles.mjs",
    "build:lexicon": "node scripts/build-lexicon.mjs",
    "build:align": "node scripts/build-align.mjs",
    "build:app-config": "node scripts/build-app-config.mjs",
    "build:data": "npm run build:bibles && npm run build:lexicon && npm run build:align && npm run build:app-config",
    "verify:data": "node scripts/verify-data.mjs"
  }
}
```

---

## 5. Что в коде меняется

### 5.1 Оставить без изменений

```
src/state/       — store, settings, progress, dictionary
src/storage/     — IndexedDB (key-value, абстрактный)
src/ui/components/ — bottom-sheet, icons, inspector, mode-widget, nav, toast, top-bar, word-card
src/ui/screens/  — about, dictionary, onboarding, progress, settings
src/router.js    — хэш-роутер
src/app.js       — точка входа
index.html       — оболочка PWA
vite.config.js   — сборка
assets/styles/   — CSS
assets/fonts/    — GentiumPlus
```

### 5.2 Адаптировать

```
src/ui/screens/reading.js  — ключевой экран: переход с русского текста на английский
src/engine/compose.js      — использование новых полей (glossBerean, glossCherith, translit, freqRank)
src/engine/form-layer.js   — новый alignment-формат (span на английский текст вместо русского)
src/engine/morphology.js   — маппинг morph-кода в русские метки (без изменений, формат morph совместим)
src/engine/letter-layer.js — без изменений (работает с surface-формами)
src/engine/rules.js        — без изменений
src/engine/hash.js         — без изменений
```

### 5.3 Переписать

```
src/data/bible-loader.js   — полное переписывание:
  - Новые пути: data/bibles/grc/ + data/bibles/eng/ (вместо data/originals/ + data/translations/)
  - Новый формат токенов (см. таблицу 3.3)
  - Загрузка alignment из data/align/grc-eng/ (вместо data/align/syn--sblgnt-macula/)
  - Загрузка books.json и data-manifest.json из data/ (пути не меняются)

src/data/lexicon-loader.js — переписывание:
  - Новый формат core.json и dictionary.json
  - Загрузка alphabet.json (путь не меняется)
```

### 5.4 UI: русский интерфейс + английские данные

UI остаётся на русском (заголовки, метки, кнопки). Меняется:
- Заголовок перевода: «BSB» вместо «Синодальный»
- В hebrew/greek-переключении: «Английский / BSB» вместо «Русский / Синодальный»
- Лейблы режимов чтения адаптируются под английский контекст
- Онбординг: текст про «русский → греческий» заменить на «английский → греческий»

Это ~20 строк текста. Полноценная английская локализация UI — отдельной фазой.

---

## 6. Миграция пользовательских данных (IndexedDB)

### 6.1 Что хранится

| Store | Ключ | Совместимость |
|---|---|---|
| `progress` | `{bookId, chapter}` | ✅ bookId те же (lowercase), chapter — число |
| `letters` | `{letter}` | ✅ буквы греческого алфавита не меняются |
| `dictionary` | `{lexemeKey}` | ✅ lexemeId совпадает между enriched и новым форматом (`grc-biblos-9adfa6`) |
| `settings` | ключи настроек | ✅ структура не меняется |

### 6.2 Стратегия

**Совместимость без миграции.** Все ключи (bookId, lexemeKey, chapter) идентичны между старым и новым форматом. При обновлении приложения:
1. Service worker обновляется → новый кеш
2. IndexedDB-данные остаются валидными (ключи не изменились)
3. Пользователь продолжает с того же места

**Единственный риск:** если пользователь обновит страницу во время загрузки данных (старый формат частично в кеше, новый загружается). Решение: версионирование data-manifest.json — при несовпадении версии сбрасывать кеш и перезагружать.

### 6.3 Версионирование

```json
// assets/data/data-manifest.json
{
  "schema": "data-manifest-v2",
  "version": "2.0.0",
  "buildDate": "2026-06-24T...",
  "files": [...]
}
```

При старте приложение сверяет `manifest.version` с сохранённой в localStorage. При несовпадении — инвалидация кеша, перезагрузка всех данных.

---

## 7. PWA / Service Worker

Текущий service worker генерируется `vite-plugin-pwa` (Workbox). При изменении структуры `assets/data/`:

1. **Precache:** Workbox сам обновит precache-манифест при `vite build` (новые файлы в `dist/data/` попадут в кеш)
2. **Runtime-кеш:** данные загружаются через `bible-loader.js` → fetch. Workbox runtime-кеширует их по URL. При изменении URL (новые пути) старый кеш становится нерелевантным
3. **Инвалидация:** использовать `data-manifest.json` version как cache-busting параметр: `fetch('data/bibles/grc/matthew.json?v=2.0.0')`

**Стратегия:** полагаться на стандартный механизм Workbox + версионирование через data-manifest.

---

## 8. Стратегия CI/CD и отката

### 8.1 Генерация vs. коммит app-ready данных

**Решение: app-ready данные НЕ коммитятся в репозиторий.**

- `assets/data/` в `.gitignore`
- Данные генерируются при `npm run build:data` перед `npm run build`
- `npm run build` = `npm run build:data && vite build` (как было в старом проекте)
- В CI (Netlify): build command = `npm run build`
- Размер source-data: ~217 MB (уже в репо)
- Размер app-ready: оценка ~30 MB (греческий + BSB + alignment + lexicon) — НЕ в репо

### 8.2 Откат

```bash
# Откат данных: перегенерировать из source-data
npm run build:data

# Откат кода: git checkout предыдущего коммита
git checkout <previous-commit>

# Полный откат: git revert
```

Source-data в репо — это точка восстановления. App-ready данные всегда можно перегенерировать.

---

## 9. План фаз

### Фаза 1: Пайплайн

| Задача | Оценка |
|---|---|
| Создать `scripts/` | 0.1 дня |
| `build-bibles.mjs` — группировка токенов, маппинг полей, конвертация BSB | 3 дня |
| `build-lexicon.mjs` — слияние enriched + Strong's + top1000 | 2 дня |
| `build-align.mjs` — span-based alignment глоссы→BSB | 3 дня |
| `build-app-config.mjs` — копирование + data-manifest | 0.5 дня |
| `build-data.mjs` — оркестратор | 0.5 дня |
| `verify-data.mjs` — проверки целостности | 1 день |
| **Итого Фаза 1** | **~2 недели** |

### Фаза 2: Адаптация кода

| Задача | Оценка |
|---|---|
| `bible-loader.js` — новые пути, новый формат, английский текст | 2 дня |
| `lexicon-loader.js` — новый формат словаря | 1 день |
| `engine/compose.js` — новые имена полей | 0.5 дня |
| `engine/form-layer.js` — alignment на английский текст | 1 день |
| `reading.js` — переход на английские данные, замена строк | 1 день |
| Обновление тестов (12 файлов) | 1 день |
| **Итого Фаза 2** | **~1.5 недели** |

### Фаза 3: Верификация и деплой

| Задача | Оценка |
|---|---|
| Сквозной прогон: все 5 режимов × 27 книг | 1 день |
| PWA: service worker, офлайн-режим, кеширование | 0.5 дня |
| Кросс-браузерное тестирование IndexedDB | 0.5 дня |
| `npm run build` → Netlify deploy | 0.5 дня |
| **Итого Фаза 3** | **~2.5 дня** |

### Фаза 4: Русский язык (отдельный план)

### Общая оценка: **4–4.5 недель**

---

## 10. Что НЕ входит

- Полноценная английская локализация UI (только замена строк, связанных с данными)
- Новая функциональность (конкорданс, семантический поиск, etc.)
- Русские переводы с ограниченными лицензиями
- Серверный рендеринг / SSR
- Мобильные приложения (PWA достаточно)

---

## 11. Ключевые решения

| Решение | Выбор |
|---|---|
| Первый язык данных | Английский |
| Основной перевод | BSB (public domain) |
| Язык UI | Русский (с адаптацией строк под английские данные) |
| Источник выравнивания | Berean (glossEn) ↔ слова BSB (прямое сопоставление) |
| Формат данных | Иерархический: книга → глава → стих → токены |
| App-ready данные | Не коммитятся, генерируются при сборке |
| Миграция IndexedDB | Не требуется (ключи совместимы) |
| Пайплайн | 5 скриптов Node.js + verify |
| Source-data | В репозитории (217 MB) |
