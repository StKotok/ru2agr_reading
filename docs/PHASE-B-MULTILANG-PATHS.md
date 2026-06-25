# PHASE B — Multi-language path restructuring

> План перевода структуры данных с жёстко зашитых `eng/` / `grc-eng/` на
> параметризованные пути `{lang}/{translation}/`. Первый concrete-перевод —
> BSB English (данные и выравнивание уже готовы, accuracy gate пройден).

## Зачем

До миграции v2 проект был привязан к русскому Синодальному переводу. После
миграции — к английскому BSB. Оба варианта жёстко зашиты в коде и путях.
Цель — сделать так, чтобы один и тот же код мог обслуживать несколько
переводов на разных языках без изменения ядра.

PROJECT.md §7 явно называет «возврат русского перевода отдельным лицензионным
этапом» как цель продукта. PROJECT.md §3 называет английский source-текст
«временным компромиссом ради лицензий». Этап Б — инфраструктурный фундамент
для этой цели; он НЕ добавляет второй перевод, а делает архитектуру готовой
к его добавлению.

## Сверка с PROJECT.md

| # | Тезис PROJECT.md | Статус |
|---|-----------------|--------|
| 1 | Язык UI русский (§3) | ✅ UI не меняется |
| 2 | `lexemeId` — канонический ключ (§3) | ✅ не зависит от языка перевода |
| 3 | Accuracy + partition hard-gate (§5) | ✅ per-перевод, не глобально |
| 4 | App-ready данные коммитятся в `assets/data/` (§3) | ✅ каталог тот же |
| 5 | Новые текстовые источники → CATALOG.md (§6) | ✅ процесс сохраняется |
| 6 | §7: возврат русского перевода | ✅ план реализует эту цель |
| 7 | §9: навигация/store/PWA/режимы не меняются | ✅ не трогаем |
| 8 | §4: документированная схема `bibles/eng/` | ⚠️ единственное противоречие — устраняется обновлением §4 |

**Неразрешимых противоречий нет.** Единственный конфликт — документационный:
§4 описывает плоские пути, которые Этап Б заменяет на nested. PROJECT.md §4
будет обновлён в рамках этапа.

## Что было (после Этапа А)

```
assets/data/
├── bibles/grc/{book}.json               греческий источник (27 книг)
├── bibles/eng/{book}.json               BSB English (27 книг)
├── align/grc-eng/{book}.json            alignment-паки (27 книг)
├── align/grc-eng/build-report.json      агрегат метрик
├── align/grc-eng/aligned-lexemes.json   индекс выровненных лексем (4647)
├── lexicon/core.json                    5468 лемм
├── lexicon/dictionary.json              Strong's + рус. соответствия
├── alphabet.json, books.json, data-manifest.json
```

Жёсткие пути в коде:

```js
// bible-loader.js
const dir = type === 'grc' ? 'data/bibles/grc' : 'data/bibles/eng';
const res = await fetch(`./data/align/grc-eng/${bookId}.json?v=${v}`);

// reading.js
loadPromises.push(loadBook('grc', bookId));   // 'grc' строкой
loadPromises.push(loadBook('eng', bookId));   // 'eng' строкой
loadPromises.push(loadAlignment(bookId));     // 'grc-eng' внутри
```

Ни в settings, ни в loader'ах нет ни одной переменной для языка или перевода.

## Что станет

```
assets/data/
├── bibles/
│   ├── grc/sblgnt/{book}.json            греческий источник
│   └── en/bsb/{book}.json                BSB English
├── align/
│   └── grc-en/bsb/
│       ├── {book}.json                   alignment-паки
│       ├── build-report.json
│       └── aligned-lexemes.json
├── lexicon/…                             без изменений
├── alphabet.json, books.json, data-manifest.json
```

Параметризованные пути в коде:

```js
// bible-loader.js
loadBook(lang, translation, bookId)
loadAlignment(sourceLang, targetLang, translation, bookId)

// reading.js — значения из settings
loadBook(settings.sourceLang, 'sblgnt', bookId)
loadBook(settings.targetLang, settings.translation, bookId)
loadAlignment(settings.sourceLang, settings.targetLang, settings.translation, bookId)
```

Настройки по умолчанию:

```js
// settings.js
{ sourceLang: 'grc', targetLang: 'en', translation: 'bsb' }
```

