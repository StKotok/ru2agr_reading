# План: довести grc↔eng выравнивание до конца (accuracy-first)

> **Для LLM-разработчика.** Выполняй задачи строго по порядку. Каждая задача
> самодостаточна: есть файлы, действие, критерий приёмки и готовый промпт.
> Отмечай `- [x]` ТОЛЬКО когда выполнен **критерий приёмки** (а не просто написан код).
> После каждой задачи делай коммит с зелёным `verify:data` (см. «Откат» ниже) —
> это контрольная точка для `git revert`.
>
> **Правило проекта (не нарушать):** сгенерированные файлы в `assets/data/**` руками
> НЕ редактируем. Любая «правка данных» = правка скрипта/исходника + регенерация.
> Для тестов используем временные фикстуры или `BUILD_DATA_DIR`, а не ручную порчу
> сгенерированных файлов.

---

## 0. Принцип (решение продукта от 2026-06-25)

### 0.1. Три разных понятия «правильности» — НЕ смешивать

Это ключевая аксиома плана. Машинная проверка гарантирует только (a) и (b), НЕ (c):

| Уровень | Что проверяется | Кто гарантирует |
|---|---|---|
| **(a) Механическая валидность span** | span в границах текста, непустой, содержит буквы, не пересекается с другими | `verify:data` (уже есть, Checks 15-15b) |
| **(b) Формальное соответствие span↔глосса** | текст `verse.text.slice(span)` соответствует глоссе токена ПО МЕТОДУ | `verify:data` accuracy-инвариант (T1.2, новый) |
| **(c) Семантическая правильность** | этот греческий токен действительно переведён этим английским словом | ТОЛЬКО ручной аудит (T4.2). Машинно НЕ проверяется. |

> **Важно для читателя:** «accuracy hard-gate» в этом плане = уровень (b), формальное
> соответствие. Это НЕ доказывает (c). Например, `phrase`-проход может дать `γένεσις` →
> span `"of the genealogy"` — формально совпадает с `glossBerean = "of [the] genealogy"`,
> и инвариант (b) проходит, хотя по-английски артикль/предлог не отдельные греческие слова.
> Поэтому семантику ловит только ручной аудит и тиринг методов (см. 0.3).

### 0.2. Гейты: что блокирует релиз

- **Точность (уровень b) — hard-gate.** Если хотя бы одна пара не проходит инвариант
  точности → `verify:data` падает (exit 1), релиз заблокирован. **100% точность важнее % покрытия.**
- **Покрытие (coverage %) — только предупреждение (warn), релиз НЕ блокирует.** Никакого
  минимального порога покрытия мы НЕ вводим (это сознательное решение продукта). Защита от
  «слишком многое исключили» — не процент, а требование явной причины у каждого исключения
  (см. 0.4) и 100%-ный аудит ручных/исключённых записей.
- **`resolved == 100%` (каждый не-служебный токен разрешён) — hard-gate** после Фазы 3.

### 0.3. Тиринг методов (источник истины для точности — `method`, не `q`)

`verify:data` валидирует каждую пару ПО ЕЁ `method`. Метод определяет «тир доверия»:

| Тир | Методы | `q` | Инвариант (b) | Доп. требование |
|---|---|---|---|---|
| `proven` | `gloss-exact`, `bracket-optional`, `phrase`, `alt-gloss-exact`, `alt-gloss-bracket`, `alt-gloss-phrase`, `lexicon-gloss-exact` | `a` | формальное совпадение + единственный кандидат | — |
| `fuzzy` | `fuzzy` | `f` | fuzzy-совпадение + единственный кандидат | входит в обязательную выборку аудита T4.2 |
| `manual` | `manual` | `a` | границы + наличие букв + `tokenId` принадлежит стиху + `expectedText` совпадает | 100% ручной аудит (запись сделана человеком) |
| `proposal` | `positional-equal-count` | — | **по умолчанию ВЫКЛЮЧЕН**; в релизные данные не попадает | при включении флага — 100% ручной аудит перед промоушеном |

> Для accuracy-first: **`positional-equal-count` НЕ эмитится как `q="a"` автоматически.**
> Он за флагом (по умолчанию off), потому что инвариант (b) НЕ ловит его мис-пэйринг.

### 0.4. Схема `q` / `method` / exclusion (зафиксировать, исправляет нестыковку старого плана)

- `q` (качество пары) ∈ `{ "a", "f" }` для автопар; ручные пары — тоже `"a"` (отличаются `method:"manual"`).
  `q` живёт на ПАРЕ. (Старый план ошибочно писал `q ∈ {a,f,manual}` — `manual` это **метод**, не качество.)
- `method` — единственный источник тиринга; перечень закрыт реестром `ALIGN_METHODS` (T1.1).
  Неизвестный `method` в данных → `verify:data` падает.
- **Exclusion — first-class запись, НЕ пара** (нет `span`, нет `q`). Виды:
  - `manual-exclusion` (человек, с `reason`) — для греческих слов без английского соответствия;
  - `no-bsb-verse` (авто) — токен в стихе, которого нет в BSB (versification/textual variant);
  - `no-gloss` (авто/ревью) — у токена `fw===false`, но обе глоссы пусты.
- **`resolved = aligned ∪ excluded`.** Токен «разрешён», если у него есть пара ИЛИ он в любом
  из множеств исключений с причиной. Coverage% = доля `aligned`; может быть < 100% при `resolved==100%`.

### 0.5. Откат и контрольные точки

После КАЖДОЙ выполненной задачи: `npm run verify:data` зелёный → `git commit -m "feat(align): T<x.y> …"`.
Если последующая задача ломает инвариант — откат конкретной точки через `git revert`.

---

## 1. Измеренные факты (проверены по данным 2026-06-25; на них стоит план)

- Всего не-служебных (`fw===false`) grc-токенов: **72 102**. Сейчас выровнено **38 562** (53.5%):
  `q="a"` — 38 305 (`gloss-exact` 27 516, `phrase` 10 789), `q="f"` — 257 (`fuzzy`). Стихов с 0 пар: 150.
- **36 089 токенов (50%) имеют `glossCherith ≠ glossBerean`.** Berean несёт предлог/артикль
  внутри глоссы (`"of God"`, `"[the] book"`), что не матчит одно слово BSB; Cherith даёт чистую
  форму (`"God"`, `"book"`). Сейчас `altGloss = t.glossCherith` вычисляется в `build-align.mjs:72`,
  но **нигде не используется** → главный безопасный резерв покрытия (Фаза 2).
- **Порча BSB-текста (баг `parts.join('')`, `build-bibles.mjs:203`):**
  - lower-lower склейка на месте пропущенного `{noteId}`/границы фрагментов: `overcomeit`
    (john 1:5), `withwater` (john 1:26). Регэкспом НЕ ловится.
  - lower-PUNCT-Upper склейка на границе строк/предложений: `poor;His` (2cor 9:9), `perish!For`
    (acts 13:41), `victory?Where` (1cor 15:55), `scroll:I` (heb 10:7), `meal.While` (1cor 11:21),
    `276of` (acts 27:37 — digit).
  - Регэкспом `[a-z][A-Z]`/`[a-z][.,]` ловятся не все: при добавлении `;:!?` и цифр
    детектируется **191 стих**; lower-lower класс не детектируется вовсе. Поэтому фикс — на
    уровне сборки (T0.1), а sweep — вторичная сеть (T0.2).
