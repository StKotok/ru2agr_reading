# IMPL-RUNTIME: Code Adaptation & Release

> **Фазы 2+3 миграции.** Адаптация runtime-кода под новые данные, миграция IndexedDB, PWA, деплой.
> **Предусловие:** `IMPL-PIPELINE.md` выполнен, `assets/data/` существует и verify зеленый.
> **Связанные документы:** `VISION.md` (контракты данных), `IMPL-PIPELINE.md` (форматы).

---

## Стратегия изменений

Меняем минимально необходимое. Ключевой принцип: **engine и UI не знают о формате source-data, они знают только app-ready формат.**

Поле `lexemeId` становится каноническим ключом во всех runtime-структурах. `lexemeKey`/`lexemeSlug` разрешены только как legacy/display fallback на границе loaders/migration и в тестах обратной совместимости.

Runtime-этап начинается только после полного выполнения `IMPL-PIPELINE.md`: `assets/data/` существует, `npm run verify:data` зелёный. Отдельные runtime-коммиты до этого могут компилироваться, но полноценная ручная проверка чтения невозможна без v2 data packs.

---

## Task 1: `src/data/bible-loader.js` — новые пути и форматы

### Файл

`src/data/bible-loader.js` — переписать загрузку данных.

### Что изменить

**Старые пути:**
```js
`data/originals/sblgnt-macula/books`           // Greek
`data/translations/syn/books`                   // Translation
`./data/align/syn--sblgnt-macula/books/${bookId}.json`  // Alignment
'./data/align/syn--sblgnt-macula/index.json'   // Alignment index
```

**Новые пути:**
```js
`data/bibles/grc`                               // Greek
`data/bibles/eng`                               // Translation (BSB)
`./data/align/grc-eng/${bookId}.json`           // Alignment
```

### Конкретные изменения

1. **Функция загрузки книги** (`loadBook` или аналогичная):
   - Параметр `type`: `'grc'` вместо `'original'`, `'eng'` вместо `'translation'`
   - Путь: `data/bibles/${type}/${bookId}.json`

2. **Функция загрузки alignment:**
   - Путь: `data/align/grc-eng/${bookId}.json`
   - Удалить загрузку `index.json` (alignment index больше не нужен — enriched данные полные)
   - Если alignment не загрузился: вернуть `null`, не бросать наружу; reading screen рендерит обычный BSB текст/letter layer без греческих вставок

3. **Функция загрузки data-manifest:**
   - Путь: `data/data-manifest.json`
   - Использовать `manifest.version` для cache-busting: `?v=${manifest.version}`
   - Не читать attribution/licensing из manifest

4. **Поле `morph` в греческих токенах:**
   - Старое: `token.morph` (строка) — уже есть
   - Новое: `token.morph` (строка) — то же самое, формат совместим

5. **Поле `strongs` vs `strong`:**
   - Старое: `token.strongs` (массив) — в некоторых местах `token.strong`
   - Новое: `token.strongs` (массив) — унифицировано
   - В engine проверить: где используется `token.strong` — заменить на `token.strongs`

### Верификация

```bash
# Запустить dev-сервер, открыть reading screen
# Проверить в консоли браузера: загрузилась ли книга
npm run dev
```

### Коммит

```bash
git add src/data/bible-loader.js
git commit -m "refactor(data): update bible-loader for v2 paths and formats"
```

---

## Task 2: `src/data/lexicon-loader.js` — новый формат словаря

### Файл

`src/data/lexicon-loader.js` — адаптировать под новый `core.json` и `dictionary.json`.

### Что изменить

1. **Путь к core:** `data/lexicon/core.json` (был `data/lexicon/top1000.core.json`)
2. **Путь к dictionary:** `data/lexicon/dictionary.json` (новый)
3. **Формат записи:** теперь каждая запись имеет `lexemeId` (канонический) и `lexemeSlug`
4. **Функция `loadCoreLexicon`:**
   - Читает `core.json`
   - Возвращает массив записей, где `id = lexemeId` для совместимости с текущими `coreById` lookup,
     но также присутствует `lexemeId`
   - Маппинг: `coreItem.lexemeKey = coreItem.lexemeSlug` (legacy/display fallback)
   - Гарантирует, что каждая запись имеет `lexemeId`