## План по шагам

### Б.1 — Переименование путей в build-пайплайне

**Файлы:** `scripts/build-bibles.mjs`, `scripts/build-align.mjs`,
`scripts/build-app-config.mjs`, `scripts/build-data.mjs`,
`scripts/verify-data.mjs`, `scripts/lib/versions.mjs`.

**Суть:** все скрипты сборки переходят с плоских путей на nested. Версии
снимка (`sourceDataVersion`, `normalizationVersion`) остаются без изменений —
данные те же, структура каталогов другая.

- `build-bibles.mjs`: пути вывода — `bibles/{lang}/{translation}/` вместо
  `bibles/{type}/`. Параметры: константы `SOURCE_LANG`, `TARGET_LANG`,
  `TRANSLATION_ID` в `versions.mjs` или аргументы командной строки.
- `build-align.mjs`: пути ввода греческого — `bibles/grc/sblgnt/`, ввода
  перевода — `bibles/{lang}/{translation}/`, вывода — `align/grc-{lang}/{translation}/`.
- `build-app-config.mjs`: рекурсивный обход новой структуры для
  `data-manifest.json`. Типы файлов: `{lang}-{translation}-bible` вместо
  `eng-bible`.
- `verify-data.mjs`: адаптация всех путей (20+ проверок). Инварианты accuracy
  и partition не меняются — проверки те же, файлы по другим путям.
- `build-data.mjs`: оркестрация с учётом новых путей; атомарный rename как
  прежде.

### Б.2 — Параметризация bible-loader.js

**Файл:** `src/data/bible-loader.js`.

Текущий API:

```js
loadBook(type, bookId)          // type ∈ {'grc', 'eng'}
loadAlignment(bookId)           // путь зашит: align/grc-eng/
```

Новый API:

```js
loadBook(lang, translation, bookId)
// Пример: loadBook('en', 'bsb', 'john')
// → fetch('./data/bibles/en/bsb/john.json?v=…')

loadAlignment(sourceLang, targetLang, translation, bookId)
// Пример: loadAlignment('grc', 'en', 'bsb', 'john')
// → fetch('./data/align/grc-en/bsb/john.json?v=…')
```

`loadManifest()` и `getVersion()` — без изменений. `loadBooks()` и
`loadAlphabet()` — без изменений (не зависят от языка перевода).

### Б.3 — Настройки языка/перевода в settings.js

**Файл:** `src/state/settings.js`.

Новые поля:

```js
const DEFAULTS = {
  readingMode: 'mixed',
  wordLayer: 'words',
  intensity: 35,
  sourceLang: 'grc',             // + новое
  targetLang: 'en',              // + новое
  translation: 'bsb',            // + новое
  // …
};
```

- `deriveComposeMode(settings, activeWordCount)` — без изменений (режим
  чтения не зависит от языка перевода).
- `shouldLoadGreek()` → переименовать в `shouldLoadSource()` — семантически
  точнее (источник всегда греческий, но функция проверяет, нужен ли слой
  оригинала).

Обратная совместимость: при загрузке старых settings (без полей `sourceLang`/
`targetLang`/`translation`) — слияние с дефолтами, пользователь получает BSB
English как и прежде.

### Б.4 — Адаптация reading.js

**Файл:** `src/ui/screens/reading.js`.

Изменения:

- `mount()`: читать `targetLang`/`translation`/`sourceLang` из settings.
- Замены вызовов:
  ```js
  // было:
  loadBook('eng', bookId)
  loadBook('grc', bookId)
  loadAlignment(bookId)

  // стало:
  loadBook(targetLang, translation, bookId)
  loadBook(sourceLang, 'sblgnt', bookId)   // 'sblgnt' — константа источника
  loadAlignment(sourceLang, targetLang, translation, bookId)
  ```
- `grcStatus` → `sourceStatus` (семантически точнее; значения: `'idle'`,
  `'loading'`, `'available'`, `'unavailable'`).
- `grcBookData` → `sourceBookData`, `grcVerseMap` → `sourceVerseMap`,
  `grcLoadPromise` → `sourceLoadPromise`.
- Функции `buildGrcVerseMap()` → `buildSourceVerseMap()`,
  `getGrcVerse()` → `getSourceVerse()`,
  `ensureGreekBookLoaded()` → `ensureSourceBookLoaded()`.