- **Токенизатор рвёт `’` (curly apostrophe).** `WORD_PATTERN` (`build-bibles.mjs:172`,
  `build-align.mjs:42`) = `/[\p{L}\p{N}']+/gu` — содержит прямой `'`, но НЕ curly `’`.
  `God’s` → токены `God` + `s` (**394 стиха**). `verse.text` отображается верно, но `words[]`
  offsets и кандидаты выравнивания искажаются. Фикс в Фазе 0 (T0.1b).
- **15 не-служебных токенов в 3 grc-стихах, которых НЕТ в BSB:** `romans 16:24` (nf=6),
  `3john 1:15` (nf=6), `revelation 12:18` (nf=3). Для них НЕ существует корректного BSB span →
  `resolved==100%` недостижим без политики авто-исключения `no-bsb-verse` (T3.2/T3.3).
- **6 не-служебных токенов с ПУСТЫМИ обеими глоссами** (john 8:3-6, перикопа 7:53–8:11):
  `καταλαμβάνω`, `πειράζω`, `αὐτόφωρος`, `μή`, `προσποιέω`. Принципиально невыравниваемы по глоссе
  → исключение `no-gloss` (T1.4/T3.3). Также 17 токенов `fw===false` с пустым `glossCherith` (T2.1
  обязан их пропускать) и 406 с пустым `glossBerean` (опираются на Cherith — ещё аргумент за T2.1).
- **11 350 ambiguous-кандидатов**, из них **514 «протухших»**: токен помечен `ambiguous` в раннем
  проходе, но получил пару в позднем. Поэтому `topUnalignedLexemes` нельзя строить из сырых
  `warningsByRef` — нужен финальный непарный набор с дедупом по `ref+tokenId` (T3.1).
- **NORMALIZATION_VERSION** = `'bsb-text-v1'` (`scripts/lib/versions.mjs:5`). Любая правка текста
  BSB (T0.1/T0.1b) меняет `verse.text` и `words[]` offsets → версию ОБЯЗАТЕЛЬНО бампнуть (T0.0).
- **Существующие защиты (НЕ дублировать):** дубль-span → `throw` в build (`build-align.mjs:348`);
  overlap → `error` в verify (`verify-data.mjs:363`); span-границы/буквы → verify (350). Новые
  проходы лишь обязаны не создавать overlap (проверка перед `claim`).

## 2. Гейты (команды)

```bash
npm test            # быстрый гейт после каждого изменения кода (+ golden/integrity тесты)
npm run build:data  # регенерация: bibles → lexicon → align → app-config (атомарно)
npm run verify:data # целостность + НОВЫЙ accuracy hard-gate; exit 1 при любой error
npm run build       # полный гейт перед «готово»
```

---

# Фаза 0 — Починить фундамент (BSB-текст). БЛОКИРУЕТ всё остальное.

Выравнивание строится по `assets/data/bibles/eng/*.json` (`verse.text` + `verse.words`).
Пока текст склеен/рвётся — span'ы и кандидаты в сотнях стихов мусорные.

> ⚠️ Приложение B [P0] «словарный UI сломан» НЕ зависит от выравнивания и может идти
> **параллельно** этой фазе (другой разработчик/ветка). Здесь — только текст и данные.

### - [ ] T0.0 — Бамп `NORMALIZATION_VERSION`

- **Файл:** `scripts/lib/versions.mjs:5`.
- **Действие:** `NORMALIZATION_VERSION = 'bsb-text-v1'` → `'bsb-text-v2'`. Делать ПЕРВЫМ в фазе,
  до правок текста, чтобы все перегенерированные данные несли новую версию. `manual-alignments.json`
  (Фаза 3) будет привязан к ней (T3.2).
- **Критерий приёмки:** значение изменено; `npm run build:data` затем проставит `bsb-text-v2`
  в `bibles/eng/*.json` и align-файлы; `verify:data` не жалуется на рассинхрон версий.
- **Промпт:**
  > В `scripts/lib/versions.mjs` смени `NORMALIZATION_VERSION` с `'bsb-text-v1'` на `'bsb-text-v2'`.
  > Не трогай `SOURCE_DATA_VERSION` и `EXPECTED_SOURCE_FILE_SHA256`. Регенерацию сделаешь в T0.3.

### - [ ] T0.1 — Починить сборку текста стиха (потеря пробелов на границах фрагментов)

- **Файл:** `scripts/build-bibles.mjs:185-204` (`collectVerseContentText`), склейка на строке 203.
- **Причина:** контент стиха — массив строк/объектов; `{noteId}` пропускается (а пробел на его
  месте теряется), и два соседних `{text}`/`{text,poem}` фрагмента склеиваются. Подтверждённые формы:
  `["…overcome",{noteId},"it."] → "overcomeit."`; `[{text:"…to the poor;"},{text:"His…"}] → "poor;His"`;
  `["…276",{noteId},"of us…"] → "276of"`.
- **Действие:** вынести ЕДИНУЮ константу «слипающейся» пунктуации (одну, не три копии):
  ```js
  // символы, перед которыми пробел НЕ ставится (закрывающая/срединная пунктуация)
  const STICKY_PUNCT = /^[,.;:!?'’"”)\]}]/;       // следующий фрагмент начинается с такого → без пробела
  const OPENING_PUNCT = /[(\[{"“]$/;               // предыдущий заканчивается открывающей скобкой/кавычкой → без пробела
  ```
  Аккумулировать строку `acc`. Перед добавлением очередного непустого фрагмента `s` вставлять
  ОДИН пробел тогда и только тогда, когда выполнено ВСЁ:
  `acc !== '' && !/\s$/.test(acc) && !OPENING_PUNCT.test(acc) && !/^\s/.test(s) && !STICKY_PUNCT.test(s)`.
  `{text}` → строка (`String(el.text)`); `{lineBreak}` → `' '`; `{noteId}` и неизвестные → пропуск.
  В конце — `.replace(/\s{2,}/g,' ').trim()` (взаимодействует с уже существующей нормализацией
  `\s+→' '` в `buildBsbBooks:238` — двойные пробелы безопасно схлопнутся).
- **Критерий приёмки (реальные битые стихи — проверено):**
  - `john 1:5` → `…the darkness has not overcome it.` (было `overcomeit`)
  - `john 1:26` → `“I baptize with water,” John replied…` (было `withwater`)
  - `2corinthians 9:9` → `…His gifts to the poor; His righteousness…` (было `poor;His`)
  - `acts 27:37` → `…there were 276 of us on board.` (было `276of`)
  - регрессий в чистых стихах нет (`1corinthians 1:1` посимвольно прежний). Тест T0.2 зелёный.
  - ⚠️ НЕ используй `john 3:5` как пример — он уже корректен в текущих данных (`born of water and
    the Spirit`); это была ошибка исходного ревью.
