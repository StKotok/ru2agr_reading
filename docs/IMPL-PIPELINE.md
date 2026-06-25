# IMPL-PIPELINE: Data Pipeline Implementation

> **Фаза 1 миграции.** Генерация app-ready данных из `docs/source-data/`.
> **Предусловие:** прочитан `VISION.md`, поняты контракты данных (раздел 5).
> **Вход:** `docs/source-data/` (данные уже собраны).
> **Выход:** `assets/data/` (27 греческих книг + 27 BSB книг + 27 alignment + lexicon + конфиг).
> **После завершения:** `npm run build:data` проходит без ошибок, `verify:data` зелёный.

---

## Общая структура

Создаём 6 скриптов в `scripts/` (директория не существует — её нужно создать):

App-ready данные коммитятся только после полного `npm run build:data` и зелёного
`verify:data`. В промежуточных task-коммитах коммитятся скрипты, тесты и
документация, но не частично сгенерированный `assets/data/`.

```
scripts/
├── build-bibles.mjs        ← греческие книги + BSB
├── build-lexicon.mjs       ← словарь
├── build-align.mjs         ← выравнивание
├── build-app-config.mjs    ← alphabet, books, manifest
├── build-data.mjs          ← оркестратор (атомарная генерация)
└── verify-data.mjs         ← проверка целостности
```

---

## Task 0: Подготовка

### Создать `scripts/` и базовый `package.json`

**Файлы:** `scripts/.gitkeep` (пустой), `scripts/lib/` (общие модули).

```bash
mkdir -p scripts/lib
touch scripts/.gitkeep
```

### Общий модуль: `scripts/lib/lexeme-slug.mjs` (источник правды для slug'ов)

`lexemeSlug` нельзя выводить из `lexemeId` независимо в двух местах — он зависит от
curated-карты (`grc-o-677c59 → "ho"`, не `"o"`) и от разрешения коллизий по **всему**
набору лемм. Если `build-bibles.mjs` (Task 1, grc-токены) и `build-lexicon.mjs`
(Task 3, `core.json`) посчитают slug каждый сам, при разном наборе/порядке лемм
они могут разойтись, и alignment/словарь будут указывать на разные display-ключи.

Решение: **один детерминированный модуль строит полную карту `Map<lexemeId, slug>`
по всему `enriched/lexemes.json` (5468 лемм) + curated `top1000.core.json`**, а Task 1
и Task 3 только читают готовую карту. Результат не зависит от порядка запуска скриптов.

```js
// scripts/lib/lexeme-slug.mjs
// Детерминированно: вход — полный список лемм + curated map; выход — Map<lexemeId, slug>.
export function buildSlugMap(allLexemes, curatedItems) {
  // 1. curated: maculaLexemeId → lexemeKey (приоритет, обратная совместимость)
  // 2. fallback: lexemeIdToSlug(lexemeId)
  // 3. разрешение коллизий по ОТСОРТИРОВАННОМУ по lexemeId списку:
  //    при дубле slug — добавить полный hex-хвост lexemeId (логос-9adfa6), не усечённый.
  //    Хвост lexemeId уникален по построению, поэтому второго прохода коллизий не нужно.
}
export function lexemeIdToSlug(lexemeId) { /* см. Task 1 */ }
```

Контракт: `buildSlugMap` чистая и детерминированная (сортировка входа по `lexemeId`),
одинаковый вход → одинаковый выход. Покрыть unit-тестом на стабильность и на
коллизию (две леммы с одинаковым базовым slug → разные финальные slug).

**Масштаб коллизий (измерено на данных):** среди 5468 лемм fallback-slug даёт 97
групп коллизий, затрагивающих ~200 лемм (`o×3`, `de×2`, `solomon×2`, …). Значит ~200
дисплей-слугов получат hex-суффикс (`logos-9adfa6`) и в таком виде могут попасть в
список «Словарь» и в `legacyKeys`. Это приемлемо (≈3.7%, редкие/непервостепенные
леммы), но: (а) curated-леммы из top1000 имеют человекочитаемый `lexemeKey` и обычно
не страдают; (б) UI словаря должен показывать `lemma`/`ruGloss`, а не сырой slug, так
что суффикс пользователю не виден в норме. Сам `lexemeId` суффиксов не имеет — он
всегда канонический.

### Общий модуль: `scripts/lib/versions.mjs` (единый источник версий)

Чтобы `sourceDataVersion` и `normalizationVersion` не были захардкожены независимо в
нескольких скриптах (риск рассинхрона, см. VISION §5.4), вынести их в одну константу:

```js
// scripts/lib/versions.mjs
export const SOURCE_DATA_VERSION = 'sblgnt-macula-clean-v1';
export const NORMALIZATION_VERSION = 'bsb-text-v1';
// Ожидаемый хеш enriched-снимка (из enriched/source-manifest.json). verify check #21
// сверяет его; при регенерации enriched обновить ОБА: версию и этот хеш.
export const EXPECTED_SOURCE_FILE_SHA256 =
  '7f71504fdee8659bdd9f85342e4103d645864c2851b8205915bb298f0c004cc5';
```

`build-bibles.mjs` (grc/eng), `build-app-config.mjs` (manifest) импортируют отсюда;
`build-align.mjs` версии **не импортирует**, а читает из grc/eng-книг (Task 4) и потом
verify сверяет всё со значениями в паках.

### Общий модуль: `scripts/lib/fs.mjs` (общие файловые утилиты)

Чтобы каждый скрипт не дублировал чтение/запись/пути, вынести в один модуль. Все
скрипты используют его, а не повторяют логику путей:

```js
// scripts/lib/fs.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const SOURCE_ROOT = resolve('docs/source-data');
// Куда писать app-ready данные: BUILD_DATA_DIR (оркестратор Task 6) или assets/data.
export const DATA_ROOT = resolve(process.env.BUILD_DATA_DIR || 'assets/data');

export function readSourceJson(relPath) {
  return JSON.parse(readFileSync(join(SOURCE_ROOT, relPath), 'utf8'));
}
export function readDataJson(relPath) {
  return JSON.parse(readFileSync(join(DATA_ROOT, relPath), 'utf8'));
}
export function writeDataJson(relPath, data) {
  const abs = join(DATA_ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  // Без \n-форматирования ради размера; читаемость не нужна в app-ready.
  writeFileSync(abs, JSON.stringify(data));
}
export { existsSync };
```

Важно: `DATA_ROOT` вычисляется один раз из `process.env.BUILD_DATA_DIR`. При запуске
через оркестратор (Task 6) переменная указывает на временную директорию; при ручном
запуске отдельного скрипта — на `assets/data`. Скрипты НЕ должны хардкодить
`assets/data` напрямую.

### `.gitignore`: временные директории сборки

Оркестратор (Task 6) создаёт `assets/.data-tmp-{timestamp}`. При жёстком прерывании
(`SIGINT`/`SIGKILL`) `catch`-блок может не сработать и директория останется орфаном.
Добавить в `.gitignore` репозитория:

```gitignore
assets/.data-tmp-*
assets/data.backup-*
```

