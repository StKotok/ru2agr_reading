# MACULA — операционный план реализации (чеклист)

**Date:** 2026-06-17
**Status:** к исполнению
**Архитектурный план:** `MACULA_migration_plan_v3.md` (источник правды о модели;
этот файл — операционка). При расхождении схем — v3 главнее, обнови оба.
**Правила кодинга:** `AGENTS.md` (обязательно).

---

## 0. Как пользоваться этим файлом

- Иди строго по шагам 0→4. Внутри шага — по чекбоксам сверху вниз.
- Каждый чекбокс — атомарное действие с проверяемым результатом.
- В конце каждого шага есть **ГЕЙТ** — не переходи дальше, пока он не зелёный.
- Снимай чекбокс только когда результат проверен (тест/валидатор/глаза), не «написал код».

### 0.1 Жёсткие правила (нарушение = переделка)

- [ ] Vanilla JS (ESM). **Никаких** фреймворков/стейт-менеджеров/линтеров/CI/Prettier
      без отдельного согласования (AGENTS.md). Тесты — только Vitest для чистых модулей.
- [ ] Пакетный менеджер — `npm`. Node 20+.
- [ ] Ключ леммы в `src/**` — **только `lexemeKey`**. Никогда `maculaLexemeId`,
      `strong`, `freq-*` как ключ в коде/IndexedDB.
- [ ] `strongs` — **всегда массив строк**. Никогда `Number(strong[0])`. Составные
      выражения (`5228+1537+4053`) сохраняются как есть.
- [ ] Рантайм **никогда** не сплитит `text` стиха и не пересчитывает offsets.
      Русский якорь приходит из сгенерированного `span:[start,end]`; движок режет
      исходный `verse.text` только через `slice()` и отдаёт промежутки как plain.
- [ ] `q="u"` (uncertain) **никогда** не показывается пользователю.
- [ ] Генерация **детерминирована**: повторный запуск при тех же входах → побайтово
      те же рантайм-файлы. Никаких `Date.now()`/`generatedAt` в рантайм-паках.
- [ ] **Никакой** миграции пользовательских данных/IndexedDB (greenfield, юзеров нет).
- [ ] Удаление legacy — **только** в Шаге 4, после зелёных гейтов Шагов 1–3.

### 0.2 Команды-гейты

```bash
npm test          # Vitest — после каждого изменения движка/стора/данных
npm run build     # перед «готово»/коммитом
npm run build:data # после изменений данных/пайплайна; ДОЛЖЕН работать офлайн
```

### 0.3 Антипаттерны (каждый — реальная ошибка из ревью, не повтори)

- [ ] НЕ удалять `assets/data/lexicon/core.json` до переноса в `docs/sources/locales/ru/core.json`.
- [ ] НЕ precache-ить book-packs (`originals/translations/align`) — только runtime caching.
- [ ] НЕ класть `hasAlignment` в нейтральное ядро `top1000.core.json`.
- [ ] НЕ хранить полный `refs[]` в ядре — только `firstRef`.
- [ ] НЕ моделировать 2Кор 11:33 как `grcOnly` — это `merged` (`syn:"11:32b", grc:"11:33"`).
- [ ] НЕ использовать индекс слова как якорь выравнивания — только `span:[start,end]`.
- [ ] НЕ оставлять в runtime-слое пунктуационные костыли (`TRAILING_PUNCT_RE`):
      токенизатор исключает внешнюю пунктуацию из `span`, а пунктуация остаётся
      plain-текстом между span'ами.
- [ ] НЕ тянуть Синодал из живого API в `build:data` — только из committed snapshot.
- [ ] НЕ забыть `assets/data/books.json`: source snapshot Синодала и runtime-manifest
      книг — разные артефакты; PWA продолжает грузить список книг из runtime assets.
- [ ] НЕ предполагать, что `src/ui/screens/reading.js` отсутствует — он есть (1041 стр.) и центральный.

---

## Шаг 0 — Ветка и baseline

- [ ] `git checkout -b feat/macula-v3` (от текущей `dev*`).
- [ ] Зафиксировать, что зелено сейчас: `npm test` и `npm run build` проходят. Записать результат.
- [ ] Зафиксировать текущие размеры: `du -sh assets/data/generated assets/data/bibles`.
- [ ] Создать заметку о baseline в PR-описании (не в коде).

