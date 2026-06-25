# План: довести grc↔eng выравнивание до конца (accuracy-first)

> Статус: НЕ НАЧАТО. Отмечай `- [x]` только когда выполнен **критерий приёмки** задачи
> (а не просто написан код). Задачи идут строго по порядку: каждая фаза опирается на
> предыдущую. Каждая задача самодостаточна — внутри есть файлы, действие, критерий и
> готовый промпт для LLM-разработчика.

## Принцип (решение продукта от 2026-06-25)

- **Точность выровненных пар — hard-gate. 100% точность важнее % покрытия.**
  Если хотя бы одна пара не проходит инвариант точности — `verify:data` падает,
  релиз заблокирован.
- **Покрытие (coverage %) — только предупреждение (warn), релиз НЕ блокирует.**
- **«Выравнивание завершено» = каждый не-служебный (`fw===false`) греческий токен
  РАЗРЕШЁН**, то есть либо (а) выровнен парой `q ∈ {a, f, manual}`, либо (б) явно
  помечен как невыравниваемый (`manual-exclusion` с причиной — например, греческое
  слово без английского соответствия). `resolved = aligned ∪ excluded`. Coverage% —
  это доля `aligned`, и она может быть < 100% при `resolved == 100%`.
- Любой автоматический проход добавляет пару **только при единственном кандидате**
  (`candIndices.length === 1`) — это существующая гарантия от угадывания, её НЕ ослаблять.

## Измеренные факты (на которых стоит план)

- Всего не-служебных grc-токенов: **72 102**. Сейчас выровнено **38 562** (53.5%),
  из них `q="a"` — 38 305, `q="f"` — 257. Пустых стихов (0 пар): 150.
- **36 089 токенов (50%) имеют `glossCherith ≠ glossBerean`.** Berean несёт предлог/артикль
  внутри глоссы (`"of God"`, `"of Christ"`, `"a called"`, `"having been sanctified"`),
  что не матчит одно слово BSB; Cherith даёт чистую форму (`"God"`, `"Christ"`, `"called"`,
  `"sanctified"`) — точный матч одного слова. Сейчас `altGloss = t.glossCherith`
  вычисляется в `build-align.mjs:73`, но **не используется**.
- **142 стиха** содержат склейку слов из-за бага сборки BSB-текста
  (`build-bibles.mjs:185` `parts.join('')`): `overcomeit`, `withwater`, `onlySon`,
  `meal.While`, `themand`, `Him,He`. Это портит и отображение, и токенизацию, и span'ы
  выравнивания → **прямое нарушение точности**. Фаза 0 чинит это первым.
- 11 350 ambiguous-кандидатов (глосса матчит >1 слова BSB) сознательно не выровнены —
  кандидаты на Фазу 2.4 (безопасно) и Фазу 3 (ручная курация).

## Гейты (запускать в прайс-листе задач)

```bash
npm test            # быстрый гейт после каждого изменения кода
npm run build:data  # регенерация данных (bibles → lexicon → align → app-config)
npm run verify:data # проверки целостности + НОВЫЙ accuracy hard-gate
npm run build       # полный гейт перед «готово»
```

---

# Фаза 0 — Починить фундамент (BSB-текст). БЛОКИРУЕТ всё остальное.

Выравнивание строится по `assets/data/bibles/eng/*.json` (`verse.text` + `verse.words`).
Пока текст склеен, span'ы в 142 стихах мусорные. Сначала чиним текст, потом всё регенерим.

### - [ ] T0.1 — Починить сборку текста стиха (потеря пробелов на границах фрагментов)

- **Файл:** `scripts/build-bibles.mjs:185-204` (`collectVerseContentText`), склейка на строке 203.
- **Причина:** контент стиха — массив строк/объектов; `{noteId}` пропускается, а пробел,
  стоявший на его месте, теряется (`["…overcome",{noteId},"it."].join('') → "…overcomeit."`).
  Аналогично на границах двух строковых фрагментов (`"…his meal.","While…" → "meal.While"`).
- **Действие:** собирать текст с учётом границ. Вставлять один пробел между фрагментами,
  когда: предыдущий аккумулятор непуст и НЕ кончается пробелом, следующий фрагмент НЕ
  начинается с пробела и НЕ начинается со «слипающейся» пунктуации `[,.;:!?’'")\]}]`.
  Объект `{text}` обрабатывать как строковый фрагмент; `{lineBreak}` → `' '`; `{noteId}` →
  пропуск (как сейчас). В конце `.replace(/\s{2,}/g,' ').trim()`.
