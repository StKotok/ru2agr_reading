# План перехода на MACULA — полная миграция данных

**Date:** 2026-06-17
**Status:** План готов к реализации
**Target branch:** dev2

---

## Цель

Полностью заменить источники данных с сомнительными лицензиями (SBLGNT.tsv из Clear-Bible, Zefania-based выравнивание) на чистый MACULA Greek pipeline (CC-BY 4.0). Удалить устаревшие скрипты, данные и документацию. Обновить движок приложения для работы с новым форматом данных.

---

## Текущее состояние: два параллельных мира

```
┌─────────────────────────────────────────────────────────────────┐
│ OLD WORLD (работает в проде)          NEW WORLD (pipeline готов) │
├─────────────────────────────────────────────────────────────────┤
│ docs/clear-bible-alignments/          docs/macula-greek/        │
│        SBLGNT.tsv (10 MB)                    SBLGNT/tsv/        │
│                                                 macula-greek-  │
│ convert-alignments.js →                      SBLGNT.tsv (20 MB) │
│   bibles/grc/*.json (48 MB)           build-macula.mjs →        │
│                                        generated/macula/        │
│ build-frequency.mjs →                       tokens.jsonl        │
│   lexicon/frequency.json (102 KB)           lexemes.json        │
│                                             frequency.json      │
│ apply-zefania-alignments.mjs →              verses.json         │
│ refine-alignments.mjs →                     books/*.json        │
│   alignment в syn/*.json                                         │
│                                                                 │
│ APP читает:                         APP HE читает:              │
│   bibles/grc/*.json (token.w)        generated/macula/          │
│   bibles/syn/*.json (alignment)      (формат несовместим)       │
│   lexicon/frequency.json                                       │
│   lexicon/core.json                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Разрыв:** движок (`form-layer.js`) ожидает `token.w`, `token.lemma`, `token.morph`, `token.strong` (число). MACULA выдаёт `token.surface`, `token.lemma`, `token.morphology.code`, `token.strong` (массив строк). Приложение не имеет кода для чтения `generated/macula/`.

---

## План: 8 шагов

### Шаг 0 — Ревизия и фиксация текущего состояния

**Цель:** зафиксировать работающее состояние перед масштабными изменениями.

- [ ] Убедиться, что `npm test` и `npm run build` проходят (✅ уже)
- [ ] Закоммитить текущие изменения MACULA pipeline
- [ ] Сделать бэкап `assets/data/bibles/grc/` и `assets/data/lexicon/frequency.json`
- [ ] Создать ветку `dev2-macula-migration` от `dev2`

**Коммит:** `chore: snapshot before MACULA migration`

---

### Шаг 1 — Добавить адаптер MACULA → старый формат в bible-loader

**Цель:** научить `bible-loader.js` читать новый MACULA-формат и отдавать его в старом формате, не трогая движок. Это минимальный мост, который позволяет приложению работать на новых данных без изменения engine.

**Файлы:** изменить `src/data/bible-loader.js`; создать `src/data/macula-adapter.js`.

#### 1.1 Создать `src/data/macula-adapter.js`

```js
// Преобразует MACULA-токен в формат, ожидаемый form-layer.js:
// { w, lemma, morph, strong }
export function maculaTokenToLegacy(token) {
  return {
    w: token.surface,
    lemma: token.lemma,
    morph: token.morphology?.code || null,
    strong: Array.isArray(token.strong) && token.strong.length > 0
      ? Number(token.strong[0])
      : null
  };
}