**ГЕЙТ 0:** ветка создана, baseline зелёный и записан.

---

## Шаг 1 — Source snapshots, схемы, вынос canonical, vite

### 1.1 Source snapshots (committed, воспроизводимость)

- [ ] Создать `docs/sources/originals/macula-greek/` — снапшот используемых файлов
      SBLGNT из `docs/macula-greek/SBLGNT` (только то, что реально читает генератор).
- [ ] `docs/sources/originals/macula-greek/LICENSE.md` (CC BY 4.0) + `source-manifest.json`
      (схема §1.5 ниже): URL, commit/tag, SHA-256 по каждому используемому файлу, license, attribution.
- [ ] **Синодал:** запустить `scripts/build-syn.mjs` **один раз** только как
      snapshot-fetcher. Он сейчас пишет в `assets/data/bibles/syn/*` и
      `assets/data/books.json`; этот вывод нужно перенести/нормализовать в
      `docs/sources/translations/syn/` (committed snapshot) + `source-manifest.json`
      (URL bolls.life, дата, SHA-256). После этого `build:data` НЕ ходит в сеть.
- [ ] Зафиксировать, что runtime `assets/data/books.json` будет заново генерироваться
      из snapshot/manifest в Шаге 2.5, а не исчезнет вместе со старым `build-syn.mjs`
      output.
- [ ] **Курация RU:** скопировать `assets/data/lexicon/core.json` → `docs/sources/locales/ru/core.json`
      + `source-manifest.json` (origin = ручная курация, версия). **Старый файл пока НЕ удалять.**

### 1.2 Схемы (JSON-схемы или строгие доки)

Зафиксировать в `assets/data/schema/` (или `docs/`) по одной на каждый рантайм-формат.
Поля и типы — точно как ниже (совпадают с v3 §2):

- [ ] `original-book-v1`: `{schema, originalId, bookId, title, chapters:[{n:int, verses:[{ref, n:int, text, tokens:[{id, i:int(1-based), s, lemma, lexemeKey, maculaLexemeId, morph, strongs:string[], fw:bool}]}]}]}`
- [ ] `translation-book-v1`: `{schema, translationId, bookId, title, short, chapters:[{n, verses:[{ref, n, text, words:[{i:int, text, start:int, end:int}]}]}]}`
- [ ] `alignment-book-v1`: `{schema, alignmentId, translationId, originalId, bookId, verses:{ref:{syn, grc, status:"paired"|"synOnly"|"grcOnly"|"merged", variant?}}, pairsByRef:{ref:[{span:[int,int], tokenId, lexemeKey, q:"e"|"f"|"u", src}]}, phraseVariantsByRef:{ref:[{span:[int,int], variant, status:"synOnlyPhrase"|"grcOnlyPhrase"}]}}`
- [ ] `alignment-index-v1`: `{schema, alignmentId, lexemesWithVisiblePair:string[]}`
- [ ] `top1000-lexicon-core-v1`: `{schema, originalId, items:[{lexemeKey, maculaLexemeId, lemma, search, translit, strongs:string[], rank:int, count:int, verseCount:int, pos, isFunctionWord:bool, sourceGlosses:{en:string[]}, forms:[{s, count:int, morph:string[]}], firstRef, domains:string[]}]}` — **без** `hasAlignment`, **без** полного `refs[]`, **без** ru-полей.
- [ ] `top1000-locale-overlay-v1`: `{schema, localeId, items:[{lexemeKey, gloss, shortGloss, explanation, searchAliases:string[], examples:string[]}]}`
- [ ] `core-locale-overlay-v1`: `{schema, localeId, items:[{lexemeKey, pos, ruMatches:string[], ruExclude:string[], refs:string[]}]}`
- [ ] `data-manifest-v1`: см. v3 §2.2a (translations/originals/locales + `version`).

### 1.3 Source-manifest schema (§1.5)

- [ ] `source-manifest.json`: `{id, kind:"original"|"translation"|"locale", url, commitOrTag, files:[{path, sha256}], license, licenseTextPath, attribution, fetchedAt}`.

### 1.4 Вынос canonical из publicDir