**Файл:** `package.json` — добавить scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "build:bibles": "node scripts/build-bibles.mjs",
    "build:lexicon": "node scripts/build-lexicon.mjs",
    "build:align": "node scripts/build-align.mjs",
    "build:app-config": "node scripts/build-app-config.mjs",
    "build:data": "node scripts/build-data.mjs",
    "verify:data": "node scripts/verify-data.mjs"
  }
}
```

### Коммит

```bash
git add scripts/.gitkeep package.json
git commit -m "chore: create scripts/ and add pipeline npm scripts"
```

---

## Task 0b: PoC alignment на Матфее (исторический; порог 90% ОТМЕНЁН)

> ⚠️ **Устарело (2026-06-25).** Гейт «≥90% non-function coverage» ОТМЕНЁН. Релизный hard-gate
> теперь = **accuracy-инвариант + полное разбиение токенов** (`verify:data` Check 16/16d),
> coverage — advisory (см. VISION §6 и раздел «Гейт verify» ниже). Alignment полностью построен
> на всех 27 книгах (coverage 81.8%, accuracy-инвариант держит). Task 0b сохранён как история
> архитектурного решения; PoC-гейт go/no-go больше не применяется.

**Зачем (исторически).** Порог ≥90% non-function coverage задумывался как жёсткий релизный гейт.
На практике alignment построен сразу по всем книгам, а гейт переопределён на точность (важнее
покрытия). Если бы потребовалась валидация достижимости, PoC на Матфее снял бы архитектурный риск
дешевле всего — поэтому раздел оставлен для контекста.

**Что сделать (минимальный вертикальный срез, можно throwaway-скриптом):**
1. Сгенерировать grc + eng **только для Матфея** (логика Task 1 + Task 2 на одной книге).
2. Прогнать алгоритм Task 4 (exact → bracket-opt → phrase → fuzzy + claimedWords) на Матфее.
3. Посчитать: non-function coverage %, % стихов с ≥1 парой, вклад каждого прохода
   отдельно (сколько пар дал exact / bracket / phrase / fuzzy), топ unaligned-леммы.

**Гейт решения:**
- coverage ≥ 90% → план подтверждён, продолжать Task 1 в полном объёме.
- 80–90% → достижимо доводкой алгоритма/override'ами; зафиксировать план добора.
- < 80% → **СТОП**, пересмотреть стратегию alignment (см. VISION §6 эскалацию) прежде
  чем реализовывать весь пайплайн.

Особое внимание — **вклад phrase-прохода**: измерить, какой % non-function токенов имеет
multi-word глосс и какой % из них реально совпал. Если вклад phrase ≈ 0 (всё держится
на exact+fuzzy), это ранний сигнал, что 90% под вопросом из-за SOV/SVO-расхождений.

PoC не коммитит `assets/data/`; его результат — цифры в описании коммита/PR и решение
go/no-go. Только после go начинается Task 1.

---

## Task 1: `build-bibles.mjs` — греческие книги

### Назначение

Сгенерировать `assets/data/bibles/grc/{book}.json` (27 файлов) из enriched-токенов.

### Вход

- `docs/source-data/enriched/books/{book}.json` — 27 файлов, плоский массив токенов
- `docs/source-data/enriched/frequency.json` — массив `{lexemeId, rank, ...}`

### Выход

- `assets/data/bibles/grc/{book}.json` — 27 файлов в иерархическом формате

### Порядок книг

```js
const NT_BOOKS = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians',
  'ephesians', 'philippians', 'colossians',
  '1thessalonians', '2thessalonians', '1timothy', '2timothy',
  'titus', 'philemon', 'hebrews',
  'james', '1peter', '2peter', '1john', '2john', '3john',
  'jude', 'revelation'
];
```

### Логика

```
1. Загрузить frequency.json → Map<lexemeId, {rank, tokenCount}>
2. Для каждого bookId из NT_BOOKS:
   а. Прочитать docs/source-data/enriched/books/{bookId}.json
      → плоский массив токенов
   б. Сгруппировать токены по chapter → verse:
      - Ключ: token.chapter (int), token.verse (int)
      - Внутри стиха: сортировать по token.tokenIndex (int)
      - Если tokenIndex отсутствует: сортировать по token.i
   в. Проверить: сумма токенов по всем стихам === длина исходного массива
      (если нет — ERROR и останов)
   г. Для каждого токена применить трансформацию полей:

      | enriched source          | app-ready field   | Правило                                        |
      |--------------------------|-------------------|-------------------------------------------------|
      | token.id                 | id                | как есть                                        |
      | token.surface            | s                 | как есть                                        |
      | token.lemma              | lemma             | как есть                                        |
      | token.lexemeId           | lexemeId          | как есть                                        |
      | token.lexemeId → slug    | lexemeSlug        | из curated map maculaLexemeId→lexemeKey;        |
      |                          |                   | fallback: извлечь из lexemeId                   |
      | token.transliteration    | translit          | строка в enriched-токенах; защитно поддержать   |
      |                          |                   | объект через .value только для будущих форматов |
      | token.morphology.code    | morph             | извлечь .code из объекта morphology             |
      | token.morphology.labelRu | morphLabelRu      | извлечь .labelRu из morphology                  |
      | token.strong             | strongs           | как есть (массив строк)                         |
      | token.pos.source         | pos               | в enriched-токенах нет pos.primary              |
      | token.pos.labelRu        | posLabelRu        | извлечь .labelRu из pos                         |
      | token.glossEn            | glossBerean       | как есть                                        |
      | token.english            | glossCherith      | как есть                                        |
      | token.isFunctionWord     | fw                | как есть                                        |
      | frequencyMap.get(        | freqRank          | null если не найден                             |
      |   token.lexemeId)?.rank  |                   |                                                 |
      | token.tokenIndex \|\| i  | i                 | индекс токена в стихе                           |

   д. Сформировать итоговый объект (SOURCE_DATA_VERSION из scripts/lib/versions.mjs):
      {
        schema: "original-book-v2",
        sourceDataVersion: SOURCE_DATA_VERSION,   // "sblgnt-macula-clean-v1"
        bookId,
        title: loadGreekTitle(bookId),
        chapters: [{ n, verses: [{ n, ref, tokens }] }]
      }
      где ref = `${bookId} ${chapter}:${verse}`
      где title берётся из originals/sblgnt-macula/books/{bookId}.json
   е. Записать в assets/data/bibles/grc/{bookId}.json (mkdir -p)
