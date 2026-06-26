# PIPELINE — сборка и верификация данных

> Справочник: как из `docs/source-data/` собираются и проверяются `assets/data/`.
> Для выравнивания (самая сложная часть) есть отдельный документ — [ALIGNMENT.md](ALIGNMENT.md).
> Контекст продукта — [PROJECT.md](PROJECT.md).

---

## 1. Обзор

```
docs/source-data/  ──build──▶  assets/data/  ──verify──▶  (gate: 0 errors)
```

Пять скриптов в `scripts/`, оркестрируемые `build-data.mjs` (атомарно):

| Скрипт | Делает | Выход |
|---|---|---|
| `build-bibles.mjs` | греческие книги + BSB книги | `bibles/grc/*`, `bibles/eng/*` |
| `build-lexicon.mjs` | словарь лемм + Strong's | `lexicon/core.json`, `lexicon/dictionary.json` |
| `build-align.mjs` | span-выравнивание grc↔eng | `align/grc-eng/*`, `build-report.json` |
| `build-app-config.mjs` | алфавит, книги, манифест | `alphabet.json`, `books.json`, `data-manifest.json` |
| `build-data.mjs` | оркестратор: tmp-dir → атомарный rename → cleanup | всё `assets/data/` |
| `verify-data.mjs` | 20+ проверок целостности | exit 1 при любой error |

Общие модули `scripts/lib/`: `versions.mjs` (единый источник версий), `fs.mjs` (`DATA_ROOT` через
`BUILD_DATA_DIR`), `lexeme-slug.mjs` (детерминированная карта lexemeId→slug),
`align-normalize.mjs` (нормализация + реестры методов/категорий — используется build И verify).

Команды (CLAUDE.md):
```bash
npm test            # быстрый гейт после каждого изменения кода
npm run build:data  # регенерация (bibles → lexicon → align → app-config), атомарно
npm run verify:data # целостность + accuracy hard-gate
npm run build       # полный гейт перед «готово»
```

## 2. Источник данных

```
docs/source-data/
├── enriched/books/*.json        грек: токены + глоссы + морфология
├── enriched/lexemes.json        5468 лемм: формы, ссылки, частотность
├── enriched/frequency.json      ранги частотности
├── enriched/source-manifest.json  sha256 enriched-снимка (verify сверяет)
├── translations/bsb-complete.json  BSB (66 книг, typed-content; генерим 27 НЗ)
├── strongs/…                    Strong's определения + рус. соответствия
└── app-config/…                 алфавит, книги, схемы
```

## 3. Версии и провенанс (`scripts/lib/versions.mjs`)

Два **объявленных идентификатора** снимка проходят сквозь все паки и сверяются verify между паками:
- `SOURCE_DATA_VERSION = 'sblgnt-macula-clean-v1'` → в grc-книги и (как `grcSourceDataVersion`) в align.
- `NORMALIZATION_VERSION = 'bsb-text-v2'` → в eng-книги и в align.
- `EXPECTED_SOURCE_FILE_SHA256` → сверяется с `enriched/source-manifest.json` (Check 21).

**Дисциплина (критично):** любая регенерация source-данных или изменение правил
сборки/нормализации текста ОБЯЗАНА поднимать соответствующую версию. Идентификаторы ловят рассинхрон
*между паками*, но не заметят молчаливую регенерацию источника без бампа — отсюда правило бампа.
Пример: фикс сборки BSB-текста потребовал `bsb-text-v1 → v2` + полную регенерацию всех eng и align
паков (смешанные версии невалидны).

## 4. Сборка библий (`build-bibles.mjs`)

**Греческие книги.** Из `enriched/books/*` → токены с `id`, `s` (surface), `lemma`, `lexemeId`,
`lexemeSlug`, `morph`/`morphLabelRu`, `strongs[]`, `glossBerean`, `glossCherith`, `pos`, `freqRank`,
`fw` (function word). Source-only поля (`semantic`, `louwNida`, `surfaceSearch`, `normalized`, …)
**срезаются** (verify Check 19 это контролирует).

