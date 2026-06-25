# IMPL-RUNTIME: Code Adaptation & Release

> **Фазы 2+3 миграции.** Адаптация runtime-кода под новые данные, миграция IndexedDB, PWA, деплой.
> **Предусловие:** `IMPL-PIPELINE.md` выполнен, `assets/data/` существует и verify зеленый.
> **Связанные документы:** `VISION.md` (контракты данных), `IMPL-PIPELINE.md` (форматы).

---

## Стратегия изменений

Меняем минимально необходимое. Ключевой принцип: **engine и UI не знают о формате source-data, они знают только app-ready формат.**

Поле `lexemeId` становится каноническим ключом во всех runtime-структурах. Там где код использует `lexemeKey` — добавляем fallback на `lexemeId`.

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

3. **Функция загрузки data-manifest:**
   - Путь: `data/data-manifest.json`
   - Использовать `manifest.version` для cache-busting: `?v=${manifest.version}`

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
   - Возвращает массив записей, где `id = lexemeSlug` для обратной совместимости с UI,
     но также присутствует `lexemeId`
   - Маппинг: `coreItem.lexemeKey = coreItem.lexemeSlug` (для старого кода)
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
{ lexemeKey: 'biblos', lexemeId: 'grc-biblos-9adfa6', lemma: 'βίβλος', ... }
// lexemeKey = lexemeSlug (для обратной совместимости)
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

## Task 3: `src/engine/form-layer.js` — `lexemeKey` → `lexemeId`

### Файл

`src/engine/form-layer.js` — адаптировать alignment-пары и dictionary-ключи.

### Что изменить (3 строки)

1. **Строка 89:** `const lexemeKey = pair.lexemeKey;` →
   ```js
   const lexemeKey = pair.lexemeId || pair.lexemeSlug || pair.lexemeKey;
   ```

2. **Строка 131-132:** в возвращаемом сегменте:
   ```js
   lexemeKey,           // оставить для обратной совместимости
   lexemeId: pair.lexemeId || pair.lexemeKey,  // канонический ключ
   ```

3. **Строка 173:** `const key = entry.lexemeKey || entry.lexemeId || entry.id;` →
   ```js
   const key = entry.lexemeId || entry.lexemeKey || entry.id;
   ```
   (приоритет: lexemeId первый)

### Коммит

```bash
git add src/engine/form-layer.js
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
   span.setAttribute('data-lexeme-key', token.lexemeId || token.lexemeSlug || token.lexemeKey || '');
   ```

4. **`coreByIdCache` (строки 602-603):**
   ```js
   coreByIdCache = new Map((coreLexicon || []).map(l => [l.lexemeId || l.id || l.lexemeKey, l]));
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
   const lexemeIdFromAttr = span.getAttribute('data-lexeme-key');
   // искать по lexemeId в dictionary
   ```

### Поиск и замена строк про Синодальный перевод

```bash
grep -n "Синодал\|русск.*текст\|ruHint\|Synodal\|bibles/syn" src/ui/screens/reading.js
```

Заменить:
- «Русский текст» → «Английский текст (BSB)»
- «Синодальный перевод» → «Berean Standard Bible»
- `ruHint` — оставить как имя переменной (это hint на ЯЗЫКЕ перевода, не обязательно русский)
- Или переименовать `ruHint` → `sourceHint`

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

## Task 6: `src/ui/render.js` — `data-lexeme-key` атрибут

### Файл

`src/ui/render.js` (строки 27-29) — обновить атрибут.

### Что изменить

```js
// Было:
span.setAttribute('data-lexeme-key', seg.lexemeKey || seg.lexemeId);

// Стало:
span.setAttribute('data-lexeme-key', seg.lexemeId || seg.lexemeKey);
```

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
1. После загрузки core.json:
   - Построить Map: legacyKey → lexemeId
     (из поля legacyKeys каждой записи core.json)
   - Сохранить как legacyKeyMap

2. Для каждой записи в IndexedDB store 'dictionary':
   - Если ключ уже является lexemeId (начинается с 'grc-') — пропустить
   - Если ключ найден в legacyKeyMap — переместить запись под новый ключ (lexemeId),
     старый ключ удалить
   - Если ключ НЕ найден в legacyKeyMap — оставить как есть,
     добавить флаг `_legacy: true`, записать предупреждение в `_migrationWarnings`

3. Для progress.wordsToday.added — та же логика

4. Сохранить обновлённый dictionary и wordsToday в IndexedDB