```

### Контракт enriched-токена (проверено на данных 2026-06-25)

Точные имена и типы полей в `enriched/books/{book}.json` (плоский массив токенов).
Не путать с `lexemes.json` (см. ниже) — у них **разная** форма `pos`:

| Поле токена | Тип | Пример | Примечание |
|---|---|---|---|
| `id` | string | `n40001001001` | |
| `lexemeId` | string | `grc-biblos-9adfa6` | |
| `surface` | string | `Βίβλος` | |
| `lemma` | string | `βίβλος` | |
| `strong` | string[] | `["976"]` | массив **строк**; может быть `[]` |
| `pos` | object | `{source, code, category, labelRu}` | у токена есть `pos.source`, **нет** `pos.primary` |
| `morphology` | object | `{code, labelRu, …}` | `morphology.code`, `morphology.labelRu` |
| `glossEn` | string | `[The] book` | Berean (PD) → `glossBerean` |
| `english` | string | `book` | Cherith (CC-BY) → `glossCherith` |
| `transliteration` | string | `Biblos` | у токена это **строка**, не объект |
| `isFunctionWord` | bool | `false` | → `fw` |
| `tokenIndex` | int | `1` | присутствует у 100% токенов (проверено 18329/18329 в Мф) |
| `chapter`,`verse` | int | `1`,`1` | для группировки |

⚠️ **Асимметрия pos.** В **токене** — `pos.source` (`"noun"`). В **лемме**
(`lexemes.json`, Task 3) — `pos.primary` (`"noun"`), поля `source` там нет. Поэтому
`build-bibles.mjs` читает `token.pos.source`, а `build-lexicon.mjs` —
`lexeme.pos.primary`. Перепутать = `undefined` во всех записях. Оба объекта имеют
`pos.labelRu`.

Поля `sourceId`, `sourceRef`, `surfaceNfc`, `surfaceSearch`, `normalized`,
`lemmaSearch`, `accent`, `maculaSource`, `bookId`, `ref` в токене **есть**, но в
app-ready **не копируются** (см. verify check #19 — strip-список).

### Извлечение lexemeSlug

`build-bibles.mjs` **не считает slug сам** — он импортирует общий модуль
`scripts/lib/lexeme-slug.mjs` (Task 0), строит полную `Map<lexemeId, slug>` по
`enriched/lexemes.json` + `top1000.core.json` и берёт `slugMap.get(token.lexemeId)`.
Так grc-токены и `core.json` (Task 3) гарантированно получают одинаковые slug'и
независимо от порядка запуска скриптов.

Базовый fallback (внутри модуля), когда леммы нет в curated-карте:

```js
function lexemeIdToSlug(lexemeId) {
  // grc-biblos-9adfa6 → biblos
  // grc-o-677c59 → o   (но curated map даёт "ho" — она в приоритете)
  const parts = lexemeId.split('-');
  if (parts.length >= 3 && parts[0] === 'grc') {
    return parts.slice(1, -1).join('-');
  }
  return lexemeId;
}
```

Важно: slug не является каноническим ключом и может быть коротким (`o`, `en`) или
нечитаемым. Коллизии slug'ов разрешаются **внутри модуля** один раз, по всему набору
лемм: дубликату добавляется disambiguation suffix из **полного** hex-хвоста `lexemeId`
(`logos-9adfa6`), который уникален по построению, поэтому повторных коллизий не возникает.
При генерации `legacyKeys` (Task 3) отдельно детектить коллизии slug/Strong's fallback
и не создавать неоднозначный legacy mapping.

### Греческие названия книг (TITLES)

Извлечь из `docs/source-data/originals/sblgnt-macula/books/{book}.json` → поле `title`. Если файла или `title` нет — падать с явной ошибкой. Не поддерживать параллельно hardcoded mapping и source extraction, чтобы не было двух источников правды.

```js
function loadGreekTitle(bookId) {
  const source = readJson(`docs/source-data/originals/sblgnt-macula/books/${bookId}.json`);
  if (!source.title) throw new Error(`Missing Greek title for ${bookId}`);
  return source.title;
}
```

### Верификация

```bash
node scripts/build-bibles.mjs
# Должен создать 27 файлов в assets/data/bibles/grc/
ls assets/data/bibles/grc/ | wc -l  # → 27

# Проверить один файл
node - <<'NODE'
import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync('assets/data/bibles/grc/matthew.json', 'utf8'));
console.log('schema:', d.schema);
console.log('chapters:', d.chapters.length);
const v1 = d.chapters[0].verses[0];
console.log('1:1 tokens:', v1.tokens.length);
console.log('first token:', JSON.stringify(v1.tokens[0], null, 2));
NODE
# Ожидаемый вывод:
# schema: original-book-v2
# chapters: 28
# 1:1 tokens: 5
# first token: { i: 1, id: 'n40001001001', s: 'Βίβλος', lexemeId: 'grc-biblos-9adfa6', ... }
```

### Коммит

```bash
git add scripts/build-bibles.mjs
git commit -m "feat(pipeline): build-bibles.mjs — generate Greek book packs"
```

---

## Task 2: `build-bibles.mjs` — BSB книги

### Назначение

Сгенерировать `assets/data/bibles/eng/{book}.json` (27 файлов) из BSB complete JSON.

### Вход

- `docs/source-data/translations/bsb-complete.json` — 66 книг, формат typed-content

### Выход

- `assets/data/bibles/eng/{book}.json` — 27 файлов НЗ

### Маппинг BSB ID → bookId

```js
const BSB_TO_BOOKID = {
  MAT: 'matthew', MRK: 'mark', LUK: 'luke', JHN: 'john',
  ACT: 'acts', ROM: 'romans',
  '1CO': '1corinthians', '2CO': '2corinthians',
  GAL: 'galatians', EPH: 'ephesians', PHP: 'philippians',
  COL: 'colossians', '1TH': '1thessalonians', '2TH': '2thessalonians',
  '1TI': '1timothy', '2TI': '2timothy', TIT: 'titus',
  PHM: 'philemon', HEB: 'hebrews', JAS: 'james',
  '1PE': '1peter', '2PE': '2peter',
  '1JN': '1john', '2JN': '2john', '3JN': '3john',
  JUD: 'jude', REV: 'revelation'
};
```

### Логика конвертации typed-content → verses

```
1. Загрузить bsb-complete.json. Верх: `{ translation, books: [...66] }`.
2. Для каждого BSB_ID → bookId из BSB_TO_BOOKID:
   а. Найти книгу: `bsb.books.find(b => b.id === BSB_ID)`. Если не найдена — ERROR.
      Книга: `{ id, name, commonName, title, order, numberOfChapters,
      totalNumberOfVerses, chapters: [...] }`.
   б. Для каждой главы по индексу `ci` (0-based) в `book.chapters`:
      - **Структура главы (проверено): `book.chapters[ci].chapter.content` — массив.**
        Номер главы = `ci + 1` (главы упорядочены по позиции; собственного поля
        `number` у объекта главы нет — `chapters[ci].number` === undefined).
      - **Жёсткая проверка структуры:** если `book.chapters[ci].chapter?.content`
        не массив — падать с ошибкой `BSB shape changed: <book> ch <ci+1>`
        (не молчаливый `?.`-фоллбэк).
      - Для каждого элемента content-массива:
        * `el.type === "verse"`: номер стиха = **`el.number`** (int). Собрать text
          из `el.content` (массив):
          - строковые элементы — конкатенировать как есть;
          - объекты `{text, poem?}` — взять `.text` (BSB так размечает
            поэзию/генеалогию); конкатенировать;
          - объекты `{lineBreak: true}` — заменить на пробел;
          - объекты `{noteId: …}` — пропустить (сноски);
          - **любой иной объект без `text`/`lineBreak`/`noteId` — пропустить**
            (защита от неизвестных типов разметки);
          - после сборки нормализовать пробелы: `text.replace(/\s+/g, ' ').trim()`;
          - сгенерировать `words` через `tokenizeWords(text)` (ниже): для каждого
            слова `{ i, text, start, end }`, где start/end — UTF-16 code unit offsets.
        * `el.type === "heading"` — пропустить;
        * `el.type === "line_break"` (верхний уровень между стихами) — пропустить;
        * иной `el.type` — пропустить (не падать; разметка может расширяться).
      - Сформировать `verses: [{ ref, n, text, words }]`, где
        `n = el.number`, `ref = `${bookId} ${ci + 1}:${el.number}``.
   в. Записать { schema, translationId, bookId, title, short, license,
        attribution, normalizationVersion, chapters: [{ n, verses }] }
      - title: взять из bsb-объекта книги (поле name или commonName)
      - short: взять из bsb-объекта книги (поле id)
      - license: "Public domain"
      - attribution: "Berean Standard Bible, https://berean.bible/"
      - normalizationVersion: NORMALIZATION_VERSION  // "bsb-text-v1", из scripts/lib/versions.mjs