- **Критерий приёмки:** John 1:5 → `…and the darkness has not overcome it.`;
  John 3:5 → `…born of water and the Spirit…`; нет регрессий в чистых стихах
  (1 Corinthians 1:1 остаётся посимвольно прежним). Тест T0.2 зелёный.
- **Промпт:**
  > В `scripts/build-bibles.mjs` функция `collectVerseContentText` (строки 185-204) теряет
  > пробелы на границах фрагментов: `parts.join('')` склеивает `"overcome"`+`"it."` в
  > `"overcomeit"`, потому что пробел стоял на месте пропущенного `{noteId}`. Перепиши сборку
  > так: вместо `parts.push(...)` + `join('')` аккумулируй строку и перед добавлением
  > очередного непустого фрагмента `s` вставляй ОДИН пробел, если выполнено всё: аккумулятор
  > непуст, `!/\s$/.test(acc)`, `!/^\s/.test(s)`, `!/^[,.;:!?’'")\]}]/.test(s)`. `{text}`
  > обрабатывай как строку, `{lineBreak}` → `' '`, `{noteId}` пропускай. В конце примени
  > `.replace(/\s{2,}/g,' ').trim()`. НЕ меняй `tokenizeWords`. Запусти `npm run build:bibles`
  > и проверь John 1:5 = `"…and the darkness has not overcome it."` и John 3:5 содержит
  > `"water and the Spirit"`. Затем сделай задачу T0.2.

### - [ ] T0.2 — Инвариант-тест на склейку слов

- **Файл:** новый `tests/bsb-text-integrity.test.js`.
- **Действие:** два уровня проверки по `assets/data/bibles/eng/*.json`:
  1. **Снапшоты конкретных ранее-битых стихов** (точное равенство `verse.text`): John 1:5,
     John 3:5 (`withwater`), 1 John 4:9 (`onlySon`), 1 Corinthians 11:21 (`meal.While`),
     2 Corinthians 6:17 (`themand`), 1 Peter 2:23 (`Him,He`). Это ловит и нижне-регистровые
     склейки (`overcomeit`), которые регэкспом не отличить.
  2. **Sweep всех стихов:** нет совпадений `/[a-z][A-Z]/`, `/[a-z]\.[A-Z]/`, `/[a-z],[A-Z]/`
     в `verse.text` (ловит класс склеек на границе предложения/заглавной буквы).
- **Критерий приёмки:** `npm test` зелёный; обе проверки проходят на свежесгенерированных данных.
- **Промпт:**
  > Создай `tests/bsb-text-integrity.test.js` (vitest). Прочитай все `assets/data/bibles/eng/*.json`.
  > Тест A: для стихов `john 1:5`, `john 3:5`, `1john 4:9`, `1corinthians 11:21`,
  > `2corinthians 6:17`, `1peter 2:23` сравни `verse.text` с ожидаемыми строками (сначала
  > сгенерируй данные после T0.1 и вставь фактические корректные строки как ожидаемые
  > снапшоты — убедись глазами, что в них есть пробелы: `overcome it`, `of water and`,
  > `only Son`, `meal. While`, `them and`, `Him, He`). Тест B: пройди по ВСЕМ стихам и
  > проверь, что `verse.text` не матчит ни `/[a-z][A-Z]/`, ни `/[a-z]\.[A-Z]/`, ни
  > `/[a-z],[A-Z]/`; при совпадении выведи `ref` и фрагмент. Запусти `npm test`.

### - [ ] T0.3 — Полная регенерация данных после фикса текста

- **Действие:** `npm run build:data` (атомарно: bibles → lexicon → align → app-config).
  Текст изменился → меняются `words[]` offsets → меняются span'ы выравнивания.
- **Критерий приёмки:** `build:data` завершается без ошибок; `john.json` больше не содержит
  `overcomeit`/`withwater`; число `versesWithZeroPairs` в build-report не выросло
  относительно 150 (а скорее уменьшилось, т.к. распавшиеся слова теперь матчатся).
