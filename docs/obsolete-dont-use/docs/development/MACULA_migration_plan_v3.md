# MACULA Plan v3 — финальный план реализации (greenfield)

**Date:** 2026-06-17
**Status:** Final — к реализации
**Supersedes:** `MACULA_migration_plan_v2.md`
**Основан на:** `MACULA_migration_plan_v2_feedback2.md` + подтверждённые решения
заказчика (17.06.2026)
**Связанные:** `ALIGNMENT.md` (мета-метод выравнивания), `DEVELOPMENT_7.md`
(отдельный трек качества выравнивания), `assets/data/textual-variants.json`
(реестр вариантов, уже существует)

---

## 0. Принцип: это не миграция, а проектирование с нуля

Пользователей нет — переносить нечего, откатываться не для кого. Поэтому **из v2
выкинуто** как нерелевантное:

- §4.2 «old alignment как oracle», §4.6 compatibility bridges;
- Phase 0 baseline-для-отката, **Phase 5 user dictionary migration**
  (`freq-*`→`lexemeKey`, IndexedDB schema migration), §13 Rollback;
- §2.1 «preserve user progress»;
- поэтапное «не удалять legacy до прохождения гейтов» — удаляем сразу.

**Но** «нет пользователей» ≠ «нет данных». Беречь нужно **ручную русскую
курацию**: `assets/data/lexicon/core.json` — 204 леммы (`ruMatches`,
`ruExclude`, глоссы, `refs`). MACULA её не заменяет.

Что наследуется из v2 без изменений: разделение слоёв
source/canonical/runtime/user, `lexemeKey` как app-ключ, `localeId` ≠
`translationId`, source-манифесты с SHA-256, fail-closed `q∈{e,f,u}`, cleanup
последним.

---

## 1. Подтверждённые решения

| # | Вопрос | Решение |
|---|---|---|
| 1 | Русская курация (204 в `core.json`) | **Перенести дословно + дополнить.** Механический перенос полей по `lexemeKey` в `locale/ru/*`; пересборка с нуля запрещена (выверенные `ruMatches` — дорогой актив). Покрытие глоссов расширяем вверх по частоте отдельной задачей. |
| 2 | Выравнивание при переходе на MACULA | **Перегенерировать тем же алгоритмом (Strong+`ruMatches`) против MACULA `tokenId`.** Цель — **100 % precision** (coverage НЕ требуется). Гарантия: строгий fail-closed порог показа; измерение — held-out precision-аудит; orphan'ы — «explained» через реестр вариантов. Улучшение recall — отдельный трек (`DEVELOPMENT_7.md`), не блокирует выпуск. |
| 3 | ~800 из top-1000 без русского глосса | **EN-глосс MACULA как fallback** в нейтральном ядре (`sourceGlosses.en`), помечен как некурированный, рядом — транслитерация. Авто-RU — опциональный поздний трек. |
| 4 | Future-proof (BSB/мультилокаль) | **Id-поля в схемах оставить** (`translationId`/`originalId`/`alignmentId`/`localeId`). **Деревья BSB/en и растущие реестры НЕ создавать.** Метаданные/лицензии — в source-manifests (build-time) + **один минимальный рантайм `data-manifest.json`** (активные translation/original/locale + версия данных), см. §2.2a (Вариант A). |

**Зафиксировано про «100 %» (release gate, НЕ «структурная гарантия»):** цель —
**0 подтверждённых ошибок на held-out выборке при скрытии всего неуверенного**.
fail-closed (строгий порог показа + `q=u` скрыт) *снижает* риск, но не
*доказывает* отсутствие ошибок: `ruMatches`, Strong и морфо-эвристики сами могут
ошибаться (пара проходит порог и всё равно неверна — омограф, ложный Strong).
Поэтому 100 % precision — это **гейт выпуска**, измеримый лишь как верхняя
граница на всех ~100k парах. При находке редкой ошибки реакция — ужесточить
порог (пара → `q=u`), а не считать цель проваленной.

---

## 2. Целевая модель данных (финальные схемы)

### 2.1 Идентификаторы

- **`originalId`** = `sblgnt-macula`. Новый греческий источник (TR и т. п.) —
  отдельный id, не перезапись.
- **`translationId`** = `syn`. (BSB — позже, поле остаётся.)
- **`alignmentId`** = `{translationId}--{originalId}` = `syn--sblgnt-macula`.
- **`localeId`** = `ru`. Управляет языком словаря/карточек, не текстом Библии.
- **`ref`** = `bookId chapter:verse` (канонический app-ref, напр. `john 1:1`).
- **`tokenId`** = стабильный ID токена MACULA (напр. `n43001001005`). **Единственный
  якорь греческой стороны выравнивания.**