```

### Нормализация и токенизация в words

`normalizationVersion` — часть data contract. Любое изменение правил сборки `text` требует:
- bump `normalizationVersion`;
- полной регенерации всех `bibles/eng/*`;
- полной регенерации всех `align/grc-eng/*`;
- verify-ошибки при смешанных версиях.

Офсеты `words.start/end` — **UTF-16 code unit offsets**, потому runtime использует JS `text.slice(start, end)`. Не называть их байтовыми offsets.

```js
function tokenizeWords(text) {
  // Разбить текст на слова, сохраняя UTF-16 code unit offsets.
  // Слово = последовательность букв (Unicode letter), цифр или апострофа
  // Пунктуация и пробелы НЕ включаются в слова
  const words = [];
  const wordPattern = /[\p{L}\p{N}']+/gu;
  let match;
  while ((match = wordPattern.exec(text)) !== null) {
    words.push({
      i: words.length,
      text: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  return words;
}
```

После токенизации `text` больше не мутируется. Проверка `text.slice(start, end) === word.text` выполняется для каждого слова в каждом стихе.

**Дефисы (важно для alignment).** `wordPattern` (`/[\p{L}\p{N}']+/gu`) **не включает
дефис**, поэтому `mother-in-law` даёт три слова: `mother`, `in`, `law` (дефис остаётся
в `text` как разделитель между словами, в `words` его нет). Это сознательно: тот же
паттерн применяется к глоссам в Task 4, поэтому Berean-глосс `mother-in-law` тоже
разбивается на `["mother","in","law"]` и совпадает с этими тремя BSB-словами phrase-
проходом (span покрывает `mother-in-law` целиком, включая дефисы, т.к. span — это
`[start("mother"), end("law")]`). Менять `wordPattern` (добавлять дефис) **не нужно** —
это сломало бы консистентность и потребовало bump `normalizationVersion`. В Berean-
глоссах ~86 лемм с внутренним дефисом (проверено), они покрываются именно так.

### Верификация

```bash
node - <<'NODE'
import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync('assets/data/bibles/eng/matthew.json', 'utf8'));
console.log('schema:', d.schema);
console.log('translationId:', d.translationId);
const ch1 = d.chapters[0];
const v1 = ch1.verses[0];
console.log('1:1 text:', v1.text.substring(0, 80));
console.log('1:1 words[0]:', JSON.stringify(v1.words[0]));
console.log('offset check:', v1.text.slice(v1.words[0].start, v1.words[0].end));
// Должно совпасть: v1.text.slice(start, end) === words[0].text
NODE
```

### Коммит

```bash
git add scripts/build-bibles.mjs
git commit -m "feat(pipeline): add BSB conversion to build-bibles.mjs"
```

---

## Task 3: `build-lexicon.mjs`

### Назначение

Сгенерировать `assets/data/lexicon/core.json` и `dictionary.json`.

### Вход

- `docs/source-data/enriched/lexemes.json` — 5468 лемм
- `docs/source-data/enriched/frequency.json` — ранги
- `docs/source-data/strongs/strongs-dictionary.json` — Strong's (массив `[{strong, ...}]`)
- `docs/source-data/strongs/strongs-ru-alignment.json` — рус. соответствия (массив)
- `docs/source-data/lexicon/top1000.core.json` — проект-курация (объект `{schema, items: [...]}`)
- `docs/source-data/lexicon/locales/ru/core.json` — рус. данные (`{schema, localeId, items}`)
- `docs/source-data/lexicon/locales/ru/top1000.json` — рус. данные топ-1000 (`{schema, localeId, items}`)

### Выход

- `assets/data/lexicon/core.json` — 5468 записей
- `assets/data/lexicon/dictionary.json` — Strong's словарь

### core.json — структура записи

```json
{
  "lexemeId": "grc-biblos-9adfa6",
  "lexemeSlug": "biblos",
  "lemma": "βίβλος",
  "translit": "biblos",
  "pos": "noun",
  "posLabelRu": "существительное",
  "strongs": ["976"],
  "freqRank": 1064,
  "freqTokenCount": 10,
  "freqVerseCount": 10,
  "glossesBerean": ["[The] book", "book"],
  "glossesCherith": ["book", "books"],
  "allRefs": ["matthew 1:1", ...],
  "attestedForms": [{ "surface": "Βίβλος", "count": 1, "refs": [...] }],
  "ruGloss": "книга",
  "ruTopWords": ["книга", "свиток"],
  "ruMatches": ["(?<![а-яё])книг(а|и|е|у|ой|ами)(?![а-яё])"],
  "ruExclude": ["книжка"],
  "refs": ["Мф 1:1", "Ин 1:1"],
  "legacyKeys": ["biblos", "freq-976"],
  "isFunctionWord": false
}
```

### Логика

**Точные имена полей входов (проверено на данных 2026-06-25) — НЕ доверять памяти:**

| Источник | Реальные поля | Примечание |
|---|---|---|
| `lexemes.json` (5468) | `id`, `lemma`, `transliteration:{value,…}`, `strong:string[]`, `pos:{primary,categories,labelRu}`, `isFunctionWord`, `frequency`, `attestedForms`, `allRefs`, `allRefsCount`, `firstRef`, `glossesEn`, `englishGlosses` | `pos.primary` (не `source`); `transliteration` — **объект** |
| `frequency.json` (массив) | `lexemeId`, `rank`, `tokenCount`, `verseCount`, `strong`, `pos`, `isFunctionWord`, … | ключ join — `lexemeId` |
| `strongs-ru-alignment.json` (5378) | `strong:number`, `ru_primary:string`, `ru_top_words:string[]`, `total_alignments` | **snake_case**; `strong` — **число** |
| `top1000.core.json` `.items` (1000) | `lexemeKey`, `maculaLexemeId`, `lemma`, `strongs`, `rank`, … | **нет** `ruMatches`/`ruExclude` (0 записей) |
| `locales/ru/core.json` `.items` (182) | `lexemeKey`, `pos:string(ru)`, `ruMatches:string[]`, `ruExclude:string[]`, `refs:string[]` | ключ — `lexemeKey`; **здесь** живут ru-guards |
| `locales/ru/top1000.json` `.items` (182) | `lexemeKey`, `gloss:string(ru)`, `shortGloss:string(ru)` | ключ — `lexemeKey`; курированный ru-глосс для дисплея |

```
1. Загрузить все входные файлы.
2. Индекс strongs-ru: Map<number, {ruPrimary, ruTopWords}> по item.strong.
   ВАЖНО: ключ — число. Маппинг полей: ruPrimary = item.ru_primary,
   ruTopWords = item.ru_top_words. (Если написать item.ruPrimary — undefined у всех.)
3. Индекс частотности: Map<lexemeId, freqItem> по item.lexemeId (frequency.json).
4. Индекс curated ru: Map<lexemeKey, {ruMatches, ruExclude, refs}> из
   locales/ru/core.json по item.lexemeKey (НЕ из top1000.core.json — там этих полей нет).
   И индекс ru-дисплея: Map<lexemeKey, {gloss, shortGloss}> из locales/ru/top1000.json.
5. Для каждой леммы из lexemes.json:
   а. Базовые поля: lexemeId = lexeme.id; lemma; translit = lexeme.transliteration.value
      (объект → .value); pos = lexeme.pos.primary; posLabelRu = lexeme.pos.labelRu;
      strongs = lexeme.strong (массив строк, как есть); allRefs; attestedForms;
      glossesBerean = lexeme.glossesEn; glossesCherith = lexeme.englishGlosses;
      isFunctionWord = lexeme.isFunctionWord.
   б. lexemeSlug: из общей Map<lexemeId, slug> модуля scripts/lib/lexeme-slug.mjs
      (Task 0) — тот же источник, что у grc-токенов в Task 1. Не вычислять повторно.
   в. freqRank/freqTokenCount/freqVerseCount: из freqIndex.get(lexeme.id) →
      .rank / .tokenCount / .verseCount (null если леммы нет в frequency.json).
   г. ru-глоссы по Strong's: для КАЖДОГО s из strongs привести к числу `Number(s)`
      и искать в strongs-ru индексе. Взять первое совпадение:
      ruGloss = hit.ruPrimary; ruTopWords = hit.ruTopWords. (lexeme.strong = "976"
      строка; strongs-ru.strong = 976 число — отсюда обязательный Number()-каст.)
   д. ru-дисплей (curated, приоритетнее Strong's): если lexemeSlug есть в индексе
      locales/ru/top1000.json — **переопределить** ruGloss = top.shortGloss || top.gloss
      (курированный глосс качественнее авто-Strong's). ruTopWords оставить из шага г.
      Это значение — основное русское в списке экрана «Словарь» (VISION §8).
   е. ru-guards (curated): ruByKey = curatedRuIndex.get(lexemeSlug). Если есть —
      ruMatches = ruByKey.ruMatches; ruExclude = ruByKey.ruExclude; refs = ruByKey.refs.
      (Join по lexemeSlug, т.к. для curated-лемм slug === их lexemeKey, напр. "logos".)
   ж. legacyKeys: [lexemeSlug] + (для каждого strong, если strongs непустой:
      'freq-' + strong). Только однозначные (одна lexemeId) попадают; коллизии
      разрешает шаг 6.
6. Коллизии `lexemeSlug` уже разрешены в `scripts/lib/lexeme-slug.mjs` (suffix из
   хвоста lexemeId), поэтому slug'и в `core.json` уникальны by construction. Здесь
   проверяется только `legacyKey` collisions:
   - если legacyKey (slug или `freq-<strong>`) встречается у нескольких lexemeId,
     удалить его из `legacyKeys` всех конфликтующих записей
   - `freq-<strong>` добавлять только если `strongs` непустой (см. шаг 5ж)
   - записать конфликт в build-report/verify output
   - не создавать неоднозначный auto-migration mapping
7. Записать core.json (объект `{ schema: "lexicon-core-v2", items: [...] }`).
8. Для dictionary.json — переупаковать strongs-dictionary в объект
   `{ [strongNumber]: { definition, greek, translit, ruPrimary, ruTopWords } }`.
   Ключ strongNumber — строка (как в lexeme.strong); ruPrimary/ruTopWords берутся
   из того же strongs-ru индекса по `Number(strongNumber)`.
```

### Верификация

```bash
node - <<'NODE'
import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync('assets/data/lexicon/core.json', 'utf8'));
console.log('schema:', d.schema);
console.log('items count:', d.items.length);
// Должно быть 5468
const biblos = d.items.find(x => x.lexemeSlug === 'biblos');
console.log('biblos:', JSON.stringify(biblos, null, 2).substring(0, 500));
NODE
```

### Коммит

```bash
git add scripts/build-lexicon.mjs
git commit -m "feat(pipeline): build-lexicon.mjs — generate lexicon packs"
```

---

## Task 4: `build-align.mjs`

> ⚠️ **Модель эволюционировала (2026-06-25). Канонический источник — VISION §6 и
> `docs/implementation-report.md` (раздел «Alignment Fixup F0–F4»).** Отличия от исходного
> текста этого Task ниже:
> - Схема файла — `alignment-book-v3`: добавлено поле `exclusionsByRef`.
> - Исключения НЕ используют `q="u"`/`q="x"`. Каждый не-выровненный `fw=false` токен попадает в
>   `exclusionsByRef` с `kind ∈ {manual-exclusion, no-bsb-verse, no-gloss, auto-deferred}`
>   (у записей исключений нет `q` и нет `span`).
> - Методы пар — закрытый реестр `ALIGN_METHODS` (gloss-exact, bracket-optional, phrase,
>   alt-gloss-*, lexicon-gloss-exact, fuzzy, manual; positional-equal-count — proposal, off).
> - `auto-deferred` — авто-backlog «алгоритм не разрешил» (под-причины `no-matching-word` /
>   `ambiguous` / `already-claimed`), НЕ ручная курация.
> - Coverage — advisory, не гейт. Где ниже написано «coverage ≥ 90%» как условие — устарело.

### Назначение

Сгенерировать `assets/data/align/grc-eng/{book}.json` — span-based alignment между греческими токенами и BSB-текстом.

### Вход

- `assets/data/bibles/grc/{book}.json` — результат Task 1
- `assets/data/bibles/eng/{book}.json` — результат Task 2
- `docs/source-data/enriched/lexemes.json` — для лемма-глоссов
- `docs/source-data/alignments/grc-eng/manual-alignments.json` — optional ручные overrides/exclusions (если файл существует)

### Выход

- `assets/data/align/grc-eng/{book}.json` (27 файлов)
- `assets/data/align/grc-eng/build-report.json`

### Алгоритм (для каждого стиха)

```
1. Загрузить BSB verse: { text, words: [{i, text, start, end}] }
2. Загрузить Greek tokens этого стиха из grc-пака
3. Для каждого греческого токена:
   а. Построить кандидаты для сопоставления:
      - primaryGloss: нормализовать glossBerean (убрать '[' и ']', lowercase)
      - altGloss: нормализовать glossCherith (lowercase)
      - splitGlosses: разбить primaryGloss на отдельные слова,
        если primaryGloss содержит пробел
      - lemmaGlosses: из lexemes.json → englishGlosses и glossesEn
   б. Сопоставить с BSB-словами детерминированными v1-проходами:
      - exact normalized single-word match → q="a", method="gloss-exact"
      - bracket-optional single-word match → q="a", method="bracket-optional"
      - normalized phrase over 2-4 adjacent, unclaimed BSB words → q="a", method="phrase"
      - simple fuzzy: lowercase, strip punctuation, normalize apostrophes → q="f", method="fuzzy"
   в. Если на одно BSB-слово претендуют несколько токенов:
      - принять только однозначный match
      - неоднозначные повторы не угадывать; записать warning и оставить token unaligned
   г. Для function words (fw=true): не создавать visible pair по умолчанию;
      если есть уверенный span, можно записать q="x" для диагностики
   д. Невыровненные meaningful tokens записать в warningsByRef/report как q="u"

4. Применить manual-alignments overrides/exclusions:
   - manual pair обязан указывать ref, tokenId, span, q="a"|"f", method="manual"
   - manual exclusion обязан указывать ref, tokenId, q="u", method="manual-exclusion" без span
   - verify обязан проверить, что tokenId существует в том же ref
   - если span есть: span валиден, text.slice(span[0], span[1]) непустой
     и содержит хотя бы одну букву или цифру (`/[\p{L}\p{N}]/u`)
   - manual pair побеждает алгоритмическую пару для того же tokenId
   - manual exclusion удаляет алгоритмическую пару для tokenId и записывает diagnostic в warningsByRef/report;
     для non-function tokens это считается unaligned и не улучшает coverage
   - количество manual пар и manual exclusions попадает в build-report.json

5. Отсортировать pairs по span[0], затем tokenId
6. Проверить span-инварианты (любое нарушение — ошибка сборки):
   - нет дублирующихся span (`a.span[0] === b.span[0] && a.span[1] === b.span[1]`)
   - **нет пересекающихся span**: для соседних в отсортированном списке пар
     `prev.span[1] <= next.span[0]`. Два валидных, но пересекающихся span'а
     (напр. `[0,6]` и `[4,10]`) ломают курсорный рендер в `form-layer.js`
     (дублирование/потеря текста), поэтому ловим их здесь, а не в рантайме.
     Источник пересечений в v1 — ручные overrides; алгоритм claim'ит занятые
     BSB-слова и сам пересечений не создаёт, но проверка обязательна как
     defense-in-depth.
7. Записать pairsByRef[ref] = [отсортированные пары со span]
8. Записать warningsByRef[ref] = [unaligned/ambiguous diagnostics без span]
```

`pairsByRef` содержит только записи со span, которые runtime может безопасно обработать. `q="u"` хранится в `warningsByRef`/report, не как span-less pair в `pairsByRef`.

### Точный механизм claimedWords и порядок разрешения конфликтов (обязательно)

Алгоритм детерминирован: **проходы применяются по приоритету, ко всем токенам стиха,
с единым набором занятых BSB-слов**. Без этого две реализации дадут разное покрытие.

```
для каждого стиха:
  claimed = new Array(words.length).fill(false)   // занятость BSB-слова по индексу i
  pairs = []
  candidates = grcTokens.filter(t => t.fw === false)  // fw=true не даёт visible pair
                       .sort by tokenIndex             // детерминированный порядок

  // Проход = (приоритет, функция нормализации, qualityCode). Порядок строгий:
  //   1) exact         — normalizeWord(primaryGloss),     q="a", method="gloss-exact"
  //   2) bracket-opt    — normalizeBerean(primaryGloss),  q="a", method="bracket-optional"
  //   3) phrase (2-4)   — токены глосса == окно BSB,       q="a", method="phrase"
  //   4) fuzzy          — fuzzyNormalize,                  q="f", method="fuzzy"

  для каждого pass в [exact, bracket-opt, phrase, fuzzy]:
    для каждого token в candidates, у которого ещё НЕТ пары:
      cand = индексы BSB-слов, которые (а) НЕ claimed и (б) матчатся по правилу pass
      // single-word passes (1,2,4): cand — индексы отдельных слов
      // phrase pass (3): cand — стартовые индексы contiguous-окон из НЕзанятых слов,
      //   совпадающих как массив с токенизированным глоссом (тот же wordPattern, Task 2)
      если cand.length === 1:
        занять слово(а) этого матча → claimed[i]=true для всех слов матча
        pairs.push({ span:[start(first), end(last)], tokenId, lexemeId, q, method })
      иначе если cand.length > 1:
        // НЕ угадывать: неоднозначность фиксируется, токен остаётся без пары
        warningsByRef[ref].push({ tokenId, lexemeId, reason:"ambiguous", pass })
        ambiguousCandidateCount++
      // cand.length === 0 → токен переходит к следующему pass
```

Свойства, на которые опираются инварианты:
- **claim немедленный и общий.** Заняв слово, exact-проход убирает его из кандидатов
  для всех последующих токенов и проходов → пересечений span не возникает (но
  проверка шага 6 всё равно обязательна как defense-in-depth).
- **first-come по tokenIndex.** Если два токена претендуют на одно и то же
  единственное слово, его получает токен с меньшим `tokenIndex`; второй остаётся
  `q="u"`. Это сознательный детерминированный выбор, не «угадывание».
- **phrase видит частично занятое окно как непригодное.** Если хотя бы одно слово окна
  уже claimed — окно не кандидат (`cand` его не содержит).
- токены без пары после всех проходов → `q="u"` в `warningsByRef`; для non-function
  токенов это unaligned (снижает coverage), что и должно отражаться в отчёте.

### Версии и итоговый объект alignment-книги

`build-align.mjs` читает версии из уже сгенерированных книг и переносит их в каждый
alignment-пак (источник правды — сами книги, не хардкод):

- `grcSourceDataVersion` ← `assets/data/bibles/grc/{book}.json.sourceDataVersion`
- `normalizationVersion` ← `assets/data/bibles/eng/{book}.json.normalizationVersion`

Если у grc/eng-книги этих полей нет или они расходятся между книгами — останов с
понятной ошибкой (нельзя строить alignment поверх несогласованных паков). Итоговый
объект на книгу:

```json
{
  "schema": "alignment-book-v2",
  "alignmentId": "grc-eng",
  "bookId": "matthew",
  "grcSourceDataVersion": "<из grc-книги>",
  "normalizationVersion": "<из eng-книги>",
  "stats": { "tokenCount": 0, "alignedTokenCount": 0, "unalignedTokenCount": 0, "warningCount": 0 },
  "pairsByRef": { "matthew 1:1": [ /* пары со span */ ] },
  "warningsByRef": { "matthew 1:1": [ /* u/ambiguous диагностики без span */ ] }
}
```

Verify (Task 7) затем сверяет, что эти версии совпадают со значениями в grc/eng-книгах
(checks #6–7).

### Формат manual-alignments.json

```json
[
  { "ref": "matthew 1:1", "tokenId": "n40001001001", "span": [0, 4], "q": "a", "method": "manual" },
  { "ref": "matthew 1:1", "tokenId": "n40001001002", "q": "u", "method": "manual-exclusion" }
]
```

Файл должен валидироваться до применения overrides. Ошибка схемы, неизвестный `tokenId`,
невалидный `span` или `span`, состоящий только из пунктуации/пробелов, останавливает сборку.

### Phrase matching v1

Phrase matching в v1 не использует gaps и не ищет “похожие” фразы через весь стих.
Для candidate phrase длиной 2-4 normalized words скрипт проверяет только contiguous
windows **такой же длины** среди ещё не занятых BSB words, с **100% совпадением**
normalized-слов и **в том же порядке**. Если найдено больше одного окна или часть
слов уже занята другой accepted pair — токен остаётся unaligned/ambiguous.

Явные **ограничения v1** (не баги, а сознательный объём):
- нет partial/subset-совпадений (греч. «the Son of God» ≠ BSB «Son of God» + отдельный «the»);
- нет перестановок слов: при расхождении порядка (греч. SOV «to him said» vs BSB SVO
  «said to him») contiguous-окно не находится, токен остаётся `q="u"`. Это часть
  ожидаемого недо-покрытия; закрывается ручными override'ами или следующей итерацией
  алгоритма (permutation pass), а не в v1.

### Правила нормализации

```js
function normalizeWord(w) {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').trim();
}
```

### Bracket-optional match

```js
// Berean '[The] book' → normalized 'the book'
function normalizeBerean(gloss) {
  return gloss.replace(/\[/g, '').replace(/\]/g, '').toLowerCase().trim();
}
```

### Build report

```json
{
  "generatedAt": "2026-06-25T...",
  "totalTokens": 137740,
  "alignedTokens": 126900,
  "unalignedTokens": 10840,
  "alignedNonFunctionTokens": 114125,
  "totalNonFunctionTokens": 125000,
  "coveragePercent": 92.1,
  "nonFunctionCoveragePercent": 91.3,
  "versesWithZeroPairs": 12,
  "duplicateSpanCount": 0,
  "overlappingSpanCount": 0,
  "ambiguousCandidateCount": 340,
  "topUnalignedLexemes": [
    {"lexemeId": "grc-...", "lemma": "δέ", "count": 1500, "glossBerean": "and/but"}
  ],
  "manualPairCount": 0,
  "manualExclusionCount": 0,
  "perBook": [
    {
      "bookId": "matthew",
      "tokenCount": 18329,
      "nonFunctionTokenCount": 0,
      "alignedNonFunctionTokens": 0,
      "nonFunctionCoveragePercent": 0,
      "versesWithZeroPairs": 0,
      "ambiguousCandidateCount": 0,
      "overlappingSpanCount": 0
    }
  ],
  "thresholds": {
    "nonFunctionCoverageMin": 90,
    "versesWithPairsMin": 95
  }
}
```

### Hard gates (сборка падает если не пройдены)

```
- 27 alignment book files exist
- 0 invalid token ids
- 0 spans outside verse.text length
- 0 duplicate spans
- 0 overlapping spans
- 0 pairs referencing wrong verse
- non-function-token coverage >= 90%
- >= 95% verses have at least one accepted pair
```

**Знаменатели coverage.** `totalTokens` считает все токены; `totalNonFunctionTokens`
считает только `fw=false`. Function words (`fw=true`) не создают visible pair по
умолчанию, поэтому они исключены из знаменателя non-function coverage — иначе
покрытие искусственно занижалось бы. `nonFunctionCoveragePercent =
alignedNonFunctionTokens / totalNonFunctionTokens`.

### Верификация

```bash
node scripts/build-align.mjs
# Проверить отчёт
node - <<'NODE'
import { readFileSync } from 'fs';
const report = JSON.parse(readFileSync('assets/data/align/grc-eng/build-report.json', 'utf8'));
console.log(JSON.stringify(report, null, 2).split('\n').slice(0, 30).join('\n'));
NODE