- **Промпт:**
  > В `scripts/build-bibles.mjs` перепиши `collectVerseContentText` (185-204). Заведи две
  > константы-регэкспа `STICKY_PUNCT = /^[,.;:!?'’"”)\]}]/` и `OPENING_PUNCT = /[(\[{"“]$/`.
  > Вместо `parts.push` + `join('')` аккумулируй `acc`: для каждого непустого фрагмента `s`
  > (`{text}` → строка, `{lineBreak}` → `' '`, `{noteId}`/неизвестное → пропуск) добавляй ` `+`s`,
  > если `acc && !/\s$/.test(acc) && !OPENING_PUNCT.test(acc) && !/^\s/.test(s) && !STICKY_PUNCT.test(s)`,
  > иначе `s`. В конце верни `acc.replace(/\s{2,}/g,' ').trim()`. НЕ трогай `tokenizeWords`. Прогон
  > `npm run build:bibles`; проверь john 1:5/1:26, 2cor 9:9, acts 27:37 по критериям выше. Затем T0.1b.

### - [ ] T0.1b — Включить curly apostrophe `’` в токенизацию слов

- **Файлы:** `scripts/build-bibles.mjs:172` и `scripts/build-align.mjs:42` (одинаковый `WORD_PATTERN`).
- **Причина:** `/[\p{L}\p{N}']+/gu` рвёт `God’s` → `God`+`s` (394 стиха). Нужно включить `’` (U+2019),
  чтобы притяжательные/сокращения были одним словом-токеном.
- **Действие:** `WORD_PATTERN = /[\p{L}\p{N}'’]+/gu` в ОБОИХ файлах (в T1.1 они станут одним модулем —
  тогда правка будет в одном месте; пока синхронно в двух). `normalizeWord`/`fuzzyNormalize` уже
  схлопывают апострофы при сравнении, так что матчинг не сломается.
- **Критерий приёмки:** после регенерации (T0.3) ни в одном `verse.text` нет `[A-Za-z]’[A-Za-z]`,
  разорванного на два `words[]`-токена; `God’s` — один токен `God’s`. Offset-инвариант
  (`build-bibles.mjs:242-248`) проходит. Тест T0.2 (проверка `’`) зелёный.
- **Промпт:**
  > В `scripts/build-bibles.mjs` (строка 172) и `scripts/build-align.mjs` (строка 42) замени
  > `WORD_PATTERN`/`wordPattern` на `/[\p{L}\p{N}'’]+/gu` (добавлен U+2019 `’`). Не меняй
  > `normalizeWord`/`fuzzyNormalize`. Прогон build:bibles; проверь, что `God’s` в 1corinthians 3:9
  > — один токен. Полную регенерацию сделаешь в T0.3.

### - [ ] T0.2 — Интеграционные тесты целостности BSB-текста

- **Файл:** новый `tests/bsb-text-integrity.test.js` (vitest).
- **Действие:** три уровня по `assets/data/bibles/eng/*.json`:
  1. **Снапшоты ранее-битых стихов** (`expect(verse.text).toMatchSnapshot()` — vitest snapshot,
     обновляемый `npm test -- -u` при легитимном апстрим-изменении): `john 1:5`, `john 1:26`,
     `2corinthians 9:9`, `acts 27:37`, `1corinthians 11:21` (`meal.While`), `1peter 2:23` (`Him,He`).
     Ловит и lower-lower склейки, которые регэкспом не отличить.
  2. **Comprehensive sweep всех стихов:** ни один `verse.text` не матчит
     `/[a-z][,.;:!?–—]?[A-Z]/` (lower + опц. 1 пунктуация + Upper) и `/[a-z][0-9]|[0-9][a-z]/`
     (digit-glue). При совпадении — вывести `ref` и фрагмент. **Allowlist:** массив-константа
     легитимных внутренне-капитализированных токенов (на случай имён вида `LaSalle`); по текущим
     данным он ПУСТ — каждое совпадение после T0.1 это баг. Если апстрим добавит легитимный кейс —
     внести в allowlist с комментарием, а не ослаблять регэксп.
  3. **Проверка `’`:** ни один `verse.text` не содержит `[A-Za-z]’[A-Za-z]`, разорванного на два
     соседних `words[]`-токена (для каждого стиха: если `’` между буквами, в `words[]` должен быть
     один токен, включающий `’`).
- **Критерий приёмки:** `npm test` зелёный; sweep даёт 0 совпадений вне allowlist на свежих данных.
- **Промпт:**
  > Создай `tests/bsb-text-integrity.test.js` (vitest). Прочитай все `assets/data/bibles/eng/*.json`.
  > (1) Для стихов john 1:5, john 1:26, 2corinthians 9:9, acts 27:37, 1corinthians 11:21,
  > 1peter 2:23 — `expect(text).toMatchSnapshot()`. (2) Пройди ВСЕ стихи: assert, что `text` НЕ
  > матчит `/[a-z][,.;:!?–—]?[A-Z]/` и `/[a-z][0-9]|[0-9][a-z]/`, исключая токены из
  > пустого пока `ALLOWLIST=[]`; при падении печатай ref+фрагмент. (3) Для стихов с `[A-Za-z]’[A-Za-z]`
  > проверь, что `’` не на границе двух `words[]`-токенов. Сгенерируй данные (T0.1/T0.1b) ДО первого
  > прогона, затем `npm test` и закоммить снапшоты.

### - [ ] T0.3 — Полная регенерация данных после фикса текста

- **Действие:** `npm run build:data` (атомарно: bibles → lexicon → align → app-config). Текст и
  токенизация изменились → меняются `words[]` offsets → меняются span'ы выравнивания и `manifest`.
- **Критерий приёмки:** `build:data` без ошибок; `bibles/eng/*.json` несут `normalizationVersion:
  "bsb-text-v2"`; `grep -c overcomeit assets/data/bibles/eng/john.json` = 0; `verify:data` проходит
  (старые проверки). **Замечание:** coverage может слегка измениться в любую сторону — распавшиеся
  склейки дают новые слова, что местами превращает single-candidate в ambiguous и наоборот. Это
  нормально; зафиксируй числа до/после в описании коммита.
- **Промпт:**
  > Запусти `npm run build:data`, затем `npm run verify:data`. Проверь нулевой `overcomeit`,
  > `normalizationVersion=bsb-text-v2` в eng-данных. Запиши `nonFunctionCoveragePercent` и
  > `versesWithZeroPairs` до/после в сообщение коммита. Коммить как контрольную точку.

---

# Фаза 1 — Сделать точность hard-gate (уровень b)

Цель: машинно гарантировать, что КАЖДАЯ пара формально соответствует глоссе по своему методу,
и что новые проходы не нарушают гарантию единственного кандидата.

### - [ ] T1.1 — Общий модуль нормализации + реестр методов

- **Файлы:** новый `scripts/lib/align-normalize.mjs`; правки в `build-align.mjs` (23-51) и `verify-data.mjs`.
- **Причина:** инвариант в verify должен использовать ТЕ ЖЕ `normalizeWord/normalizeBerean/
  fuzzyNormalize/tokenizeGloss/WORD_PATTERN`, что и build, иначе ложные срабатывания. Плюс единый
  закрытый реестр методов, чтобы неизвестный `method` валил verify.