- **`maculaLexemeId`** = MACULA-хеш леммы (`grc-logos-04b1f3`) — только provenance,
  не ключ в коде.
- **`lexemeKey`** — единственный app-ключ леммы (словарь, движок, UI, IndexedDB).

**Схема `lexemeKey` (решена окончательно):**

1. **Курируемые (204):** сохраняют существующий человекочитаемый ключ
   (`logos`, `theos`, `kurios`, …) — берётся из текущего `core.json[].id`.
2. **Некурируемые:** `lexemeKey = translit` (поле `transliteration` генератора),
   если транслитерация уникальна. **При коллизии — суффикс `-<hash>`** (короткий
   хвост из `maculaLexemeId`), НЕ `-{n}` по rank: rank нестабилен при пересчёте
   частот, хеш детерминирован. Коллизий ровно **10 групп** (проверено по
   `lexemes.json`): `ou`={οὐ,οὔ}, `tis`={τίς,τις}, `ara`={ἄρα,ἆρα,ἀρά}, `pou`,
   `pōs`, `pote`, `Silas`, `Solomōn`, `syniēmi`, `pharmakos`. Генератор **обязан**
   ассертить глобальную уникальность `lexemeKey` и печатать коллизии в
   `build-report`.

Правило использования (обязательное): в `src/engine/**`, `src/ui/**`,
`src/state/**`, `src/storage/**` ключ леммы — **только `lexemeKey`**.
`maculaLexemeId` живёт исключительно в данных; `strongs` — только внутри
генерации выравнивания.

### 2.2 Физическая раскладка

`assets/` — Vite `publicDir`: **всё** копируется в `dist/`. Сейчас в
`assets/data/generated/macula` лежит **369 MB**, и для него есть
`runtimeCaching` (`vite.config.js`). Это уезжает в `dist/`.

Целевое разделение:

```text
docs/sources/                   # committed source snapshots (вне runtime; point 3/4)
├── originals/macula-greek/SBLGNT/      # снапшот + LICENSE.md + source-manifest.json
├── translations/syn/                   # committed Synodal snapshot + source-manifest.json
└── locales/ru/core.json                # ИСТОЧНИК ручной курации (см. §2.8)

generated/                      # ВНЕ publicDir → не попадает в dist
└── canonical/                  # промежуточный/аудит-слой
    ├── sblgnt-macula/
    │   ├── tokens.jsonl        # gitignore (регенерируемо)
    │   ├── lexemes.json        # gitignore
    │   ├── verses.json         # gitignore
    │   ├── source-manifest.json    # коммитим
    │   ├── build-report.json        # коммитим (агрегаты, < 100 KB)
    │   └── audit-report.json        # коммитим
    └── alignments/syn--sblgnt-macula/
        ├── audit-report.json        # коммитим
        └── gold-report.json         # коммитим

assets/data/                    # рантайм, коммитим, компактно
├── books.json                  # список книг (есть)
├── data-manifest.json          # активные translation/original/locale + версия данных (§2.2a)
├── alphabet.json               # (есть)
├── textual-variants.json       # реестр вариантов (есть)
├── originals/sblgnt-macula/books/{bookId}.json
├── translations/syn/books/{bookId}.json
├── align/syn--sblgnt-macula/
│   ├── books/{bookId}.json
│   └── index.json              # производный индекс (hasAlignment и пр.)
└── lexicon/
    ├── top1000.core.json       # нейтральное ядро
    └── locales/ru/
        ├── top1000.json        # глоссы (overlay)
        └── core.json           # match-rules (overlay)
```

Действия: вынести canonical из `assets/`; в `vite.config.js` **удалить**
`runtimeCaching` `/data/generated/macula/` и `globIgnores '**/data/generated/**'`,
но **добавить** `globIgnores` для book-packs (`originals/`, `translations/`,
`align/`) — иначе они уедут в precache (см. §6, point 2); `generated/` (кроме
report/manifest) — в `.gitignore`.

#### 2.2a Рантайм-метадата: один `data-manifest.json` (решение 4 / Вариант A)

Растущие реестры `translations.json`/`originals.json`/`locales.json` (v2 §7.2–7.4)
и деревья BSB/en — **не создаём**. Вместо них **один** маленький файл
`assets/data/data-manifest.json` (precache), который генератор **выпускает**
(не пишется руками):

