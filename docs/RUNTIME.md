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
  `lexemeSlug`/legacy-ключи. Cache-busting через `?v=` из `data-manifest.json`.
  `loadCoreLexicon` добавляет `id=lexemeId` и `lexemeKey=lexemeSlug` для совместимости.
  Каждый элемент содержит `detail` (`{ definition, derivation, pronunciation }`) из Strong's.
  `loadFrequency` отдаёт `strong` как скаляр (`strongs[0]`), `count` (частота),
  `hasAlignment` (через `loadAlignedLexemes()` → `aligned-lexemes.json`), сортирует
  по возрастанию ранга (самые частотные первыми). `loadAlignedLexemes` — новый загрузчик,
  возвращает `Set<string>` lexemeId с ≥1 alignment-парой (4647 из 5468).

## 3. Движок (`src/engine/`)

- **`compose.js`** — собирает отображаемый стих: текст BSB + наложение греческого слоя по парам
  выравнивания. `buildDictByLexemeId` — индекс пользовательского словаря по `lexemeId`.
- **`form-layer.js`** — словесный слой: замена выровненных слов на греческую лемму или реальную
  форму. Overlap guard; рендерит вставки только для пар, явно разрешённых правилами.
- **Рендер по выравниванию (контракт UX):** греческая вставка показывается только для слов, у
  которых есть пара (`pairsByRef`). Токены без пары (`auto-deferred` и пр. категории) **не
  оборачиваются** в `span.gr` → не кликабельны, не открывают карточку, не подсвечиваются. Это
  следствие архитектуры (нет слоя — нет интерактивности), а не баг. Доля таких слов = (100% − coverage).
- **Буквенный слой (`letter-layer.js` / `rules.js`)** — заменяет буквы исходного текста на греческие
  детерминированно (`hash01`). Два словаря правил: `RULES_LATIN` (32 правила для английского BSB:
  `a→α`, `th→θ`, `ph→φ`, `ch→χ`, `w→ω` и др.) и `RULES_CYRILLIC` (38 правил для русского
  Синодального). `getRules(script)` выбирает словарь; `applyLetterLayer` принимает `script` параметр.
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
  Миграция вызывается из `reading.js mount()` после загрузки core+dictionary; идемпотентна.
  Покрыта юнит-тестами (9 тестов в `tests/dictionary.test.js`): перенос slug/freq-* ключей,
  canonical lexemeId, неоднозначные ключи → `_legacy:true`, идемпотентность, миграция
  `progress.wordsToday.added`, merge-коллизии.

## 5. UI-компоненты (`src/ui/`)

- **`screens/reading.js`** — основной экран; lexemeId-first индексы (`coreByIdCache`,
  `coreByLegacyKey`, `lexemeIdKnownSet`); `collectWordData` с каноническим ключом; `CSS.escape` в
  обработчиках; баннер data-notice (релиз 1.1).
- **`screens/dictionary.js`** — список изучаемых слов. **Остаётся русскоязычным по смыслу:** заглавное
  значение — русское (`ruGloss`/`ruPrimary`); английское BSB-слово — только в карточке как «исходное
  слово», не как заглавное значение.
- **`screens/about.js`** — лицензии BSB / SBLGNT-MACULA / Cherith; Синодальный удалён.
- **`screens/onboarding.js`** — пресеты режимов. Примеры обновлены под английский BSB
  (`«Word»→λόγος`, `«Word»→λόγῳ`, цитата «In the beginning was the Word»).
- **`render.js`** — проставляет `data-lexeme-id` + `data-lexeme` + `data-lexeme-key` (совместимость).
- **`components/`** — `top-bar`, `mode-widget`, `word-card` (поле «исходное слово» = английское слово BSB).

## 6. PWA-кеширование (`vite.config.js`, `src/app.js`)

- Runtime-кеши под новые пути: `book-packs-v2`, `lexicon-data-v2`; `globIgnores` для `data/bibles`,
  `data/lexicon` (не precache — грузятся по требованию).
- `src/app.js`: `cleanupOldDataCaches` после регистрации SW — снос старых data-кешей при апдейте с
  v1.0.x. Cache-busting `core.json` через `?v=` из манифеста (как в bible-loader) — реализован.

## 7. Тесты (`tests/`)

220 тестов (14 файлов). Релевантные: `align-invariant` (golden-кейсы checkPairAccuracy),
`bsb-text-integrity` (склейки/апострофы), `dictionary` (включая 9 миграционных тестов),
`letter-layer` (22 теста: латиница + кириллица), `rules` (34 теста: оба словаря),
`form-layer`, `compose`, `lexicon`, `frequency-data`. Obsolete-сьют
(`docs/obsolete-dont-use/**`) исключён из vitest — `npm test` — настоящий зелёный гейт.

## 8. Статус рантайм-issue (на 2026-06-26)

| Sev | Issue | Статус |
|---|---|---|
| P0 | Словарный UI: форма данных loader ↔ экран | ✅ закрыто (`91fb31ec`): `strong` скаляр, `hasAlignment` через `aligned-lexemes.json`, `ruGloss` в карточках |
| P1 | Миграция словаря: call-site + тесты | ✅ закрыто (`83651753`): вызов в `reading.js mount()`, 9 юнит-тестов |
| P2 | cache-busting `core.json`; онбординг-примеры | ✅ закрыто (`91fb31ec`, `83651753`): `?v=` для core.json, примеры под BSB |
| — | Буквенный слой под латиницу | ✅ закрыто (`e642d712`): раздельные словари RULES_LATIN / RULES_CYRILLIC |
| — | Частотный список: сортировка + поле count | ✅ закрыто (`4c527728`): sort by rank, `tokenCount`→`count` |

**Технический трек закрыт.** Следующий этап — редизайн (со слов владельца).