- **Промпт:**
  > Запусти `npm run build:data`. Проверь, что `grep -c overcomeit assets/data/bibles/eng/john.json`
  > даёт 0. Сравни `nonFunctionCoveragePercent` и `versesWithZeroPairs` в
  > `assets/data/align/grc-eng/build-report.json` до/после — зафиксируй числа в описании коммита.

---

# Фаза 1 — Сделать точность hard-gate

Цель: машинно гарантировать, что КАЖДАЯ выровненная пара корректна (текст span'а
действительно соответствует глоссе токена тем методом, которым она была получена).

### - [ ] T1.1 — Вынести функции нормализации в общий модуль

- **Файлы:** новый `scripts/lib/align-normalize.mjs`; правки в `scripts/build-align.mjs`
  (строки 23-51) и `scripts/verify-data.mjs`.
- **Причина:** инвариант точности в verify должен использовать ТЕ ЖЕ `normalizeWord`,
  `normalizeBerean`, `fuzzyNormalize`, `tokenizeGloss`, `WORD_PATTERN`, что и build-align,
  иначе проверка не будет точным зеркалом и даст ложные срабатывания.
- **Критерий приёмки:** build-align и verify импортируют нормализацию из одного модуля;
  `npm run build:data` и `npm test` зелёные; поведение выравнивания не изменилось
  (build-report идентичен до/после рефакторинга).
- **Промпт:**
  > Создай `scripts/lib/align-normalize.mjs`, экспортируй `WORD_PATTERN`, `normalizeWord`,
  > `normalizeBerean`, `fuzzyNormalize`, `tokenizeGloss` — перенеси их дословно из
  > `scripts/build-align.mjs` (строки 23-51). В `build-align.mjs` замени локальные
  > определения импортом. Убедись, что `npm run build:align` даёт побайтово идентичный
  > `build-report.json` (кроме `generatedAt`). Модуль понадобится verify в T1.2.

### - [ ] T1.2 — Accuracy-инвариант в verify (hard error)

- **Файл:** `scripts/verify-data.mjs`, блок «Checks 15-15b» (строки 325-368) — там уже есть
  `engTexts` (текст стиха по ref). Добавить загрузку grc-токенов по `tokenId`
  (glossBerean/glossCherith) на книгу.
- **Действие:** для каждой пары проверять соответствие span↔глосса ПО МЕТОДУ:
  - `gloss-exact` / `alt-gloss-exact`: `normalizeWord(slice) === normalizeWord(gloss)` (одно слово);
  - `bracket-optional`: `normalizeWord(slice) === normalizeWord(normalizeBerean(gloss))`;
  - `phrase` / `alt-gloss-phrase`: `tokenizeGloss(slice).map(normalizeWord)` поэлементно равен
    `tokenizeGloss(gloss).map(normalizeWord)`;
  - `lexicon-gloss-exact` (Фаза 2.2): `normalizeWord(slice)` ∈ нормализованным глоссам лексемы;
  - `fuzzy` (`q="f"`): `fuzzyNormalize(slice) === fuzzyNormalize(gloss)`;
  - `manual` / `positional-equal-count`: проверять только границы и наличие букв (соответствие
    доверяем куратору/инварианту порядка), span в пределах текста.
  где `gloss` берётся из glossBerean токена (для alt-* — glossCherith). Любое несоответствие →
  `error(...)` (hard).
- **Критерий приёмки:** на текущих данных `verify:data` либо зелёный, либо точно указывает
  пары-нарушители (их чиним/исключаем). Появляется строка `ok('alignment accuracy invariant holds')`.
- **Промпт:**
  > В `scripts/verify-data.mjs` в блоке span-проверок (строки 325-368) для каждой книги
  > дополнительно построй `Map<tokenId, {glossBerean, glossCherith}>` из
  > `bibles/grc/<book>.json`. Импортируй нормализацию из `scripts/lib/align-normalize.mjs`.
  > Для каждой пары валидируй `verseText.slice(span)` против глоссы по правилу метода (см.
  > таблицу в T1.2 плана ALIGNMENT-COMPLETION-PLAN.md). При несоответствии вызывай `error(...)`
  > с `ref`, `method`, `slice`, `gloss`. Для `method` `manual`/`positional-equal-count` проверяй
  > только границы и наличие `[\p{L}\p{N}]`. В конце добавь `ok('alignment accuracy invariant holds')`,
  > если нарушений нет. Запусти `npm run verify:data`.