- **Действие:** перенести нормализацию дословно; экспортировать также:
  ```js
  export const ALIGN_METHODS = {
    'gloss-exact':       { tier: 'proven', q: 'a' },
    'bracket-optional':  { tier: 'proven', q: 'a' },
    'phrase':            { tier: 'proven', q: 'a' },
    'alt-gloss-exact':   { tier: 'proven', q: 'a' },
    'alt-gloss-bracket': { tier: 'proven', q: 'a' },
    'alt-gloss-phrase':  { tier: 'proven', q: 'a' },
    'lexicon-gloss-exact':{ tier: 'proven', q: 'a' },
    'fuzzy':             { tier: 'fuzzy',  q: 'f' },
    'manual':            { tier: 'manual', q: 'a' },
    'positional-equal-count': { tier: 'proposal', q: 'a' }, // off by default
  };
  ```
- **Критерий приёмки:** build и verify импортируют из одного модуля; `npm run build:align` даёт
  побайтово идентичный `build-report.json` (кроме `generatedAt`); `npm test` зелёный.
- **Промпт:**
  > Создай `scripts/lib/align-normalize.mjs`: перенеси `WORD_PATTERN`, `normalizeWord`,
  > `normalizeBerean`, `fuzzyNormalize`, `tokenizeGloss` из `build-align.mjs` (23-51) дословно и
  > добавь `ALIGN_METHODS` (см. план). В `build-align.mjs` замени локальные определения импортом
  > (включая `WORD_PATTERN` из T0.1b). Убедись, что `build:align` даёт идентичный отчёт. Модуль
  > используется в T1.2.

### - [ ] T1.0 — Golden-фикстуры инварианта точности (юнит-тест, без генерации данных)

> Делать ВМЕСТЕ с T1.2 (логику инварианта вынеси в чистую функцию и протестируй ею).

- **Файл:** новый `tests/align-invariant.test.js`; чистая функция `checkPairAccuracy(slice, gloss, method)`
  → `{ ok: boolean, reason }` в `scripts/lib/align-normalize.mjs` (или соседнем `align-invariant.mjs`).
- **Причина:** verify запускается ПОСЛЕ build и читает уже сгенерированные пары — если инвариант
  использует ту же нормализацию, он может быть тавтологичен. Golden-кейсы тестируют САМУ логику
  инварианта на хардкоде, независимо от данных, и ловят регрессию кода.
- **Действие:** набор кейсов `{ slice, gloss, method, expected }`, например:
  `{slice:'God', gloss:'[the] God', method:'bracket-optional', expected:true}`,
  `{slice:'God', gloss:'of God', method:'gloss-exact', expected:false}` (gloss многословна),
  `{slice:'of the genealogy', gloss:'of [the] genealogy', method:'phrase', expected:true}`,
  `{slice:'xyz', gloss:'God', method:'alt-gloss-exact', expected:false}`,
  `{slice:'loved', gloss:'love', method:'fuzzy', expected:true}` (если fuzzy так задумано — иначе false).
- **Критерий приёмки:** `npm test` зелёный; функция инварианта покрыта позитивными и негативными кейсами.
- **Промпт:**
  > Вынеси логику «соответствует ли slice глоссе по методу» в чистую `checkPairAccuracy(slice,
  > gloss, method)` (в `scripts/lib/align-normalize.mjs`). Создай `tests/align-invariant.test.js`
  > с хардкод-кейсами (см. план: позитивные и негативные для каждого тира). verify в T1.2 вызывает
  > ЭТУ ЖЕ функцию.

### - [ ] T1.2 — Accuracy-инвариант в verify (hard error) + структурная проверка единственного кандидата

- **Файл:** `scripts/verify-data.mjs`, блок «Checks 15-15b» (325-368) — там уже есть `engTexts`.
- **Действие:**
  - Для каждой книги построить `Map<tokenId, {glossBerean, glossCherith}>` из `bibles/grc/<book>.json`.
  - Для каждой пары вызвать `checkPairAccuracy(verseText.slice(span), gloss, method)`, где `gloss` =
    `glossBerean` для `gloss-exact`/`bracket-optional`/`phrase`, `glossCherith` для `alt-gloss-*`,
    «slice ∈ нормализованным глоссам лексемы» для `lexicon-gloss-exact`, `glossBerean` для `fuzzy`.
    Правила по тиру:
    - `proven` single-word (`gloss-exact`,`alt-gloss-exact`): `normalizeWord(slice)===normalizeWord(gloss)`;
    - `bracket-optional`/`alt-gloss-bracket`: `normalizeWord(slice)===normalizeWord(normalizeBerean(gloss))`;
    - `phrase`/`alt-gloss-phrase`: поэлементное равенство `tokenizeGloss(slice).map(normalizeWord)` и
      `tokenizeGloss(gloss).map(normalizeWord)`;
    - `lexicon-gloss-exact`: `normalizeWord(slice)` ∈ множеству нормализованных одно-словных глосс лексемы;
    - `fuzzy`: `fuzzyNormalize(slice)===fuzzyNormalize(gloss)`;
    - `manual`: границы + `/[\p{L}\p{N}]/` + `tokenId` есть в стихе + (если запись хранит
      `expectedText`) `verseText.slice(span)===expectedText` (см. T3.2).
  - `method` отсутствует в `ALIGN_METHODS` → `error`.
  - **Структурная проверка единственного кандидата** (ловит баг будущего прохода, который
    заклеймил бы при >1 кандидате): для каждой `proven`-single-word пары пересчитать в стихе число
    несклеймленных-другими-парами слов с той же нормал-формой; их должно быть ровно 1 (сам span).
    Для `phrase`/`alt-gloss-phrase` — ровно одно непересекающееся окно. Несоответствие → `error`.
  - **НЕ дублировать** overlap/duplicate (уже Check 15-15b / build throw) — только сослаться.
- **Критерий приёмки:** на текущих данных `verify:data` зелёный ИЛИ точно перечисляет нарушителей;
  печатает `ok('alignment accuracy invariant holds')`.
- **Промпт:**
  > В `verify-data.mjs` (блок 325-368) для каждой книги построй `Map<tokenId,{glossBerean,glossCherith}>`
  > из `bibles/grc/<book>.json`, импортируй `checkPairAccuracy`/`ALIGN_METHODS`/нормализацию из
  > `scripts/lib/align-normalize.mjs`. Для каждой пары: если `method` не в `ALIGN_METHODS` → `error`;
  > иначе валидируй slice↔gloss по тиру (см. план T1.2), при провале `error(ref, method, slice, gloss)`.
  > Добавь структурную проверку единственного кандидата для `proven`-методов. Не дублируй overlap.
  > В конце `ok('alignment accuracy invariant holds')`. Прогон `npm run verify:data`.

### - [ ] T1.3 — Подтвердить семантику гейтов (coverage=warn, exit-код) — это VERIFY, не change

- **Файлы:** `scripts/verify-data.mjs` (Check 17 — строка 385, уже `warn`; финал — строка 537-539,
  уже `process.exit(1)` при `errors>0`); `scripts/build-align.mjs` (`thresholds`, 452-455).
