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

**Файл:** `scripts/.gitkeep` (пустой)

```bash
mkdir -p scripts
touch scripts/.gitkeep
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

   д. Сформировать итоговый объект:
      {
        schema: "original-book-v2",
        bookId,
        title: loadGreekTitle(bookId),
        chapters: [{ n, verses: [{ n, ref, tokens }] }]
      }
      где ref = `${bookId} ${chapter}:${verse}`
      где title берётся из originals/sblgnt-macula/books/{bookId}.json
   е. Записать в assets/data/bibles/grc/{bookId}.json (mkdir -p)
```

### Извлечение lexemeSlug

Основной источник `lexemeSlug` — curated-словарь `docs/source-data/lexicon/top1000.core.json`, поле `maculaLexemeId → lexemeKey`. Это даёт обратную совместимость для 1000 curated-лемм. Для остальных лемм fallback — парсинг `lexemeId`.

```js
function lexemeIdToSlug(lexemeId) {
  // grc-biblos-9adfa6 → biblos
  // grc-o-677c59 → o
  const parts = lexemeId.split('-');
  if (parts.length >= 3 && parts[0] === 'grc') {
    return parts.slice(1, -1).join('-');
  }
  return lexemeId;
}
```

Важно: slug не является каноническим ключом и может быть коротким (`o`, `en`) или нечитаемым. При генерации `legacyKeys` нужно детектить коллизии slug/Strong's fallback и не создавать неоднозначный legacy mapping.

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
node -e "
const d = require('./assets/data/bibles/grc/matthew.json');
console.log('schema:', d.schema);
console.log('chapters:', d.chapters.length);
const v1 = d.chapters[0].verses[0];
console.log('1:1 tokens:', v1.tokens.length);
console.log('first token:', JSON.stringify(v1.tokens[0], null, 2));
"
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
1. Загрузить bsb-complete.json
2. Для каждого BSB_ID → bookId из BSB_TO_BOOKID:
   а. Найти книгу в BSB: bsb.books.find(b => b.id === BSB_ID)
   б. Для каждой главы:
      - Пройти по массиву chapter.content (или chapter.chapter.content —
        проверить структуру: в BSB JSON глава = { chapter: { content: [...] } })
      - Для каждого элемента content-массива:
        * type === "verse":
          собрать text из поля content (массив):
          - строки конкатенировать
          - объекты с полем noteId — пропустить (сноски)
          - объекты с полем lineBreak — заменить на пробел
          - объекты с полем text — извлечь text и конкатенировать
            (BSB использует {text, poem} для поэтической/генеалогической разметки)
          - нормализовать пробелы: заменить /\s+/g на ' ', убрать trim
          - сгенерировать words: токенизировать text на слова,
            для каждого слова вычислить { i, text: слово, start, end }
            где start/end — UTF-16 code unit offsets в итоговом text
        * type === "heading" — пропустить
        * type === "line_break" на верхнем уровне — пропустить
      - Сформировать verses: [{ ref, n, text, words }]
        ref = `${bookId} ${chapterNumber}:${verseNumber}`
   в. Записать { schema, translationId, bookId, title, short, license,
        attribution, normalizationVersion, chapters: [{ n, verses }] }
      - title: взять из bsb-объекта книги (поле name или commonName)
      - short: взять из bsb-объекта книги (поле id)
      - license: "Public domain"
      - attribution: "Berean Standard Bible, https://berean.bible/"
      - normalizationVersion: "bsb-text-v1"
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

### Верификация