```json
{
  "schema": "data-manifest-v1",
  "version": "sha-<hash входов>",
  "translations": [{ "id": "syn", "title": "Синодальный перевод", "short": "Синод.",
                     "defaultOriginalId": "sblgnt-macula", "versification": "synodal-nt",
                     "license": "Public domain", "sourceManifestId": "syn-2026-06-17" }],
  "originals":    [{ "id": "sblgnt-macula", "title": "SBLGNT via MACULA", "language": "grc",
                     "license": "CC BY 4.0", "attribution": "MACULA Greek; CC BY 4.0",
                     "sourceManifestId": "macula-greek-2026-06-17" }],
  "locales":      [{ "id": "ru", "title": "Русский", "defaultTranslationId": "syn",
                     "sourceManifestId": "locale-ru-2026-06-17" }]
}
```

Зачем файл, а не константы: (1) `version` считается из хешей входов → авто-бамп
для инвалидации PWA-кэша (ручная константа ошибкоопасна); (2) лицензия/атрибуция
для экрана About трассируются к source-manifests, которые лежат в
`generated/canonical/` вне runtime и приложению напрямую недоступны. Это **не**
скаффолдинг под мультиперевод — одиночные записи, без BSB/en-деревьев.

### 2.3 Original pack — `assets/data/originals/sblgnt-macula/books/{bookId}.json`

Компактная проекция canonical-токенов в nested-структуру (canonical хранит
плоский массив — нужен шаг группировки по главам/стихам через
`verse-reconstructor`/`verses.json`).

```json
{
  "schema": "original-book-v1",
  "originalId": "sblgnt-macula",
  "bookId": "john",
  "title": "ΚΑΤΑ ΙΩΑΝΝΗΝ",
  "chapters": [{
    "n": 1,
    "verses": [{
      "ref": "john 1:1", "n": 1,
      "text": "Ἐν ἀρχῇ ἦν ὁ λόγος...",
      "tokens": [{
        "id": "n43001001001", "i": 1, "s": "Ἐν",
        "lemma": "ἐν", "lexemeKey": "en", "maculaLexemeId": "grc-en-b54dde",
        "morph": "PREP", "strongs": ["1722"], "fw": true
      }]
    }]
  }]
}
```

- `i` — индекс токена в стихе, **1-based** (генератор уже даёт `tokenIndex:1`;
  хедж v2 «if 1-based» убран — зафиксировано).
- `strongs` — **всегда массив**. Составные выражения (`5228+1537+4053`, 5 шт. в
  корпусе) сохраняются как есть, не коэрсятся в число.
- `fw` = function word (из `isFunctionWord`).

### 2.4 Translation pack — `assets/data/translations/syn/books/{bookId}.json`

```json
{
  "schema": "translation-book-v1",
  "translationId": "syn",
  "bookId": "john",
  "title": "От Иоанна святое благовествование",
  "short": "Ин",
  "chapters": [{
    "n": 1,
    "verses": [{
      "ref": "john 1:1", "n": 1,
      "text": "В начале было Слово...",
      "words": [
        { "i": 0, "text": "В", "start": 0, "end": 1 },
        { "i": 1, "text": "начале", "start": 2, "end": 8 }
      ]
    }]
  }]
}
```

- `words[]` — **замороженный авторитет** из объектов `{ i, text, start, end }`
  (`start`/`end` — символьные offsets в `text`). Коммитится; runtime **никогда не
  сплитит `text` заново** и не пересчитывает offsets (опция v2 «regenerate at
  runtime» удалена — это и был источник хрупкости индексов). Токенизация одна,
  общая с генератором выравнивания. Замороженные offsets позволяют движку делать
  замену по символьному диапазону (см. §2.5, якорь `span`).

### 2.5 Alignment pack — `assets/data/align/syn--sblgnt-macula/books/{bookId}.json`

```json
{
  "schema": "alignment-book-v1",
  "alignmentId": "syn--sblgnt-macula",
  "translationId": "syn",
  "originalId": "sblgnt-macula",
  "bookId": "john",
  "verses": {
    "john 1:1": { "syn": "1:1", "grc": "1:1", "status": "paired" }
  },
  "pairsByRef": {
    "john 1:1": [
      { "span": [13, 18], "tokenId": "n43001001005", "lexemeKey": "logos", "q": "e", "src": "strong" }
    ]
  },
  "phraseVariantsByRef": {
    "1john 5:7": [
      { "span": [40, 95], "variant": "comma-johanneum", "status": "synOnlyPhrase" }
    ]
  }
}
```

Три изменения против v2 §7.7 (обязательные):

1. **Греческий якорь — только `tokenId`.** Поле-индекс `g` удалено (устраняет
   дублирование «индекс vs id»).
2. **Русский якорь — `span: [start, end]`** (символьный диапазон в `text`,
   совпадает с замороженными offsets из `words[]`, §2.4), НЕ индекс слова. Runtime
   опирается на замороженные offsets и не сплитит строку — устраняет хрупкость
   индекса к токенизатору.