5. **Функция `loadDictionary` (новая):**
   - Читает `dictionary.json`
   - Возвращает Map `strongNumber → { definition, ruPrimary, ruTopWords }`

### Конкретные изменения

```js
// Старый формат записи:
{ lexemeKey: 'biblos', lemma: 'βίβλος', gloss: 'книга', ... }

// Новый формат (core.json):
{ lexemeId: 'grc-biblos-9adfa6', lexemeSlug: 'biblos', lemma: 'βίβλος', ... }

// Адаптация для UI (lexicon-loader добавляет):
{ id: 'grc-biblos-9adfa6', lexemeKey: 'biblos', lexemeId: 'grc-biblos-9adfa6', lemma: 'βίβλος', ... }
// id = lexemeId; lexemeKey = lexemeSlug for legacy/display only
```

### Верификация

```bash
node -e "
import { loadCoreLexicon } from './src/data/lexicon-loader.js';
const items = await loadCoreLexicon();
console.log('items:', items.length);
console.log('first:', items[0].lexemeId, items[0].lexemeKey);
// Должны присутствовать оба поля
"
```

### Коммит

```bash
git add src/data/lexicon-loader.js
git commit -m "refactor(data): update lexicon-loader for v2 core/dictionary format"
```

---

## Task 3: `src/engine/form-layer.js` + `src/engine/compose.js` — `lexemeKey` → `lexemeId`

### Файлы

- `src/engine/form-layer.js` — адаптировать alignment-пары и dictionary-ключи.
- `src/engine/compose.js` — обновить builder map, JSDoc и передачу dictionary map.

### Что изменить

Это механическая, но cross-cutting замена ключа. Не ограничивать задачу “3 строками”: нужно обновить lookup, Segment metadata и тесты.

1. Pair key:
   ```js
   const lexemeId = pair.lexemeId || pair.lexemeKey; // temporary fallback
   ```

2. В возвращаемом сегменте:
   ```js
   lexemeId,
   lexemeKey: pair.lexemeKey || pair.lexemeSlug || lexemeId, // temporary compatibility
   ```

3. Dictionary lookup:
   ```js
   const dictEntry = dictByLexemeId.get(lexemeId);
   ```

4. `buildDictByLexemeKey` переименовать или продублировать как `buildDictByLexemeId`; приоритет ключей:
   ```js
   const key = entry.lexemeId || entry.lexemeKey || entry.id;
   ```

5. `q="u"` и `q="x"` не рендерить как греческие вставки. Если pair не имеет span, пропускать до обращения к `pair.span`.

6. В `compose.js`:
   - заменить импорт `buildDictByLexemeKey` на `buildDictByLexemeId`;
   - локальную переменную `dictByLexemeKey` заменить на `dictByLexemeId`;
   - JSDoc “Synodal/Russian verse text” заменить на BSB/source verse text;
   - JSDoc token/alignment fixtures описывать как `{lexemeId, lexemeKey?}`.

### Коммит

```bash
git add src/engine/form-layer.js src/engine/compose.js
git commit -m "refactor(engine): prefer lexemeId in form-layer, fallback to lexemeKey"
```

---

## Task 4: `src/ui/screens/reading.js` — BSB вместо Синодального

### Файл

`src/ui/screens/reading.js` — адаптировать под английские данные.

### Что изменить

1. **Имя загружаемого перевода:** `'eng'` вместо `'syn'`

2. **`ruHint`-переменные и логика (строки 425-429):**
   - Переименовать `ruHint` → `enSourceHint` (или оставить `ruHint` — это подсказка на языке перевода)
   - Текст: «Русский текст» → «Английский текст (BSB)» в подсказке

3. **`data-lexeme-key` атрибут (строка 409):**
   ```js
   span.setAttribute('data-lexeme-id', token.lexemeId || '');
   span.setAttribute('data-lexeme-key', token.lexemeSlug || token.lexemeKey || token.lexemeId || '');
   ```

