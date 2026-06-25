# План правок после имплементации (accuracy-first, honest data model)

> **Контекст.** `ALIGNMENT-COMPLETION-PLAN.md` имплементирован (коммиты d805ba41 → 97f62b54),
> гейты зелёные, accuracy-инвариант держит. Это ревью нашло **3 P0 + 5 P1**, проверенных по
> коду/данным 2026-06-25. План ниже их закрывает. Решение продукта: **«честный релейбл +
> аудит риска»** — авто-исключения не выдаём за ручную курацию; точность важнее покрытия;
> coverage остаётся advisory (81.8%).
>
> **Правила (как раньше):** `assets/data/**` руками НЕ редактируем (только скрипт+регенерация);
> после каждой задачи — зелёный `verify:data` + коммит-контрольная точка; отмечай `- [x]` по
> критерию приёмки, не по факту написания кода.

---

## 0. Что именно сломано (проверено по коду/данным)

| # | Sev | Факт (проверено) | Где |
|---|---|---|---|
| 1 | **P0** | `audit-align.mjs` аудирует **0 пар**: `Object.entries(pairsByMethod)` по `Map` → `[]`. T4.2 (семантика, уровень c) фактически не выполнен. | `scripts/audit-align.mjs:87,111` |
| 2 | **P0** | `bulk-curate.mjs` записал **13 132** `manual-exclusion` (8190 no-matching-word, 4465 ambiguous, 456 already-claimed, 15 no-bsb-verse, 6 no-gloss). Только **21 легитимны**; **13 111** — «алгоритм не смог», выдано за «человек исключил». | `scripts/bulk-curate.mjs`; `manual-alignments.json` (13132 entries) |
| 3 | **P0** | `verify:data` НЕ делает hard-gate на `unresolved==0` и не пересчитывает разбиение из реальных токенов — доверяет числу из report. | `scripts/verify-data.mjs` (нет проверки) |
| 4 | **P1** | Валидация `manual-alignments.json` слабая: не проверяет `tokenId ∈ ref`, `fw===false`, валидность `method`, `wordIndex`/`expectedText` для пар. | `verify-data.mjs:405-425` |
| 5 | **P1** | `q` не валидируется против `method`; `proposal`-tier не запрещён в релизных данных. Текущие данные чисты (proven=a, fuzzy=f), но защиты нет. | `verify-data.mjs:506-541` |
| 6 | **P1** | `findStripFields` не рекурсит в массивы (Appendix B [P1] не починен). | `verify-data.mjs:814` |
| 7 | **P1** | **T4.3 не выполнен** (хотя коммит назван «doc sync»): VISION.md:232 и IMPL-PIPELINE.md:174 требуют «90% — hard gate»; `implementation-report.md` устарел (12 warnings/53.5%/«путь к 90%», факт 41/81.8%). | `docs/VISION.md`, `docs/IMPL-PIPELINE.md`, `docs/implementation-report.md` |
| 8 | P2 | `topUnalignedLexemes`/`candidateCount` — заглушка (сейчас пусто: всё «исключено»). Check 19 — только первые 3 книги. | `build-align.mjs` buildReport; `verify-data.mjs:823` |

**Отклонено как неверное:** `grk` в доках (0 вхождений); конфликт pair-vs-exclusion частично уже
ловится (дубль-tokenId в Check 15c).

**Что НЕ сломано (точность цела):** массовое исключение неверных пар НЕ добавило — accuracy-инвариант
держит, q/method в данных консистентны, span'ы валидны. Проблема — честность модели данных и
непроверенная семантика, а не повреждённое выравнивание.

## 1. Целевая модель данных (honest, partition)

Каждый не-служебный (`fw===false`) токен попадает РОВНО в одну категорию (разбиение):

| Категория | Кто ставит | Где хранится | Считается «aligned»? |
|---|---|---|---|
| `aligned` (пара) | алгоритм/человек | `pairsByRef` | да (вклад в coverage) |
| `manual-exclusion` | **человек**, рукописный `reason` | `manual-alignments.json` | нет (resolved) |
| `no-bsb-verse` | авто (нет BSB-стиха) | derived в build | нет (resolved) |
| `no-gloss` | авто (обе глоссы пусты) | derived в build | нет (resolved) |
| `auto-deferred` | **авто** («алгоритм не разрешил», sub-reason) | derived в build | нет (**backlog**, виден в report) |