# Проверить один стих
node - <<'NODE'
import { readFileSync } from 'fs';
const a = JSON.parse(readFileSync('assets/data/align/grc-eng/matthew.json', 'utf8'));
const pairs = a.pairsByRef['matthew 1:1'];
console.log('matthew 1:1 pairs:', pairs.length);
pairs.slice(0, 3).forEach(p => console.log(JSON.stringify(p)));
NODE
```

### Коммит

```bash
git add scripts/build-align.mjs
git commit -m "feat(pipeline): build-align.mjs — generate alignment packs"
```

---

## Task 5: `build-app-config.mjs`

### Назначение

Скопировать `alphabet.json`, `books.json` и сгенерировать `data-manifest.json`.

`books.json` остаётся UI/navigation metadata на русском языке: порядок книг, группы,
русские `title`/`short` для навигации. Английское source title хранится в
`bibles/eng/{book}.json.title`. Не заменять русские названия в `books.json`
на английские без отдельного UX-решения.

### Вход

- `docs/source-data/app-config/alphabet.json`
- `docs/source-data/app-config/books.json`

### Выход

- `assets/data/alphabet.json`
- `assets/data/books.json`
- `assets/data/data-manifest.json`

### data-manifest.json

```json
{
  "schema": "data-manifest-v2",
  "version": "2.0.0",
  "buildDate": "<ISO timestamp>",
  "sourceDataVersion": "sblgnt-macula-clean-v1",
  "normalizationVersion": "bsb-text-v1",
  "dataTypes": ["grc-bible", "eng-bible", "alignment", "lexicon-core", "lexicon-dict", "alphabet", "books"],
  "files": [
    { "path": "bibles/grc/matthew.json", "type": "grc-bible", "size": 12345, "sha256": "abc..." },
    { "path": "align/grc-eng/build-report.json", "type": "alignment-report", "size": 12345, "sha256": "abc..." },
    ...
  ]
}
```

Для хеширования использовать Node.js crypto в ESM:

```js
import { createHash } from 'crypto';
```

Manifest должен включать `align/grc-eng/build-report.json`; иначе `verify:data` обязан падать.
Он попадает в манифест только как **диагностика** (целостность через sha256 + опц.
статистика для экрана «О приложении»), runtime-логика на него не завязана — loader
его не читает для принятия решений.

**Стратегия version bump манифеста.** `version` («2.0.0») — версия app-ready набора
данных, отдельная от версии приложения. Поднимать: major — несовместимое изменение
schema любого пака; minor — изменение `sourceDataVersion`/`normalizationVersion` или
полная регенерация контента; patch — точечные правки данных без смены контрактов.
`version` используется loader'ом для cache-busting (`?v=`), поэтому любая регенерация,
которую должны увидеть существующие клиенты, обязана менять хотя бы patch.

`books.json` имеет два экземпляра: `docs/source-data/app-config/books.json` —
**источник правды**, `assets/data/books.json` — его копия для runtime. Task 5
копирует source→assets; verify (check #2) сверяет главы/стихи именно с source-версией.

### Верификация

```bash
node scripts/build-app-config.mjs
ls assets/data/alphabet.json assets/data/books.json assets/data/data-manifest.json
# Все три должны существовать
```

### Коммит

```bash
git add scripts/build-app-config.mjs
git commit -m "feat(pipeline): build-app-config.mjs — generate config files"
```

---

## Task 6: `build-data.mjs` — оркестратор

### Назначение

Запустить все build-скрипты с атомарной заменой `assets/data/`.

### Логика

```
1. Создать assets/.data-tmp-{timestamp}/
2. Установить TMP_DIR как переменную окружения или глобальную переменную
   (чтобы дочерние скрипты писали во временную директорию)