### - [ ] T1.3 — Покрытие → warn; подтвердить exit-код; обновить семантику порогов

- **Файлы:** `scripts/verify-data.mjs` (Check 17, строки 376-392 — уже `warn`);
  `scripts/build-align.mjs` (`thresholds`, строки 452-455).
- **Действие:** убедиться, что Check 17 остаётся `warn` (не блокирует). Убедиться, что любой
  `error(...)` приводит к `process.exitCode = 1` (если нет — добавить в финале verify).
  В `build-align.mjs` переименовать смысл порогов: добавить `accuracyInvariant: 'hard'`,
  пометить `nonFunctionCoverageMin` как `advisory`.
- **Критерий приёмки:** при искусственно сломанной паре `verify:data` выходит с кодом 1; при
  низком coverage без ошибок точности — код 0 (только warn). Проверить `echo $?`.
- **Промпт:**
  > В `scripts/verify-data.mjs` убедись, что функция `error()` инкрементит счётчик и что в конце
  > скрипта `if (errorCount > 0) process.exitCode = 1`. Оставь Check 17 (coverage) как `warn`.
  > В `scripts/build-align.mjs` объект `thresholds` (стр. 452-455) приведи к виду
  > `{ accuracyInvariant: 'hard', nonFunctionCoverageMin: 90, nonFunctionCoverageEnforced: false,
  > versesWithPairsMin: 95 }`. Проверь оба сценария exit-кодом: сломай одну пару руками →
  > `verify:data; echo $?` = 1; верни обратно → 0.

---

# Фаза 2 — Поднять покрытие БЕЗ потери точности (использовать неиспользуемый сигнал)

Каждый проход — только единственный кандидат, `q="a"`. Порядок проходов: Berean-проходы
(существующие 1-3) → новые Cherith-проходы → лексиконные глоссы. Berean выигрывает ничьи.

### - [ ] T2.1 — Проходы по `glossCherith` (exact / bracket / phrase)

- **Файл:** `scripts/build-align.mjs`, `alignVerse` (строки 57-261). `altGloss` уже есть (стр. 73).
- **Действие:** после Pass 3 (phrase по Berean) и до Pass 4 (fuzzy) добавить зеркальные
  проходы по `td.altGloss` (= glossCherith): single-word exact (`method:"alt-gloss-exact"`),
  bracket-optional (`"alt-gloss-bracket"`), phrase 2-4 слова (`"alt-gloss-phrase"`), все `q="a"`,
  только при `candIndices.length === 1`. Это закрывает кейсы Berean `"of God"` → Cherith `"God"`.
- **Критерий приёмки:** coverage заметно растёт (ожидание: на десятки %, т.к. 50% токенов имеют
  отличный Cherith); `verify:data` с инвариантом точности (T1.2) — зелёный (alt-* валидируются
  против glossCherith). 0 overlapping/duplicate span.
- **Промпт:**
  > В `scripts/build-align.mjs`, функция `alignVerse`: между Pass 3 (phrase) и Pass 4 (fuzzy)
  > добавь три прохода по `td.altGloss` (это `t.glossCherith`), полностью повторяющие логику
  > Pass 1 (exact, `method:"alt-gloss-exact"`), Pass 2 (bracket-optional, `"alt-gloss-bracket"`)
  > и Pass 3 (phrase, `"alt-gloss-phrase"`), `q:"a"`, claim только при единственном кандидате,
  > учёт `claimed[]` и `td.hasPair`. НЕ трогай существующие проходы. Запусти `npm run build:align`,
  > зафиксируй прирост `nonFunctionCoveragePercent`, затем `npm run verify:data` — инвариант
  > точности должен пройти (добавь обработку `alt-gloss-*` в T1.2, если ещё не сделал).

### - [ ] T2.2 — Проход по множественным глоссам лексемы

- **Файлы:** `scripts/build-align.mjs` (прокинуть core-глоссы в `alignVerse` через
  `buildAlignmentForBook`, читая `assets/data/lexicon/core.json` один раз в main).