- **Действие:** УБЕДИТЬСЯ (не менять без нужды), что Check 17 — `warn`, а не `error`, и что любой
  `error(...)` инкрементит `errors` и приводит к `process.exit(1)` (так и есть: var называется
  `errors`, выход — `process.exit(1)`, НЕ `process.exitCode`). В `build-align.mjs` уточнить смысл
  порогов: `thresholds = { accuracyInvariant: 'hard', nonFunctionCoverageMin: 90,
  nonFunctionCoverageEnforced: false, versesWithPairsMin: 95 }` (документирует, что coverage —
  advisory). Сам факт «accuracy hard» обеспечивает T1.2, не thresholds.
- **Критерий приёмки:** через юнит-тест/временную фикстуру (НЕ ручную порчу `assets/data`)
  подтвердить: при паре с неверным slice инвариант даёт `error` и exit=1; при низком coverage без
  ошибок точности — exit=0 (только warn). `thresholds` обновлены.
- **Промпт:**
  > В `verify-data.mjs` подтверди (не ломая): Check 17 (coverage) — `warn`; финал — `if (errors>0)
  > process.exit(1)`. В `build-align.mjs` приведи `thresholds` к `{ accuracyInvariant:'hard',
  > nonFunctionCoverageMin:90, nonFunctionCoverageEnforced:false, versesWithPairsMin:95 }`. Проверку
  > exit-кода сделай через временную фикстуру/юнит-тест инварианта (T1.0), а НЕ правкой
  > сгенерированных файлов. `echo $?` после verify.

### - [ ] T1.4 — Verify-проверка классификации `fw` и наличия глоссы

- **Файл:** `scripts/verify-data.mjs` (новая проверка).
- **Причина:** `resolved` считается по `fw===false`. Если content-word ошибочно `fw=true` — он молча
  выпадает (ложный 100%). Если `fw=false`, но обе глоссы пусты (6 токенов john 8:3-6) — он
  принципиально невыравниваем и должен быть в `no-gloss`-исключениях, иначе вечный `unresolved`.
- **Действие:** для всех grc-токенов: (1) собрать список `fw===false` с пустыми обеими глоссами →
  должны быть покрыты `no-gloss`-исключением (T3.3) либо явным allowlist; иначе `error`. (2) Мягкая
  эвристика (warn, не error): токен `fw===true` с непустой содержательной глоссой не из множества
  служебных (`—`, артикли) — вывести для ручного контроля качества `fw`.
- **Критерий приёмки:** verify печатает число `fw=false`-токенов без глоссы и без покрытия
  исключением; на финале (после T3.3) их 0. Эвристика `fw=true` даёт обозримый warn-список.
- **Промпт:**
  > В `verify-data.mjs` добавь Check: пройди все `bibles/grc/*.json`. Собери `fw===false` токены с
  > пустыми `glossBerean` И `glossCherith`; если такой токен НЕ покрыт записью `no-gloss`/manual-exclusion
  > (из T3.2-файла) → `error(ref, tokenId, lemma)`. Отдельно warn-эвристика: `fw===true` с глоссой
  > вне множества `{'', '—', '[the]', 'the', 'a', 'an'}` → `warn` для ручной ревизии. Прогон verify.

### - [ ] T1.5 — Verify-консистентность агрегатов build-report

- **Файл:** `scripts/verify-data.mjs` (расширить Check 17/18).
- **Причина:** `build-report.json` может остаться от прошлого прогона. Сейчас сверяется только sha
  манифеста, не арифметика.
- **Действие:** пересчитать `totalNonFunctionTokens`, `alignedNonFunctionTokens` суммированием
  `perBook[]` и сверить с агрегатами; пересчитать `nonFunctionCoveragePercent`; при расхождении → `error`.
- **Критерий приёмки:** verify падает, если агрегаты отчёта не равны сумме per-book.
- **Промпт:**
  > В `verify-data.mjs` добавь проверку: `report.totalNonFunctionTokens === Σ perBook.nonFunctionTokenCount`,
  > `report.alignedNonFunctionTokens === Σ perBook.alignedNonFunctionTokens`, и пересчитанный
  > coverage совпадает (±0.1). Иначе `error`.

---

# Фаза 2 — Поднять покрытие БЕЗ потери точности (использовать неиспользуемый сигнал)

Преамбула (общие правила для всех проходов T2.1-T2.3):
- Каждый проход добавляет пару **только при единственном кандидате среди ещё несклеймленных слов
  BSB** (`candIndices.length === 1`) — определение «единственного» не зависит от других глосс
  токена/лексемы, только от несклеймленных слов стиха.
- **Overlap-guard:** перед `claim` проверять, что новый span не пересекается ни с одной уже
  созданной парой стиха: `pairs.every(p => span[1] <= p.span[0] || span[0] >= p.span[1])`.
  (`claimed[]` по словам это уже обеспечивает для пословных проходов, но guard обязателен явно.)
- **Определение «ничьи» Berean vs Cherith:** ничья = Berean-глосса и Cherith-глосса матчат ОДНО И
  ТО ЖЕ слово. Так как Cherith-проходы идут ПОСЛЕ Berean и уважают `claimed[]`/`hasPair`, Berean
  выигрывает автоматически (слово уже занято или токен уже спарен). Если матчат РАЗНЫЕ слова — обе
  пары допустимы (overlap-guard их и так разведёт).
- Порядок: Pass 1-3 (Berean) → T2.1 (Cherith) → T2.2 (лексикон) → [T2.3 proposal, off] → Pass 4 (fuzzy).

### - [ ] T2.1 — Проходы по `glossCherith` (exact / bracket / phrase)

- **Файл:** `scripts/build-align.mjs`, `alignVerse` (57-261). `altGloss` уже есть (стр. 72).
- **Действие:** между Pass 3 (phrase Berean) и Pass 4 (fuzzy) добавить три зеркальных прохода по
  `td.altGloss`: single-word exact (`alt-gloss-exact`), bracket-optional (`alt-gloss-bracket`),
  phrase 2-4 (`alt-gloss-phrase`), все `q="a"`, single-candidate, с overlap-guard, учётом
  `claimed[]`/`td.hasPair`. **Если `td.altGloss` пуст/`null` ИЛИ после нормализации равен уже
  проверенному `td.primaryGloss` — токен пропустить** (17 токенов имеют пустой Cherith; для многих
  Cherith==Berean — повтор не нужен). Bracket-optional для Cherith почти всегда == exact (скобок
  нет) — это нормально, оставь для симметрии, не оптимизируй.
- **Критерий приёмки:** coverage заметно растёт; `verify:data` (T1.2) зелёный (alt-* валидируются
  против `glossCherith`); 0 overlap/duplicate. Прирост зафиксирован (T2.4).
- **Промпт:**
  > В `alignVerse` между Pass 3 и Pass 4 добавь проходы по `td.altGloss` (`=t.glossCherith`),
  > копируя логику Pass 1/2/3 с методами `alt-gloss-exact`/`alt-gloss-bracket`/`alt-gloss-phrase`,
  > `q:"a"`, single-candidate. Пропускай токен, если `altGloss` пуст или `normalizeWord(altGloss)
  > === normalizeWord(primaryGloss)`. Перед каждым `claim` — overlap-guard против `pairs`. Не трогай
  > существующие проходы. Прогон build:align, зафиксируй прирост, затем verify:data (зелёный).

