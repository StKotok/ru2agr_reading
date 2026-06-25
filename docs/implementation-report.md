# Implementation Report — Clean-Data Migration (v2) + Alignment Completion

**Дата:** 2026-06-25
**Ветка:** dev2
**Выполнено:** Phase 1 (Data Pipeline) + Phase 2 (Runtime Adaptation) + Alignment Phases 0-2

---

## 1. Общий статус

| Этап | Статус | Комментарий |
|---|---|---|
| Pipeline (IMPL-PIPELINE.md) | **✓ Готов** | 6 скриптов + оркестратор + verify, атомарная генерация |
| Runtime (IMPL-RUNTIME.md) | **✓ Готов** | Все Tasks 1-8 + notice + тесты |
| `npm test` | **193 passed (14 files)** | obsolete-сьют исключён из vitest |
| `npm run build` | **OK** | Vite + PWA билд успешен |
| `npm run build:data` | **OK** | Все 27×3 + lexicon + config |
| `npm run verify:data` | **0 errors, 41 warnings** | Все предупреждения ожидаемые (§4); см. также раздел «Alignment Fixup (F0–F4)» ниже |

> ⚠️ Разделы §4–§5 и §9 ниже отражают СТАРОЕ состояние (coverage 53.5%, гейт 90%). Актуальное
> состояние и модель гейта — в разделе **«Alignment Fixup (F0–F4)»** в конце документа. Гейт «90%
> coverage» ОТМЕНЁН (см. VISION.md §6): hard-gate теперь = accuracy-инвариант + полное разбиение
> токенов; coverage — advisory.

---

## 2. Созданные файлы

### Pipeline scripts (`scripts/`)