3. **Два уровня correspondence** (verse-level + phrase-level). Без phrase-level
   orphan ВНУТРИ paired-стиха остался бы необъяснённым, ломая «100 % explained»:

   **3a. `verses` — verse-level:**
   - `status: "paired"` — стих есть с обеих сторон;
   - `status: "synOnly"` (`grc: null`) — целый TR-плюс-стих без греч. соответствия
     (Мф 17:21; 18:11; 23:14; Мк 7:16; 9:44,46; 11:26; 15:28; Лк 17:36; 23:17;
     Ин 5:4; Деян 8:37; 15:34; 24:7; 28:29; Рим 14:24–26);
   - `status: "grcOnly"` (`syn: null`) — **Откр 12:18** (целый греч. стих без syn);
   - `status: "merged"` — **2Кор 11:33** (греч. отдельный стих, в syn слит в 11:32):
     `{ "syn": "11:32b", "grc": "11:33", "status": "merged" }`. **Не `grcOnly`** —
     текст есть с обеих сторон, просто иначе разбит на стихи (исправление: ранее
     стих ошибочно был и в `grcOnly`, и в `merged`).

   **3b. `phraseVariantsByRef` — phrase/span-level (НОВОЕ, point 6):** для TR-плюсов
   ВНУТРИ paired-стиха (Comma Johanneum 1Ин 5:7; доксология Мф 6:13b; Деян 9:5 и
   др.). Запись = `span` русского текста + `variant`-ссылка. Источник данных уже
   есть: `textual-variants.json` содержит `synOnlyVerses`/`grcOnlyVerses` (→ 3a) и
   `synOnlyPhrases`/`grcOnlyNotes` (→ 3b).

   Слова в synOnly-стихах И в phrase-вариантах помечаются **explained** (категория
   «текстовый вариант»), не «ошибка выравнивания».

Уровни `q`: `e` — точное лексическое соответствие (видимо); `f` —
функциональное (видимо, стиль «ниже уверенности»); `u` — неуверенно (хранится,
**скрыто**). Рантайм-замены используют только `e` (и `f`, если продукт решит);
**никогда** `u`. Это — основа precision-гейта (§1), но не доказательство
безошибочности: precision подтверждается held-out-аудитом.

### 2.6 Per-alignment index — `assets/data/align/syn--sblgnt-macula/index.json`

```json
{ "schema": "alignment-index-v1", "alignmentId": "syn--sblgnt-macula",
  "lexemesWithVisiblePair": ["logos", "theos", "en", "..."] }
```

`hasAlignment` **вынесен сюда** из нейтрального ядра (устраняет противоречие v2
§7.8 ↔ §4.1: факт про syn-выравнивание не должен жить в language-neutral core).
Словарь вычисляет «есть ли подсветка» как `lexemeKey ∈ lexemesWithVisiblePair`.

### 2.7 Top-1000 нейтральное ядро — `assets/data/lexicon/top1000.core.json`

```json
{
  "schema": "top1000-lexicon-core-v1",
  "originalId": "sblgnt-macula",
  "items": [{
    "lexemeKey": "logos", "maculaLexemeId": "grc-logos-04b1f3",
    "lemma": "λόγος", "search": "λογος", "translit": "logos",
    "strongs": ["3056"], "rank": 55, "count": 330, "verseCount": 318,
    "pos": "noun", "isFunctionWord": false,
    "sourceGlosses": { "en": ["word", "speech", "message"] },
    "forms": [{ "s": "λόγος", "count": 60, "morph": ["N-NSM"] }],
    "firstRef": "john 1:1",
    "domains": ["033005"]
  }]
}
```

Правки против v2 §7.8:

- **`hasAlignment` убран** (см. §2.6).
- **`refs[]` → `firstRef`** (генератор уже хранит `firstRef`; полный массив для
  частотных лемм — размерная мина: λόγος=318, ὁ — десятки тысяч). Полные занятия
  — только в canonical/audit.
- Язык-нейтрально: русских полей здесь нет; `sourceGlosses.en` — метаданные,
  не UI-копия.

Поля `rank,count(=tokenCount),verseCount,pos,isFunctionWord,strongs,glossesEn,`
`transliteration,firstRef` уже есть в `generated/.../frequency.json` — нужно
добавить лишь `lexemeKey`-маппинг, `forms[]`, `domains[]`.

### 2.8 Locale `ru` overlays (перенос курации, решение 1)

`assets/data/lexicon/locales/ru/top1000.json` — глоссы:

```json
{ "schema": "top1000-locale-overlay-v1", "localeId": "ru", "items": [
  { "lexemeKey": "logos", "gloss": "слово, речь, смысл", "shortGloss": "слово",
    "explanation": "Речь, сообщение, смысловое слово.",
    "searchAliases": ["слово","речь","смысл"], "examples": ["Ин 1:1","Ин 1:14"] }]}
```