### - [ ] T2.2 — Проход по множественным глоссам лексемы (`lexicon-gloss-exact`)

- **Файлы:** `scripts/build-align.mjs` (прокинуть core-глоссы в `alignVerse` через
  `buildAlignmentForBook`, прочитав `assets/data/lexicon/core.json` ОДИН раз в main).
- **Факт структуры:** `core.json = { schema, items: [...] }`; каждый `item` имеет `lexemeId`,
  `glossesBerean` (напр. `["[The] book","[the] book","book","books"]`), `glossesCherith`
  (`["book","books"]`). Построй `Map<lexemeId, {glossesBerean, glossesCherith}>` из `core.items`.
- **Действие:** для ещё не спаренных токенов перебрать одно-словные глоссы лексемы из ОБОИХ массивов.
  **Дедуп:** пропускать глоссы, нормал-форма которых уже проверена на уровне токена (`primaryGloss`,
  `altGloss` и их bracket-форма) — иначе пустая работа и ложные ambiguous. Для оставшихся —
  exact-match по несклеймленным словам, single-candidate, overlap-guard, `method:"lexicon-gloss-exact"`,
  `q="a"`. При нескольких источниках-кандидатах брать первый по порядку (Berean-глоссы, затем Cherith).
- **Критерий приёмки:** доп. прирост coverage; `verify:data` зелёный (`lexicon-gloss-exact`:
  `normalizeWord(slice)` ∈ нормал-множеству глосс лексемы). Прирост зафиксирован (T2.4).
- **Промпт:**
  > Прочитай `assets/data/lexicon/core.json` один раз в main `build-align.mjs`, построй
  > `Map<lexemeId,{glossesBerean,glossesCherith}>` из `core.items`, прокинь в `buildAlignmentForBook`
  > → `alignVerse`. После T2.1-проходов: для токенов без пары перебери одно-словные глоссы лексемы,
  > пропуская уже проверенные на уровне токена (нормал-форма `primaryGloss`/`altGloss`/их bracket).
  > exact-match по несклеймленным словам, single-candidate, overlap-guard, `method:"lexicon-gloss-exact"`,
  > `q:"a"`. Обнови `checkPairAccuracy` для этого метода (slice ∈ нормал-глоссы лексемы — прокинь
  > множество и в verify). Прогон + verify.

### - [ ] T2.3 — (proposal, ВЫКЛЮЧЕН по умолчанию) Позиционная дизамбигуация

- **Файл:** `scripts/build-align.mjs`, `alignVerse`; флаг `const ENABLE_POSITIONAL = false;` (модульная
  константа в начале файла).
- **Причина:** инвариант (b) НЕ ловит позиционный мис-пэйринг (slice корректен, но i-й токен
  сопоставлен не тому i-му слову). Поэтому метод — тир `proposal`: **в релизные данные не идёт.**
- **Действие:** при `ENABLE_POSITIONAL===true`: сгруппировать несклеймленные токены по
  `normalizeWord(gloss)`; для группы найти несклеймленные слова BSB с тем же нормал-видом; **только
  если число слов == числа токенов И эти слова попарно НЕ пересекаются после нормализации** —
  спарить по возрастанию `token.i` ↔ возрастанию `word.i`, `method:"positional-equal-count"`. Любой
  иной случай не трогать (ambiguous → Фаза 3). При выключенном флаге — проход не выполняется.
- **Критерий приёмки:** по умолчанию (флаг off) данные и coverage не меняются. Если кто-то включит
  флаг — обязателен протокол ручного аудита (T4.2-стиль: `ref | grc-лемма | морфология | англ.слово
  | контекст`) и 100% проверка ВСЕХ таких пар перед коммитом. По умолчанию проход остаётся off.
- **Промпт:**
  > В `build-align.mjs` добавь `const ENABLE_POSITIONAL=false;`. Реализуй проход
  > `positional-equal-count` за этим флагом (см. план: равное число + непересекающиеся слова, парность
  > по индексам). При `false` (по умолчанию) проход не выполняется — данные не меняются. НЕ включай
  > флаг без явного решения и 100% ручного аудита.

### - [ ] T2.4 — Зафиксировать прирост + раннее поле `unresolvedNonFunctionTokens`

- **Действие:** уже в этой фазе добавить в `build-report.json` подсчёт `resolvedNonFunctionTokens`
  (aligned ∪ excluded) и `unresolvedNonFunctionTokens`, чтобы видеть динамику после каждого прохода
  (а не ждать Фазы 3). Записать coverage до Фазы 2 (после T0.3) и после T2.1/T2.2 в
  `docs/implementation-report.md`.
- **Критерий приёмки:** отчёт содержит оба поля; дельты записаны.
- **Промпт:**
  > В `buildReport` (build-align.mjs) добавь `resolvedNonFunctionTokens` и
  > `unresolvedNonFunctionTokens` (пока excluded=0, кроме авто-`no-bsb-verse` из T3.3 если уже есть).
  > После T2.1 и T2.2 фиксируй coverage и unresolved в `docs/implementation-report.md`.

---

# Фаза 3 — Курация «длинного хвоста» до `resolved == 100%`

### - [ ] T3.0 — Инструмент куратора (показывает span-кандидаты; обязателен ДО ручной курации)

- **Файл:** новый `scripts/curate-align.mjs` (read-only helper, не часть build).
- **Причина:** ручной ввод raw-offsets для 30k+ токенов — гарантированные ошибки. Куратору нужен
  инструмент, печатающий контекст и индексы слов.
- **Действие:** CLI `node scripts/curate-align.mjs <ref> <tokenId?>`: печатает
  - `verse.text` с маркерами индексов слов (каждое слово как `[i]слово`);
  - греческие токены стиха (`i`, `lemma`, `glossBerean`, `glossCherith`, `fw`);
  - для указанного `tokenId` — слова-кандидаты (нормал-совпадения глосс) с их `wordIndex`;
  - соседние стихи (предыдущий/следующий) для контекста.
  Также режим `--top N`: вывести верхние `N` записей из `topUnalignedLexemes` с первым `ref`.
- **Критерий приёмки:** для `john 1:1` инструмент печатает текст с индексами и кандидатами; куратор
  может назвать `wordIndex` вместо offsets.
- **Промпт:**
  > Создай `scripts/curate-align.mjs`. Аргументы `<ref> [tokenId]`. Загрузи `bibles/eng/<book>.json`
  > и `bibles/grc/<book>.json`. Напечатай `verse.text` с `[i]`-маркерами по `words[]`, таблицу grc-токенов
  > (i, lemma, glossBerean, glossCherith, fw), и (если задан tokenId) кандидатные слова с `wordIndex`.
  > Добавь `--top N` (из `build-report.topUnalignedLexemes`). Только чтение, ничего не пишет.

### - [ ] T3.1 — Реальный `topUnalignedLexemes` (из ФИНАЛЬНОГО непарного набора, не из сырых warnings)

- **Файл:** `scripts/build-align.mjs` (`buildAlignmentForBook` возвращает `warningsByRef`;
  `buildReport` использует финальные пары).
- **Причина:** в `warningsByRef` 514 «протухших» ambiguous (токен потом получил пару). Строить надо
  из множества: `все fw===false токены − токены с финальной парой − исключённые`, с дедупом по `ref+tokenId`.