- **Действие:** для ещё не выровненных токенов перебрать `glossesBerean[]` и `glossesCherith[]`
  лексемы (по `lexemeId`), каждую одно-словную глоссу пробовать как exact, single-candidate,
  `method:"lexicon-gloss-exact"`, `q="a"`.
- **Критерий приёмки:** дополнительный прирост coverage; `verify:data` зелёный
  (`lexicon-gloss-exact` валидируется как «slice ∈ глоссы лексемы»).
- **Промпт:**
  > Прочитай `assets/data/lexicon/core.json` один раз в main `build-align.mjs`, построй
  > `Map<lexemeId, {glossesBerean, glossesCherith}>`, прокинь в `buildAlignmentForBook` →
  > `alignVerse`. Добавь проход после T2.1-проходов: для токенов без пары перебери одно-словные
  > глоссы из обоих массивов лексемы, exact-match по несклеймленным словам BSB, claim при
  > единственном кандидате, `method:"lexicon-gloss-exact"`, `q:"a"`. Обнови инвариант T1.2:
  > для этого метода `normalizeWord(slice)` должен входить в нормализованное множество глосс
  > лексемы. Прогон + verify.

### - [ ] T2.3 — (опционально) Позиционная дизамбигуация при равном числе

- **Файл:** `scripts/build-align.mjs`, `alignVerse`.
- **Действие:** ТОЛЬКО для безопасного случая: если глосса токена матчит ровно N несклеймленных
  слов BSB И в стихе ровно N не-выровненных токенов с той же нормализованной глоссой — спарить
  их по порядку (i-й токен ↔ i-е слово). `method:"positional-equal-count"`, `q="a"`.
  Любой неравный случай — НЕ трогать (оставить ambiguous → Фаза 3).
- **Критерий приёмки:** прирост покрытия на повторяющихся словах; ручной spot-check 10 примеров
  подтверждает корректность пар; `verify:data` зелёный. Если spot-check выявит ошибки — проход
  ОТКЛЮЧИТЬ (этот проход опционален именно из-за риска мис-пэйринга, который инвариант не ловит).
- **Промпт:**
  > Реализуй в `alignVerse` проход `positional-equal-count`: сгруппируй несклеймленные токены по
  > `normalizeWord(gloss)`; для каждой группы найди несклеймленные слова BSB с тем же нормал-видом;
  > если |токенов| === |слов| и > 0 — спарь по возрастанию `token.i` ↔ возрастанию `word.i`,
  > `q:"a"`, `method:"positional-equal-count"`. Иначе пропусти. Выведи список созданных пар для
  > ручной проверки 10 случайных; если хоть один мис-пэйринг — поставь проход за флаг и оставь
  > выключенным. verify должен быть зелёным.

### - [ ] T2.4 — Зафиксировать прирост покрытия в отчёте

- **Критерий приёмки:** в описании коммита/в `docs/implementation-report.md` записан coverage
  до Фазы 2 (53.5% или то, что после T0.3) и после каждого прохода T2.1/T2.2/T2.3.

---

# Фаза 3 — Курация «длинного хвоста» до полного `resolved`

Автоматика не дотянет до 100% без риска. Остаток — ручная курация с машинной валидацией.

### - [ ] T3.1 — Реальный `topUnalignedLexemes` в build-report (рабочий список куратора)

- **Файл:** `scripts/build-align.mjs`, `buildReport` (строки 421-424, 439 — сейчас `[]`).
- **Действие:** агрегировать из `warningsByRef` (reasons `unaligned` и `ambiguous`) по всем книгам:
  считать частоту по `lexemeId`, прикладывать пример глоссы и до 3 примеров `ref`. Сортировать по
  убыванию. Чтобы получить warnings в `buildReport`, либо прокинуть их из
  `buildAlignmentForBook`, либо перечитать `align/grc-eng/<book>.json`.
- **Критерий приёмки:** `build-report.json` → `topUnalignedLexemes` непуст, отсортирован,
  с `lexemeId`, `gloss`, `count`, `sampleRefs`.
- **Промпт:**
  > В `scripts/build-align.mjs` верни из `buildAlignmentForBook` также `warningsByRef` (или
  > перечитай готовые align-файлы в main). В `buildReport` собери `topUnalignedLexemes`:
  > по всем warnings с `reason ∈ {unaligned, ambiguous}` посчитай частоту по `lexemeId`,
  > возьми пример `gloss` и до 3 `ref`, отсортируй по `count` desc, ограничь топ-200. Запиши в
  > отчёт вместо `[]`. Прогон + проверь поле в JSON.