- **`auto-deferred` ≠ `manual-exclusion`.** Это честная замена 13 111 фейковых ручных исключений.
  Под-причины: `no-matching-word`, `ambiguous-N`, `already-claimed`.
- `auto-deferred`/`no-bsb-verse`/`no-gloss` **вычисляются build-align автоматически** (он уже
  эмитит `unaligned`-warnings) — их НЕ надо хранить в человеческом `manual-alignments.json`.
- **`resolved = aligned ∪ manual-exclusion ∪ no-bsb-verse ∪ no-gloss ∪ auto-deferred`** — по
  построению покрывает всё, поэтому реальный hard-gate — не «resolved==100%», а **«разбиение
  корректно: каждый токен ровно в одной категории, ничего не потеряно и не задвоено»** + точность.
- **Coverage% = доля `aligned`** = 81.8% (advisory). `auto-deferredCount` — явный backlog в report.

---

# Фаза F0 — Честная модель исключений (убрать фейковую ручную курацию)

### - [ ] F0.1 — Расширить enum exclusion в `align-normalize.mjs`

- **Файл:** `scripts/lib/align-normalize.mjs` (`ALIGN_METHODS` + новый экспорт).
- **Действие:** добавить реестр категорий разрешения, отдельный от методов пар:
  ```js
  export const RESOLUTION_KINDS = {
    'manual-exclusion': { source: 'human',  countsAligned: false },
    'no-bsb-verse':     { source: 'auto',   countsAligned: false },
    'no-gloss':         { source: 'auto',   countsAligned: false },
    'auto-deferred':    { source: 'auto',   countsAligned: false }, // backlog
  };
  export const AUTO_DEFER_REASONS = ['no-matching-word', 'ambiguous', 'already-claimed'];
  ```
- **Критерий приёмки:** экспорт доступен; `npm test` зелёный.
- **Промпт:**
  > В `scripts/lib/align-normalize.mjs` добавь экспорты `RESOLUTION_KINDS` и `AUTO_DEFER_REASONS`
  > (см. план F0.1). Не меняй `ALIGN_METHODS`. Это словарь категорий для build/verify.

### - [ ] F0.2 — build-align сам вычисляет авто-категории; убрать 13 111 фейковых записей

- **Файлы:** `scripts/build-align.mjs` (`buildAlignmentForBook`, buildReport); удалить
  `scripts/bulk-curate.mjs`; пересоздать `docs/source-data/alignments/grc-eng/manual-alignments.json`.
- **Действие:**
  1. В `buildAlignmentForBook` для каждого `fw===false` токена, не получившего пару и не покрытого
     ЧЕЛОВЕЧЕСКОЙ записью из `manual-alignments.json`, определить авто-категорию:
     - нет BSB-стиха для ref → `no-bsb-verse`;
     - обе глоссы пусты → `no-gloss`;
     - иначе → `auto-deferred` с sub-reason: посчитать кандидатов (как в bulk-curate.mjs:100-116) →
       0 ⇒ `no-matching-word`, >1 ⇒ `ambiguous` (с `candidateCount`), ==1-но-занято ⇒ `already-claimed`.
     Писать это в `warningsByRef[ref]` как `{ tokenId, lexemeId, kind, reason, candidateCount? }`.
  2. `manual-alignments.json` → `{ "normalizationVersion": "bsb-text-v2", "entries": [] }`
     (генерируется как файл-сид, человеческих записей пока нет; bulk-данные выкинуть).
  3. Удалить `scripts/bulk-curate.mjs` (антипаттерн — фейковая курация).
- **Критерий приёмки:** `manual-alignments.json` снова пуст (или только реальные человеческие
  записи); build-report содержит `autoDeferredCount` (≈13 111) с разбивкой по sub-reason и
  `manualExclusionCount`, `noBsbVerseCount` (15), `noGlossCount` (6) раздельно; `verify:data` зелёный.
- **Промпт:**
  > Удали `scripts/bulk-curate.mjs`. Перезапиши `docs/source-data/alignments/grc-eng/manual-alignments.json`
  > = `{"normalizationVersion":"bsb-text-v2","entries":[]}`. В `build-align.mjs` для каждого
  > `fw===false` токена без пары и без человеческой записи вычисли авто-категорию (`no-bsb-verse` /
  > `no-gloss` / `auto-deferred` с sub-reason `no-matching-word|ambiguous|already-claimed`,
  > считая кандидатов как в старом bulk-curate). Запиши в `warningsByRef`. В buildReport добавь
  > раздельные счётчики `autoDeferredCount` (+breakdown), `manualExclusionCount`, `noBsbVerseCount`,
  > `noGlossCount`. Прогон `build:data` + `verify:data`.