- [ ] До первого финального `build:macula` принять решение по морфологии:
      runtime либо использует raw `morph` + `src/engine/morphology.js`, либо берёт
      готовый `morphology.labelRu` из canonical. Если выбран `labelRu`, чинить
      `scripts/macula/lib/morphology-decoder.mjs` **до** генерации canonical;
      если выбран raw `morph`, canonical `labelRu` не считается runtime-контрактом.
- [ ] Перенаправить выход `scripts/macula/build-macula.mjs` с `assets/data/generated/macula/`
      на `generated/canonical/sblgnt-macula/`.
- [ ] `.gitignore`: добавить `generated/canonical/**/tokens.jsonl`,
      `generated/canonical/**/lexemes.json`, `generated/canonical/**/verses.json`
      (большие, регенерируемые). Коммитим `source-manifest.json`, `build-report.json`, `audit-report.json`.
- [ ] Удалить старый каталог `assets/data/generated/` из рабочего дерева (после переноса).

### 1.5 vite.config.js (точные Workbox-правила)

- [ ] Удалить `runtimeCaching`-объект с `urlPattern: /\/data\/generated\/macula\/.*/`.
- [ ] Удалить из `globIgnores` строку `'**/data/generated/**'`.
- [ ] Добавить в `globIgnores`: `'**/data/originals/**'`, `'**/data/translations/**'`, `'**/data/align/**'`.
- [ ] Оставить в `globIgnores`: `'**/data/bibles/**'` (до удаления legacy в Шаге 4).
- [ ] Добавить `runtimeCaching` (StaleWhileRevalidate, как у `bible-data`) для
      `urlPattern: /\/data\/(originals|translations|align)\/.*/`.
- [ ] Проверить: precache-список после сборки = shell + `data-manifest.json` +
      `top1000.core.json` + `locale/ru/{top1000,core}.json` + `books.json` + `alphabet.json` + `textual-variants.json`.

**ГЕЙТ 1:**
- [ ] `npm run build:macula` пишет в `generated/canonical/`, `assets/` чист от 369 MB.
- [ ] `npm run build` зелёный; `dist/` НЕ содержит `tokens.jsonl`/`lexemes.json` (проверить `du -sh dist`).
- [ ] Схемы зафиксированы; ни одна рантайм-схема не использует `token.w`/single-`strong`/`freq-*`/`bibles/`.

---

## Шаг 2 — Рантайм-генераторы + перенос курации

### 2.1 `scripts/build-original-packs.mjs`

- [ ] Вход: `generated/canonical/sblgnt-macula/{tokens.jsonl|verses.json}`.
- [ ] Выход: `assets/data/originals/sblgnt-macula/books/{bookId}.json` (схема `original-book-v1`).
- [ ] Группировать плоские токены по `chapter`/`verse`; `text` стиха — из `verses.json`.
- [ ] `i` = `tokenIndex` (1-based, как в canonical). `strongs` = массив. `fw` = `isFunctionWord`.
- [ ] `lexemeKey` — из маппинга §2.3 (импортируй общий модуль ключей).
- [ ] Тест `scripts/macula/test/original-packs.test.mjs`: 27 книг валидны по схеме;
      `strongs` всегда массив; составной Strong сохранён; детерминизм.

### 2.2 Общий модуль ключей `scripts/macula/lib/lexeme-key.mjs` (алгоритм lexemeKey)

- [ ] Реализовать детерминированную функцию:
```
buildLexemeKeyMap(canonicalLexemes, curatedCoreEntries):
  map = {}
  # 1. курируемые: ключ = oldId (logos, theos, …), матч с MACULA-леммой по strong (+проверка lemma)
  for c in curatedCoreEntries:
      lex = findLexemeByStrong(canonical, c.strong)   # ассерт: найдено; иначе → report
      map[lex.maculaLexemeId] = c.id
  # 2. некурируемые: translit, при коллизии — translit + '-' + hashTail(maculaLexemeId)
  seen = {}
  for lex in canonical sorted by rank:
      if lex.maculaLexemeId in map: continue
      base = lex.transliteration
      key = base if base not in seen else base + '-' + shortHash(lex.maculaLexemeId)
      assert key not in usedKeys   # глобальная уникальность
      map[lex.maculaLexemeId] = key; seen[base]=true; usedKeys.add(key)
  return map
```
- [ ] `shortHash` — короткий хвост из `maculaLexemeId` (он уже `grc-<translit>-<hash6>`; взять `<hash6>` или его префикс). **НЕ** `-{n}` по rank.
- [ ] Ассерт глобальной уникальности; список коллизий (ожидается 10 групп) — в `build-report`.
- [ ] Тест: 10 известных групп (`ou`,`tis`,`ara`,`pou`,`pōs`,`pote`,`Silas`,`Solomōn`,`syniēmi`,`pharmakos`) получают суффикс; курируемые ключи (`logos`/`theos`/`kurios`) сохранены.