```bash
node -e "
const d = require('./assets/data/bibles/eng/matthew.json');
console.log('schema:', d.schema);
console.log('translationId:', d.translationId);
const ch1 = d.chapters[0];
const v1 = ch1.verses[0];
console.log('1:1 text:', v1.text.substring(0, 80));
console.log('1:1 words[0]:', JSON.stringify(v1.words[0]));
console.log('offset check:', v1.text.slice(v1.words[0].start, v1.words[0].end));
// Должно совпасть: v1.text.slice(start, end) === words[0].text
"
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

```
1. Загрузить все входные файлы
2. Построить индекс: strongNumber → { ruPrimary, ruTopWords } из strongs-ru-alignment.json
3. Построить индекс: maculaLexemeId → top1000-запись из lexicon/top1000.core.json
4. Для каждой лемы из lexemes.json:
   а. Базовые поля из lexemes.json: lexemeId(=id), lemma, transliteration(=transliteration.value),
      pos(=lexeme.pos.primary), strongs(=strong), allRefs, attestedForms,
      glossesBerean(=glossesEn), glossesCherith(=englishGlosses),
      isFunctionWord, freqRank(=frequency.rank)
   б. lexemeSlug: извлечь из lexemeId (см. Task 1)
   в. posLabelRu: из pos.labelRu
   г. freqTokenCount: из frequency.tokenCount
   д. freqVerseCount: из frequency.verseCount
   е. Если есть strongs и strongNumber есть в strongs-ru-alignment:
      - ruGloss = ruPrimary
      - ruTopWords = ruTopWords
   ж. Если lexeme.id есть в top1000.maculaLexemeId:
      - ruMatches, ruExclude, refs — взять из top1000
   з. legacyKeys: [lexemeSlug] + (если есть strong: ['freq-' + strongNumber] для каждого)
      но только если legacyKey однозначно указывает на одну lexemeId
5. После сборки всех записей проверить legacyKey collisions:
   - если legacyKey встречается у нескольких lexemeId, удалить его из legacyKeys всех конфликтующих записей
   - записать конфликт в build-report/verify output
   - не создавать неоднозначный auto-migration mapping
6. Записать core.json
7. Для dictionary.json — переупаковать strongs-dictionary в объект { [strongNumber]: { definition, greek, translit, ruPrimary, ruTopWords } }
```

### Верификация

```bash
node -e "
const d = require('./assets/data/lexicon/core.json');
console.log('schema:', d.schema);
console.log('items count:', d.items.length);
// Должно быть 5468
const biblos = d.items.find(x => x.lexemeSlug === 'biblos');
console.log('biblos:', JSON.stringify(biblos, null, 2).substring(0, 500));
"
```

### Коммит

```bash
git add scripts/build-lexicon.mjs
git commit -m "feat(pipeline): build-lexicon.mjs — generate lexicon packs"
```

---

## Task 4: `build-align.mjs`

### Назначение

Сгенерировать `assets/data/align/grc-eng/{book}.json` — span-based alignment между греческими токенами и BSB-текстом.

### Вход

- `assets/data/bibles/grc/{book}.json` — результат Task 1
- `assets/data/bibles/eng/{book}.json` — результат Task 2
- `docs/source-data/enriched/lexemes.json` — для лемма-глоссов
- `docs/source-data/alignments/grc-eng/manual-alignments.json` — optional ручные overrides (если файл существует)

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
      - normalized phrase over adjacent BSB words → q="a", method="phrase"
      - simple fuzzy: lowercase, strip punctuation, normalize apostrophes → q="f", method="fuzzy"
   в. Если на одно BSB-слово претендуют несколько токенов:
      - принять только однозначный match
      - неоднозначные повторы не угадывать; записать warning и оставить token unaligned
   г. Для function words (fw=true): не создавать visible pair по умолчанию;
      если есть уверенный span, можно записать q="x" для диагностики
   д. Невыровненные meaningful tokens записать в warningsByRef/report как q="u"

4. Применить manual-alignments overrides:
   - override обязан указывать ref, tokenId, span, method="manual"
   - verify обязан проверить, что tokenId существует в том же ref, span валиден,
     text.slice(span[0], span[1]) непустой
   - manual pair побеждает алгоритмическую пару для того же tokenId
   - количество manual пар попадает в build-report.json

5. Отсортировать pairs по span[0], затем tokenId
6. Проверить: нет дублирующихся span
7. Записать pairsByRef[ref] = [отсортированные пары со span]
8. Записать warningsByRef[ref] = [unaligned/ambiguous diagnostics без span]
```