4. **`coreByIdCache` (строки 602-603):**
   ```js
   coreByIdCache = new Map((coreLexicon || []).map(l => [l.lexemeId, l]).filter(([key]) => key));
   const coreByLegacyKey = new Map((coreLexicon || []).flatMap(l =>
     [l.lexemeKey, l.lexemeSlug, ...(l.legacyKeys || [])]
       .filter(Boolean)
       .map(k => [k, l])
   ));
   ```

5. **`freqByKeyCache` (строки 608-609):**
   ```js
   const key = item.lexemeId || item.lexemeKey || item.lexemeSlug;
   ```

6. **`lexemeKeyKnownSet` (строка 615):**
   - Переименовать в `lexemeIdKnownSet`
   - Наполнять `lexemeId || lexemeKey`

7. **Функция `buildWordEntries` (строки 625-648):**
   - `lexemeKey` в возвращаемом объекте заменить на `lexemeId`
   - Добавить `lexemeSlug` для отображения

8. **Функция `collectWordData` (строка 914):**
   ```js
   const lexemeIdFromAttr = span.getAttribute('data-lexeme-id');
   const legacyKeyFromAttr = span.getAttribute('data-lexeme-key');
   const lookupKey = lexemeIdFromAttr || legacyKeyFromAttr;
   const core = lexemeIdFromAttr
     ? coreByIdCache.get(lexemeIdFromAttr)
     : coreByLegacyKey.get(legacyKeyFromAttr);
   ```

9. **Graceful degradation:**
   - если `bookData` загрузилась, но `alignmentBookData` отсутствует или битая, не показывать white screen;
   - рендерить BSB plain text + letter layer fallback;
   - показать fail-soft toast только если настройки требуют греческий слой.

10. **Греческий режим:**
   - подсказка под стихом становится source hint BSB;
   - внутреннее имя можно оставить `ruHint` только временно, но UI label должен быть “Показывать английский текст BSB под стихом”.

### Поиск и замена строк про Синодальный перевод

```bash
grep -n "Синодал\|русск.*текст\|ruHint\|Synodal\|bibles/syn" src/ui/screens/reading.js
```

Заменить:
- «Русский текст» → «Английский текст (BSB)»
- «Синодальный перевод» → «Berean Standard Bible»
- `ruHint` — оставить как имя переменной (это hint на ЯЗЫКЕ перевода, не обязательно русский)
- Или переименовать `ruHint` → `sourceHint`

### Дополнительные UI-файлы с текстом

Также обновить:
- `src/ui/components/top-bar.js`: “Показать обычный русский текст” → “Показать обычный текст BSB”; “Вернуть греческий слой” оставить.
- `src/ui/components/mode-widget.js`: “чистый русский”, “русский перевод под стихом” → BSB/source wording.
- `src/ui/components/word-card.js`: “из Синодального перевода”, JSDoc “исходное русское слово” → “исходное слово перевода”.
- `src/ui/screens/dictionary.js`: “русско-греческое соответствие” → “проверенное соответствие в тексте”.

### Коммит

```bash
git add src/ui/screens/reading.js
git commit -m "refactor(ui): switch reading screen to BSB (English) data"
```

---

## Task 5: `src/ui/screens/about.js` — обновить информацию

### Файл

`src/ui/screens/about.js` — заменить информацию о Синодальном переводе на BSB и лицензии.

### Что изменить

Заменить HTML-строки:

```js
// Было:
'<h4>Синодальный перевод</h4>'
'<p>Русский Синодальный перевод Библии — общественное достояние (public domain).</p>'

// Стало:
'<h4>Berean Standard Bible (BSB)</h4>'
'<p>Berean Standard Bible — public domain. <a href="https://berean.bible/">berean.bible</a></p>'
```

Добавить блок про греческие данные:

```html
<h4>Греческий текст</h4>
<p>SBLGNT + MACULA Greek morphology — CC BY 4.0.
   MACULA Greek Linguistic Datasets, available at
   <a href="https://github.com/Clear-Bible/macula-greek/">github.com/Clear-Bible/macula-greek/</a></p>

<h4>Cherith Glosses</h4>
<p>Cherith Glosses for the Greek New Testament, © 2023 Cherith Analytics — CC BY 4.0.</p>
```