### 2.3 `scripts/build-lexicon-core.mjs`

- [ ] Вход: `generated/canonical/sblgnt-macula/frequency.json` (+ lexemes, forms).
- [ ] Выход: `assets/data/lexicon/top1000.core.json` (схема `top1000-lexicon-core-v1`).
- [ ] Top-1000 по `rank`. Поля: `lexemeKey`(из 2.2), `maculaLexemeId`, `lemma`, `search`, `translit`, `strongs[]`, `rank`, `count`, `verseCount`, `pos`, `isFunctionWord`, `sourceGlosses.en`(=`glossesEn`), `forms[]`, `firstRef`, `domains[]`.
- [ ] **Запрещено** добавлять `hasAlignment`, полный `refs[]`, любые ru-поля.
- [ ] Тест: 1000 записей; нет ru-полей; нет `hasAlignment`; каждый `lexemeKey` уникален и присутствует.

### 2.4 `scripts/build-locale-ru.mjs` (перенос курации, point 3)

- [ ] Вход: `docs/sources/locales/ru/core.json` (НЕ из `assets/`).
- [ ] Выход: `assets/data/lexicon/locales/ru/top1000.json` (`top1000-locale-overlay-v1`)
      и `assets/data/lexicon/locales/ru/core.json` (`core-locale-overlay-v1`).
- [ ] Перенос полей по `lexemeKey`: `gloss→gloss/shortGloss`, `pos→pos`,
      `ruMatches→ruMatches`, `ruExclude→ruExclude`, `refs→refs/examples`.
- [ ] **Запрещено** протаскивать `ruMatches`/любую ru-копию в `top1000.core.json`.
- [ ] Тест: 204 курируемых `lexemeKey` присутствуют в overlay; join ядро↔overlay по `lexemeKey` бьётся; `logos`/`theos`/`kurios` живы.

### 2.5 `scripts/build-syn-packs.mjs`

