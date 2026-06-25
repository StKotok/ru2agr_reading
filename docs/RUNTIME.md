# RUNTIME — приложение: загрузка и рендер данных

> Справочник: как PWA-приложение (`src/`) потребляет `assets/data/`. Сборка данных —
> [PIPELINE.md](PIPELINE.md). Контекст — [PROJECT.md](PROJECT.md).

---

## 1. Обзор потока

```
data loaders ──▶ engine (compose/form-layer) ──▶ UI (reading, word-card, dictionary)
     │                    │
data-manifest      lexemeId — канонический ключ везде
(cache-busting)
```

Каноническая идентичность леммы — `lexemeId` (`grc-biblos-9adfa6`). `lexemeSlug` и legacy-ключи
(slug, `freq-*`, Strong's) — только для отображения и совместимости со старым словарём пользователя.

## 2. Загрузчики данных (`src/data/`)

- **`bible-loader.js`** — грузит `bibles/grc/{book}.json`, `bibles/eng/{book}.json`,
  `align/grc-eng/{book}.json`, `alphabet.json`, `books.json`. Cache-busting через
  `data-manifest.json.version` (`?v=`). `data-manifest.json` грузится с `cache: 'no-cache'`.
- **`lexicon-loader.js`** — грузит `lexicon/core.json` (5468) и `lexicon/dictionary.json`.
  Адаптация lexemeId-first: `core.json` индексируется по `lexemeId`, с fallback на
  `lexemeSlug`/legacy-ключи. **Открытый issue [P0]:** `loadFrequency` отдаёт `strong: item.strongs`
  (массив) и не отдаёт `hasAlignment`, а экран словаря читает скаляр `item.strong` + `item.hasAlignment`
  → строки могут оказаться disabled. Согласовать форму перед релизом.

## 3. Движок (`src/engine/`)

- **`compose.js`** — собирает отображаемый стих: текст BSB + наложение греческого слоя по парам
  выравнивания. `buildDictByLexemeId` — индекс пользовательского словаря по `lexemeId`.
- **`form-layer.js`** — словесный слой: замена выровненных слов на греческую лемму или реальную
  форму. Overlap guard; рендерит вставки только для пар, явно разрешённых правилами.
- **Рендер по выравниванию (контракт UX):** греческая вставка показывается только для слов, у
  которых есть пара (`pairsByRef`). Токены без пары (`auto-deferred` и пр. категории) **не
  оборачиваются** в `span.gr` → не кликабельны, не открывают карточку, не подсвечиваются. Это
  следствие архитектуры (нет слоя — нет интерактивности), а не баг. Доля таких слов = (100% − coverage).
- **5 режимов чтения** — от чистого BSB до реальных греческих форм; концепт неизменен с v1, логика
  адаптирована под lexemeId и BSB source.

## 4. Словарь и миграция (`src/state/dictionary.js`)

Пользовательский словарь живёт в IndexedDB. Ключи мигрируют legacy (slug, `freq-*`) → `lexemeId`:
- `migrateDictionaryData(dict, progress, coreLexicon)` — идемпотентно; строит карту legacy→lexemeId
  из `legacyKeys`/`lexemeSlug`; неоднозначные ключи НЕ мигрируются (помечаются `_legacy: true`, в
  подсветке не участвуют — сознательный компромисс мажорной миграции, данные не удаляются).
- `mergeDictionaryEntry` — при коллизии ключей объединяет записи по свежести (timestamp) и силе
  статуса; поддерживает и ISO/date строки, и числовые `Date.now()`.
- `saveMigrationResults` — персист fail-soft; предупреждения в `dictionary_migration_warnings`.

**Открытый issue [P1]:** убедиться, что миграция вызывается из `reading.js mount()` после загрузки
core+dictionary, и покрыть юнит-тестами (перенос ключей, идемпотентность, merge-конфликт, неизвестный
legacy-ключ).

## 5. UI-компоненты (`src/ui/`)

- **`screens/reading.js`** — основной экран; lexemeId-first индексы (`coreByIdCache`,
  `coreByLegacyKey`, `lexemeIdKnownSet`); `collectWordData` с каноническим ключом; `CSS.escape` в
  обработчиках; баннер data-notice (релиз 1.1).
- **`screens/dictionary.js`** — список изучаемых слов. **Остаётся русскоязычным по смыслу:** заглавное
  значение — русское (`ruGloss`/`ruPrimary`); английское BSB-слово — только в карточке как «исходное
  слово», не как заглавное значение.
- **`screens/about.js`** — лицензии BSB / SBLGNT-MACULA / Cherith; Синодальный удалён.
- **`screens/onboarding.js`** — пресеты режимов. **Открытый issue [P2]:** примеры (`«Слово»→λόγος`)
  устарели под английский BSB.
- **`render.js`** — проставляет `data-lexeme-id` + `data-lexeme` + `data-lexeme-key` (совместимость).
- **`components/`** — `top-bar`, `mode-widget`, `word-card` (поле «исходное слово» = английское слово BSB).

## 6. PWA-кеширование (`vite.config.js`, `src/app.js`)

- Runtime-кеши под новые пути: `book-packs-v2`, `lexicon-data-v2`; `globIgnores` для `data/bibles`,
  `data/lexicon` (не precache — грузятся по требованию).
- `src/app.js`: `cleanupOldDataCaches` после регистрации SW — снос старых data-кешей при апдейте с
  v1.0.x. **Открытый issue [P2]:** cache-busting `core.json` через версию манифеста (как в bible-loader).

## 7. Тесты (`tests/`)

193 теста (14 файлов). Релевантные: `align-invariant` (golden-кейсы checkPairAccuracy),
`bsb-text-integrity` (склейки/апострофы), `dictionary`, `form-layer`, `compose`, `lexicon`,
`frequency-data`. Obsolete-сьют (`docs/obsolete-dont-use/**`) исключён из vitest — `npm test` —
настоящий зелёный гейт.

## 8. Открытые рантайм-issue (сводка перед релизом)

| Sev | Issue | Действие |
|---|---|---|
| P0 | Словарный UI: форма данных loader ↔ экран не совпадает | согласовать `hasAlignment`/`strong`/`translit` |
| P1 | Миграция словаря: проверить call-site + тесты | подключить в `reading.js mount()` |
| P2 | cache-busting `core.json`; онбординг-примеры; комментарии/`ruHint` | косметика/надёжность |