`pairsByRef` содержит только записи со span, которые runtime может безопасно обработать. `q="u"` хранится в `warningsByRef`/report, не как span-less pair в `pairsByRef`.

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
  "ambiguousCandidateCount": 340,
  "topUnalignedLexemes": [
    {"lexemeId": "grc-...", "lemma": "δέ", "count": 1500, "glossBerean": "and/but"}
  ],
  "manualPairCount": 0,
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
- 0 pairs referencing wrong verse
- non-function-token coverage >= 90%
- >= 95% verses have at least one accepted pair
```

### Верификация

```bash
node scripts/build-align.mjs
# Проверить отчёт
node -e "console.log(JSON.stringify(require('./assets/data/align/grc-eng/build-report.json'), null, 2))" | head -30

# Проверить один стих
node -e "
const a = require('./assets/data/align/grc-eng/matthew.json');
const pairs = a.pairsByRef['matthew 1:1'];
console.log('matthew 1:1 pairs:', pairs.length);
pairs.slice(0, 3).forEach(p => console.log(JSON.stringify(p)));
"
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
5. Если verify прошёл:
   - удалить assets/data (если существует)
   - переименовать TMP_DIR → assets/data
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

  if (existsSync('assets/data')) {
    rmSync('assets/data', { recursive: true, force: true });
  }
  renameSync(TMP_DIR, 'assets/data');
  console.log('\n✓ Atomic generation complete');
} catch (err) {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
  console.error('\n✗ Generation failed, old data preserved');
  process.exit(1);
}
```

Каждый дочерний скрипт читает `process.env.BUILD_DATA_DIR` и пишет туда. Если переменная не задана — пишет в `assets/data/` (для ручного запуска отдельного скрипта).

`TMP_DIR` создаётся внутри `assets/`, чтобы `renameSync(TMP_DIR, 'assets/data')` не пересекал filesystem boundary. Если rename падает из-за lock/permission, скрипт должен оставить старый `assets/data` нетронутым и вывести понятную ошибку.

### Коммит

```bash
git add scripts/build-data.mjs
git commit -m "feat(pipeline): build-data.mjs — atomic data generation"
```

---

## Task 7: `verify-data.mjs`

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

7.  Греческих токенов в grc-книге === enriched-токенов для того же bookId
    (ни один токен не потерян при группировке)

8.  token.id уникальны в пределах всего NT corpus

9.  Каждый греческий токен имеет обязательные поля:
    id, s, lemma, lexemeId, morph, strongs, fw

10. core.json содержит 5468 записей

11. Каждая curated RU запись (top1000.core.json) либо мапится
    на существующий lexemeId, либо перечислена в migrationWarnings

12. Каждая alignment-пара ссылается на существующий греческий токен
    (проверка: tokenId существует в grc-книге того же стиха)

13. Каждый alignment-span валиден:
    span[0] >= 0 && span[1] <= engVerse.text.length
    и engVerse.text.slice(span[0], span[1]).trim() !== ''

14. Alignment quality thresholds:
    non-function-token coverage >= 90%
    verses with >=1 pair >= 95%

15. data-manifest.json: все перечисленные файлы существуют,
    размеры и sha256 совпадают с реальными; build-report.json включён

16. Ни один app-ready файл не содержит source-only/UBS-полей:
    semantic, louwNida, domain, domainCode, ln,
    sourceId, sourceRef, maculaSource, accent,
    surfaceNfc, surfaceSearch, normalized, lemmaSearch
    (проверка grep-ом по JSON-ключам)

17. Общий размер assets/data находится в ожидаемом диапазоне
    (warning при > 60 MB, error при > 100 MB)
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