**BSB книги** (главный источник тонкостей). typed-content `bsb-complete.json` → `verse.text` +
`verse.words[]`:
- `collectVerseContentText` собирает текст из массива фрагментов (строки, `{text}`, `{lineBreak}`,
  `{noteId}`). **Гоча:** наивный `join('')` терял пробел на месте пропущенного `{noteId}` и на
  границе двух фрагментов → склейки `overcomeit`, `poor;His`, `276of`. Фикс: вставлять ОДИН пробел
  между фрагментами с word-символами на границе; единые константы `STICKY_PUNCT`/`OPENING_PUNCT`
  для исключений (закрывающая/открывающая пунктуация). Затем `\s+→' '` + trim.
- `tokenizeWords` → `words[]` с замороженными UTF-16 offsets через `WORD_PATTERN =
  /[\p{L}\p{N}'’]+/gu` (включая curly `’`, иначе `God’s` рвётся на `God`+`s` — 394 стиха).
  `WORD_PATTERN` — единый источник в `align-normalize.mjs`, build-bibles клонирует (свежий lastIndex).
- offset-инвариант: для каждого слова `text.slice(start,end) === word.text` (иначе throw).

> Защита от регрессий — `tests/bsb-text-integrity.test.js`: снапшоты ранее-битых стихов +
> comprehensive sweep `/[a-z][,.;:!?–—]?[A-Z]/` + digit-glue + проверка `’` на границе токенов.

## 5. Лексикон (`build-lexicon.mjs`)