5. Миграция идемпотентна: при повторном запуске уже мигрированные записи не трогаются
```

### Реализация

```js
// В dictionary.js, после загрузки coreLexicon:

function buildLegacyKeyMap(coreLexicon) {
  const map = new Map();
  for (const item of coreLexicon) {
    const keys = item.legacyKeys || [];
    // Также добавить lexemeSlug как legacy-ключ
    if (item.lexemeSlug) keys.push(item.lexemeSlug);
    for (const k of keys) {
      if (!map.has(k)) map.set(k, item.lexemeId);
    }
  }
  return map;
}

async function migrateDictionaryKeys(db, legacyKeyMap) {
  const store = db.transaction('app_state', 'readwrite').objectStore('app_state');
  const dictReq = store.get('dictionary');
  const dict = (await promisify(dictReq)) || {};
  const warnings = [];

  for (const [key, entry] of Object.entries(dict)) {
    if (key.startsWith('grc-')) continue; // уже новый формат
    const newKey = legacyKeyMap.get(key);
    if (newKey && newKey !== key) {
      // Мержим: если оба ключа существуют
      if (dict[newKey]) {
        // strongest status wins
        const statusOrder = { known: 3, learning: 2, new: 1 };
        const keep = (statusOrder[dict[newKey].status] || 0) >= (statusOrder[entry.status] || 0)
          ? dict[newKey] : entry;
        dict[newKey] = keep;
      } else {
        dict[newKey] = entry;
      }
      delete dict[key];
    } else if (!newKey) {
      entry._legacy = true;
      warnings.push({ key, lexemeSlug: key, reason: 'no-mapping' });
    }
  }

  if (warnings.length > 0) {
    store.put({ _migrationWarnings: warnings }, '_migrationWarnings');
  }
  store.put(dict, 'dictionary');
}
```

### Верификация

```bash
# Открыть приложение, проверить IndexedDB в DevTools:
# - В dictionary ключи должны быть формата grc-*
# - Старые ключи (logos, freq-3056) должны мигрировать или получить _legacy: true
# - _migrationWarnings должен содержать записи без маппинга
```

### Коммит

```bash
git add src/state/dictionary.js
git commit -m "feat(state): add IndexedDB dictionary key migration"
```

---

## Task 8: `vite.config.js` — PWA-кеширование новых путей

### Файл

`vite.config.js` — обновить Workbox runtime-кеширование.

### Что изменить

Добавить правило для новых data-путей:

```js
// В vite.config.js, в настройках vite-plugin-pwa:
workbox: {
  runtimeCaching: [
    {
      urlPattern: /\/data\/(bibles|align|lexicon)\/.*\.json$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'book-packs-v2',
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
      }
    }
  ]
}
```

Удалить старые правила для `data/originals/`, `data/translations/`, `data/align/syn--sblgnt-macula/`.

### Верификация

```bash
npm run build
# Проверить сгенерированный sw.js: должен содержать кеширование для /data/bibles/
```

### Коммит

```bash
git add vite.config.js
git commit -m "fix(pwa): update Workbox caching for v2 data paths"
```

---

## Task 9: Обновление тестов

### Файлы

```
tests/form-layer.test.js   — обновить field names в фикстурах
tests/compose.test.js      — проверить field names
tests/lexicon.test.js      — проверить формат данных
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

4. Обновить assertions: `find(s => s.lexemeKey === 'euangelion')` → `find(s => s.lexemeKey === 'euangelion' || s.lexemeId === 'grc-euangelion-...')`

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
rg -n "Синод|русск|ruHint|Synodal|syn--sblgnt|исходное русское|bibles/syn" src tests
```

### Ожидаемые хиты и действия

| Хит | Действие |
|---|---|
| `Синодальный` в about.js | Заменён в Task 5 |
| `ruHint` в reading.js | Оставить как имя переменной или переименовать в `sourceHint` |
| `исходное русское слово` в word-card.js | Заменить на «исходное слово перевода» |
| `syn--sblgnt-macula` | Не должно остаться — все заменены в Tasks 1-4 |
| `bibles/syn` | Не должно остаться |

### Коммит

```bash
git add src/ui/components/word-card.js
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
 6. render.js            — data-lexeme-key
 7. dictionary.js        — миграция ключей
 8. vite.config.js       — PWA-кеширование
 9. tests/               — обновление фикстур
10. word-card.js         — нейтральный wording
11. End-to-end проверка
12. Деплой
```

Каждый коммит — независимый, с проходящими тестами.