Состояние хранилища (`store`) — без изменений, только имена полей в
модульных переменных reading.js (не персистятся).

### Б.5 — Реорганизация данных и регенерация

1. Удалить старые каталоги: `assets/data/bibles/eng/`, `assets/data/bibles/grc/`,
   `assets/data/align/grc-eng/`.
2. Запустить `npm run build:data` — генерация в новой структуре.
3. `npm run verify:data` → 0 errors.
4. Инвариант: coverage (81.8%), accuracy (hard-gate), partition (72102/72102),
   aligned-lexemes (4647) — те же значения, что до переименования. Меняются
   только пути.

### Б.6 — PWA-кеши

**Файлы:** `vite.config.js`, `src/app.js`.

- `vite.config.js`: runtime-кеши с новыми cacheName:
  ```js
  // было:                     // стало:
  'book-packs-v2'              'book-packs-v3'
  'lexicon-data-v2'            'lexicon-data-v3'
  ```
- `src/app.js`: `cleanupOldDataCaches` — пополнить список удаляемых:
  ```js
  const keep = new Set(['book-packs-v3', 'lexicon-data-v3']);
  const oldPrefixes = ['book-packs', 'book-packs-v2', 'lexicon-data', 'lexicon-data-v2'];
  ```

### Б.7 — Обновление документации

| Файл | Изменения |
|------|-----------|
| `docs/PROJECT.md` §4 | Новая схема каталогов (nested paths) |
| `docs/PROJECT.md` §8 | Вычеркнуть P0/P1/P2 (закрыты Этапом А) |
| `docs/PIPELINE.md` §1,§4,§6 | Пути вывода в таблице скриптов, примеры |
| `docs/RUNTIME.md` §2 | Новые сигнатуры `loadBook`/`loadAlignment` |
| `docs/RUNTIME.md` §3 | Переименование `grcStatus` → `sourceStatus` |

### Б.8 — Тесты и финальный гейт

```bash
npm test             # 193+ passed (новые тесты на loadBook с параметрами)
npm run build:data   # регенерация в новой структуре
npm run verify:data  # 0 errors
npm run build        # production build
```

Ручная проверка: приложение загружается, BSB отображается, греческий слой
работает, словарь функционален.

## Что НЕ делается в этом этапе

- ❌ Добавление второго перевода (русского или любого другого) — Этап В.
- ❌ UI выбора языка/перевода — пока жёсткий дефолт `en/bsb` в settings.
- ❌ Локализация `books.json` — названия книг остаются русскими (UI русский).
- ❌ Перестройка source-данных (`docs/source-data/`) под несколько переводов —
  только реорганизация готовых app-ready данных.
- ❌ Изменение схем данных (original-book-v2, translation-book-v2,
  alignment-book-v3) — схемы остаются без изменений.

## Оценка рисков

| Риск | Вероятность | Смягчение |
|------|------------|-----------|
| Переименование сломает PWA-кеши (старый SW кеширует старые пути) | Средняя | `cleanupOldDataCaches` с явным списком старых префиксов + bump cacheName |
| verify-data сломается на новых путях | Средняя | verify адаптируется в Б.1; 20+ проверок, каждая тестируется |
| Регрессия coverage/accuracy | Низкая | Инвариант: входные данные не меняются → выходные метрики те же |
| IndexedDB-миграция для существующих пользователей | Низкая | Ключи БД не меняются (store/settings/progress/dictionary), только пути загрузки данных |
| Смешение старых и новых данных в `assets/data/` | Низкая | Оркестратор `build-data.mjs` атомарно заменяет всю директорию |

## Следующий этап (В)

После Б проект готов к добавлению конкретных переводов. Этап В — добавление
первого нового перевода (кандидаты: русский Синодальный при решении
лицензионного вопроса, или другой public domain / CC перевод). Для этого
потребуется:

1. Достать текст перевода с лицензией, допускающей использование.
2. Токенизировать с frozen offsets (как BSB в `build-bibles.mjs`).
3. Запустить alignment против греческого SBLGNT (алгоритм уже обобщён).
4. Пройти accuracy hard-gate + partition (verify-data per-перевод).
5. Добавить перевод в `data-manifest.json` и настройки.
6. Обновить CATALOG.md с лицензией источника.