`core.json = { schema, items: [...] }`, item: `lexemeId`, `lexemeSlug`, `lemma`, `translit`, `pos`,
`strongs[]`, `freqRank`, `glossesBerean[]` (с bracket-формами `"[The] book"`), `glossesCherith[]`
(чистые формы `"book"`), `attestedForms[]`, `ruGloss`, `legacyKeys[]`, `isFunctionWord`,
`detail` (`{ definition, derivation, pronunciation }` — из Strong's, 5463/5468 лемм).

**Гоча:** `attestedForms[]` тянул source-only поля `normalized`/`surfaceSearch` (по 19 428) → утечка
в `core.json`. Фикс: `.map(({normalized, surfaceSearch, ...keep}) => keep)`. verify Check 19 теперь
рекурсит в массивы и сканирует core.json, поэтому подобные утечки ловятся.

`dictionary.json` — Strong's: определение, происхождение, транскрипция + русские соответствия
(5624 записи).

## 6. Выравнивание (`build-align.mjs`)

Кратко: для каждого стиха несколько детерминированных проходов сопоставляют глоссы токенов со
словами BSB; пара создаётся **только при единственном кандидате**. Не-выровненные `fw=false` токены
авто-классифицируются в категории разбиения (`auto-deferred`/`no-bsb-verse`/`no-gloss`); ручные
записи берутся из `manual-alignments.json`. **Полное описание алгоритма, методов, инвариантов,
честной партиции и manual-схемы — в [ALIGNMENT.md](ALIGNMENT.md).** Здесь — только место в пайплайне.

Выход на книгу: `{ schema:"alignment-book-v3", bookId, grcSourceDataVersion, normalizationVersion,
stats, pairsByRef, warningsByRef, exclusionsByRef }`. Плюс агрегат `build-report.json`
(coverage, счётчики категорий, `topUnalignedLexemes` backlog).

## 7. App-config (`build-app-config.mjs`)

`alphabet.json` (копия source), `books.json` (русская навигация), `data-manifest.json` (версия +
список файлов + sha256 + размеры — основа cache-busting в рантайме и Check 18 в verify).

## 8. Оркестратор (`build-data.mjs`)

Собирает во временную директорию (`assets/.data-tmp-*`), затем атомарный rename в `assets/data`
с бэкапом и очисткой. Контракт: между `build:data` и `verify:data` данные не меняются (частичная
пересборка → ложные срабатывания). `BUILD_DATA_DIR` позволяет собирать в изолированную папку (для
тестов — не трогая `assets/data`).

## 9. Схемы данных (контракты)

**Греческая книга** (`original-book-v2`): `chapters[].verses[].tokens[]` (см. §4). `lexemeId` —
канонический ключ; `lexemeSlug` — display-дубликат.

**Английская книга** (`translation-book-v2`): `chapters[].verses[]` с `ref`, `text`, `words[]`
(`{i, text, start, end}` — замороженные UTF-16 offsets). `normalizationVersion` в шапке. Любое
изменение нормализации → bump версии + полная регенерация eng и align.

**Alignment-книга** (`alignment-book-v3`):
```json
{ "schema":"alignment-book-v3", "bookId":"matthew",
  "grcSourceDataVersion":"…", "normalizationVersion":"bsb-text-v2",
  "stats": { … счётчики категорий … },
  "pairsByRef": { "matthew 1:1": [ {"span":[0,4],"tokenId":"…","lexemeId":"…","q":"a","method":"gloss-exact"} ] },
  "warningsByRef": { … диагностика проходов … },
  "exclusionsByRef": { "ref": [ {"tokenId":"…","lexemeId":"…","kind":"auto-deferred","reason":"ambiguous","candidateCount":2} ] } }
```
`q ∈ {a, f}` (на паре); `method` — закрытый реестр; `kind` ∈ resolution-категории. Детали — ALIGNMENT.md.

## 10. Верификация (`verify-data.mjs`)

20+ проверок; любой `error` → счётчик `errors`, в конце `process.exit(1)`. `warn` не блокирует.
Ключевые (нумерация checks в коде):
- **Структура/поля** grc/eng/align; уникальность tokenId; ссылки пар на валидные токены.
- **Span-валидность (15-15b):** span в границах, содержит буквы, нет дублей/overlap (overlap → error).
- **Manual-валидация (15c):** версия файла == текущей; `tokenId ∈ ref`; `fw===false`;
  `method ∈ {manual, manual-exclusion}`; для пары — `wordIndex`/`wordIndexes` в границах +
  `slice === expectedText`; непустой `reason` у exclusion.
- **Accuracy-инвариант (16):** для каждой пары `checkPairAccuracy(slice, gloss, method)`; `q ==
  ALIGN_METHODS[method].q`; proposal-тир запрещён; структурная проверка единственного кандидата для
  proven-методов; неизвестный метод → error.
- **fw/no-gloss (16b):** `fw=false` с пустыми глоссами → warn (покрыты `no-gloss` в партиции).
- **Агрегаты (16c):** суммы per-book == тоталы build-report.
- **Партиция (16d, hard-gate):** каждый `fw=false` токен ровно в одной категории; сверка
  пересчитанных счётчиков с build-report.
- **Coverage (17):** только `warn` (advisory, без порога).
- **Манифест (18):** sha256/размеры всех файлов + наличие build-report.
- **Strip-поля (19):** нет source-only полей (рекурсия в массивы; все 27 книг + core.json).
- **Источник (21):** sha256 enriched-снимка == `EXPECTED_SOURCE_FILE_SHA256`.

## 11. Диагностические скрипты

- `scripts/audit-align.mjs` — детерминированная (seed=42) выборка пар по методам для ручного
  семантического аудита (proven 50/метод, 100% fuzzy/manual). Падает при 0 пар.
- `scripts/audit-claimed.mjs` — расследование `already-claimed` (потенциальный мис-пэйринг).
- `scripts/curate-align.mjs` — read-only: печатает `verse.text` с `[i]`-индексами слов, grc-токены,
  кандидаты; `--top N` из `topUnalignedLexemes`. Инструмент куратора (см. ALIGNMENT.md).