### - [ ] T3.2 — Схема `manual-alignments.json` + валидация в verify + seed

- **Файлы:** `docs/source-data/alignments/grc-eng/manual-alignments.json` (создать, `[]`);
  `scripts/verify-data.mjs` (новая проверка); механизм чтения уже есть в
  `build-align.mjs:309-333`.
- **Действие:** задокументировать схему записи:
  `{ "ref": "...", "tokenId": "...", "span": [s,e], "lexemeId": "...", "q": "a", "method": "manual" }`
  или `{ "ref", "tokenId", "method": "manual-exclusion", "reason": "..." }`. Добавить в verify
  проверку: для каждой `manual`-записи `tokenId` существует в этом стихе, span в пределах текста
  и содержит буквы, span не пересекается с другими парами стиха; `manual-exclusion` имеет `reason`.
  **ВАЖНО:** ручные span'ы привязаны к `normalizationVersion` — при смене версии BSB-текста их
  надо ревалидировать (offsets смещаются).
- **Критерий приёмки:** verify проверяет manual-файл; пустой seed-файл не ломает `build:data`.
- **Промпт:**
  > Создай `docs/source-data/alignments/grc-eng/manual-alignments.json` со значением `[]`.
  > В `scripts/verify-data.mjs` добавь проверку этого файла: для каждой записи с `span` —
  > `tokenId` есть в `bibles/grc/<book>.json` для её `ref`, `span` в границах `verse.text`,
  > содержит `[\p{L}\p{N}]`, и не пересекается с финальными парами стиха; для
  > `manual-exclusion` — обязательно непустой `reason`. Несоответствие → `error`. Документируй
  > в шапке файла плана, что span'ы связаны с `normalizationVersion`.

### - [ ] T3.3 — Итеративная курация до `resolved == 100%`

- **Действие (цикл):** `npm run build:data` → открыть `topUnalignedLexemes` → для топовых
  не-выровненных/ambiguous токенов добавить записи в `manual-alignments.json` (пара или
  `manual-exclusion` с причиной, если у греческого слова нет английского соответствия) →
  повторить. Каждый прогон проверяется инвариантом точности (T1.2) и валидацией manual (T3.2).
- **Критерий приёмки:** в build-report добавлено поле `unresolvedNonFunctionTokens` = (не
  выровнены И не исключены); цель `unresolvedNonFunctionTokens == 0`. Coverage% при этом —
  любое значение (advisory). `verify:data` зелёный.
- **Промпт:**
  > Добавь в `build-report.json` подсчёт `resolvedNonFunctionTokens` (aligned ∪ manual-excluded) и
  > `unresolvedNonFunctionTokens`. Затем итеративно: запускай `npm run build:data`, бери верхние
  > записи `topUnalignedLexemes`, добавляй в `docs/source-data/alignments/grc-eng/manual-alignments.json`
  > либо ручную пару (с проверенным span по `verse.text`), либо `manual-exclusion` с `reason`, пока
  > `unresolvedNonFunctionTokens` не станет 0. После каждого батча — `npm run verify:data`
  > (инвариант точности обязан оставаться зелёным).

---

# Фаза 4 — Финальный гейт и синхронизация документов

### - [ ] T4.1 — Полная регенерация и зелёный verify

- **Критерий приёмки:** `npm run build:data` → `npm run verify:data` (0 errors;
  `ok('alignment accuracy invariant holds')`; `unresolvedNonFunctionTokens == 0`) →
  `npm test` → `npm run build` — всё зелёное.

### - [ ] T4.2 — Ручной spot-audit точности

- **Действие:** скрипт берёт случайную выборку (например, 50 пар по каждому `method`) и печатает
  `ref | grc-лемма | gloss | slice` для глазной проверки. Зафиксировать результат в
  `docs/implementation-report.md`.
- **Критерий приёмки:** в выборке нет неверных соответствий; отчёт сохранён.
- **Промпт:**
  > Напиши одноразовый скрипт (в `scripts/` или inline `node -e`), который из всех align-файлов
  > берёт по N=50 случайных пар каждого `method`, и печатает `ref | lexemeId | gloss(Berean/Cherith)
  > | verseText.slice(span)`. Просмотри вывод, отметь долю верных. Сохрани сводку в
  > `docs/implementation-report.md`.