- [ ] Вход: `docs/sources/translations/syn/` (committed snapshot).
- [ ] Выход: `assets/data/translations/syn/books/{bookId}.json` (`translation-book-v1`)
      + runtime `assets/data/books.json` (список книг для текущего UI/loader'ов).
- [ ] `words[]` — объекты `{i, text, start, end}`; `start`/`end` — символьные offsets в `text`.
- [ ] Токенизатор — **один общий модуль** (`scripts/macula/lib/ru-tokenizer.mjs`), тот же,
      что использует генератор выравнивания (Шаг 3). Заморозить — рантайм его не вызывает.
- [ ] Тест: 27 книг валидны; для каждого `word`: `text === verseText.slice(start,end)`; детерминизм.
- [ ] Тест: `assets/data/books.json` создан из snapshot, содержит 27 книг, и `src/data/bible-loader.js`
      может продолжать читать список книг без legacy `assets/data/bibles/**`.

### 2.6 package.json scripts

- [ ] Обновить как в v3 §3 (`build:macula`/`build:runtime`/`build:align`/`build:data`/`verify:data`).

**ГЕЙТ 2:**
- [ ] `npm run build:runtime` зелёный; 27×(original+translation) валидны.
- [ ] `top1000.core.json` нейтрален; `locale/ru/*` перенесён (204 ключа); 10 коллизий разрешены.
- [ ] Детерминизм: повторный `build:runtime` → нет diff (`git status` чист по сгенерированным).
- [ ] `npm test` зелёный.

---

## Шаг 3 — Перегенерация выравнивания + гейты

### 3.1 `scripts/macula/lib/ru-tokenizer.mjs` (общий, см. 2.5)

- [ ] Токенизатор работает по исходной строке и возвращает только lexical word span:
      внешняя пунктуация/кавычки/скобки остаются вне `span`; регистр букв сохраняется.
- [ ] Не использовать runtime-подход `text.split(/\s+/)` как контракт. Можно брать идеи
      из старого `cleanRuWord`, но результатом должны быть точные offsets.
- [ ] Возвращает `[{i, text, start, end}]`, где `text === verseText.slice(start,end)`.
      Тесты на крайних случаях: «Его», «его.», «нею?», «"слово,"», скобки, дефисы.

### 3.2 `scripts/build-alignment.mjs`

- [ ] Вход: translation-packs (`words` с offsets), original-packs (`tokenId`,`strongs`),
      `docs/sources/locales/ru/core.json` (`ruMatches`/`ruExclude`), `assets/data/textual-variants.json`.
- [ ] Выход: `assets/data/align/syn--sblgnt-macula/books/{bookId}.json` (`alignment-book-v1`)
      + `assets/data/align/syn--sblgnt-macula/index.json` (`alignment-index-v1`).
- [ ] **`verses` (verse-level):** заполнить из реестра версификации:
      synOnly (17 стихов, список в v3 §2.5/3a), grcOnly (Откр 12:18),
      merged (2Кор 11:33 → `{syn:"11:32b", grc:"11:33", status:"merged"}`).
- [ ] **`phraseVariantsByRef` (phrase-level):** из `textual-variants.json.synOnlyPhrases`
      (Comma Johanneum 1Ин 5:7, Мф 6:13b, Деян 9:5 …) — `span` русского текста + `variant`.
- [ ] **Пары:** для каждого `word` применить `ruMatches` → кандидат `lexemeKey`; найти
      greek `tokenId` в стихе с тем же `lexemeKey` (и Strong-intersection как
      дополнительную проверку там, где `ruMatches` пришёл из Strong-курации);
      якорь русского — `span:[word.start, word.end]`.
- [ ] **Монотонное потребление повторов:** для каждого `(ref, lexemeKey)` держать cursor
      по кандидатным Greek token'ам, аналог старого `strongUsage`. Никогда не брать
      первый найденный token повторно. Если порядок/количество повторов неоднозначны —
      пара уходит в `q:"u"`, а не в видимый `e`/`f`.
- [ ] Fixture-тест: стих с повторяющимся Strong/lexemeKey (минимум Ин 1:1) связывает
      первое русское вхождение с первым Greek token, второе — со вторым, и не создаёт
      дублей на один `tokenId`.
- [ ] **Строгий порог (precision):** Strong-матч + `ruMatches` (+согласование падеж/число/род
      где доступно из morph) → `q:"e"`; функциональное → `q:"f"`; всё иное/неоднозначное → `q:"u"`.
- [ ] `index.json`: `lexemesWithVisiblePair` = леммы с ≥1 видимой (`e`/`f`) парой.

### 3.3 `scripts/verify-data.mjs` (инварианты — ГЕЙТ-валидатор)

- [ ] Схема-валидация всех рантайм-паков.
- [ ] Каждый `pair.tokenId` существует в соответствующем original-pack.
- [ ] Каждый `pair.span` в границах `text` и совпадает с offsets `words[]`.
- [ ] Нет дублей видимых пар (`e`/`f`) на один `tokenId`/один `span` в стихе.
- [ ] Каждый orphan (русское слово без видимой пары) объясним: либо synOnly/merged verse,
      либо попадает в `phraseVariantsByRef`, либо служебное — иначе **FAIL** (нарушение «100 % explained»).
- [ ] Детерминизм: повторный `build:align` → нет diff.
- [ ] SHA из `source-manifest.json` совпадает с фактическими снапшотами.

### 3.4 Held-out precision-аудит

- [ ] Сформировать held-out выборку видимых пар (`e`+`f`), проверить вручную/слепо.
- [ ] **Гейт:** 0 подтверждённых ошибок. Найденная ошибка → ужесточить порог (пара → `u`),
      перегенерировать, повторить. (Recall НЕ гейт — не блокирует.)
- [ ] Отчёт в `generated/canonical/alignments/syn--sblgnt-macula/{audit,gold}-report.json` (коммит).

**ГЕЙТ 3:**
- [ ] `npm run build:align && npm run verify:data` зелёные.
- [ ] Нет out-of-bounds `span`/несуществующих `tokenId`/дублей видимых пар.
- [ ] Каждый orphan explained; held-out без подтверждённых ошибок.

---

## Шаг 4 — Код (загрузчики/движок/UI/PWA) + удаление legacy

> Внимание: `src/ui/screens/reading.js` — 1041 строка, главный объём. Раньше
> alignment лежал inline в syn-стихе (`verse.alignment`); теперь это отдельный pack.

### 4.1 Загрузчики

- [ ] `src/data/bible-loader.js`: `loadBook('grc'|'syn', bookId)` → новые пути
      `originals/sblgnt-macula/books/*` и `translations/syn/books/*`; добавить
      `loadAlignment(bookId)` → `align/syn--sblgnt-macula/books/*`. Метаданные — из `data-manifest.json`.
- [ ] `src/data/lexicon-loader.js`: грузить `top1000.core.json` + `locale/ru/{top1000,core}.json`,
      join по `lexemeKey`; fallback на `sourceGlosses.en` (+translit) при отсутствии ru-глосса;
      читать `align/.../index.json` для «есть подсветка».

### 4.2 Движок (Vitest-покрытие обязательно)

- [ ] `src/engine/form-layer.js` / `compose.js`: нативные поля `s`/`morph`/`strongs`/`lexemeKey`/`tokenId`;
      пары по `tokenId`; позиция русского слова — по `span`; `q="u"` не показывать никогда.
- [ ] Переписать `applyFormLayer` с парадигмы `verseText.split(/\s+/)` на cursor/slice:
      `plain = text.slice(cursor, span.start)`, интерактивное слово = `text.slice(span.start, span.end)`,
      после последней пары — plain-хвост. Всё между span'ами (пробелы, пунктуация,
      невыровненные слова, variant phrase) остаётся plain.