### Коммит

```bash
git add src/ui/screens/about.js
git commit -m "refactor(ui): update about screen with BSB and CC-BY attributions"
```

---

## Task 6: `src/ui/render.js` — lexeme DOM attributes

### Файл

`src/ui/render.js` (строки 27-29) — обновить атрибут.

### Что изменить

```js
// Было:
span.setAttribute('data-lexeme-key', seg.lexemeKey || seg.lexemeId);

// Стало:
span.setAttribute('data-lexeme-id', seg.lexemeId || '');
span.setAttribute('data-lexeme-key', seg.lexemeKey || seg.lexemeSlug || seg.lexemeId || '');
```

`data-lexeme-id` — canonical runtime key. `data-lexeme-key` остаётся legacy/display fallback на время миграции.

### Коммит

```bash
git add src/ui/render.js
git commit -m "refactor(ui): prefer lexemeId in render data-lexeme-key"
```

---

## Task 7: `src/state/dictionary.js` — миграция словарных ключей

### Файл

`src/state/dictionary.js` — добавить миграцию старых ключей при загрузке.

### Логика миграции

```
1. После загрузки core.json построить Map legacyKey → lexemeId из:
   - item.legacyKeys
   - item.lexemeSlug
   - item.lexemeKey
   Только однозначные keys попадают в map.

2. Для каждой записи dictionary:
   - если ключ уже есть среди core.lexemeId — оставить как есть
   - если ключ найден в legacyKeyMap — переместить/смержить запись под lexemeId
   - если ключ НЕ найден — оставить под старым ключом, добавить `_legacy: true`,
     записать warning в отдельный IndexedDB key `dictionary_migration_warnings`

3. Для progress.wordsToday.added применить ту же key mapping.

4. Сохранить обновлённые `dictionary`, `progress` и `dictionary_migration_warnings`
   только через обёртки `src/storage/db.js` / state helpers. Не открывать
   `indexedDB.transaction` напрямую из UI/state-кода.

5. Миграция идемпотентна: повторный запуск не меняет уже мигрированные записи.
```

### Реализация

```js
const DICTIONARY_MIGRATION_WARNINGS_KEY = 'dictionary_migration_warnings';

function buildLegacyKeyMap(coreLexicon) {
  const map = new Map();
  const conflicts = new Set();
  for (const item of coreLexicon) {
    const keys = [
      ...(item.legacyKeys || []),
      item.lexemeSlug,
      item.lexemeKey
    ].filter(Boolean);
    for (const k of keys) {
      if (map.has(k) && map.get(k) !== item.lexemeId) {
        conflicts.add(k);
      } else {
        map.set(k, item.lexemeId);
      }
    }
  }
  for (const k of conflicts) map.delete(k);
  return map;
}

function mergeDictionaryEntry(existing, incoming) {
  const statusOrder = { known: 3, learning: 2, new: 1 };
  const existingTime = Date.parse(existing.updatedAt || existing.addedAt || '') || 0;
  const incomingTime = Date.parse(incoming.updatedAt || incoming.addedAt || '') || 0;

  const fresher = incomingTime > existingTime ? incoming : existing;
  const strongerStatus = (statusOrder[incoming.status] || 0) > (statusOrder[existing.status] || 0)
    ? incoming.status
    : existing.status;

  return {
    ...existing,
    ...incoming,
    ...fresher,
    status: incomingTime !== existingTime ? fresher.status : strongerStatus,
    showInText: existing.showInText === false || incoming.showInText === false ? false : fresher.showInText,
    addedAt: [existing.addedAt, incoming.addedAt].filter(Boolean).sort()[0] || fresher.addedAt
  };
}

export function migrateDictionaryData(dict, progress, coreLexicon) {
  const legacyKeyMap = buildLegacyKeyMap(coreLexicon);
  const knownLexemeIds = new Set(coreLexicon.map(i => i.lexemeId).filter(Boolean));
  const nextDict = {};
  const warnings = [];

  for (const [key, entry] of Object.entries(dict)) {
    const newKey = knownLexemeIds.has(key) ? key : legacyKeyMap.get(key);
    if (newKey) {
      nextDict[newKey] = nextDict[newKey]
        ? mergeDictionaryEntry(nextDict[newKey], entry)
        : { ...entry };
    } else {
      nextDict[key] = { ...entry, _legacy: true };
      warnings.push({ key, reason: 'no-safe-mapping' });
    }
  }

  const wordsToday = progress.wordsToday || { date: '', added: [] };
  const added = (wordsToday.added || []).map(key => legacyKeyMap.get(key) || key);
  const nextProgress = {
    ...progress,
    wordsToday: { ...wordsToday, added: [...new Set(added)] }
  };

  return { dictionary: nextDict, progress: nextProgress, warnings };
}
```