---

# Фаза F1 — Закрыть дыры верификации (P0/P1)

### - [ ] F1.1 — Починить `audit-align.mjs` (Map.entries; падать при 0; писать в отчёт)

- **Файл:** `scripts/audit-align.mjs:87,111`.
- **Действие:** `Object.entries(pairsByMethod)` → `pairsByMethod.entries()` (строка 87) и
  `[...pairsByMethod.entries()].sort(...)` (строка 111). Если `totalAudited === 0` → `process.exit(1)`
  (защита от тихого провала). Добавить запись сводки (метод|тир|sample size) в
  `docs/implementation-report.md` (или печать с пометкой «вставить в отчёт вручную после просмотра»).
- **Критерий приёмки:** `node scripts/audit-align.mjs` печатает непустую выборку (proven 50/метод,
  100% fuzzy/manual), `Total audited > 0`, exit 0; при искусственно пустых данных — exit 1.
- **Промпт:**
  > В `scripts/audit-align.mjs` замени `Object.entries(pairsByMethod)` на `pairsByMethod.entries()`
  > (строки 87 и 111 — для 111 используй `[...pairsByMethod.entries()].sort(...)`). После цикла:
  > `if (totalAudited === 0) { console.error('AUDIT FOUND 0 PAIRS'); process.exit(1); }`. Запусти,
  > убедись, что выборки печатаются.

### - [ ] F1.2 — verify: hard-gate разбиения + `q`↔`method` + запрет proposal в релизе

- **Файл:** `scripts/verify-data.mjs` (новый Check + дополнение Check 16).
- **Действие:**
  1. **Partition hard-gate (заменяет хилое «resolved==100%»):** пройти все `fw===false` grc-токены;
     для каждого определить категорию из реальных данных (пара в `pairsByRef` ИЛИ запись в
     `warningsByRef` с `kind ∈ RESOLUTION_KINDS` ИЛИ человеческая `manual-exclusion`). Проверить:
     каждый токен ровно в ОДНОЙ категории; нет «нигде» (uncategorized) → `error`; нет «в двух»
     (например, и пара, и exclusion) → `error`. Пересчитать `aligned/resolved/autoDeferred` из этого
     прохода и сверить с build-report (как Check 16c, но для разбиения).
  2. В Check 16 (accuracy) добавить: `pair.q === ALIGN_METHODS[pair.method].q` иначе `error`;
     `ALIGN_METHODS[pair.method].tier === 'proposal'` в релизных данных → `error` (proposal не
     допускается без отдельного audited-флага).
- **Критерий приёмки:** на текущих данных Check проходит (после F0.2); искусственная пара с
  `q` не по методу или токен без категории → `verify:data` exit 1.
- **Промпт:**
  > В `verify-data.mjs` добавь Check «alignment partition»: для всех `fw===false` токенов из
  > `bibles/grc/*.json` определи категорию (пара / auto-kind из `warningsByRef` / human
  > manual-exclusion); `error` если токен в 0 или в ≥2 категориях; пересчитай и сверь
  > `aligned/autoDeferred/resolved` с build-report. В Check 16 добавь `error`, если
  > `pair.q !== ALIGN_METHODS[pair.method].q` или `tier==='proposal'`. Прогон verify.

### - [ ] F1.3 — Усилить валидацию `manual-alignments.json`

- **Файл:** `scripts/verify-data.mjs` (Check 15c, строки 405-425).
- **Действие:** для каждой ЧЕЛОВЕЧЕСКОЙ записи дополнительно проверять (через загрузку
  `bibles/grc/<book>.json` и `bibles/eng/<book>.json` по ref):
  - `tokenId` существует в grc-токенах ИМЕННО этого `ref`; иначе `error`;
  - токен `fw===false`; иначе `error`;
  - `method ∈ {'manual','manual-exclusion'}`; иначе `error`;
  - для `manual` (пара): есть `wordIndex` ИЛИ `wordIndexes` в границах `words[]`, скомпилированный
    span содержит буквы, `verse.text.slice(span) === expectedText`; иначе `error`;
  - конфликт: один `tokenId` не может иметь и пару, и exclusion (дубль-tokenId уже ловится — оставить).
- **Критерий приёмки:** пустой сид проходит; добавленная битая запись (несуществующий tokenId /
  wrong expectedText) → `error`.
