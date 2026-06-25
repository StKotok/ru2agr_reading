# IMPL-PIPELINE: Data Pipeline Implementation

> **Фаза 1 миграции.** Генерация app-ready данных из `docs/source-data/`.
> **Предусловие:** прочитан `VISION.md`, поняты контракты данных (раздел 5).
> **Вход:** `docs/source-data/` (данные уже собраны).
> **Выход:** `assets/data/` (27 греческих книг + 27 BSB книг + 27 alignment + lexicon + конфиг).
> **После завершения:** `npm run build:data` проходит без ошибок, `verify:data` зелёный.

---

## Общая структура

Создаём 6 скриптов в `scripts/` (директория не существует — её нужно создать):

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
      | token.lexemeId → slug    | lexemeSlug        | извлечь часть после 'grc-' и до последнего '-'  |
      |                          |                   | Пример: grc-biblos-9adfa6 → biblos              |
      | token.transliteration    | translit          | если объект → .value; если строка → как есть    |
      | token.morphology.code    | morph             | извлечь .code из объекта morphology             |
      | token.morphology.labelRu | morphLabelRu      | извлечь .labelRu из morphology                  |
      | token.strong             | strongs           | как есть (массив строк)                         |
      | token.pos.primary        | pos               | извлечь .primary; fallback: pos.source          |
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
        title: TITLES[bookId],
        chapters: [{ n, verses: [{ n, ref, tokens }] }]
      }
      где ref = `${bookId} ${chapter}:${verse}`
      где TITLES — маппинг bookId → греческое название (взять из старых originals)
   е. Записать в assets/data/bibles/grc/{bookId}.json (mkdir -p)
```

### Извлечение lexemeSlug из lexemeId

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

### Греческие названия книг (TITLES)

Извлечь из `docs/source-data/originals/sblgnt-macula/books/{book}.json` → поле `title`. Скрипт может либо загрузить все 27 файлов и взять `title`, либо использовать захардкоженный маппинг:

```js
const TITLES = {
  matthew: 'ΚΑΤΑ ΜΑΘΘΑΙΟΝ', mark: 'ΚΑΤΑ ΜΑΡΚΟΝ', luke: 'ΚΑΤΑ ΛΟΥΚΑΝ',
  john: 'ΚΑΤΑ ΙΩΑΝΝΗΝ', acts: 'ΠΡΑΞΕΙΣ ΑΠΟΣΤΟΛΩΝ',
  romans: 'ΠΡΟΣ ΡΩΜΑΙΟΥΣ', '1corinthians': 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Α´',
  '2corinthians': 'ΠΡΟΣ ΚΟΡΙΝΘΙΟΥΣ Β´', galatians: 'ΠΡΟΣ ΓΑΛΑΤΑΣ',
  ephesians: 'ΠΡΟΣ ΕΦΕΣΙΟΥΣ', philippians: 'ΠΡΟΣ ΦΙΛΙΠΠΗΣΙΟΥΣ',
  colossians: 'ΠΡΟΣ ΚΟΛΟΣΣΑΕΙΣ', '1thessalonians': 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Α´',
  '2thessalonians': 'ΠΡΟΣ ΘΕΣΣΑΛΟΝΙΚΕΙΣ Β´', '1timothy': 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ Α´',
  '2timothy': 'ΠΡΟΣ ΤΙΜΟΘΕΟΝ Β´', titus: 'ΠΡΟΣ ΤΙΤΟΝ',
  philemon: 'ΠΡΟΣ ΦΙΛΗΜΟΝΑ', hebrews: 'ΠΡΟΣ ΕΒΡΑΙΟΥΣ',
  james: 'ΙΑΚΩΒΟΥ', '1peter': 'ΠΕΤΡΟΥ Α´', '2peter': 'ΠΕΤΡΟΥ Β´',
  '1john': 'ΙΩΑΝΝΟΥ Α´', '2john': 'ΙΩΑΝΝΟΥ Β´', '3john': 'ΙΩΑΝΝΟΥ Γ´',
  jude: 'ΙΟΥΔΑ', revelation: 'ΑΠΟΚΑΛΥΨΙΣ ΙΩΑΝΝΟΥ'
};
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
git add scripts/build-bibles.mjs assets/data/bibles/grc/
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
          - нормализовать пробелы: заменить /\s+/g на ' ', убрать trim
          - сгенерировать words: токенизировать text на слова,
            для каждого слова вычислить { i, text: слово, start, end }
            где start/end — байтовые (!) позиции в итоговом text
        * type === "heading" — пропустить
        * type === "line_break" на верхнем уровне — пропустить
      - Сформировать verses: [{ ref, n, text, words }]
        ref = `${bookId} ${chapterNumber}:${verseNumber}`
   в. Записать { schema, translationId, bookId, title, short, license,
        attribution, chapters: [{ n, verses }] }
      - title: взять из bsb-объекта книги (поле name или commonName)
      - short: взять из bsb-объекта книги (поле id)
      - license: "Public domain"
      - attribution: "Berean Standard Bible, https://berean.bible/"