The caller persists results fail-soft:
- save `dictionary` under key `dictionary`
- save `progress` under key `progress`
- save warnings under key `dictionary_migration_warnings`
- `console.warn` once if warnings are non-empty

Unknown legacy entries are technical debt. They remain in IndexedDB but do not participate in text replacement. Add a v1.2 follow-up for a small maintenance UI or export/debug path if warnings appear in real user data.

### Верификация

```bash
# Открыть приложение, проверить IndexedDB в DevTools:
# - В dictionary ключи должны быть формата grc-*
# - Старые ключи (logos, freq-3056) должны мигрировать или получить _legacy: true
# - dictionary_migration_warnings должен содержать записи без safe mapping
# - progress.wordsToday.added не содержит старых legacy keys, если для них есть mapping
```

### Коммит

```bash
git add src/state/dictionary.js
git commit -m "feat(state): add IndexedDB dictionary key migration"
```

---

## Task 8: `vite.config.js` + `src/app.js` — PWA-кеширование новых путей

### Файлы

- `vite.config.js` — обновить Workbox runtime-кеширование и precache policy.
- `src/app.js` — добавить fail-soft cleanup старых data caches после регистрации service worker.

### Что изменить

1. **Не precache'ить тяжёлые data packs.**

Текущий `globPatterns: ['**/*.{js,css,html,woff2,svg,json}']` захватывает JSON,
поэтому новые `data/bibles/**`, `data/align/**`, `data/lexicon/**` должны быть
исключены через `globIgnores`, иначе production SW попробует precache'ить крупные
книги/alignments.

```js
workbox: {
  cleanupOutdatedCaches: true,
  globPatterns: ['**/*.{js,css,html,woff2,svg,json}'],
  globIgnores: [
    '**/data/originals/**',
    '**/data/translations/**',
    '**/data/align/**',
    '**/data/bibles/**',
    '**/data/lexicon/**'
  ],
  // ...
}
```

2. **Runtime cache для новых путей.**

```js
// В vite.config.js, в настройках vite-plugin-pwa:
workbox: {
  runtimeCaching: [
    {
      // Book packs and alignments are content-addressed by manifest version.
      urlPattern: /\/data\/(bibles|align)\/.*\.json(?:\?.*)?$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'book-packs-v2',
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
      }
    },
    {
      urlPattern: /\/data\/lexicon\/.*\.json(?:\?.*)?$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'lexicon-data-v2',
        expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 }
      }
    }
  ]
}
```

Удалить или заменить старое runtime-правило для `data/originals/`,
`data/translations/`, `data/align/syn--sblgnt-macula/`.

3. **Cleanup старых runtime caches.**

`cleanupOutdatedCaches` чистит старые Workbox precache buckets, но не гарантирует
удаление кастомных runtime caches `book-packs`/`lexicon-data`. После успешной
регистрации SW в `src/app.js` добавить fail-soft cleanup:

```js
async function cleanupOldDataCaches() {
  if (!('caches' in window)) return;
  const keep = new Set(['book-packs-v2', 'lexicon-data-v2']);
  const oldPrefixes = ['book-packs', 'lexicon-data'];
  const names = await caches.keys();
  await Promise.all(names.map(name => {
    const isOldDataCache = oldPrefixes.some(prefix => name === prefix || name.startsWith(`${prefix}-`));
    return isOldDataCache && !keep.has(name) ? caches.delete(name) : false;
  }));
}
```