- [ ] Полностью убрать из runtime `TRAILING_PUNCT_RE`/ручное отделение пунктуации:
      внешний знак препинания не входит в `span`, поэтому не должен попадать в
      интерактивный `Segment`.
- [ ] Словарный lookup в движке — только по `lexemeKey` (`dictByLexemeKey`), не
      `dictByStrong`. `strongs[]` остаётся данными для карточки/проверок/provenance,
      но не ключом замены.
- [ ] `src/engine/morphology.js`: если runtime выбран raw `morph`, проверить поддержку
      MACULA-кодов и добавить тесты; если runtime выбран canonical `labelRu`, заменить
      потребление карточки осознанно, после исправления decoder в Шаге 1.
- [ ] Тесты: `strongs`-массивы; составной Strong (`5228+1537+4053`); нет alignment;
      `q=u` скрыт; парсинг morph; join `lexemeKey`; lookup не использует Strong;
      пунктуация вокруг span остаётся plain; fallback EN-глосс; missing overlay не роняет рендер.

### 4.3 UI

- [ ] `src/ui/screens/reading.js`: переключить `loadBook`/alignment/lexeme-key; `verse.alignment` → `loadAlignment(bookId)` прокинуть в `composeVerse`.
- [ ] `src/ui/render.js`: `data-*` и сбор слова из DOM → `lexemeKey`/`tokenId`/`s`.
- [ ] `src/ui/screens/dictionary.js`, `src/ui/components/word-card.js`, `inspector.js`, `mode-widget.js`: ключ = `lexemeKey`; источник глосса = overlay→EN-fallback.
- [ ] `word-card.js` сейчас использует `formatMorphShort/formatMorphFull`, а не
      `morphology.labelRu`. Не вносить фиктивную зависимость от `labelRu`; менять
      карточку только если в Шаге 1 осознанно выбран canonical `labelRu` как runtime
      источник морфологических подписей.
- [ ] `src/state/dictionary.js`, `src/storage/db.js`: ключ словаря = `lexemeKey` (без миграции).

### 4.4 Деградация (fail-soft)

- [ ] Нет alignment/original → режимы 3–5 падают до букв/plain; перевод и словарь top-1000 работают.

### 4.5 Удаление legacy (ТОЛЬКО после зелёных ГЕЙТ 1–3 и ручной QA)

Удалить:
- [ ] `scripts/apply-zefania-alignments.mjs`, `scripts/convert-alignments.js`,
      `scripts/refine-alignments.mjs`, `scripts/parse-zefania-strongs.mjs`,
      `scripts/build-frequency.mjs` (после переноса логики), `scripts/verify-alignments.mjs`.