- **Действие:** вернуть из `buildAlignmentForBook` `{ stats, warningsByRef, unresolved }`, где
  `unresolved` — массив `{ref, tokenId, lexemeId, gloss}` финально непарных-неисключённых. В
  `buildReport` агрегировать по `lexemeId`: `count`, пример `gloss`, до 3 `sampleRefs`; для ambiguous
  добавить `candidateCount` (макс. число кандидатов из warning по этому токену). Сортировать по
  `count desc`, топ-200. Не перечитывать align-файлы (DRY) — прокидывать через возврат.
- **Критерий приёмки:** `topUnalignedLexemes` непуст, отсортирован, поля `{lexemeId, gloss, count,
  sampleRefs, candidateCount?}`; не содержит лексем, у которых все вхождения уже спарены.
- **Промпт:**
  > Верни из `buildAlignmentForBook` также `unresolved` (fw===false токены без финальной пары и без
  > исключения) и `warningsByRef`. В `buildReport` собери `topUnalignedLexemes` из `unresolved` всех
  > книг: дедуп по `ref+tokenId`, частота по `lexemeId`, пример `gloss`, до 3 `sampleRefs`,
  > `candidateCount` из ambiguous-warning. Сортировка desc, топ-200. Без перечитывания файлов.

### - [ ] T3.2 — Схема `manual-alignments.json` + авто-исключения + валидация в verify

- **Файлы:** `docs/source-data/alignments/grc-eng/manual-alignments.json` (создать); `build-align.mjs`
  (механизм чтения уже есть, 308-333 — расширить под `wordIndex`/авто-исключения); `verify-data.mjs`
  (новая проверка).
- **Схема файла** (привязка к версии текста — обязательна):
  ```json
  {
    "normalizationVersion": "bsb-text-v2",
    "entries": [
      { "ref": "...", "tokenId": "...", "wordIndex": 4, "expectedText": "God", "lexemeId": "...", "method": "manual" },
      { "ref": "...", "tokenId": "...", "wordIndexes": [3,4], "expectedText": "of God", "lexemeId": "...", "method": "manual" },
      { "ref": "...", "tokenId": "...", "method": "manual-exclusion", "reason": "Greek particle δέ not rendered as a separate English word" }
    ]
  }
  ```
  - Куратор задаёт `wordIndex`/`wordIndexes` (НЕ raw offsets); build компилирует span из `words[]`
    (`span = [words[first].start, words[last].end]`) и проверяет `verse.text.slice(span)===expectedText`.
  - Примеры `reason` для `manual-exclusion`: `"Greek particle not translated in BSB"`,
    `"implicit in English construction"`, `"covered by a multi-word phrase aligned elsewhere"`.
- **Авто-исключения (build генерирует, в файл писать не нужно):**
  - `no-bsb-verse`: токен `fw===false` в grc-стихе, которого нет среди eng-refs (15 токенов:
    romans 16:24, 3john 1:15, revelation 12:18) → запись `{reason:'no-bsb-verse'}` в `warningsByRef`,
    учитывается как `excluded`.
  - `no-gloss`: токен `fw===false` с пустыми обеими глоссами (6 токенов john 8:3-6) → требует явной
    `manual-exclusion` с `reason:"no-gloss-available (pericope/textual)"` ЛИБО исправления `fw`.
- **Валидация в verify (для ОБОИХ типов записей):** `normalizationVersion` файла == текущей (иначе
  hard error «ревалидируй ручные привязки»); `tokenId` существует в стихе своего `ref`; для пар —
  `wordIndex(es)` в пределах `words[]`, скомпилированный span содержит буквы, не пересекается с
  другими финальными парами стиха, `slice===expectedText`; для `manual-exclusion` — непустой `reason`;
  **конфликты:** не более одной записи на `tokenId`; запрет одновременной пары и exclusion для одного
  `tokenId`; запрет пары для токена с `fw===true`.
- **Критерий приёмки:** пустой seed (`{"normalizationVersion":"bsb-text-v2","entries":[]}`) не ломает
  `build:data`; verify валидирует файл и авто-исключения; `no-bsb-verse` уже считаются `excluded`.
- **Промпт:**
  > Создай `docs/source-data/alignments/grc-eng/manual-alignments.json` =
  > `{"normalizationVersion":"bsb-text-v2","entries":[]}`. В `build-align.mjs` адаптируй чтение под
  > новую схему: поддержи `wordIndex`/`wordIndexes` (компиляция span из `words[]`, проверка
  > `expectedText`), сохранив обратную совместимость нет (старый формат — массив — больше не нужен).
  > Добавь авто-исключения `no-bsb-verse` (grc-ref без eng-стиха) в `warningsByRef` и в `excluded`.
  > В `verify-data.mjs` провалидируй файл по правилам плана T3.2 (версия, tokenId, индексы,
  > expectedText, overlap, конфликты, reason). Несоответствие → `error`.

### - [ ] T3.3 — Итеративная курация до `unresolvedNonFunctionTokens == 0`

- **Действие (цикл):** `npm run build:data` → `node scripts/curate-align.mjs --top 50` → для верхних
  записей добавить в `manual-alignments.json` пару (`wordIndex`+`expectedText`, найденные через T3.0)
  ИЛИ `manual-exclusion` с `reason` → `npm run verify:data` → повтор. `no-bsb-verse` уже авто-исключены;
  для `no-gloss` (john 8:3-6) добавить `manual-exclusion`.
- **Критерий приёмки:** `unresolvedNonFunctionTokens == 0` в build-report; `verify:data` зелёный
  (инвариант T1.2 + валидация T3.2 + fw/no-gloss T1.4). Coverage% — любое (advisory).
- **Промпт:**
  > Итеративно доводи `unresolvedNonFunctionTokens` до 0: `build:data` → `curate-align.mjs --top 50`
  > → дополняй `manual-alignments.json` (пары через `wordIndex`/`expectedText` или `manual-exclusion`
  > с `reason`) → `verify:data`. Покрой 6 no-gloss токенов john 8:3-6 исключениями. После каждого
  > батча verify обязан быть зелёным; коммить контрольными точками.

---

# Фаза 4 — Финальный гейт и синхронизация документов

### - [ ] T4.1 — Полная регенерация и зелёный verify

- **Критерий приёмки:** `npm run build:data` → `npm run verify:data` (0 errors;
  `ok('alignment accuracy invariant holds')`; `unresolvedNonFunctionTokens == 0`) → `npm test` →
  `npm run build` — всё зелёное.

### - [ ] T4.2 — Детерминированный аудит точности (семантика, уровень c)

- **Действие:** скрипт с ФИКСИРОВАННЫМ seed (воспроизводимо) берёт выборку и печатает
  `ref | grc-лемма | морфология | gloss(Berean/Cherith) | verseText.slice(span) | method`. Состав:
  - детерминированная выборка по `proven`-методам (например, 50 на метод);
  - **100% обязательный аудит** ВСЕХ пар тиров `fuzzy` и `manual`, и любых `proposal` (если включали);
  - результаты (доля верных, найденные ошибки) — в `docs/implementation-report.md`.