### - [ ] T4.3 — Синхронизировать VISION / IMPL-PIPELINE / IMPL-RUNTIME с новой политикой гейта

- **Файлы:** `docs/VISION.md` (§6), `docs/IMPL-PIPELINE.md` (Task 4, Task 7/verify, Task 0b).
- **Действие:** заменить «coverage 90% — hard gate» на «accuracy-инвариант — hard gate;
  coverage — advisory warn»; задокументировать `resolved = aligned ∪ excluded`; описать
  workflow `manual-alignments.json` и связь span↔`normalizationVersion`; описать новые методы
  (`alt-gloss-*`, `lexicon-gloss-exact`, `positional-equal-count`).
- **Критерий приёмки:** документы не противоречат коду; нет упоминаний «90% блокирует релиз».

---

# Приложение A — Команды-помощники

```bash
# текущее покрытие/качество
node -e 'const r=require("./assets/data/align/grc-eng/build-report.json");console.log(r.nonFunctionCoveragePercent,r.versesWithZeroPairs,r.unresolvedNonFunctionTokens)'
# распределение методов
node -e 'const fs=require("fs");const d="assets/data/align/grc-eng";const q={},m={};for(const f of fs.readdirSync(d)){if(!f.endsWith(".json")||f==="build-report.json")continue;const b=JSON.parse(fs.readFileSync(d+"/"+f));for(const r in b.pairsByRef)for(const p of b.pairsByRef[r]){q[p.q]=(q[p.q]||0)+1;m[p.method]=(m[p.method]||0)+1}}console.log(q,m)'
```

---

# Приложение B — НЕ-выравнивательные баги (отдельный трек, найдены в ревью 2026-06-25)

Эти проблемы подтверждены проверкой, но **вне scope этого плана** (он про выравнивание).
Вынесены сюда, чтобы не потерять. Приоритет — после/параллельно Фазам 0-1.

- [ ] **[P0] Словарный UI сломан.** `loadFrequency` (`src/data/lexicon-loader.js:55-77`) отдаёт
  `strong: item.strongs` (массив) и НЕ отдаёт `hasAlignment`; экран
  (`src/ui/screens/dictionary.js:388,394,397`) читает скалярный `item.strong` и `item.hasAlignment`
  → все строки `dict-row--disabled`, `lex` не находится. Согласовать форму: отдавать `hasAlignment`,
  нормализовать `strong`, выровнять имена полей (`translit`), вернуть add/toggle.
- [ ] **[P1] Миграция словаря не вызывается.** `migrateDictionaryData`/`saveMigrationResults`
  (`src/state/dictionary.js:84,117`) экспортированы, но нет call-site. Подключить в
  `reading.js mount()` после загрузки core+dictionary; персист fail-soft; добавить юнит-тесты
  (перенос ключей, идемпотентность, merge-конфликт, неизвестный легаси-ключ).
- [ ] **[P1] Утечка source-only полей.** `build-lexicon.mjs:183` копирует `attestedForms` сырьём →
  `normalized`+`surfaceSearch` (по 19 428) попадают в `core.json`. Срезать их при сборке. И
  закрыть слепое пятно verify: `findStripFields` (`verify-data.mjs:441`) не рекурсит в массивы —
  добавить рекурсию в массивы.
- [ ] **[P1] `npm test` красный из-за obsolete-сьюта.** Исключить `docs/obsolete-dont-use/**` из
  vitest (через `vitest.config`/`test.exclude`), чтобы `npm test` был настоящим зелёным гейтом.
- [ ] **[P2] `core.json` без cache-busting.** `lexicon-loader.js:18` грузит `core.json` без `?v=`;
  использовать версию манифеста, как в bible-loader.
- [ ] **[P2] Онбординг — устаревшие русские примеры.** `src/ui/screens/onboarding.js:22,30`
  (`«Слово»→λόγος`) не соответствуют английскому тексту BSB; заменить на английские примеры.
- [ ] **[P3] Вводящие в заблуждение комментарии** (`reading.js:525,534` «русский текст») и имя
  настройки `ruHint`, которая теперь управляет показом английского BSB-текста.