```

### Токенизация в words (ВАЖНО — байтовые офсеты)

```js
function tokenizeWords(text) {
  // Разбить текст на слова, сохраняя байтовые позиции
  // Слово = последовательность букв (Unicode letter), цифр или апострофа
  // Пунктуация и пробелы НЕ включаются в слова
  const words = [];
  const wordPattern = /[\p{L}\p{N}']+/gu;
  let match;
  while ((match = wordPattern.exec(text)) !== null) {
    // В JS .index возвращает кодовые единицы (UTF-16), не байты.
    // Для ASCII-текста BSB это одно и то же.
    // Для совместимости с engine используем UTF-16 offset,
    // потому что JS .slice() работает с кодовыми единицами.
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
git add scripts/build-bibles.mjs assets/data/bibles/eng/
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
- `docs/source-data/lexicon/locales/ru/core.json` — рус. данные (массив)
- `docs/source-data/lexicon/locales/ru/top1000.json` — рус. данные топ-1000 (массив)

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
3. Построить индекс: lemma → top1000-запись из lexicon/top1000.core.json
4. Для каждой лемы из lexemes.json:
   а. Базовые поля из lexemes.json: lexemeId(=id), lemma, transliteration(=transliteration.value),
      pos(=pos.primary), strongs(=strong), allRefs, attestedForms,
      glossesBerean(=glossesEn), glossesCherith(=englishGlosses),
      isFunctionWord, freqRank(=frequency.rank)
   б. lexemeSlug: извлечь из lexemeId (см. Task 1)
   в. posLabelRu: из pos.labelRu
   г. freqTokenCount: из frequency.tokenCount
   д. freqVerseCount: из frequency.verseCount
   е. Если есть strongs и strongNumber есть в strongs-ru-alignment:
      - ruGloss = ruPrimary
      - ruTopWords = ruTopWords
   ж. Если lemma есть в top1000-словаре:
      - ruMatches, ruExclude, refs — взять из top1000
   з. legacyKeys: [lexemeSlug] + (если есть strong: ['freq-' + strongNumber] для каждого)
5. Записать core.json
6. Для dictionary.json — переупаковать strongs-dictionary в объект { [strongNumber]: { definition, greek, translit, ruPrimary, ruTopWords } }
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
git add scripts/build-lexicon.mjs assets/data/lexicon/
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
      - lemmaGlosses: из lexemes.json → englishGlosses (Cherith) и glossesEn (Berean)
   б. Для каждого BSB-слова найти best match score:
      - exact match normalized word ↔ normalized BSB word: score 10
      - bracket-optional: Berean '[The] book' → ищем 'the' и 'book'
        среди BSB слов: score 8 за каждое
      - case-insensitive + strip punctuation: score 5
      - lemma-level gloss match: score 3
   в. Разрешить конфликты (несколько токенов претендуют на одно BSB слово):
      - Выигрывает кандидат с максимальным score
      - При равных score — monotonic order bonus (+1 если
        греческий порядок совпадает с английским)
      - При всё ещё равных — distance penalty (-1 за каждый шаг
        отклонения от монотонного порядка)
   г. Если score >= 3: создать alignment pair с q="a" и method=лучший метод
      Если score >= 1 но < 3: q="f", пары не показываются в режиме 4
      Если нет совпадения: q="u" (unaligned)
   д. Для function words (fw=true): q="x" (excluded)

4. Отсортировать pairs по span[0], затем tokenId
5. Проверить: нет дублирующихся span без groupId
6. Записать pairsByRef[ref] = [отсортированные пары]
```

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
  "alignedTokens": 123000,
  "unalignedTokens": 14740,
  "alignedNonFunctionTokens": 110000,
  "totalNonFunctionTokens": 125000,
  "coveragePercent": 89.3,
  "nonFunctionCoveragePercent": 88.0,
  "versesWithZeroPairs": 12,
  "duplicateSpanCount": 0,
  "ambiguousCandidateCount": 340,
  "topUnalignedLexemes": [
    {"lexemeId": "grc-...", "lemma": "δέ", "count": 1500, "glossBerean": "and/but"}
  ],
  "thresholds": {
    "nonFunctionCoverageMin": 85,
    "versesWithPairsMin": 95
  }
}
```

### Hard gates (сборка падает если не пройдены)

```
- 27 alignment book files exist
- 0 invalid token ids
- 0 spans outside verse.text length
- 0 duplicate spans without groupId
- 0 pairs referencing wrong verse
- non-function-token coverage >= 85%
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
git add scripts/build-align.mjs assets/data/align/
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
    ...
  ]
}
```

Для хеширования использовать `crypto.createHash('sha256')`.

### Верификация

```bash
node scripts/build-app-config.mjs
ls assets/data/alphabet.json assets/data/books.json assets/data/data-manifest.json
# Все три должны существовать
```

### Коммит

```bash
git add scripts/build-app-config.mjs assets/data/alphabet.json assets/data/books.json assets/data/data-manifest.json
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

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const TMP_DIR = `assets/.data-tmp-${TIMESTAMP}`;

try {
  mkdirSync(TMP_DIR, { recursive: true });
  process.env.BUILD_DATA_DIR = TMP_DIR;

  const scripts = [
    'build-bibles.mjs',
    'build-lexicon.mjs',
    'build-align.mjs',
    'build-app-config.mjs'
  ];

  for (const script of scripts) {
    console.log(`\n=== ${script} ===`);
    execSync(`node scripts/${script}`, { stdio: 'inherit' });
  }

  console.log('\n=== verify-data.mjs ===');
  execSync(`node scripts/verify-data.mjs`, { stdio: 'inherit' });

  if (existsSync('assets/data')) {
    rmSync('assets/data', { recursive: true });
  }
  renameSync(TMP_DIR, 'assets/data');
  console.log('\n✓ Atomic generation complete');
} catch (err) {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true });
  }
  console.error('\n✗ Generation failed, old data preserved');
  process.exit(1);
}
```

Каждый дочерний скрипт читает `process.env.BUILD_DATA_DIR` и пишет туда. Если переменная не задана — пишет в `assets/data/` (для ручного запуска отдельного скрипта).

### Коммит

```bash
git add scripts/build-data.mjs
git commit -m "feat(pipeline): build-data.mjs — atomic data generation"
```

---

## Task 7: `verify-data.mjs`

### Назначение

Проверить целостность сгенерированных данных.

### Проверки (13 обязательных)

```
1.  Все 27 книг NT_BOOKS существуют в:
    {DATA_DIR}/bibles/grc/, {DATA_DIR}/bibles/eng/, {DATA_DIR}/align/grc-eng/

2.  Для каждой eng-книги: количество стихов === ожидаемому
    (сверка с books.json из source-data/app-config/)

3.  Каждый eng-стих имеет ref, n, text, words

4.  Для каждого eng-стиха: text.slice(w.start, w.end) === w.text (все слова)

5.  Греческих токенов в grc-книге === enriched-токенов для того же bookId
    (ни один токен не потерян при группировке)

6.  Каждый греческий токен имеет обязательные поля:
    id, s, lemma, lexemeId, morph, strongs, fw

7.  core.json содержит 5468 записей

8.  Каждая curated RU запись (top1000.core.json) либо мапится
    на существующий lexemeId, либо перечислена в migrationWarnings

9.  Каждая alignment-пара ссылается на существующий греческий токен
    (проверка: tokenId существует в grc-книге того же стиха)

10. Каждый alignment-span валиден:
    span[0] >= 0 && span[1] <= engVerse.text.length

11. Alignment quality thresholds:
    non-function-token coverage >= 85%
    verses with >=1 pair >= 95%

12. data-manifest.json: все перечисленные файлы существуют
    и их размеры совпадают с реальными

13. Ни один сгенерированный файл не содержит полей:
    semantic, louwNida, domain, domainCode, ln
    (проверка grep-ом по JSON-ключам)
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
✓ thresholds: coverage 89.3% >= 85%, verses 100% >= 95%
✗ MISSING FILES IN MANIFEST: align/grc-eng/build-report.json
  (добавить файл в манифест или исключить из проверки)
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
- Verify прошёл (все 13 проверок зелёные)
- Общий размер `assets/data/`: ~35–50 MB

### Финальный коммит

```bash
git add assets/data/
git commit -m "feat(data): initial app-ready data generation (v2.0.0)"
```