- **Промпт:**
  > В `verify-data.mjs` Check 15c расширь валидацию: загрузи grc/eng по ref записи; проверь, что
  > `tokenId` есть в токенах этого ref и `fw===false`; `method ∈ {manual,manual-exclusion}`; для
  > `manual` — `wordIndex(es)` в границах, span содержит буквы, `slice===expectedText`. Несоответствие
  > → `error`. Добавь юнит-тест с битой записью во временной фикстуре (НЕ правь сгенерированные данные).

### - [ ] F1.4 — `findStripFields` рекурсия в массивы + Check 19 на все книги

- **Файл:** `scripts/verify-data.mjs:807-826`.
- **Действие:** в `findStripFields` рекурсить и в элементы массивов (сейчас `!Array.isArray` это
  блокирует). Check 19 прогнать по всем 27 книгам (или по всем + lexicon; если перф критичен —
  оставить комментарий с замером, но по умолчанию все).
- **Критерий приёмки:** verify ловит strip-поле, спрятанное в массиве объектов; Check 19 покрывает
  все книги; `verify:data` зелёный (если утечки нет) либо точно указывает поле.
- **Промпт:**
  > В `verify-data.mjs` `findStripFields` (807): обрабатывай массивы — для каждого элемента-объекта
  > рекурсивно вызывай `findStripFields(el, path[i])`. На строке 823 замени `NT_BOOKS.slice(0,3)` на
  > все книги. Прогон verify. (Связано с Appendix B [P1] утечки `attestedForms` — см. F3/трек B.)

### - [ ] F1.5 — Реальные `topUnalignedLexemes` + `candidateCount` (из auto-deferred)

- **Файл:** `scripts/build-align.mjs` (buildReport).
- **Действие:** собрать `topUnalignedLexemes` из множества `auto-deferred` (не из пустого «unresolved»):
  частота по `lexemeId`, пример `gloss`, до 3 `sampleRefs`, `candidateCount` (макс. из `ambiguous`
  sub-reason). Сортировка desc, топ-200. Это рабочий список для возможной будущей курации.
- **Критерий приёмки:** `topUnalignedLexemes` непуст и отсортирован; топовые леммы видны
  (ожидаемо: Jesus, Lord, Christ, God…).
- **Промпт:**
  > В `buildReport` собери `topUnalignedLexemes` из `auto-deferred`-записей `warningsByRef`: дедуп
  > `ref+tokenId`, частота по `lexemeId`, `gloss`, до 3 `sampleRefs`, `candidateCount` из ambiguous.
  > Топ-200 desc. Прогон, проверь поле.

---

# Фаза F2 — Аудит риска точности (456 already-claimed + выборки)

### - [ ] F2.1 — Расследовать `already-claimed` (потенциальный мис-пэйринг порядка проходов)

- **Действие:** для всех ~456 `auto-deferred/already-claimed` токенов: слово матчит глоссу, но занято
  ДРУГОЙ парой. Скрипт печатает `ref | grc-токен(lemma,morph,gloss) | конкурирующая пара (её токен,
  метод, slice)`. Куратор смотрит: правильно ли РАННЯЯ пара заняла слово, или это её следовало
  отдать текущему токену (мис-пэйринг). Если найдены ошибки → зафиксировать как кандидатов на
  ручную пару/перестановку (вне scope этой итерации, но задокументировать).
- **Критерий приёмки:** список просмотрен; доля настоящих мис-пэйрингов оценена и записана в
  `docs/implementation-report.md`. Если мис-пэйрингов >0 — отметить как известный технический долг.
- **Промпт:**
  > Напиши `scripts/audit-claimed.mjs`: найди все `auto-deferred` с sub-reason `already-claimed`;
  > для каждого выведи токен и пару, что заняла его слово (tokenId, method, slice). Просмотри,
  > оцени долю мис-пэйрингов, запиши вывод в `docs/implementation-report.md`.

### - [ ] F2.2 — Прогнать seeded-аудит и зафиксировать результат (закрыть T4.2 по сути)

- **Действие:** после F1.1 запустить `audit-align.mjs`; человек просматривает: proven 50/метод
  (особое внимание `lexicon-gloss-exact` — 6334 пар, семантически слабее: единственность по
  лемма-глоссе не доказывает, что именно этот токен переведён этим словом), 100% fuzzy (235), 100%
  manual (0). Записать долю верных в `docs/implementation-report.md` с указанием seed.