| Файл | Назначение | Строк |
|---|---|---|
| `scripts/lib/lexeme-slug.mjs` | Детерминированная карта lexemeId→slug (5468 лемм, 97 коллизий разрешены) | 60 |
| `scripts/lib/versions.mjs` | Единый источник версий (`sourceDataVersion`, `normalizationVersion`, sha256) | 10 |
| `scripts/lib/fs.mjs` | Общие файловые утилиты (DATA_ROOT через BUILD_DATA_DIR) | 30 |
| `scripts/build-bibles.mjs` | Греческие книги (27) + BSB книги (27) | 210 |
| `scripts/build-lexicon.mjs` | core.json (5468 записей) + dictionary.json (5624 Strong's) | 230 |
| `scripts/build-align.mjs` | Span-based alignment (27 книг), 4 прохода, build report | 330 |
| `scripts/build-app-config.mjs` | alphabet, books, data-manifest (SHA-256) | 85 |
| `scripts/build-data.mjs` | Атомарный оркестратор (tmp dir → rename → backup cleanup) | 75 |
| `scripts/verify-data.mjs` | 21 проверка целостности данных | 350 |

### Изменённые runtime-файлы

| Файл | Изменения |
|---|---|
| `src/data/bible-loader.js` | Новые пути `bibles/grc`, `bibles/eng`, `align/grc-eng`; cache-busting через manifest.version; `loadAlphabet` |
| `src/data/lexicon-loader.js` | `core.json` (5468) вместо `top1000.core.json`; `dictionary.json`; lexemeId-first адаптация |
| `src/engine/form-layer.js` | `lexemeId` как канонический ключ; `buildDictByLexemeId`; overlap guard; q="u"/"x" фильтрация |
| `src/engine/compose.js` | `buildDictByLexemeId`; JSDoc под BSB source text |
| `src/ui/screens/reading.js` | `eng` вместо `syn`; lexemeId-first индексы (`coreByIdCache`, `coreByLegacyKey`, `lexemeIdKnownSet`); `collectWordData` с каноническим ключом; `CSS.escape` в `onMarkStatus`; BSB data notice banner |
| `src/ui/screens/about.js` | BSB, SBLGNT/MACULA, Cherith лицензии; удалён Синодальный |
| `src/ui/screens/dictionary.js` | Нейтральный wording ("проверенное соответствие в тексте") |
| `src/ui/render.js` | `data-lexeme-id` + `data-lexeme` + `data-lexeme-key` (совместимость) |
| `src/ui/components/top-bar.js` | "Показать обычный текст BSB" |
| `src/ui/components/mode-widget.js` | "0% — чистый BSB"; "Показывать английский текст BSB под стихом" |
| `src/ui/components/word-card.js` | JSDoc "исходное слово перевода" |
| `src/state/dictionary.js` | `migrateDictionaryData` + `saveMigrationResults` + merge logic; `countActiveWords` на lexemeId |
| `src/state/settings.js` | `dismissedNotices: []` в defaults |
| `vite.config.js` | Новые runtime кеши `book-packs-v2`, `lexicon-data-v2`; globIgnores для data/bibles, data/lexicon |
| `src/app.js` | `cleanupOldDataCaches` после SW-регистрации |
| `assets/styles/app.css` | Стили для `.data-notice` баннера |
| `.gitignore` | `assets/.data-tmp-*`, `assets/data.backup-*` |
| `package.json` | Новые скрипты: `build:bibles`, `build:lexicon`, `build:align`, `build:app-config`, `build:data`, `verify:data` |

### Обновлённые тесты

| Файл | Изменения |
|---|---|
| `tests/form-layer.test.js` | `buildDictByLexemeId`; lexemeId в фикстурах; q="a"/"f" вместо "e"; BSB English verse text |
| `tests/lexicon.test.js` | `core.json` (5468) вместо `top1000.core.json`; проверка `lexemeId`/`lexemeSlug`/`legacyKeys`; `dictionary.json` |
| `tests/frequency-data.test.js` | `core.json` вместо `top1000.core.json`; поля v2 (`lexemeId`, `freqRank`, `freqTokenCount`) |

---

## 3. Сгенерированные данные (`assets/data/`)

```
assets/data/
├── bibles/grc/{27 книг}.json      — Greek tokens (137,740 total)
├── bibles/eng/{27 книг}.json      — BSB English with word offsets
├── align/grc-eng/{27 книг}.json   — Span-based alignment
├── align/grc-eng/build-report.json — Coverage report
├── lexicon/core.json              — 5,468 lexemes (9.7 MB)
├── lexicon/dictionary.json        — 5,624 Strong's entries
├── alphabet.json, books.json, data-manifest.json
```

**Размер:** 74.4 MB (87 файлов)

---

## 4. Результаты verify

```
✓ 27/27 grc books
✓ 27/27 eng books
✓ 27/27 alignment books
✓ verse counts match expected
✓ word offsets valid (0 errors)
✓ token counts: enriched = generated (0 lost)
✓ all 137,740 token IDs unique
✓ all tokens have required fields
✓ core.json: 5468/5468 lexemes
✓ all 5468 lexemeSlug unique
✓ no legacyKey conflicts
✓ all alignment pairs reference valid tokens
✓ all spans valid (0 errors)
✓ no overlapping spans (0 errors)
✓ alignment versions match grc/eng packs
✓ manifest consistent with files
✓ no source-only fields in app-ready data
✓ source snapshot matches expected hash
```

### Предупреждения (все ожидаемые)

| # | Предупреждение | Причина |
|---|---|---|
| 1–8 | Ref mismatches grc ↔ eng | Verse numbering differences between SBLGNT and BSB (Acts 19:41, Romans 16:24-27, 2Cor 13:14, 3John 1:15, Rev 12:18) — нормально |
| 9 | Coverage 53.5% < 90% | v1 алгоритм alignment без permutation pass и без ручных overrides. Требует доработки (см. §5) |
| 10 | Data size 74.4 MB > 60 MB | Основной вклад — `lexicon/core.json` (9.7 MB). Для v1.1 приемлемо |
| 11 | File > 5 MB: lexicon/core.json | 9.7 MB — ожидаемо для 5468 × полных attestedForms + allRefs |
| 12 | 8 ref mismatches | См. выше |

---

## 5. Анализ alignment coverage (ключевая проблема)

### Результат

**Non-function coverage: 53.5%** (threshold: 90%).

### Распределение по качеству

Текущий v1 алгоритм (exact → bracket-optional → phrase → fuzzy) даёт 53.5% покрытия non-function токенов. Основные причины низкого покрытия:

1. **Расхождение порядка слов (SOV vs SVO).** Греческие glosses следуют греческому порядку слов («to him said»), BSB — английскому («said to him»). Phrase pass требует contiguous-окна того же порядка → такие токены остаются unaligned.

2. **Функциональные слова в glosses.** Berean глоссы включают артикли и частицы в квадратных скобках (`[The] book`), которые не имеют соответствия в BSB (BSB: «record») → multi-word gloss не находит contiguous-окно.

3. **Лексическое расхождение.** Глосс «book» vs BSB «record» — разные слова, не ловятся exact/bracket-optional проходами. Lemma-gloss pass НЕ реализован в v1.

4. **Phrase pass ограничен contiguous-окнами.** Partial/subset совпадения («the Son of God» vs «Son of God») не поддерживаются v1.

### Путь к 90%

В порядке приоритета (без изменения архитектуры):
1. Добавить **lemma-gloss pass** (использует `englishGlosses`/`glossesEn` из lexemes.json как дополнительные кандидаты) — оценка +15-20%
2. Расширить **phrase pass** для subset-совпадений — оценка +5-10%
3. Добавить **permutation pass** для 2-3 слов (перестановки порядка) — оценка +3-5%
4. **Manual overrides** для top-100 unaligned лемм — оценка +2-3%

Ожидаемый результат после шагов 1-4: ~75-85%. Для достижения 90% может потребоваться более глубокая алгоритмическая работа (word-alignment ML, синтаксическое дерево).

---

## 6. Отчёт о сомнениях (bugs analysis)

### Подтверждённые проблемы

1. **Alignment coverage (53.5%) — критично.** Без доработки алгоритма или ручных overrides приложение НЕ проходит hard gate 90% для релиза. Это ожидаемо для v1 алгоритма, но требует решения до релиза 1.1.

2. **Verse numbering differences (8 стихов).** SBLGNT и BSB имеют разную нумерацию в нескольких местах (Acts 19:41, Romans 16:24-27 и др.). Alignment для этих стихов невозможен без cross-reference mapping. Это ожидаемо и задокументировано.

3. **Romans 16:24 отсутствует в SBLGNT.** Греческий текст заканчивается на 16:23, а BSB содержит 16:25-27. Это известная textual issue — SBLGNT помещает doxology после 16:23, BSB после 16:27. Не влияет на чтение, но требует awareness.

### Потенциальные риски

4. **IndexedDB миграция.** Код `migrateDictionaryData` написан, но НЕ протестирован на реальных пользовательских данных (тестов нет). Рекомендуется ручное тестирование на копии реальной БД перед деплоем.

5. **Cache-busting через manifest.version.** Зависит от того, что `data-manifest.json` всегда грузится с `cache: 'no-cache'`. Если старый SW отдаст закешированный manifest, версия не изменится и данные не обновятся до SW update. `cleanupOldDataCaches` смягчает, но не гарантирует на 100%.

6. **lexemeSlug с hex-суффиксами.** ~200 лемм имеют slug вида `logos-9adfa6` из-за коллизий. UI словаря должен показывать `lemma`/`ruGloss`, а не сырой slug — проверено: `lexemeSlug` используется только как display fallback, пользователь видит lemma/ruGloss.

7. **BSB data notice.** Баннер показывается один раз и закрывается кнопкой «Понятно». Если `settings.dismissedNotices` не сохранится (ошибка IndexedDB), notice появится снова — fail-soft, не блокирует чтение.

### Что НЕ сделано (сознательно)

- PoC на Матфее (Task 0b) — пропущен в пользу полной реализации; measurement делается по всем 27 книгам
- Manual alignments — файл `manual-alignments.json` не создан; при появлении подхватится автоматически
- Lemma-gloss pass — за пределами v1, см. план добора покрытия
- Permutation phrase pass — за пределами v1
- CI — не добавлен (AGENTS.md: не добавлять CI по своей инициативе)
- Custom service worker — не вводился; cleanup выполняется из app.js

---

## 7. Проверка лицензий

| Данные | Лицензия | Атрибуция в about.js |
|---|---|---|
| SBLGNT/MACULA | CC BY 4.0 | ✓ |
| Cherith Glosses | CC BY 4.0 | ✓ |
| Berean Interlinear | Public domain | N/A (не требуется) |
| BSB | Public domain | ✓ (источник) |
| Strong's Dictionary | Public domain | N/A (не требуется) |
| Gentium Plus | SIL OFL | ✓ |

---

## 8. Git status

Изменённые файлы (все изменения — наша реализация):

```
M  .gitignore
M  package.json
M  vite.config.js
M  src/app.js
M  src/data/bible-loader.js
M  src/data/lexicon-loader.js
M  src/engine/form-layer.js
M  src/engine/compose.js
M  src/ui/screens/reading.js
M  src/ui/screens/about.js
M  src/ui/screens/dictionary.js
M  src/ui/render.js
M  src/ui/components/top-bar.js
M  src/ui/components/mode-widget.js
M  src/ui/components/word-card.js
M  src/state/dictionary.js
M  src/state/settings.js
M  assets/styles/app.css
M  tests/form-layer.test.js
M  tests/lexicon.test.js
M  tests/frequency-data.test.js
?? scripts/              (новые скрипты)
?? assets/data/          (сгенерированные данные)
?? docs/implementation-report.md  (этот отчёт)
```

---

## 9. Следующие шаги

1. **Улучшить alignment** — добавить lemma-gloss pass как минимум; измерить coverage после
2. **Создать manual-alignments.json** — для top-100 unaligned лемм (после сбора статистики)
3. **Ручное тестирование IndexedDB миграции** — на копии реальной БД
4. **Smoke-тест на Netlify preview** — перед деплоем в production
5. **Деплой** — после достижения порога coverage или явного решения о его снижении

## Alignment Completion — Coverage Tracking (2026-06-25)

### Phase 0 — BSB Text Foundation
| Metric | Before | After |
|--------|--------|-------|
| NORMALIZATION_VERSION | bsb-text-v1 | bsb-text-v2 |
| Coverage (NF) | 53.5% | 53.7% |
| Aligned NF tokens | 38,562 | 38,727 |

### Phase 1 — Accuracy Hard-Gate
| Metric | Before | After |
|--------|--------|-------|
| Coverage (NF) | 53.7% | 54.3% |
| Bracket-optional pairs | 0 | ~400 |

### Phase 2 — Coverage Boost
- T2.1 (glossCherith): 54.3% → 73.1% (+18.8pp, +13,545 pairs)
- T2.2 (lexicon): 73.1% → 81.8% (+8.7pp, +6,299 pairs)
- **Total Phase 2:** 54.3% → 81.8% (+27.5pp)

| Metric | Phase 2 End |
|--------|-------------|
| Coverage (NF) | 81.8% |
| Aligned NF tokens | 58,971 |
| Verses with zero pairs | 17 |
| Overlap errors | 0 |
| verify:data errors | 0 |

---

## Alignment Fixup (F0–F4) — honest model + closed verification gaps (2026-06-25)

Ревью имплементации нашло, что `resolved==100%` был достигнут скриптом `bulk-curate.mjs`,
который пометил все 13 132 неразрешённых токена как `manual-exclusion` (выдав авто-результат за
ручную курацию). Этот fixup сделал модель честной и закрыл дыры верификации.

### Что изменено
- **Честная модель разрешения.** `bulk-curate.mjs` удалён; `manual-alignments.json` сброшен в пустой.
  `build-align.mjs` сам выводит категории для каждого не-выровненного `fw=false` токена:
  `no-bsb-verse` / `no-gloss` / `auto-deferred` (backlog с под-причиной), отдельно от человеческих
  `manual-exclusion`. Записи лежат в `exclusionsByRef` (schema `alignment-book-v3`).
- **Partition hard-gate** (`verify:data` Check 16d): каждый `fw=false` токен ровно в одной категории
  (aligned XOR одна resolution-kind); сверка с агрегатами build-report. Заменил «доверие к
  report.unresolved==0».
- **`q`↔`method` + запрет proposal** в Check 16; усиленная валидация `manual-alignments.json`
  (Check 15c: tokenId∈ref, fw===false, method-enum, wordIndex/expectedText); `findStripFields`
  рекурсит в массивы и сканирует все 27 книг + `lexicon/core.json`; **утечка `attestedForms`
  (`normalized`/`surfaceSearch`) устранена** в `build-lexicon.mjs`.
- **Аудит починен:** `audit-align.mjs` (`Map.entries`, exit≠0 при 0 пар) — реально аудирует 535 пар.
- `topUnalignedLexemes` строится из auto-deferred backlog (с `candidateCount`).

### Финальное состояние (партиция 72 102 NF-токенов)
| Категория | Кол-во | Что значит |
|---|---|---|
| aligned (пара) | **58 971** (81.8%) | выровнено, coverage advisory |
| auto-deferred (**backlog**) | **13 111** | алгоритм не разрешил: no-matching-word 8 194, ambiguous 4 464, already-claimed 453 |
| no-bsb-verse | 15 | нет BSB-стиха (romans 16:24, 3john 1:15, revelation 12:18) |
| no-gloss | 5 | обе глоссы пусты (перикопа john 7:53–8:11) |
| manual-exclusion (человек) | 0 | ручная курация не велась (сознательно отложена) |

> `auto-deferred` — это **технический долг/backlog**, НЕ «слова без английского эквивалента».
> Рабочий список для будущей курации — `build-report.topUnalignedLexemes` (топ: λέγω 427, εἰμί 418,
> πᾶς 225, θεός 217). На точность выровненных пар не влияет.

### Аудит точности (F2, seed=42, `audit-align.mjs` + `audit-claimed.mjs`)
- **fuzzy** (235/235, 100%): во всех просмотренных парах `slice == gloss` (weeping, baptize, Zebedee…). Ошибок нет.
- **proven** (50/метод): ошибок не найдено. `lexicon-gloss-exact` (6 335 пар) — **самый слабый тир**:
  формально валиден (slice ∈ глоссы лексемы), семантически почти всегда верен (ἀποκρίνομαι→replied,
  πᾶς→everyone), но встречаются «свободные, но допустимые» матчи (λέγω→"asked", οὗτος→"them"). Помечен
  как **audit-required** в доках; рекомендуется периодический ручной контроль.
- **already-claimed (453)** — расследование `audit-claimed.mjs`: 380 — один и тот же лексема-токен
  (два греческих токена одной леммы на одно английское слово, benign); 73 — разные леммы, но во ВСЕХ
  просмотренных случаях занявшая пара корректна (πᾶς→all, ἱερόν→temple, λέγω→said), а отложенный
  токен — синоним, который английский объединил. **Мис-пэйрингов не найдено.**

### Гейты после fixup
`npm run verify:data` → 0 errors, 41 warnings (accuracy invariant holds; partition complete).
`npm test` → 193 passed (14 files). `npm run build` → OK. `node scripts/audit-align.mjs` → 535 audited, exit 0.