`assets/data/lexicon/locales/ru/core.json` — match-rules (продуктовая курация,
не из MACULA):

```json
{ "schema": "core-locale-overlay-v1", "localeId": "ru", "items": [
  { "lexemeKey": "logos", "pos": "сущ., муж. род",
    "ruMatches": ["(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])"],
    "ruExclude": ["словно","условие","словарь"],
    "refs": ["Ин 1:1","Ин 1:14","Деян 6:2","Рим 10:17"] }]}
```

Оба генерируются **переносом** из `docs/sources/locales/ru/core.json` (204 записи,
источник курации — туда переносится содержимое старого
`assets/data/lexicon/core.json` до его удаления, point 3) по `lexemeKey`
(= старый `id`). Поля переходят так:
`gloss→gloss`, `pos→pos`, `ruMatches→ruMatches`, `ruExclude→ruExclude`,
`refs→refs/examples`. `ruMatches` присоединяется к нейтральному ядру **только**
по `lexemeKey` и не протекает в language-neutral packs.

### 2.9 Чего НЕ создаём сейчас

`translations.json`, `originals.json`, `locales.json`, деревья
`translations/bsb/**`, `lexicon/locales/en/**`, offline-группы для `bsb`
(решение 4). Пути остаются расширяемыми, добавление BSB будет дописыванием.

---

## 3. Конвейер генерации

Один конвейер, два выхода (не двойная генерация одинаковых данных — canonical и
runtime разной гранулярности):

```text
source (committed snapshots: docs/sources/originals/macula-greek/SBLGNT,
        docs/sources/translations/syn, docs/sources/locales/ru/core.json)
  → [canonical generator]  → generated/canonical/**   (большое, gitignore, аудит)
  → [runtime projector]    → assets/data/**           (компактное, коммит)
  → [audit reporter]       → *-report.json            (агрегаты, коммит)
```

Переиспользуем существующий `scripts/macula/lib/`:
`lexeme-id.mjs`, `morphology-decoder.mjs`, `frequency.mjs`, `ref-selector.mjs`,
`transliteration.mjs`, `verse-reconstructor.mjs`, `normalizer.mjs`,
`accent.mjs`, `domain-labels.mjs`.

Entrypoints (новые/обновлённые):

- `scripts/macula/build-macula.mjs` — canonical (уже есть; оставить как
  intermediate, перенаправить выход в `generated/canonical/`).
- `scripts/build-original-packs.mjs` — canonical → `originals/.../books/*.json`
  (nested, компакт; группировка токенов по главам/стихам + `text` из `verses.json`).
- `scripts/build-lexicon-core.mjs` — canonical/frequency → `top1000.core.json`
  (+ `lexemeKey`-маппинг, `forms`, `domains`, `firstRef`).
- `scripts/build-locale-ru.mjs` — **`docs/sources/locales/ru/core.json`** (204,
  источник курации) → `assets/data/lexicon/locales/ru/{top1000,core}.json` по
  `lexemeKey`. Источник — в `docs/sources/`, НЕ рантайм-оверлей (point 3).
- `scripts/build-syn-packs.mjs` — Синодал из **committed snapshot**
  `docs/sources/translations/syn` (НЕ из живого API) → `translations/syn/books/*.json`
  с замороженным `words[]` (объекты с offsets, §2.4). `build-syn.mjs` (тянет из
  bolls.life API) запускается **один раз** для создания снапшота + source-manifest;
  далее `build:data` воспроизводим офлайн.
- `scripts/build-alignment.mjs` — выравнивание (§5) → `align/.../books/*.json` +
  `index.json`.

`package.json` scripts обновить:

```jsonc
"build:macula":  "node scripts/macula/build-macula.mjs",      // canonical
"build:runtime": "node scripts/build-original-packs.mjs && node scripts/build-lexicon-core.mjs && node scripts/build-locale-ru.mjs && node scripts/build-syn-packs.mjs",
"build:align":   "node scripts/build-alignment.mjs",
"build:data":    "npm run build:macula && npm run build:runtime && npm run build:align && npm run verify:data",
"verify:data":   "node scripts/verify-data.mjs"
```

Детерминизм обязателен: повторный запуск при тех же входах → побайтово
идентичные рантайм-файлы (никаких `generatedAt` в рантайме; таймстемпы — только
в report).

---

## 4. lexemeKey: перенос курации и генерация ключей