3. Запустить последовательно:
   - build-bibles.mjs     (пишет в TMP_DIR/bibles/)
   - build-lexicon.mjs    (пишет в TMP_DIR/lexicon/)
   - build-align.mjs      (пишет в TMP_DIR/align/)
   - build-app-config.mjs (пишет в TMP_DIR/)
4. Запустить verify-data.mjs на TMP_DIR
5. Если verify прошёл (безопасная замена без деструктивного rm, см. реализацию):
   - rename(assets/data → assets/data.backup-{ts}) — упадёт при lock, старое цело
   - rename(TMP_DIR → assets/data); при ошибке — откатить backup обратно
   - rm(backup) только после успешного rename
6. Если любой шаг упал:
   - удалить TMP_DIR
   - оставить старый assets/data нетронутым
   - exit с кодом 1
```

### Реализация

```js
import { execSync } from 'child_process';
import { mkdirSync, rmSync, renameSync, existsSync } from 'fs';

const TIMESTAMP = Date.now();
const TMP_DIR = `assets/.data-tmp-${TIMESTAMP}`;

try {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
  mkdirSync(TMP_DIR, { recursive: true });

  const scripts = [
    'build-bibles.mjs',
    'build-lexicon.mjs',
    'build-align.mjs',
    'build-app-config.mjs'
  ];

  for (const script of scripts) {
    console.log(`\n=== ${script} ===`);
    execSync(`node scripts/${script}`, {
      stdio: 'inherit',
      env: { ...process.env, BUILD_DATA_DIR: TMP_DIR }
    });
  }

  console.log('\n=== verify-data.mjs ===');
  execSync(`node scripts/verify-data.mjs`, {
    stdio: 'inherit',
    env: { ...process.env, BUILD_DATA_DIR: TMP_DIR }
  });

  // Безопасная замена: rename(old → backup) → rename(tmp → data) → rm(backup).
  // НЕ удаляем assets/data деструктивно: если каталог залочен (открыт в редакторе/
  // Finder), первый rename упадёт ДО любого удаления, и старые данные целы.
  const BACKUP_DIR = `assets/data.backup-${TIMESTAMP}`;
  let backedUp = false;
  if (existsSync('assets/data')) {
    renameSync('assets/data', BACKUP_DIR);  // упадёт при lock — старое цело
    backedUp = true;
  }
  try {
    renameSync(TMP_DIR, 'assets/data');
  } catch (renameErr) {
    if (backedUp) renameSync(BACKUP_DIR, 'assets/data');  // откат
    throw renameErr;
  }
  if (backedUp) rmSync(BACKUP_DIR, { recursive: true, force: true });
  console.log('\n✓ Atomic generation complete');
} catch (err) {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
  console.error('\n✗ Generation failed, old data preserved:', err.message);
  process.exit(1);
}
```

Каждый дочерний скрипт читает `process.env.BUILD_DATA_DIR` и пишет туда. Если переменная не задана — пишет в `assets/data/` (для ручного запуска отдельного скрипта).

`execSync` здесь идёт со `stdio: 'inherit'`: вывод дочерних скриптов проксируется
прямо в терминал, **не буферизуется**, поэтому лимит `maxBuffer` неприменим даже при
тысячах строк warning'ов. Переходить на `spawn` ради этого не нужно. `execSync`
пробрасывает ненулевой exit-код дочернего скрипта как исключение — это и есть нужный
fail-fast для атомарной генерации.

`TMP_DIR` создаётся внутри `assets/`, чтобы `renameSync(TMP_DIR, 'assets/data')` не пересекал filesystem boundary. Если rename падает из-за lock/permission, скрипт должен оставить старый `assets/data` нетронутым и вывести понятную ошибку.

### Коммит

```bash
git add scripts/build-data.mjs
git commit -m "feat(pipeline): build-data.mjs — atomic data generation"
```

---

## Task 7: `verify-data.mjs`

> ⚠️ **Гейт обновлён (2026-06-25). Канонический источник — VISION §6.** Релизный hard-gate —
> НЕ «coverage ≥ 90%», а: (Check 16) accuracy-инвариант slice↔gloss по методу + `q`↔`method` +
> запрет proposal-тира; (Check 16d) полное разбиение `fw=false` токенов по категориям
> (`aligned` XOR одна resolution-kind), сверка с агрегатами build-report. Coverage (Check 17) —
> только `warn`, никогда не блокирует. Где ниже сказано «coverage ≥ 90%» как условие гейта —
> устарело и читается как advisory.

### Назначение

Проверить целостность сгенерированных данных.

### Проверки (обязательные)

```
1.  Все 27 книг NT_BOOKS существуют в:
    {DATA_DIR}/bibles/grc/, {DATA_DIR}/bibles/eng/, {DATA_DIR}/align/grc-eng/