- **Критерий приёмки:** в отчёте есть таблица «метод | выборка | доля верных | найденные ошибки»;
  для proven ≥99.5%, fuzzy 100%. `lexicon-gloss-exact` помечен как «audit-required tier» в доках.
- **Промпт:**
  > Запусти `node scripts/audit-align.mjs`, просмотри выборки (особенно `lexicon-gloss-exact`),
  > занеси «метод | размер | доля верных | ошибки | seed=42» в `docs/implementation-report.md §аудит`.
  > Если для метода доля < порога — заведи задачу на пересмотр метода.

---

# Фаза F3 — Синхронизация документов (выполнить T4.3 по-настоящему)

### - [ ] F3.1 — `VISION.md`

- **Файл:** `docs/VISION.md` (§6, строки ~232-241, 290).
- **Действие:** заменить «≥90% coverage — hard gate / релиз блокируется / порог 90% не понижается»
  на: **hard-gate = (a) accuracy-инвариант + (b) корректное разбиение всех `fw=false` токенов;
  coverage% — advisory (текущее 81.8%), порога нет.** Описать категории (`aligned` /
  `manual-exclusion` / `no-bsb-verse` / `no-gloss` / `auto-deferred`-backlog). Уточнить §290
  («доля ненажимаемых слов» = auto-deferred + exclusions, это ожидаемо и не блокирует релиз).
- **Критерий приёмки:** в VISION нет «90% блокирует релиз»; описана новая модель гейта.

### - [ ] F3.2 — `IMPL-PIPELINE.md`

- **Файл:** `docs/IMPL-PIPELINE.md` (Task 0b ~172-193, Task 4, Task 7/verify).
- **Действие:** убрать «≥90% non-function coverage — жёсткий релизный гейт»; задокументировать
  тиринг методов, схему `q`/`method`/exclusion, авто-категории и `auto-deferred`-backlog, новый
  partition-Check и accuracy-инвариант. Терминология `grc` (уже без `grk`).
- **Критерий приёмки:** IMPL-PIPELINE не противоречит коду; нет «90% hard gate».

### - [ ] F3.3 — `implementation-report.md`

- **Файл:** `docs/implementation-report.md` (§4 строка 18, §9 строки 116-157, 244-262).
- **Действие:** обновить реальными числами: `0 errors, 41 warnings`; `aligned 58 970`;
  coverage 81.8%; `auto-deferred 13 111` (разбивка: no-matching 8190, ambiguous 4465, already-claimed
  456) как **явный backlog/тех-долг**; `manual-exclusion 21` (15 no-bsb-verse + 6 no-gloss);
  убрать секцию «путь к 90%» (порог отменён); вставить результаты аудита (F2.2) и расследования
  already-claimed (F2.1). Явно записать: «13 111 токенов отложены (auto-deferred), не выровнены и не
  курированы вручную — backlog для будущих итераций; на точность не влияют».
- **Критерий приёмки:** отчёт соответствует фактическому состоянию; тех-долг зафиксирован.

---

# Фаза F4 — Финальный гейт

### - [ ] F4.1 — Полная регенерация и зелёные гейты

- **Критерий приёмки:** `npm run build:data` → `npm run verify:data` (0 errors; accuracy-инвариант;
  partition-gate; раздельные счётчики; `q↔method`) → `npm test` → `npm run build` → `node
  scripts/audit-align.mjs` (`Total audited > 0`) — всё зелёное; числа в report/доках синхронны.

---

# Приложение — НЕ-выравнивательные баги (трек B, из Appendix B прошлого плана)

Статус по ревью: **не тронуты**, кроме связи F1.4 с утечкой `attestedForms`. Приоритет — отдельно.

- [ ] **[P0] Словарный UI сломан** (`lexicon-loader.js:55-77` ↔ `dictionary.js:388,394,397`) — форма
  данных не совпадает (`strong` массив vs скаляр, нет `hasAlignment`). Можно делать параллельно.
- [ ] **[P1] Миграция словаря не вызывается** (`state/dictionary.js:84,117` без call-site).
- [ ] **[P1] Утечка `attestedForms`** (`build-lexicon.mjs:183`) — `normalized`/`surfaceSearch` в
  core.json; чинится вместе с F1.4 (рекурсия `findStripFields` в массивы её и поймает).
- [ ] **[P2]** cache-busting `core.json`; **[P2]** онбординг-примеры; **[P3]** комментарии/`ruHint`.