1. Прочитать `docs/sources/locales/ru/core.json` (204, источник курации) →
   словарь `oldId → {ruMatches, ruExclude, gloss, pos, refs}`. `oldId` становится
   `lexemeKey` курируемой леммы. **До удаления старого
   `assets/data/lexicon/core.json` его содержимое переносится в этот source-path
   (point 3) — нельзя оставить курацию только в сгенерированном рантайм-оверлее.**
2. Сопоставить курируемые с MACULA-леммами по `strong` (+ проверка `lemma`).
   Несопоставленные — в report как ручной разбор (ожидаемо ~0, но проверить).
3. Некурируемым присвоить `lexemeKey` по §2.1 п. 2 (translit; при коллизии —
   `-<hash>` хвост из `maculaLexemeId`, 10 известных групп); генератор ассертит
   глобальную уникальность ключей, печатает коллизии.
4. Записать `locale/ru/*` (перенос) и `top1000.core` (`lexemeKey` в каждой записи).

Поскольку пользователей нет — **никакой миграции IndexedDB**. `lexemeKey` просто
становится ключом с первого запуска.

---

## 5. Выравнивание: перегенерация + 100 % precision

Алгоритм не меняется (Strong + `ruMatches`), меняется источник греческих токенов
(MACULA `tokenId`). Логика — как в текущих `convert-alignments.js` /
`refine-alignments.mjs`, переписанная на новые паки.

Шаги генератора `build-alignment.mjs`:

1. Для каждого стиха сопоставить `verses`-correspondence (§2.5) из реестра
   версификации + `textual-variants.json`.
2. Для каждого русского слова (`words[i]` из замороженного pack) применить
   `ruMatches` курируемой леммы → кандидат `lexemeKey`.
3. Найти греческий `tokenId` с тем же `strong` в этом стихе → пара
   `{ r:i, tokenId, lexemeKey, q, src }`.
4. **Строгий порог показа (даёт precision):**
   - совпадение Strong + срабатывание `ruMatches` + согласование (где возможно —
     падеж/число/род из morph) → `q:"e"`;
   - функциональное соответствие → `q:"f"`;
   - **всё неоднозначное/неуверенное → `q:"u"` (скрыто).**
5. synOnly/grcOnly/variant-стихи: слова помечаются explained, пары не строятся.

**Гейты выравнивания (фиксируют 100 % precision как измеримую границу):**

- инварианты: schema; каждый `tokenId` существует в original-pack; `r` в
  границах `words[]`; нет дублей видимых `r`/`tokenId` в стихе; детерминизм;
- **held-out precision-аудит**: ручная/слепая проверка выборки видимых пар
  (`e`+`f`) → требование «0 подтверждённых ошибок на выборке»; найденная ошибка →
  ужесточение порога (пара → `u`), а не послабление;
- **«100 % explained»**: каждый orphan (русское слово без пары) попадает в
  документированную категорию (вариант/служебное/структурное) — отчёт
  `audit-report.json`;
- recall — best-effort, **не блокирует**; улучшение — отдельный трек
  `DEVELOPMENT_7.md` (refine-passes A/B/C), не часть v3.

---

## 6. Код: загрузчики / движок / PWA

Фактические файлы (проверено по дереву `src/**`):

- **`src/ui/screens/reading.js` (1041 стр. — ГЛАВНАЯ точка переподключения)** —
  центральный экран чтения, импортируется `app.js:6`. Связывает `loadBook`,
  `loadCoreLexicon`/`loadFrequency`, `composeVerse`, словарь, DOM-окно стихов,
  карточки слов. Перевести: `loadBook('grc'|'syn', …)` → новые
  original/translation-загрузчики; **`verse.alignment` (сейчас inline в syn-стихе)
  → отдельный alignment-pack, грузится по `ref` и прокидывается в `composeVerse`**;
  ключ слова → `lexemeKey`. Это самый объёмный пункт Шага 4, не недооценивать.
- **`src/data/bible-loader.js`** — грузить `originals/sblgnt-macula/...`,
  `translations/syn/...` и `align/.../books/{bookId}.json` (новые пути/схемы);
  метаданные перевода/оригинала читать из `data-manifest.json` (§2.2a).
- **`src/data/lexicon-loader.js`** — грузить `top1000.core.json` + активный
  `locale/ru/{top1000,core}.json`, джойнить по `lexemeKey`; fallback на
  `sourceGlosses.en` при отсутствии русского глосса (решение 3); читать
  `align/.../index.json` для «есть подсветка».
- **`src/engine/compose.js`, `src/engine/form-layer.js`** — потреблять нативные
  поля: `s`(surface)/`morph`/`strongs`/`lexemeKey`/`tokenId`; замены берут пары
  по `tokenId`, позицию русского слова — по `span`; фильтр `q` — `u` никогда не
  показывать. Движок остаётся чистым (Vitest).