// Группирует плоский массив MACULA-токенов в главы/стихи
export function buildBookFromMacula(tokens) {
  const chapters = new Map();
  for (const t of tokens) {
    if (!chapters.has(t.chapter)) chapters.set(t.chapter, new Map());
    const verses = chapters.get(t.chapter);
    if (!verses.has(t.verse)) verses.set(t.verse, []);
    verses.get(t.verse).push(maculaTokenToLegacy(t));
  }
  // Преобразуем в формат { chapters: [{ n, verses: [{ n, text, tokens }] }] }
  // ...
}
```

#### 1.2 Обновить `bible-loader.js`

Добавить метод `loadMaculaBook(bookId)` — загружает `data/generated/macula/books/${bookId}.json` и адаптирует.

#### 1.3 Обновить `reading.js`

Переключить загрузку греческих данных с `loadBook('grc', bookId)` на `loadMaculaBook(bookId)`.

- [ ] `src/data/macula-adapter.js` создан
- [ ] `src/data/bible-loader.js` обновлён: `loadMaculaBook()`
- [ ] `src/ui/screens/reading.js` обновлён: `buildWordEntries` и `loadChapter` используют новый источник
- [ ] `npm test` зелёный
- [ ] Ручная проверка: приложение открывается, греческий слой работает

**Коммит:** `feat: macula-adapter — bridge between MACULA tokens and legacy engine format`

---

### Шаг 2 — Обновить частотный словарь и лексикон

**Цель:** заменить `lexicon/frequency.json` на MACULA-версию, обогатить `lexicon/core.json`.

#### 2.1 Заменить `frequency.json`

MACULA `generated/macula/frequency.json` содержит 5 468 лемм (против 1000 в старом). Нужно:
- Скопировать `generated/macula/frequency.json` → `assets/data/lexicon/frequency.json`
- Или лучше: обновить `build-macula.mjs` чтобы он писал `frequency.json` напрямую в `assets/data/lexicon/frequency.json`
- Убедиться, что формат совместим с `lexicon-loader.js` (сейчас ожидает `{rank, strong, lemma, count, translit, hasAlignment}`)

#### 2.2 Обогатить `core.json` из MACULA

Для каждой записи в `core.json`:
- Найти соответствующую лемму в MACULA `lexemes.json` (по номеру Стронга или лемме)
- Добавить `lexemeId` из MACULA
- Добавить `attestedForms`
- Добавить `semanticDomains` (Louw-Nida)
- Обновить `freqNT` из точных данных MACULA
- Добавить `strong` как массив (если несколько Strong-номеров)

**Скрипт:** `scripts/enrich-core-from-macula.mjs`

#### 2.3 Обновить `lexicon-loader.js`

```js
export async function loadFrequency() {
  const res = await fetch('./data/lexicon/frequency.json');
  if (!res.ok) return [];
  return res.json();
  // Новый формат: { rank, denseRank, lexemeId, lemma, tokenCount,
  //   verseCount, coverage, coveragePercent, cumulativeCoverage,
  //   strong[], pos, isFunctionWord, glossesEn[], transliteration, firstRef }
}