2.  Для каждой grc/eng-книги: количество глав и стихов === ожидаемому
    (сверка с books.json из source-data/app-config/)

3.  Ref-согласованность grc ↔ eng:
    для каждой книги набор refs в grc и eng идентичен

4.  Каждый eng-стих имеет ref, n, text, words, normalizationVersion

5.  Для каждого eng-стиха: text.slice(w.start, w.end) === w.text (все слова)

6.  Все eng-книги имеют один normalizationVersion;
    каждый alignment pack имеет тот же normalizationVersion, что eng-книга

7.  Все grc-книги имеют один sourceDataVersion;
    каждый alignment pack имеет тот же grcSourceDataVersion, что grc-книга

8.  Греческих токенов в grc-книге === enriched-токенов для того же bookId
    (ни один токен не потерян при группировке)

9.  token.id уникальны в пределах всего NT corpus

10. Каждый греческий токен имеет все маппинг-поля (ловит опечатку в имени поля
    Task 1, иначе фронтенд получает undefined в карточке):
    - непустые: id, s, lemma, lexemeId, lexemeSlug, morph, pos, posLabelRu
    - ключ присутствует (значение может быть пустым/обычным): morphLabelRu, translit,
      glossBerean, glossCherith
    - strongs — массив (возможно пустой); fw — boolean
    - freqRank — present (число или null)
    Проверять структурно (по ключам объекта), не подстрокой по тексту.