Вызвать внутри `try/catch`; ошибка cleanup не должна ломать запуск приложения.

### Верификация

```bash
npm run build
# Проверить dist/sw.js:
# - нет precache entries для data/bibles/*.json и data/align/*.json
# - есть runtimeCaching для /data/bibles/, /data/align/, /data/lexicon/
# Ручной smoke: обновление с v1.0.x не оставляет приложение на старых data caches
```

### Коммит

```bash
git add vite.config.js src/app.js
git commit -m "fix(pwa): update Workbox caching for v2 data paths"
```

---

## Task 9: Обновление тестов

### Файлы

```
tests/form-layer.test.js   — обновить field names в фикстурах
tests/compose.test.js      — проверить field names
tests/lexicon.test.js      — проверить формат данных
tests/dictionary.test.js   — покрыть миграцию dictionary/progress keys
tests/frequency-data.test.js — перейти с top1000.core.json на core.json
tests/morphology.test.js   — проверить morph/morphs
tests/letter-layer.test.js — без изменений (работает с surface-формами)
```

### Что изменить в `tests/form-layer.test.js`

1. В тестовых фикстурах (строки 8-12): переименовать `lexemeKey` → `lexemeId`
   ```js
   // Было:
   { id: 'n41001001001', i: 1, s: 'Ἀρχὴ', lemma: 'ἀρχή', lexemeKey: 'arche', morph: 'N-NSF', ... }
   // Стало (добавить lexemeId, оставить lexemeKey для совместимости):
   { id: 'n41001001001', i: 1, s: 'Ἀρχὴ', lemma: 'ἀρχή', lexemeId: 'grc-arche-abc123', lexemeKey: 'arche', morph: 'N-NSF', ... }
   ```

2. В alignment-фикстурах (строки 25-28): добавить `lexemeId`
   ```js
   { span: [0, 6], tokenId: 'n41001001001', lexemeId: 'grc-arche-abc123', lexemeKey: 'arche', q: 'a', method: 'gloss-exact' }
   ```

3. В dictionary-фикстурах (строки 34-37): добавить `lexemeId`
   ```js
   { lexemeId: 'grc-arche-abc123', lexemeKey: 'arche', status: 'known', intensityPct: 100, forms: 'form' }
   ```

4. Обновить assertions: искать сначала по `lexemeId`, `lexemeKey` использовать
   только в compatibility cases.

### Что изменить в `tests/compose.test.js`

- Обновить JSDoc/fixtures: verse text теперь BSB/source text, не Synodal.
- В Greek token fixtures добавить `lexemeId`; старый `lexemeKey` оставить только
  там, где тестируется fallback.
- Alignment fixtures должны содержать `method` (`gloss-exact`, `manual`, etc.)
  и `q`; `q="u"`/`q="x"` не должны приводить к form-segment replacement.

### Что изменить в `tests/lexicon.test.js` и `tests/frequency-data.test.js`

- Старый путь `assets/data/lexicon/top1000.core.json` заменить на
  `assets/data/lexicon/core.json`.
- Проверять уникальность `lexemeId`, наличие `lexemeSlug`, `legacyKeys` без
  конфликтов, и что curated top1000 entries мапятся на существующий `lexemeId`.
- Locale overlay `locales/ru/top1000.json` остаётся source-data concern; runtime
  тесты не должны ожидать его в `assets/data/lexicon/`.

### Что добавить в `tests/dictionary.test.js`

- `migrateDictionaryData`:
  - переносит `lexemeKey`/`lexemeSlug` entry под `lexemeId`;
  - idempotent при повторном запуске;
  - conflict legacy keys не мапятся и дают warning;
  - unknown legacy entry остаётся с `_legacy: true`;
  - merge сохраняет сильнейший/fresher статус, `showInText:false` и ранний `addedAt`;
  - мигрирует `progress.wordsToday.added`.

### Что проверить в state/UI tests

- `countActiveWords(dict, coreLexicon, frequencyList)` должен индексировать
  `coreLexicon` по `lexemeId || id`, а не только по старому `id`.
- `frequencyList` fallback должен искать `lexemeId` первым, `lexemeKey` — только
  для compatibility fixtures.