- [ ] `assets/data/bibles/**`, `assets/data/rus_nt_strongs.xml`,
      старые `assets/data/lexicon/{core,frequency}.json`.
- [ ] `docs/clear-bible-alignments/`, `docs/greek-nt-frequency-sources/`.
- [ ] В `vite.config.js` убрать `'**/data/bibles/**'` из `globIgnores` и `bible-data` runtimeCaching.

Проверить использование перед удалением (НЕ удалять вслепую):
- [ ] `scripts/lib/text-utils.js`, `scripts/lib/greek-translit.mjs` — `grep -r` по репо; удалить, только если нет потребителей.
- [ ] `scripts/build-syn.mjs` — **оставить** (нужен для пере-создания snapshot).
- [ ] `scripts/build-variants-registry.mjs` — **оставить** (генерит `textual-variants.json`).
- [ ] `scripts/*.py`, `scripts/analyze-coverage.mjs`, `scripts/build-syn.mjs` — оценить, архивировать/оставить.

### 4.6 Ручная QA

- [ ] Ширины/темы: 375 light, 375 dark, 1280 light, 1280 dark.
- [ ] Флоу: режим 1; режим 2; режим 3 (lemma replace); режим 4 (real form); режим 5 (греч.);
      словарь top-1000 офлайн ДО открытия книги; словарь с ru-overlay офлайн; карточка из текста;
      карточка из словаря; перезагрузка офлайн.
- [ ] Spot-check выравнивания: Ин 1:1, Мф 1:1, Деян 8:39, 1Ин 5:7 (Comma — слова explained, не подставляются).

**ГЕЙТ 4 (финальный):**
- [ ] Режимы 1–5 на новых паках; `u` не показывается; режим 3/4 только `e`(/`f`).
- [ ] Словарь top-1000 офлайн до открытия книги; EN-fallback виден для некурированных.
- [ ] `lexemeKey` — ключ везде в `src/**`.
- [ ] `npm test` + `npm run build` + `npm run build:data` (офлайн!) зелёные.
- [ ] `dist/` без больших canonical и без book-packs в precache; ручная QA пройдена.
- [ ] Legacy удалён; `grep -r "bibles/\|freq-\|token.w\|rus_nt_strongs"` по `src/` пуст.

---

## Карта «файл → что делает» (быстрый справочник)

| Скрипт | Вход | Выход |
|---|---|---|
| `build-macula.mjs` (есть) | `docs/sources/.../SBLGNT` | `generated/canonical/sblgnt-macula/*` |
| `lib/lexeme-key.mjs` (нов.) | canonical lexemes + curated core | `maculaLexemeId → lexemeKey` map |
| `build-original-packs.mjs` (нов.) | canonical tokens/verses | `assets/data/originals/.../books/*` |
| `build-lexicon-core.mjs` (нов.) | canonical frequency/forms | `assets/data/lexicon/top1000.core.json` |
| `build-locale-ru.mjs` (нов.) | `docs/sources/locales/ru/core.json` | `assets/data/lexicon/locales/ru/*` |
| `lib/ru-tokenizer.mjs` (нов.) | — | общий токенайзер (offsets) |
| `build-syn-packs.mjs` (нов.) | `docs/sources/translations/syn` | `assets/data/translations/syn/books/*` |
| `build-alignment.mjs` (нов.) | packs + ruMatches + variants | `assets/data/align/.../books/*` + `index.json` |
| `verify-data.mjs` (нов.) | все рантайм-паки | pass/fail (инварианты) |

---

## Commit breakdown (как в v3 §9)

1. `docs: MACULA plan v3 + implementation checklist`
2. `build: source snapshots + manifests (macula, syn, ru-core)`
3. `build: define runtime schemas; move canonical out of assets; vite workbox rules`
4. `build: original packs + lexemeKey module`
5. `build: top1000 core + ru locale overlays`
6. `build: syn translation packs (frozen words+offsets)`
7. `build: syn--sblgnt-macula alignment (tokenId+span) + index + verify-data`
8. `test: data/engine/lexicon/alignment gates`
9. `feat: loaders for original/translation/alignment/locale + data-manifest`
10. `feat: reading.js/render/dictionary on lexemeKey/tokenId/span`
11. `feat: workbox precache core+locale, runtime-cache book packs`
12. `chore: remove legacy pipeline, sources, runtime paths`

Cleanup (12) — последним.