11. core.json содержит 5468 записей

12. Каждая curated RU запись (top1000.core.json) либо мапится
    на существующий lexemeId, либо перечислена в migrationWarnings

13. Каждый lexemeSlug уникален в пределах core.json; legacyKeys не содержат
    ключей, которые указывают на несколько lexemeId

14. Каждая alignment-пара ссылается на существующий греческий токен
    (проверка: tokenId существует в grc-книге того же стиха)

15. Каждый alignment-span валиден:
    span[0] >= 0 && span[1] <= engVerse.text.length
    и engVerse.text.slice(span[0], span[1]).trim() !== ''
    и /[\p{L}\p{N}]/u.test(engVerse.text.slice(span[0], span[1]))

15b. Внутри каждого ref пары не пересекаются: после сортировки по span[0]
    для соседних пар prev.span[1] <= next.span[0] (0 overlapping spans)

16. manual-alignments.json, если существует:
    - валиден по схеме
    - manual pair имеет span и q="a"|"f"
    - manual-exclusion не имеет span, имеет q="u"
    - все tokenId/ref существуют

17. Alignment quality thresholds:
    non-function-token coverage >= 90%
    verses with >=1 pair >= 95%

18. data-manifest.json: все перечисленные файлы существуют,
    размеры и sha256 совпадают с реальными; build-report.json включён

19. Ни один app-ready файл не содержит source-only/UBS-полей:
    semantic, louwNida, domain, domainCode, ln,
    sourceId, sourceRef, maculaSource, accent,
    surfaceNfc, surfaceSearch, normalized, lemmaSearch
    **Структурная проверка по КЛЮЧАМ объектов, а не grep по тексту**: рекурсивно
    обойти распарсенный JSON и проверять `Object.keys`. Grep по тексту даёт ложные
    срабатывания на значениях (напр. слово «normalized» внутри BSB-текста).

20. Размер данных находится в ожидаемом диапазоне:
    - общий assets/data: warning при > 60 MB, error при > 100 MB
    - отдельный JSON-файл: warning при > 5 MB, error при > 20 MB

21. Снимок источника не «уплыл» незаметно. В `docs/source-data/enriched/source-manifest.json`
    есть `sourceFileSha256` и `schemaVersion`. verify хранит ожидаемый
    `sourceFileSha256` (константа рядом с SOURCE_DATA_VERSION в scripts/lib/versions.mjs)
    и сверяет с текущим manifest. Mismatch → error «enriched source changed —
    bump SOURCE_DATA_VERSION & expected sha». Это дешёвый автоконтроль, который ловит
    регенерацию enriched без поднятия версии (см. VISION §5.4).
```

### Вывод

```
✓ 27/27 grc books
✓ 27/27 eng books
✓ 27/27 alignment books
✓ verse counts match expected
✓ word offsets valid (0 errors)
✓ token counts: enriched = generated (0 lost)
✓ core.json: 5468/5468 lexemes
✓ alignment spans valid (0 errors)
✓ no overlapping spans (0 errors)
✓ alignment versions match grc/eng packs (0 errors)
✓ manual alignments valid (0 errors)
✓ thresholds: coverage 91.3% >= 90%, verses 100% >= 95%
✓ manifest includes build-report.json
```

### Коммит

```bash
git add scripts/verify-data.mjs
git commit -m "feat(pipeline): verify-data.mjs — data integrity checks"
```

---

## Task 8: End-to-end

### Запуск

```bash
npm run build:data
```

### Ожидаемый результат

- `assets/data/` создана
- Все 27×3 + lexicon + config файлов на месте
- Verify прошёл (все обязательные проверки зелёные)
- Общий размер `assets/data/`: ~35–50 MB

### Финальный коммит

```bash
git add assets/data/
git commit -m "feat(data): initial app-ready data generation (v2.0.0)"
```

### CI / гейт в репозитории

App-ready `assets/data/` **коммитится** (AGENTS.md), поэтому CI **не должен**
регенерировать данные на каждый PR. CI запускает только:

```bash
npm run verify:data   # проверяет уже закоммиченный assets/data
npm test
npm run build
```

`npm run build:data` (полная регенерация) запускается локально/вручную разработчиком,
когда менялись source-data или пайплайн, и результат коммитится. Если когда-нибудь
verify в CI падёт на закоммиченных данных — значит данные и скрипты рассинхронились,
и нужно перегенерировать локально. (`build:data` в CI избыточен и медленен —
enriched 152 MB.)