### Запуск тестов

```bash
npm test
# Все тесты должны проходить
```

### Коммит

```bash
git add tests/
git commit -m "test: update test fixtures for v2 field names"
```

---

## Task 10: Строковый аудит

### Команда

```bash
rg -n "Синод|русск|ruHint|Synodal|syn--sblgnt|исходное русское|русско-греческ|bibles/syn|top1000\\.core" src tests
```

### Ожидаемые хиты и действия

| Хит | Действие |
|---|---|
| `Синодальный` в about.js | Заменён в Task 5 |
| `ruHint` в reading.js | Оставить как имя переменной или переименовать в `sourceHint` |
| `исходное русское слово` в word-card.js | Заменить на «исходное слово перевода» |
| `русско-греческое соответствие` в dictionary.js | Заменить на «проверенное соответствие в тексте» |
| `syn--sblgnt-macula` | Не должно остаться — все заменены в Tasks 1-4 |
| `bibles/syn` | Не должно остаться |
| `top1000.core` в runtime/tests | Не должно остаться, кроме source-data pipeline/docs |

Обязательные файлы аудита:
- `src/ui/screens/reading.js`
- `src/ui/screens/about.js`
- `src/ui/screens/dictionary.js`
- `src/ui/components/top-bar.js`
- `src/ui/components/mode-widget.js`
- `src/ui/components/word-card.js`
- `src/engine/compose.js`
- `src/engine/form-layer.js`
- `src/data/lexicon-loader.js`
- `tests/lexicon.test.js`
- `tests/frequency-data.test.js`

### Коммит

```bash
git add src/ui/components/word-card.js src/ui/components/top-bar.js src/ui/components/mode-widget.js src/ui/screens/dictionary.js
git commit -m "chore(ui): replace Russian-source wording with neutral wording"
```

---

## Task 11: End-to-end проверка

### Сборка

```bash
npm run build:data   # Генерация данных (если не коммитились)
npm run build        # Vite production build
```

### Проверки

- [ ] `npm test` — все тесты зелёные
- [ ] `npm run dev` — приложение открывается
- [ ] Навигация: все экраны (Чтение, Словарь, Прогресс, Настройки)
- [ ] 5 режимов чтения переключаются
- [ ] Греческие слова отображаются в режимах 3-5
- [ ] Тап по слову открывает word-card
- [ ] Словарь показывает список лемм
- [ ] Добавление слова в словарь работает
- [ ] Прогресс чтения сохраняется после перезагрузки
- [ ] Тёмная/светлая тема
- [ ] Режим офлайн (отключить сеть, перезагрузить)
- [ ] About screen показывает лицензии
- [ ] About screen видимо показывает BSB/SBLGNT/MACULA/Cherith attribution
- [ ] При битом/отсутствующем alignment приложение не падает и показывает BSB fallback
- [ ] IndexedDB migration не теряет dictionary/progress entries

### Production build

```bash
npm run build
npx vite preview
# Открыть http://localhost:4173, проверить основные экраны
```

---

## Task 12: Деплой

### Команда

```bash
npm run build
netlify deploy --prod --dir=dist
```

### Проверки после деплоя

- [ ] https://ru2gr.netlify.app открывается
- [ ] PWA: можно установить
- [ ] Service worker обновляется (старая версия → новая)
- [ ] IndexedDB: прогресс сохраняется после обновления

---

## Сводка коммитов (порядок выполнения)

```
 1. bible-loader.js      — новые пути
 2. lexicon-loader.js    — новый формат
 3. form-layer.js        — lexemeId предпочтение
 4. reading.js           — BSB вместо Синодального
 5. about.js             — лицензии
 6. render.js            — data-lexeme-id + compatibility key
 7. dictionary.js        — миграция ключей
 8. vite.config.js/app.js — PWA-кеширование и cleanup
 9. tests/               — обновление фикстур
10. UI wording           — нейтральный BSB/source wording
11. End-to-end проверка
12. Деплой
```

Коммиты 1-10 должны компилироваться и проходить unit-тесты. Полная ручная
проверка чтения требует уже сгенерированных v2 data packs из `IMPL-PIPELINE.md`.