- **`src/engine/morphology.js`** — рантайм **уже** парсит сырой `morph` и
  корректно мапит `D`→повелительное (стр. 33/137/185), runtime-грамматика в
  порядке. Дефекты `labelRu` сидят в *canonical*-генераторе
  (`scripts/macula/lib/morphology-decoder.mjs`) и важны лишь если что-то читает
  `labelRu`. Проверить потребление в `src/ui/components/word-card.js`; чинить
  декодер до выпуска только если `labelRu` реально используется.
- **`src/ui/render.js`** — `data-*`-атрибуты и сбор слова из DOM перевести на
  `lexemeKey`/`tokenId`/`s` вместо старых `w`/`strong`-полей.
- **`src/state/dictionary.js`, `src/storage/db.js`** — ключ словаря = `lexemeKey`
  (без миграции — greenfield).
- **`vite.config.js` (точные Workbox-правила, point 2):**
  - убрать `runtimeCaching` `/data/generated/macula/` и `globIgnores
    '**/data/generated/**'`;
  - `globPatterns` сейчас `['**/*.{…,json}']` → **добавить в `globIgnores`**
    `'**/data/originals/**'`, `'**/data/translations/**'`, `'**/data/align/**'`,
    иначе все book-packs уедут в precache;
  - **precache** (остаётся в `globPatterns`): shell + `data-manifest.json` +
    `top1000.core.json` + `locale/ru/{top1000,core}.json` + `books.json` +
    `alphabet.json` + `textual-variants.json`;
  - **runtimeCaching** (StaleWhileRevalidate): `/data/originals/`,
    `/data/translations/`, `/data/align/` — per-book ленивая загрузка.

Деградация (fail-soft, не для отката, а для устойчивости рантайма): нет
alignment/original → греческие режимы 3–5 падают до букв/plain; текст перевода и
словарь top-1000 продолжают работать.

---

## 7. План по шагам

### Шаг 1 — Модель, схемы, вынос canonical

- Зафиксировать схемы §2 (JSON-схемы в `assets/data/.../schema/` или докой).
- Перенаправить `build-macula.mjs` в `generated/canonical/`; `.gitignore` на
  большие файлы; убрать macula из `vite.config.js`.
- Решить открытые пункты §11 (формат `lexemeKey`-суффикса; ru-якорь).

*Done:* canonical вне `assets/`; `dist/` больше не содержит 369 MB; схемы
зафиксированы; ни один рантайм-контракт не зависит от legacy `token.w`/
single-`strong`/`freq-*`.

### Шаг 2 — Рантайм-генераторы + перенос курации

- `build-original-packs`, `build-lexicon-core`, `build-locale-ru`,
  `build-syn-packs`.
- `lexemeKey`-маппинг (§4), ассерт уникальности.

*Done:* 27 книг original+translation валидируют по схемам; `top1000.core`
нейтрален (нет ru-полей, нет `hasAlignment`); `locale/ru` перенесён, 204
курируемых ключа на месте (`logos`/`theos`/`kurios` живы); детерминизм.

### Шаг 3 — Перегенерация выравнивания + precision-гейты

- `build-alignment` (§5): `tokenId`-якорь, `verses`-correspondence, fail-closed.
- `index.json` с `lexemesWithVisiblePair`.

*Done:* все паки валидны; нет out-of-bounds `r`/несуществующих `tokenId`/дублей
видимых пар; held-out precision-аудит без подтверждённых ошибок; каждый orphan
explained в `audit-report.json`.

### Шаг 4 — Код (загрузчики/движок/UI/PWA) + удаление legacy

- §6: загрузчики, движок, **`reading.js` (1041 стр. — главный объём)**,
  `dictionary.js`, `word-card.js`, `inspector.js`, `mode-widget.js`, `render.js`,
  `state/dictionary.js`, `storage/db.js`, `vite.config.js`. Внимание: alignment
  теперь отдельный pack, а не `verse.alignment` inline — `reading.js` грузит и
  прокидывает его в `composeVerse`.
- После зелёных гейтов — **сразу удалить** legacy:
  `scripts/{apply-zefania-alignments,convert-alignments,refine-alignments,`
  `parse-zefania-strongs,build-frequency}.{mjs,js}` (после переноса логики),
  `assets/data/bibles/**`, `assets/data/rus_nt_strongs.xml` (5.3M),
  старый `assets/data/lexicon/{core,frequency}.json`,
  `docs/clear-bible-alignments/`, `docs/greek-nt-frequency-sources/` (2.3G);
  обновить `scripts/lib/{text-utils.js,greek-translit.mjs}` судьбу.