- **Критерий приёмки:** для авто-выборки доля семантически верных ≥ 99.5% (≤1 ошибка на 200);
  для `fuzzy`/`manual`/`proposal` — 0 ошибок (иначе чинить/исключать и вернуться в Фазу 2/3).
  Отчёт сохранён, seed зафиксирован.
- **Промпт:**
  > Напиши `scripts/audit-align.mjs` с фикс-seed. Печатай `ref|лемма|морфология|gloss|slice|method`.
  > Выборка: 50/метод для proven; ВСЕ fuzzy и manual пары. Просмотри, отметь долю верных. Порог:
  > proven ≥99.5%, fuzzy/manual = 100%. Сводку в `docs/implementation-report.md`.

### - [ ] T4.3 — Синхронизировать VISION / IMPL-PIPELINE / IMPL-RUNTIME

- **Файлы:** `docs/VISION.md` (§6), `docs/IMPL-PIPELINE.md` (Task 4, Task 7/verify, Task 0b).
- **Действие:** заменить «coverage 90% — hard gate» на «accuracy-инвариант + `resolved==100%` — hard
  gate; coverage — advisory warn»; задокументировать три уровня правильности (0.1), тиринг методов
  (0.3), схему `q`/`method`/exclusion (0.4), новые методы (`alt-gloss-*`, `lexicon-gloss-exact`,
  `positional-equal-count`-proposal), workflow `manual-alignments.json` + `wordIndex`/`expectedText`
  + привязку к `normalizationVersion`, авто-исключения `no-bsb-verse`/`no-gloss`. Унифицировать
  терминологию `grc` (не `grk`) — в коде везде `grc`.
- **Критерий приёмки:** документы не противоречат коду; нет «90% блокирует релиз»; нет `grk`.

---

# Приложение A — Команды-помощники

```bash
# текущее покрытие/разрешённость
node -e 'const r=require("./assets/data/align/grc-eng/build-report.json");console.log({cov:r.nonFunctionCoveragePercent,zero:r.versesWithZeroPairs,unresolved:r.unresolvedNonFunctionTokens})'
# распределение q и method
node -e 'const fs=require("fs");const d="assets/data/align/grc-eng";const q={},m={};for(const f of fs.readdirSync(d)){if(!f.endsWith(".json")||f==="build-report.json")continue;const b=JSON.parse(fs.readFileSync(d+"/"+f));for(const r in b.pairsByRef)for(const p of b.pairsByRef[r]){q[p.q]=(q[p.q]||0)+1;m[p.method]=(m[p.method]||0)+1}}console.log(q,m)'
# курация: контекст стиха
node scripts/curate-align.mjs "john 1:1"
```

---

# Приложение B — НЕ-выравнивательные баги (отдельный трек, ревью 2026-06-25)

Подтверждены проверкой, но **вне scope выравнивания**. [P0] можно делать **параллельно** Фазе 0.

- [ ] **[P0] Словарный UI сломан.** `loadFrequency` (`src/data/lexicon-loader.js:55-77`) отдаёт
  `strong: item.strongs` (массив) и НЕ отдаёт `hasAlignment`; экран
  (`src/ui/screens/dictionary.js:388,394,397`) читает скаляр `item.strong` и `item.hasAlignment` →
  все строки `dict-row--disabled`, `lex` не находится. Согласовать форму: отдавать `hasAlignment`,
  нормализовать `strong`, выровнять имена полей (`translit`), вернуть add/toggle.
- [ ] **[P1] Миграция словаря не вызывается.** `migrateDictionaryData`/`saveMigrationResults`
  (`src/state/dictionary.js:84,117`) экспортированы, но нет call-site. Подключить в `reading.js
  mount()` после загрузки core+dictionary; персист fail-soft; юнит-тесты (перенос ключей,
  идемпотентность, merge-конфликт, неизвестный легаси-ключ).
- [ ] **[P1] Утечка source-only полей.** `build-lexicon.mjs:183` копирует `attestedForms` сырьём →
  `normalized`+`surfaceSearch` (по 19 428) в `core.json`. Срезать при сборке. Закрыть слепое пятно
  verify: `findStripFields` (`verify-data.mjs:441`) не рекурсит в массивы — добавить рекурсию.
- [ ] **[P1] `npm test` красный из-за obsolete-сьюта.** Исключить `docs/obsolete-dont-use/**` из
  vitest (`test.exclude`), чтобы `npm test` был настоящим зелёным гейтом.
- [ ] **[P2] `core.json` без cache-busting.** `lexicon-loader.js:18` грузит без `?v=`; использовать
  версию манифеста, как в bible-loader.
- [ ] **[P2] Онбординг — устаревшие русские примеры.** `src/ui/screens/onboarding.js:22,30`
  (`«Слово»→λόγος`) не соответствуют английскому BSB; заменить на английские примеры.
- [ ] **[P3] Вводящие в заблуждение комментарии** (`reading.js:525,534` «русский текст») и имя
  настройки `ruHint` (теперь управляет показом английского BSB-текста).

---

# Приложение C — Журнал проверки фидбека (verified, not trusted; 2026-06-25)

Проверено по реальным данным/коду; здесь — что подтвердилось и что отклонено.

**Подтверждено и учтено в плане:**
- `john 3:5` уже корректен; реально битые — `john 1:5` (`overcomeit`), `john 1:26` (`withwater`) → T0.1.
- Curly `’` рвёт `God’s` → 394 стиха → T0.1b.
- Sweep `[a-z][A-Z]` пропускает `;:!?`/цифры — 36 реальных склеек (`poor;His`, `276of`) → T0.2 (comprehensive + allowlist).
- `NORMALIZATION_VERSION='bsb-text-v1'` не бампнут → T0.0.
- 15 nf-токенов в 3 grc-стихах без BSB (`romans 16:24`,`3john 1:15`,`revelation 12:18`) → авто-исключение `no-bsb-verse` (T3.2).
- 6 nf-токенов без обеих глосс (`john 8:3-6`) → `no-gloss` (T1.4/T3.3).
- 514 «протухших» ambiguous → `topUnalignedLexemes` из финального непарного набора (T3.1).
- `q ∈ {a,f,manual}` неверно (`manual` — метод) → схема 0.4; реестр методов (T1.1); инвариант по методу (T1.2).
- `lexicon-gloss-exact`/`positional-equal-count` рискованны → тиринг 0.3; positional по умолчанию OFF (T2.3).
- Ручной span по offsets опасен → `wordIndex`/`expectedText` + инструмент куратора (T3.0/T3.2).
- «accuracy = формальное, не семантическое» → аксиома 0.1; ручной аудит уровня c (T4.2).

**Отклонено / уже сделано (проверено):**
- «coverage — hard error» — НЕТ, уже `warn` (`verify-data.mjs:385`); T1.3 = подтвердить, не менять.
- «нужен `process.exitCode=1`» — уже `process.exit(1)` при `errors>0` (строка 539); вар. — `errors`.
- «build-report не в манифесте» — Check 18 (`verify-data.mjs:421`) уже проверяет.
- «overlap/duplicate не проверяются» — проверяются: дубль → `throw` (build:348), overlap → `error`
  (verify:363). Новые проходы лишь не должны их создавать (overlap-guard), дублировать проверки не нужно.