export async function loadCoreLexicon() {
  const res = await fetch('./data/lexicon/core.json');
  if (!res.ok) return [];
  const items = await res.json();
  // Прекомпиляция регулярок (как сейчас)
  for (const item of items) {
    item._regexps = item.ruMatches.map(r => new RegExp(r, 'iu'));
    item._exclude = item.ruExclude;
  }
  return items;
}
```

- [ ] `scripts/enrich-core-from-macula.mjs` создан и запущен
- [ ] `assets/data/lexicon/frequency.json` заменён на MACULA-версию
- [ ] `assets/data/lexicon/core.json` обогащён (lexemeId, attestedForms, etc.)
- [ ] `src/data/lexicon-loader.js` обновлён под новый формат
- [ ] Словарь и прогресс в приложении работают
- [ ] `npm test` зелёный

**Коммит:** `feat: MACULA-based frequency + enriched core lexicon`

---

### Шаг 3 — Обновить движок для нативного MACULA-формата

**Цель:** убрать адаптер, обновить `form-layer.js` и `compose.js` для работы с MACULA-полями напрямую.

#### 3.1 `form-layer.js`

Заменить обращения к старым полям:

| Старое | Новое |
|--------|-------|
| `grToken.w` | `grToken.surface` |
| `grToken.morph` | `grToken.morphology?.code` |
| `grToken.strong` (number) | `Number(grToken.strong[0])` или `grToken.strong` (array) |
| `grToken.lemma` | `grToken.lemma` (без изменений) |

Добавить использование новых полей:
- `grToken.morphology.labelRu` — готовая русская расшифровка (вместо вызова `formatMorphShort`)
- `grToken.isFunctionWord` — флаг служебного слова
- `grToken.glossEn` — английский глосс (для будущих фич)

#### 3.2 `compose.js`

Обновить сигнатуру `composeVerse` — передавать MACULA-токены вместо старых.

#### 3.3 `reading.js`

Обновить `buildWordEntries`:
- Искать слова по `lexemeId` вместо `id`/`strong`
- Использовать `frequency.json` нового формата

#### 3.4 `render.js`

Обновить data-атрибуты на span'ах:
- `data-morph` → брать из `morphology.code`
- `data-strong` → первый элемент массива `strong`
- Добавить `data-lexeme-id` (новый стабильный идентификатор)

- [ ] `src/engine/form-layer.js` обновлён
- [ ] `src/engine/compose.js` обновлён
- [ ] `src/ui/screens/reading.js` обновлён
- [ ] `src/ui/render.js` обновлён
- [ ] `src/ui/components/word-card.js` обновлён (если использует старые поля)
- [ ] `npm test` зелёный
- [ ] Ручная проверка: все 5 режимов работают

**Коммит:** `feat: engine reads native MACULA token format`

---

### Шаг 4 — Удалить адаптер и старый формат

**Цель:** удалить `macula-adapter.js`, переключить `build-macula.mjs` на прямую запись в `bibles/grc/`.

#### 4.1 Обновить `build-macula.mjs`

Добавить output mode `--format=legacy` который пишет MACULA-токены в формате `bibles/grc/*.json` (сгруппированные по книгам/главам/стихам, с полями `w`, `lemma`, `morph`, `strong` — но уже в новом формате с MACULA-полями).

Или — лучше — изменить структуру выходных данных, чтобы `books/*.json` имели формат, совместимый с bible-loader:

```json
{
  "id": "john",
  "title": "ΚΑΤΑ ΙΩΑΝΝΗΝ",
  "chapters": [
    { "n": 1, "verses": [
      { "n": 1, "tokens": [...] }
    ]}
  ]
}
```

где каждый token — MACULA-формат (с `surface`, `morphology`, `strong` как массив, etc.)

#### 4.2 Переключить выход `build:macula` → `bibles/grc/`

```bash
# В package.json:
"build:macula": "node scripts/macula/build-macula.mjs",
"build:data": "npm run build:macula && node scripts/build-syn.mjs"
```

`build-syn.mjs` остаётся (Синодальный текст не меняется).

#### 4.3 Удалить `src/data/macula-adapter.js`

Больше не нужен — движок читает MACULA напрямую.

- [ ] `build-macula.mjs` пишет в `bibles/grc/`
- [ ] Старый `convert-alignments.js` отключён из `build:data`
- [ ] `src/data/macula-adapter.js` удалён
- [ ] `bible-loader.js` обновлён — читает новый формат из `bibles/grc/`
- [ ] `npm run build:data` работает
- [ ] `npm test` зелёный
- [ ] Ручная проверка: полный цикл

**Коммит:** `refactor: remove macula-adapter, build:macula writes directly to bibles/grc`

---

### Шаг 5 — Обновить тесты

**Цель:** все тесты используют MACULA-данные.

#### 5.1 `tests/form-layer.test.js`

- Заменить импорт `../assets/data/bibles/grc/mark.json` на MACULA-данные
- Или создать тестовый fixture из MACULA (несколько стихов)
- Обновить все обращения к `token.w` → `token.surface`

#### 5.2 `tests/bible-data.test.js`

- Адаптировать под новый формат `bibles/grc/`

#### 5.3 `tests/frequency-data.test.js`

- Адаптировать под новый формат `frequency.json` (5468 записей, новые поля)

#### 5.4 `tests/compose.test.js`, `tests/morphology.test.js`

- Проверить, что не сломаны изменениями формата

#### 5.5 `scripts/macula/test/output-data.test.js`

- Уже использует MACULA-формат ✅

- [ ] Все тесты обновлены
- [ ] `npm test` зелёный (все 20+ test files)

**Коммит:** `test: update all tests for MACULA token format`

---

### Шаг 6 — Удалить устаревшие скрипты и данные

**Цель:** очистить репозиторий от obsolete-кода.

#### 6.1 Скрипты на удаление

| Файл | Причина |
|------|---------|
| `scripts/convert-alignments.js` | Заменён `build-macula.mjs` |
| `scripts/build-frequency.mjs` | Заменён MACULA frequency в `build-macula.mjs` |
| `scripts/parse-zefania-strongs.mjs` | Zefania-подход упразднён |
| `scripts/apply-zefania-alignments.mjs` | Zefania-выравнивание упразднено |
| `scripts/refine-alignments.mjs` | Zefania-рефайнмент упразднён |
| `scripts/verify-alignments.mjs` | Zefania-верификация упразднена |
| `scripts/analyze-coverage.mjs` | Устаревший анализатор покрытия |

#### 6.2 Данные на удаление

| Путь | Причина |
|------|---------|
| `assets/data/bibles/grc/*.json` (27 файлов) | Заменены MACULA-версией в `bibles/grc/` |
| `assets/data/lexicon/frequency.json` (старая версия) | Заменена MACULA-версией |
| `assets/data/rus_nt_strongs.xml` (5.6 MB) | Zefania-источник, больше не нужен |

#### 6.3 Python-скрипты — на усмотрение

| Файл | Решение |
|------|---------|
| `scripts/add-detail.py` | Оставить — работает с `core.json` (не зависит от формата grc) |
| `scripts/add-refs.py` | Оставить — работает с `core.json` |
| `scripts/add-ubs-senses.py` | Оставить — работает с `core.json` |
| `scripts/translate-top100.py` | Оставить — работает с `core.json` |
| `scripts/build-variants-registry.mjs` | Оставить — работает с syn/grc verse inventories |
| `scripts/build-syn.mjs` | Оставить — Синодальный текст не меняется |
| `scripts/download-greek-nt-frequency-sources.sh` | Оставить — историческая ценность |

#### 6.4 Библиотеки на удаление

| Файл | Причина |
|------|---------|
| `scripts/lib/text-utils.js` | Используется только Zefania-скриптами |
| `scripts/lib/greek-translit.mjs` | Заменён `scripts/macula/lib/transliteration.mjs` |

**Важно:** `scripts/lib/greek-translit.mjs` используется в `scripts/build-frequency.mjs`. После удаления `build-frequency.mjs` — можно удалять.

- [ ] Устаревшие скрипты удалены
- [ ] Устаревшие данные удалены
- [ ] `scripts/lib/text-utils.js` удалён
- [ ] `package.json` обновлён: `build:data` упрощён
- [ ] `npm run build:data` работает
- [ ] `npm test` зелёный

**Коммит:** `chore: remove obsolete scripts and data (replaced by MACULA pipeline)`

---

### Шаг 7 — Очистить `docs/`

**Цель:** удалить устаревшую документацию и исходные данные, оставить только актуальное.

#### 7.1 На удаление

| Путь | Размер | Причина |
|------|--------|---------|
| `docs/clear-bible-alignments/` | ~11 MB | SBLGNT.tsv — старый источник. Заменён `docs/macula-greek/`. Выравнивание построено заново. |
| `docs/greek-nt-frequency-sources/raw/` | ~500 MB | 6 git-клонов репозиториев. Можно перескачать. |
| `docs/greek-nt-frequency-sources/selected/` | ~27 MB | Курированные копии. Заменены `docs/macula-greek/`. |
| `docs/greek-nt-frequency-sources/checksums.sha256` | 18 KB | Контрольные суммы удалённых файлов. |
| `docs/greek-nt-frequency-sources/manifest.json` | 9 KB | Манифест удалённых файлов. |
| `docs/ru2gr_design-example/` | ? | Архивный дизайн-пример. |

#### 7.2 Оставить (переместить)

| Путь | Действие |
|------|----------|
| `docs/greek-nt-frequency-sources/README.md` | Оставить — документирует процесс выбора MACULA |
| `docs/greek-nt-frequency-sources/manifest.md` | Оставить |
| `docs/greek-nt-frequency-sources/notes/` | Оставить — анализ datasets, license review |
| `docs/greek-nt-frequency-sources/licenses/` | Оставить — собранные лицензии |
| `docs/macula-greek/` | Оставить — ИСТОЧНИК ДАННЫХ (read-only) |

#### 7.3 Актуальная структура `docs/` после очистки

```text
docs/
├── macula-greek/                    # SOURCE DATA (read-only, CC-BY 4.0)
├── generated-data/
│   └── MACULA_PIPELINE.md           # Документация pipeline
├── development/
│   ├── DEVELOPMENT_1..7.md          # История разработки
│   ├── ALIGNMENT.md                 # Алгоритм выравнивания
│   ├── alignment-error-report.md
│   ├── data-sources-requirements.md # Требования к источникам
│   └── textual-audit.md
├── greek-nt-frequency-sources/
│   ├── README.md                    # Как выбирали источники
│   ├── manifest.md                  # Манифест источников
│   ├── notes/                       # Анализ и license review
│   └── licenses/                    # Собранные лицензии
├── groq_plan/                       # План миграции (архив)
│   ├── plan.md
│   └── word_bank_scheme.md
├── superpowers/                     # Планы и спеки (архив)
├── ux-functional-description.md     # Функциональная спецификация
└── visual-design-review-2026-06-16.md
```

#### 7.4 Обновить `.gitignore`

Убедиться, что `docs/greek-nt-frequency-sources/raw/` в `.gitignore` (если git-клоны не коммитились).

- [ ] `docs/clear-bible-alignments/` удалён
- [ ] `docs/greek-nt-frequency-sources/raw/` удалён
- [ ] `docs/greek-nt-frequency-sources/selected/` удалён
- [ ] `docs/greek-nt-frequency-sources/checksums.sha256` удалён
- [ ] `docs/greek-nt-frequency-sources/manifest.json` удалён
- [ ] `docs/ru2gr_design-example/` удалён
- [ ] Структура `docs/` соответствует целевой

**Коммит:** `chore: clean up obsolete docs and source data`

---

### Шаг 8 — Финальная верификация и документирование

#### 8.1 Полный гейт

```bash
npm run build:macula    # Сгенерировать все данные из MACULA
npm test                # Все тесты (ожидается 20+ test files, 250+ tests)
npm run build           # Production build (PWA, precache)
npm run build:data      # Полный цикл: macula + syn + variants
```

#### 8.2 Ручная проверка

- [ ] Приложение открывается (`npm run dev`)
- [ ] Все 5 режимов чтения работают
- [ ] Греческие буквы заменяются (mode 1-2)
- [ ] Слова из словаря заменяются (mode 3-4)
- [ ] Карточка слова показывает морфологию, глоссы, формы
- [ ] Частотный словарь показывает правильные рейтинги
- [ ] Прогресс букв работает
- [ ] Словарь работает (поиск, фильтры)
- [ ] Настройки сохраняются
- [ ] Offline: книга читается без сети (PWA)
- [ ] Мобильная вёрстка (375px) не сломана
- [ ] Тёмная тема работает

#### 8.3 Обновить `README.md` / `AGENTS.md`

- [ ] Обновить список источников данных (раздел 3.5 в DEVELOPMENT_1.md)
- [ ] Обновить CLAUDE.md если нужно

#### 8.4 Документировать миграцию

- [ ] `docs/development/MACULA_MIGRATION.md` — краткий отчёт о выполненной миграции
- [ ] Обновить `docs/generated-data/MACULA_PIPELINE.md` (если изменились выходные пути)

**Коммит:** `docs: finalize MACULA migration — verification and documentation`

---

## Сводка: что будет удалено

### Скрипты (7 файлов)

```
scripts/convert-alignments.js
scripts/build-frequency.mjs
scripts/parse-zefania-strongs.mjs
scripts/apply-zefania-alignments.mjs
scripts/refine-alignments.mjs
scripts/verify-alignments.mjs
scripts/analyze-coverage.mjs
scripts/lib/text-utils.js
scripts/lib/greek-translit.mjs
```

### Данные (29 файлов, ~54 MB)

```
assets/data/bibles/grc/*.json (27 files)
assets/data/rus_nt_strongs.xml
```

### Документация и исходники

```
docs/clear-bible-alignments/          (~11 MB)
docs/greek-nt-frequency-sources/raw/  (~500 MB)
docs/greek-nt-frequency-sources/selected/ (~27 MB)
docs/greek-nt-frequency-sources/checksums.sha256
docs/greek-nt-frequency-sources/manifest.json
docs/ru2gr_design-example/
```

### Суммарно освобождается: ~600 MB

---

## Сводка: что будет изменено

### Engine (3 файла)

```
src/engine/form-layer.js   — token.w → token.surface, token.morph → token.morphology.code
src/engine/compose.js       — проброс нового формата
src/engine/morphology.js    — возможно, замена на morphology-decoder из MACULA
```

### Data layer (2 файла)

```
src/data/bible-loader.js    — новый метод loadMaculaBook()
src/data/lexicon-loader.js  — адаптация под новый frequency.json
```

### UI (4 файла)

```
src/ui/screens/reading.js   — buildWordEntries по lexemeId
src/ui/screens/dictionary.js — работа с новым форматом lexeme
src/ui/render.js             — новые data-атрибуты
src/ui/components/word-card.js — новые поля
```

### Конфигурация (2 файла)

```
package.json                — упрощение build:data
vite.config.js              — уже обновлён ✅
```

### Тесты (3-4 файла)

```
tests/form-layer.test.js    — переход на MACULA fixture
tests/bible-data.test.js    — адаптация
tests/frequency-data.test.js — адаптация
```

---

## Оценка трудозатрат

| Шаг | Описание | Оценка |
|-----|----------|--------|
| 0 | Snapshot | 5 мин |
| 1 | Адаптер | 1-2 часа |
| 2 | Frequency + core lexicon | 1-2 часа |
| 3 | Engine update | 2-3 часа |
| 4 | Удаление адаптера | 1 час |
| 5 | Тесты | 1-2 часа |
| 6 | Удаление obsolete | 30 мин |
| 7 | Очистка docs | 30 мин |
| 8 | Финальная верификация | 1 час |
| **Всего** | | **8-12 часов** |

---

## Риски

| Риск | Вероятность | Mitigation |
|------|-------------|------------|
| Выравнивание syn↔grc ломается | Средняя | Шаг 1 с адаптером — минимальные изменения. Выравнивание в `syn/*.json` не трогаем. |
| Новый формат ломает form-layer | Средняя | Покрыть тестами на шаге 1, до удаления адаптера |
| Инварианты частот не сходятся | Низкая | MACULA frequency уже проверен тестами (p50: ~28 лемм, top-1: ὁ ~19.8k) |
| Python-скрипты перестают работать | Низкая | Они работают с `core.json`, который не меняет структуру |
| Размер данных в PWA | Средняя | Уже настроен runtimeCaching для `data/generated/macula/` и `data/bibles/` |