*Done:* режимы 1–5 на новых паках; режим 3/4 — только `e`(/`f`); режим 5 — из
original-pack; словарь top-1000 офлайн до открытия книги; `lexemeKey` —
app-ключ везде; `npm test`+`npm run build`+`npm run build:data` зелёные; ручная
QA (375/1280 × light/dark) пройдена.

---

## 8. Тесты и гейты (Vitest, чистые модули)

- **Данные:** схема-валидация всех паков; `tokenId`-ссылки существуют; `span` в
  границах `text` и совпадает с offsets из `words[]`; детерминизм (повторный
  запуск = тот же байт); SHA source-манифеста совпадает со снапшотом; **`build:data`
  воспроизводим офлайн (без живого API)**.
- **Движок (`form-layer`/`compose`):** `strongs`-массивы; составной Strong
  (`5228+1537+4053`); отсутствующее выравнивание; `q=u` скрыт; парсинг morph.
- **Лексикон:** джойн `lexemeKey` ядро↔overlay; fallback на `sourceGlosses.en`
  при отсутствии ru-глосса; отсутствующая запись overlay не роняет рендер.
- **Выравнивание:** verse-correspondence (synOnly/grcOnly/**merged**); phrase-level
  `phraseVariantsByRef` (Comma Johanneum и пр.); precision held-out выборка
  (0 подтверждённых ошибок).
- **PWA build:** `dist/` без больших canonical; `assets/data/**` ограничен по
  размеру; нейтральное ядро+`locale/ru` precache.

Размерный бюджет: `top1000.core` + `locale/ru/top1000` ≤ ~1 MB несжато;
original-паки компактны для мобильного парса; full-NT offline — по явному
действию пользователя, не на первой загрузке.

---

## 9. Commit breakdown (без миграционных коммитов)

1. `docs: add MACULA plan v3 (final)`
2. `build: define runtime schemas; move canonical out of assets`
3. `build: generate compact MACULA original packs`
4. `build: generate top1000 core + port ru locale overlays`
5. `build: generate Synodal translation packs (frozen words)`
6. `build: regenerate syn--sblgnt-macula alignment (tokenId-anchored) + index`
7. `test: data/engine/lexicon/alignment verification gates`
8. `feat: load runtime original/translation/alignment/locale packs`
9. `feat: engine + dictionary on lexemeKey/tokenId`
10. `feat: precache core+locale, per-book offline caching`
11. `docs: data-source attribution (MACULA CC BY 4.0)`
12. `chore: remove legacy pipeline, sources and runtime paths`

Cleanup (12) — последним.

---

## 10. Done criteria

- Source-снапшоты (MACULA, **Синодал**, `locale/ru/core.json`) и манифесты с
  лицензиями закоммичены; `build:data` воспроизводим **офлайн** (без живого API).
- Рантайм сгенерирован из MACULA-first canonical; canonical вне `dist/`;
  `data-manifest.json` присутствует.
- `top1000.core` нейтрален; `locale/ru` перенесён (204 курируемых ключа живы).
- 27 книг syn имеют original+translation+alignment паки.
- `syn--sblgnt-macula`: **100 % precision** (fail-closed + held-out без
  подтверждённых ошибок); все orphan'ы explained; recall — best-effort.
- Режимы 1–5 на новых данных; `u` никогда не показывается.
- `lexemeKey` — финальный app-ключ (не `freq-*`, не внешний ID).
- `npm test` / `npm run build` / `npm run build:data` зелёные.
- Ручная QA на мобиле/десктопе, light/dark.
- Legacy (скрипты/источники/пути) удалены после успешного переключения.

---

## 11. Решённые вопросы (закрыты заказчиком 17.06.2026)

1. **Суффикс `lexemeKey` при коллизии — РЕШЕНО:** хвост `-<hash>` из
   `maculaLexemeId`, НЕ `-{n}` по rank (rank нестабилен). 10 групп коллизий
   измерены (§2.1).
2. **Русский якорь — РЕШЕНО:** char-span `[start,end]` сразу; `words[]` — объекты
   `{i,text,start,end}` с замороженными offsets (§2.4, §2.5). Индекс слова не
   используется.
3. **Canonical-репорты — РЕШЕНО:** большие canonical в `.gitignore`; снапшоты +
   source-manifests коммитятся; `build:data` воспроизводим офлайн (особенно
   Синодал — committed snapshot, не API).
4. **Морфо-декодер — РЕШЕНО:** runtime `morphology.js` парсит сырой `morph`
   корректно (`D` ок); чинить `labelRu` в canonical-декодере только если
   `word-card.js` его читает — проверить на Шаге 4.
5. **Рантайм-метадата — РЕШЕНО (Вариант A):** один `data-manifest.json` (§2.2a),
   не растущие реестры и не константы.
```
