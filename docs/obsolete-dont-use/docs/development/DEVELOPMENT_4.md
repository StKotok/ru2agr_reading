# DEVELOPMENT_4.md — Режим 3 на Strong-выравнивании и частотный слой

> **Статус выполнения:** все фазы выполнены в `153ec7d..af672da` (2026-06-12).
> Найденные при ревью регрессии и доводка до release-ready —
> `docs/development/DEVELOPMENT_5.md`.
>
> **Статус проекта:** v1.0.1 выпущена. 103 теста зелёных, сборка чистая. Ветка `dev2`.
> **Дата решения:** 2026-06-12. Решение владельца проекта: точность соответствия русского
> слова греческому оригиналу важнее покрытия. Падение количества замен — приемлемо.

> **Для агентов-исполнителей:** задачи выполняются строго последовательно, фаза за фазой.
> Одна задача = один коммит. Перед началом прочитай `AGENTS.md` целиком и
> `docs/development/DEVELOPMENT_1.md` разделы 3–4. После каждой задачи: `npm test` зелёный,
> `npm run build` чистый; если менялись данные — `npm run build:data`.
> Чекбоксы отмечаются в этом файле и коммитятся вместе с кодом задачи.

---

## Правила работы

1. Работаем в ветке `dev2`. Коммиты — conventional commits.
2. TDD: для задач движка сначала пишем падающий тест, потом реализацию.
3. После каждого изменения движка/стора — `npm test`.
4. После каждого изменения UI — ручная проверка в браузере (`npm run dev`),
   мобильная (375px) и десктопная (1280px) ширина, светлая и тёмная тема.
5. Перед каждым коммитом — `npm run build` без ошибок.
6. Не трогаем: имя базы и ключи IndexedDB, контракт `Segment`, сигнатуру
   `composeVerse(verseText, ctx)`, hash-маршруты.

---

## Контекст и мотивация (зачем всё это)

Сегодня в приложении два механизма словарных замен:

- **Режим 3** (`word-layer.js`): ищет русские слова регулярками `ruMatches` из
  `core.json` и заменяет на лемму. Выравнивание не используется.
- **Режим 4** (`form-layer.js`): идёт по Strong-выравниванию
  (`verse.alignment`: индекс русского слова → индекс греческого токена) и
  заменяет на реальную форму из греческого текста.

Замер на Евангелии от Иоанна (27 книг в корпусе, у Иоанна выровнено 729 из 879
стихов) показал:

| Метрика | Значение |
|---|---|
| Замен через регулярки в выровненных стихах | 2204 |
| Из них лемма **отсутствует** в греческом стихе (ложная замена) | **481 (~22%)** |
| Случаев, где выравнивание даёт замену, а регулярка против | **0** |

Типичная ложная замена: Ин 1:1 «было» → γίνομαι, тогда как в оригинале стоит
ἦν (εἰμί). Топ ложных лемм: λέγω (145), γίνομαι (108), γινώσκω (55). Для
учебного приложения это хуже, чем отсутствие замены: пользователь заучивает
неверное соответствие.

Второй аргумент — масштабирование. Цикл `word-layer.js` пробует каждую запись
словаря на каждой позиции текста: O(длина × записи × регулярки). На 104 словах
терпимо, на сотнях слов частотного слоя — нет. Замена по выравниванию — O(слов
стиха) с Map-lookup и не требует ручного написания регулярок на каждое слово.

Третий аргумент — у нас уже всё есть: греческий текст грузится с режима 3
(`reading.js:110`), `form-layer.js` уже умеет показывать лемму вместо формы
(`dictEntry.forms === 'lemma'`), выравнивание проверено в v1.0.1.

## Принятые решения (не пересматривать в ходе работ)

1. **Замены слов в режимах 3 и 4 происходят ТОЛЬКО по выравниванию.** Стих без
   `alignment` → словарных замен в нём нет; буквенный слой работает как раньше.
   Точность 100% важнее покрытия — решение владельца проекта.
2. **Regex-fallback'и режима 4 удаляются** (`applyWordToPlainSegments` и полный
   откат на word-layer): они построены на том же неточном механизме.
3. **`ruMatches`/`ruExclude` остаются в `core.json`** как валидационный guard
   внутри `form-layer.js` (строки 60–77): даже выровненное слово не заменяется,
   если не похоже на словарное. Это вторая линия защиты от ошибок выравнивания —
   она работает на цель «100% точность» и не удаляется. Для слов частотного
   слоя, отсутствующих в `core.json` (лексемы `freq-<strong>`), guard пропускает
   слово без проверки — выравнивание считается достаточной гарантией.
4. **`word-layer.js` удаляется** после перевода режимов 3–4 на выравнивание.
5. **Частотный слой строится из собственного корпуса** (`assets/data/bibles/grc`,
   137 741 токен, 5436 уникальных Strong): никаких новых внешних данных и
   лицензионных рисков. Внешний частотный словарь с глоссами
   (`docs/greek-nt-frequency-sources/`) — за пределами этого roadmap'а, ждёт
   license review.
6. **Управление словами — через страницу словаря.** Слайдер интенсивности на
   главном экране влияет только на буквенный слой (режимы 1–2). Какие слова
   показывать — решает пользователь чекбоксами `showInText` на странице
   словаря. Никакого отдельного `freqTopN`-слайдера. Схема настроек
   расширяется аддитивно: пользователи без записей в словаре не видят
   словарных замен — это штатное поведение.
7. Картина замен в режиме 3 изменится (другой механизм → другие seed'ы) — это
   ожидаемо и не является регрессией.

---

## Фаза 1 — Движок: режим 3 через выравнивание

### Задача 1.1 — form-layer: per-word интенсивность через `intensityPct`

**Проблема (латентный баг):** `form-layer.js:81-82` читает `dictEntry.intensity`
(строки `often|sometimes|rare`), но записи из `buildWordEntries()`
(`reading.js:525`) содержат числовое поле `intensityPct` — поля `intensity` в них
нет. Итог: `intensityMap[undefined] || 100` → пер-словная интенсивность
«иногда/редко» в режиме 4 молча игнорируется, замена всегда 100%. Пока режим 3
работал через word-layer (который честно читает `intensityPct`), баг не был
виден; после перевода режима 3 на form-layer он сломал бы настройку «как часто
заменять» у слов словаря.

**Логика:** контракт записей словаря один — `intensityPct: number` (0–100).
form-layer должен читать его же, как это делает word-layer.

**Файлы:** изменить `src/engine/form-layer.js`, дополнить
`tests/form-layer.test.js`.

- [x] Написать падающий тест: `intensityPct: 0`, `status: 'new'` → замена не происходит
- [x] Написать тест: `intensityPct: 100`, `status: 'new'` → замена происходит
- [x] `form-layer.js`: заменить чтение `dictEntry.intensity` на `dictEntry.intensityPct ?? 100`
- [x] `npm test` зелёный
- [x] Коммит

**Промпт:**
```text
Почини чтение пер-словной интенсивности в form-layer (TDD).

Прочитай AGENTS.md и src/engine/form-layer.js. Баг: строки 81-82
  const intensityMap = { often: 100, sometimes: 50, rare: 25 };
  const pct = intensityMap[dictEntry.intensity] || 100;
читают dictEntry.intensity (строка 'often'|'sometimes'|'rare'), но реальные
записи из buildWordEntries() в reading.js несут ЧИСЛОВОЕ поле intensityPct
(0-100), а intensity в них отсутствует. Поэтому pct всегда 100 и настройка
«как часто заменять» игнорируется.

1) Сначала тесты в tests/form-layer.test.js (стиль существующих тестов файла,
   фикстуры самодостаточные):

   it('intensityPct=0 со статусом new никогда не заменяет', () => {
     const tokens = [
       { w: 'Ἀρχὴ', lemma: 'ἀρχή', morph: 'N-NSF', strong: 746 },
       { w: 'εὐαγγελίου', lemma: 'εὐαγγέλιον', morph: 'N-GSN', strong: 2098 }
     ];
     const segs = applyFormLayer('Начало Евангелия', tokens, [{ ru: 1, gr: 1 }], [
       { lexemeId: 'euangelion', lemma: 'εὐαγγέλιον', strong: 2098,
         intensityPct: 0, status: 'new', forms: 'all' }
     ], { seedPrefix: 'mark' });
     expect(segs.every(s => s.greek === undefined)).toBe(true);
   });

   it('intensityPct=100 со статусом new заменяет', () => {
     // те же фикстуры, intensityPct: 100 →
     expect(segs.some(s => s.greek === 'εὐαγγελίου')).toBe(true);
   });

2) Запусти npm test — первый тест должен упасть (сейчас pct всегда 100 и
   замена происходит вопреки intensityPct: 0). Второй пройдёт и до фикса —
   он регрессионный guard на «не сломать обычный случай».

3) Реализация: в form-layer.js замени две строки на
   const pct = dictEntry.intensityPct ?? 100;
   intensityMap удали. Семантика shouldReplace не меняется:
   status === 'known' → всегда; иначе hash01(seed) * 100 < pct.

4) npm test — все зелёные (включая старые тесты form-layer: они передают
   intensityPct: 100 и не сломаются). npm run build.

Коммит: "fix: form-layer reads intensityPct, per-word intensity works in mode 4"
```

---

### Задача 1.2 — compose.js: режим 3 через form-layer с леммами

**Логика:** режим 3 остаётся «учебным мостиком» (показывает словарную форму —
лемму), но слово для замены теперь находится не регулярками, а по выравниванию:
русское слово → выровненный греческий токен → его Strong есть у активного слова
словаря → замена на лемму. `applyFormLayer` уже умеет всё это, включая показ
леммы (`forms === 'lemma'`) и guard по `ruMatches`; compose лишь форсирует
`forms: 'lemma'` для всех записей, потому что в режиме 3 реальные формы не
показываются никогда. Стих без выравнивания → только буквенный слой: точность
важнее покрытия (решение №1).

**Файлы:** изменить `src/engine/compose.js`, дополнить `tests/compose.test.js`.

- [x] Написать падающие тесты (5 кейсов из промпта: лемма вместо формы; игнор персонального `forms:'all'`; нет выравнивания слова → нет замены, даже если регулярка матчит; нет `grcVerse`/`alignment` → только буквенный слой; guard `ruMatches` отклоняет непохожее слово)
- [x] `compose.js`: ветка `mode === 3` вызывает `applyFormLayer` с записями, у которых `forms` форсирован в `'lemma'`; вызов `applyWordLayer` из ветки удалить
- [x] Без `grcVerse`/`alignment` ветка возвращает только letter-layer
- [x] `npm test` зелёный
- [x] Коммит

**Промпт:**
```text
Переведи режим 3 с регулярок на Strong-выравнивание (TDD).

Прочитай AGENTS.md, DEVELOPMENT_1.md раздел 3.4, src/engine/compose.js,
src/engine/form-layer.js и DEVELOPMENT_4.md «Контекст и мотивация».
Суть: режим 3 заменяет русское слово на ЛЕММУ, но находит слово по
выравниванию (как режим 4), а не регулярками. Без выравнивания замен нет.

1) Сначала тесты в tests/compose.test.js, новый describe('mode 3 через
   выравнивание'). Общие фикстуры:

   const grcTokens = [
     { w: 'Ἐν', lemma: 'ἐν', morph: 'PREP', strong: 1722 },
     { w: 'ἀρχῇ', lemma: 'ἀρχή', morph: 'N-DSF', strong: 746 },
     { w: 'ἦν', lemma: 'εἰμί', morph: 'V-IAI-3S', strong: 1510 },
     { w: 'λόγον', lemma: 'λόγος', morph: 'N-ASM', strong: 3056 }
   ];
   const wordEntries = [{
     lexemeId: 'logos', lemma: 'λόγος', strongNum: 3056,
     regexps: [/(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])/iu],
     excludeRegexps: [], intensityPct: 100, status: 'known', forms: 'all'
   }];
   const baseCtx = { mode: 3, intensity: 0, progressLetters: {}, seedPrefix: 't', wordEntries };

   Кейсы:
   a) Замена на лемму, не на форму. composeVerse('В начале было Слово',
      { ...baseCtx, grcVerse: { tokens: grcTokens }, alignment: [{ ru: 3, gr: 3 }] })
      → есть сегмент с greek 'Λόγος' (регистр первой буквы сохраняется от
      «Слово»), и НЕТ сегмента 'Λόγον'. Заметь: forms у записи 'all', но
      режим 3 обязан показать лемму — это и проверяем.
   b) Слово без выравнивания не заменяется, даже если регулярка матчит.
      Тот же стих, alignment: [{ ru: 0, gr: 0 }] (само «Слово» не выровнено)
      → итоговый текст segments.map(s => s.greek || s.plain || '').join('')
      равен 'В начале было Слово'.
   c) Нет grcVerse/alignment вообще → словарных замен нет:
      composeVerse('Слово', baseCtx) → текст 'Слово'.
      (Раньше тут срабатывал regex-механизм — теперь не должен.)
   d) Guard ruMatches: composeVerse('В начале был свет',
      { ...baseCtx, grcVerse: { tokens: grcTokens }, alignment: [{ ru: 3, gr: 3 }] })
      — «свет» выровнен с λόγον (имитация ошибки выравнивания), но не матчится
      регуляркой словарной записи → текст остаётся 'В начале был свет'.
   e) Детерминизм: два вызова с одинаковым ctx → toEqual.

2) npm test — новые тесты падают (кейс a: сейчас режим 3 вообще не смотрит
   на grcVerse; кейс c: regex-механизм заменит «Слово»).

3) Реализация в compose.js — замени ветку if (mode === 3) { ... } на:

   // Режим 3: словарный слой по выравниванию (леммы) + буквенный.
   // Без выравнивания словарных замен нет: точность важнее покрытия.
   if (mode === 3) {
     if (grcVerse && alignment && grcVerse.tokens) {
       const lemmaEntries = wordEntries.map(e => ({
         ...e,
         strong: e.strongNum || null,
         forms: 'lemma'
       }));
       const segs = applyFormLayer(verseText, grcVerse.tokens, alignment, lemmaEntries, { seedPrefix });
       return applyLetterToPlain(segs, activeLetters, intensity, seedPrefix, showDiacritics);
     }
     return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
   }

   Импорт applyWordLayer пока не удаляй — он ещё используется веткой режима 4
   (уберём в Фазе 2). Сегменты режима 3 теперь имеют kind 'form' (не 'word') —
   это ок: data-kind нигде не используется ни в CSS, ни в коде, а карточка
   слова открывается по data-lexeme.

4) npm test && npm run build.

Коммит: "feat: mode 3 word substitutions via Strong alignment (lemma display)"
```

---

### Задача 1.3 — reading.js: передавать греческие данные в режиме 3

**Логика:** греческая книга уже грузится с режима 3 (`reading.js:110`), но
`grcVerse`/`alignment` кладутся в контекст стиха только при `mode >= 4` — в
двух местах (первичный рендер и перерендер). После задачи 1.2 движок режима 3
ждёт эти данные. Заодно обновляем тост деградации: прежний текст обещал
«словарные формы» через regex-fallback, которого больше не будет.

**Файлы:** изменить `src/ui/screens/reading.js`.

- [x] `renderWindowed()` (~строка 409): условие `grcBookData && settings.mode >= 4` → `>= 3`
- [x] `reRenderWindowed()` (~строка 598): то же условие → `>= 3`
- [x] Тост недоступности греческого (~строка 129): условие `settings.mode >= 4` → `>= 3`, текст: «Греческий текст недоступен — словарные замены отключены»
- [x] Загрузку книги (строка 110, `mode >= 3`) НЕ менять — уже корректна
- [x] `npm test` зелёный, ручная проверка в браузере
- [x] Коммит

**Промпт:**
```text
Подключи греческие данные к режиму 3 в читалке.

Прочитай AGENTS.md и src/ui/screens/reading.js. После перевода compose.js
режима 3 на выравнивание (задача 1.2) экран обязан передавать grcVerse и
alignment в контекст стиха начиная с режима 3.

1) В renderWindowed() найди блок (~строка 407):
     // Добавляем grcVerse и alignment для режимов 4-5
     const verseCtx = { ...composeCtx };
     if (grcBookData && settings.mode >= 4) {
   Замени условие на settings.mode >= 3 и поправь комментарий на «для
   режимов 3-5». Внутри блока ничего больше не меняй: grcVerse берётся по
   индексам chIdx/vIdx, alignment — verse.alignment || null.

2) То же самое в reRenderWindowed() (~строка 598).

3) Тост (~строка 129):
     if (!grcBookData && settings.mode >= 4) {
       showToast('Греческий текст недоступен — показываем словарные формы', ...);
   →
     if (!grcBookData && settings.mode >= 3) {
       showToast('Греческий текст недоступен — словарные замены отключены', { timeout: 5000 });

4) Строку 110 (loadBook('grc', bookId) при settings.mode >= 3) не трогай —
   она уже грузит греческий для режима 3.

5) npm test, затем ручная проверка (npm run dev):
   - Режим 3, Иоанн 1, слово «Слово» в словаре со статусом known:
     в стихах 1 и 14 видна замена на Λόγος/λόγος (лемма, не λόγον).
   - Стих без выравнивания — словарных замен нет, буквенный слой работает.
   - Тап по заменённому слову открывает карточку слова (моб. — шторка,
     десктоп — инспектор).
   - Режим 4 ведёт себя как раньше (реальные формы).
   - Проверка на 375px и 1280px, светлая и тёмная тема.
6) npm run build.

Коммит: "feat: pass Greek verse data to mode 3 in reading screen"
```

---

## Фаза 2 — Точность в режиме 4: убрать regex-fallback'и

### Задача 2.1 — compose.js: режим 4 без word-layer

**Логика:** в режиме 4 сейчас два regex-отката: `applyWordToPlainSegments`
(словарные слова без выравнивания внутри выровненного стиха) и полный откат на
`applyWordLayer`, когда греческих данных нет. Оба наследуют ~22% ложных замен и
противоречат решению №1: лучше не заменить, чем заменить неверно. После этой
задачи у `applyWordLayer` не остаётся вызывающих — формально он удаляется в
Фазе 3.

**Файлы:** изменить `src/engine/compose.js`, обновить `tests/compose.test.js`.

- [x] Переписать тест `mode 4: word-layer fallback для невыровненных словарных слов` под новое поведение: невыровненное слово остаётся русским
- [x] Добавить тест: режим 4 без `grcVerse`/`alignment` → только буквенный слой
- [x] `compose.js`: из ветки `mode === 4` удалить вызов `applyWordToPlainSegments` и откат на `applyWordLayer`; удалить саму функцию `applyWordToPlainSegments` и импорт `applyWordLayer`
- [x] `npm test` зелёный
- [x] Коммит

**Промпт:**
```text
Убери regex-fallback'и из режима 4 (TDD).

Прочитай AGENTS.md, src/engine/compose.js и DEVELOPMENT_4.md «Принятые
решения» (№1-2). Невыровненные слова в режиме 4 должны оставаться русскими,
без греческих данных словарных замен нет вообще.

1) Сначала тесты в tests/compose.test.js.
   a) Существующий тест 'mode 4: word-layer fallback для невыровненных
      словарных слов' переписать (фикстуры оставь те же — стих
      'В начале было Слово и Бог', токены, alignment: [{ ru: 3, gr: 2 }],
      записи logos и theos со status 'known'):
      - название: 'mode 4: невыровненные слова остаются русскими'
      - ожидания: текст содержит 'Λόγος' (выровнено, заменилось с сохранением
        заглавной), содержит 'Бог' и НЕ содержит 'θεός' (не выровнено —
        не заменилось, хотя регулярка матчит и статус known).
   b) Новый тест 'mode 4 без греческих данных не делает словарных замен':
      composeVerse('В начале было Слово', { mode: 4, intensity: 0,
      progressLetters: {}, seedPrefix: 't', wordEntries: <запись logos из (a)> })
      → итоговый текст равен 'В начале было Слово'.

2) npm test — оба падают (сейчас срабатывают fallback'и).

3) Реализация: ветка if (mode === 4) в compose.js становится:

   // Режим 4: формовый слой по выравниванию + буквенный.
   // Без выравнивания словарных замен нет: точность важнее покрытия.
   if (mode === 4) {
     if (grcVerse && alignment && grcVerse.tokens) {
       const dictEntries = wordEntries.map(e => ({
         ...e,
         strong: e.strongNum || null
       }));
       const segs = applyFormLayer(verseText, grcVerse.tokens, alignment, dictEntries, { seedPrefix });
       return applyLetterToPlain(segs, activeLetters, intensity, seedPrefix, showDiacritics);
     }
     return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
   }

   Удали функцию applyWordToPlainSegments целиком и импорт applyWordLayer
   из compose.js (после задачи 1.2 других использований в compose нет).

4) npm test && npm run build. Ручная проверка: режим 4, Иоанн 1 — формы
   видны, невыровненные слова русские; перевод стрелки настроек в режим 3
   и обратно не ломает рендер.

Коммит: "feat: mode 4 substitutions are alignment-only, drop regex fallbacks"
```

---

## Фаза 3 — Чистка regex-механизма

### Задача 3.1 — удалить word-layer и мёртвый код кандидатов

**Логика:** после Фаз 1–2 `applyWordLayer` не вызывается нигде. Функция
`getChapterCandidates` в `reading.js` (~строка 500) — мёртвый код (вызовов нет,
проверено grep'ом), построенный на тех же регулярках. Удаляем оба. ВАЖНО:
`ruMatches`/`ruExclude` в `core.json` и их компиляция в `buildWordEntries()`
остаются — это валидационный guard form-layer (решение №3).

**Файлы:** удалить `src/engine/word-layer.js`, `tests/word-layer.test.js`;
изменить `src/ui/screens/reading.js`.

- [x] Убедиться grep'ом, что `applyWordLayer` не используется вне `word-layer.js`
- [x] Удалить `src/engine/word-layer.js` и `tests/word-layer.test.js`
- [x] Удалить `getChapterCandidates` из `reading.js` (вызовов нет)
- [x] Убедиться, что компиляция `regexps`/`excludeRegexps` в `buildWordEntries()` осталась нетронутой
- [x] `npm test` зелёный (минус 5 тестов word-layer), `npm run build` чистый
- [x] Коммит

**Промпт:**
```text
Удали отживший regex-механизм замен.

Прочитай AGENTS.md и DEVELOPMENT_4.md «Принятые решения» (№3-4).

1) Проверь, что вызовов больше нет:
   grep -rn "applyWordLayer\|word-layer" src/ tests/
   Ожидание: совпадения только в самом src/engine/word-layer.js и
   tests/word-layer.test.js. Если есть другие — остановись и разберись,
   Фазы 1-2 не завершены.

2) Удали файлы src/engine/word-layer.js и tests/word-layer.test.js.

3) В src/ui/screens/reading.js удали функцию getChapterCandidates (~строка
   500) — это мёртвый код: grep -rn "getChapterCandidates" src/ должен
   находить только само объявление.

4) НЕ трогай: ruMatches/ruExclude в assets/data/lexicon/core.json и их
   компиляцию в buildWordEntries() (поля regexps/excludeRegexps записей) —
   их использует guard в form-layer.js как защиту от ошибок выравнивания.

5) npm test (тестов станет на 5 меньше — это удалённые тесты word-layer,
   остальные зелёные) && npm run build.

Коммит: "chore: remove regex word-layer, superseded by alignment-based engine"
```

---

## Фаза 4 — Частотный слой и новый экран словаря

Продуктовая суть: страница «Словарь» превращается в мастер-список **всех** слов
НЗ из корпусного частотного списка. Пользователь видит каждое слово с его
частотой, рангом и статусом доступности; включает/выключает показ в тексте
через чекбокс `showInText`. Подстановки идут только по выравниванию — ровно
тем же механизмом, что и личный словарь. Никакого отдельного `freqTopN`-слайдера
нет: управление словами — только через страницу словаря (решение №6).

### Задача 4.1 — корпусная частотность: скрипт и frequency.json

**Логика:** частотность считаем по собственным греческим данным
(`assets/data/bibles/grc/*.json`: 137 741 токен, 5436 уникальных Strong) —
ноль новых внешних источников, ноль лицензионных вопросов (данные уже в репо,
происхождение зафиксировано в v1.0.x). У 137 Strong-номеров встречается
несколько вариантов леммы — берём самую частотную с детерминированным
tie-break'ом. Дополнительно: (а) считаем `hasAlignment` — участвует ли Strong
хотя бы в одной alignment-паре во всём НЗ (для disabled-логики в словаре);
(б) добавляем SBL-транслитерацию леммы (механика, 0 лицензионных рисков —
таблица замен латинскими буквами); (в) замеряем долю alignment-пар,
отклонённых ruMatches-guard'ом — для data-driven решения о будущем guard'а.

**Файлы:** создать `scripts/build-frequency.mjs`,
`tests/frequency-data.test.js`, сгенерировать
`assets/data/lexicon/frequency.json`; изменить `package.json` (`build:data`).

- [x] Написать тест данных `tests/frequency-data.test.js` (он падает: файла ещё нет)
- [x] Написать `scripts/build-frequency.mjs` с инвариантами (счётчики и guard-статистика)
- [x] Подключить скрипт к `npm run build:data` (после `convert-alignments.js`)
- [x] Сгенерировать `assets/data/lexicon/frequency.json`, тест зелёный
- [x] `npm run build:data` целиком проходит (старые инварианты не ослаблены)
- [x] Коммит (скрипт + данные + тест вместе)

**Промпт:**
```text
Построй корпусный частотный список лемм НЗ (TDD по данным).

Прочитай AGENTS.md (раздел про данные: сгенерированное не править руками,
скрипт + перегенерация) и scripts/convert-alignments.js (стиль скриптов).

1) Сначала тест tests/frequency-data.test.js (упадёт — файла данных нет):

   import { describe, it, expect } from 'vitest';
   import { readFileSync } from 'node:fs';

   const items = JSON.parse(readFileSync('assets/data/lexicon/frequency.json', 'utf8'));

   describe('frequency.json', () => {
     it('ровно 1000 записей с непрерывным rank с 1', () => {
       expect(items.length).toBe(1000);
       items.forEach((it_, i) => expect(it_.rank).toBe(i + 1));
     });
     it('отсортирован по count по убыванию', () => {
       for (let i = 1; i < items.length; i++) {
         expect(items[i].count).toBeLessThanOrEqual(items[i - 1].count);
       }
     });
     it('strong уникальны и положительны', () => {
       const s = new Set(items.map(i => i.strong));
       expect(s.size).toBe(items.length);
       items.forEach(i => expect(i.strong).toBeGreaterThan(0));
     });
     it('леммы греческие и непустые', () => {
       items.forEach(i => expect(i.lemma).toMatch(/^[Ͱ-Ͽἀ-῿]/));
     });
     it('translit присутствует и непустой у всех записей', () => {
       items.forEach(i => {
         expect(typeof i.translit).toBe('string');
         expect(i.translit.length).toBeGreaterThan(0);
       });
     });
     it('hasAlignment — булево поле', () => {
       items.forEach(i => expect(typeof i.hasAlignment).toBe('boolean'));
     });
     it('топ-3 корпуса: ὁ, καί, αὐτός', () => {
       expect(items[0]).toMatchObject({ strong: 3588, lemma: 'ὁ' });
       expect(items[1]).toMatchObject({ strong: 2532, lemma: 'καί' });
       expect(items[2]).toMatchObject({ strong: 846, lemma: 'αὐτός' });
     });
   });

2) Скрипт scripts/build-frequency.mjs (ESM, node:fs, без зависимостей):

   import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
   import path from 'node:path';

   const GRC_DIR = 'assets/data/bibles/grc';
   const ALIGN_DIR = 'assets/data/bibles/align';
   const OUT = 'assets/data/lexicon/frequency.json';
   const TOP_LIMIT = 1000;

   // ── SBL-транслитерация (справочная таблица, 0 лицензионных рисков) ──
   const SBL_MAP = [
     ['α', 'a'], ['β', 'b'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'],
     ['ζ', 'z'], ['η', 'ē'], ['θ', 'th'], ['ι', 'i'], ['κ', 'k'],
     ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'], ['ο', 'o'],
     ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'],
     ['υ', 'y'], ['φ', 'ph'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'ō'],
     ['ἀ', 'a'], ['ἁ', 'ha'], ['ἂ', 'ha'], ['ἃ', 'ha'], ['ἄ', 'ha'], ['ἅ', 'ha'], ['ἆ', 'ha'], ['ἇ', 'ha'],
     ['ἐ', 'e'], ['ἑ', 'he'], ['ἒ', 'he'], ['ἓ', 'he'], ['ἔ', 'he'], ['ἕ', 'he'],
     ['ἠ', 'ē'], ['ἡ', 'hē'], ['ἢ', 'hē'], ['ἣ', 'hē'], ['ἤ', 'hē'], ['ἥ', 'hē'], ['ἦ', 'hē'], ['ἧ', 'hē'],
     ['ἰ', 'i'], ['ἱ', 'hi'], ['ἲ', 'hi'], ['ἳ', 'hi'], ['ἴ', 'hi'], ['ἵ', 'hi'], ['ἶ', 'hi'], ['ἷ', 'hi'],
     ['ὀ', 'o'], ['ὁ', 'ho'], ['ὂ', 'ho'], ['ὃ', 'ho'], ['ὄ', 'ho'], ['ὅ', 'ho'],
     ['ὐ', 'y'], ['ὑ', 'hy'], ['ὒ', 'hy'], ['ὓ', 'hy'], ['ὔ', 'hy'], ['ὕ', 'hy'], ['ὖ', 'hy'], ['ὗ', 'hy'],
     ['ὠ', 'ō'], ['ὡ', 'hō'], ['ὢ', 'hō'], ['ὣ', 'hō'], ['ὤ', 'hō'], ['ὥ', 'hō'], ['ὦ', 'hō'], ['ὧ', 'hō'],
     ['ὰ', 'a'], ['ά', 'a'], ['ὲ', 'e'], ['έ', 'e'], ['ὴ', 'ē'], ['ή', 'ē'],
     ['ὶ', 'i'], ['ί', 'i'], ['ὸ', 'o'], ['ό', 'o'], ['ὺ', 'y'], ['ύ', 'y'],
     ['ὼ', 'ō'], ['ώ', 'ō'], ['ᾶ', 'a'], ['ῆ', 'ē'], ['ῖ', 'i'], ['ῦ', 'y'], ['ῶ', 'ō'],
   ];
   function sblTransliterate(text) {
     let out = '';
     for (let i = 0; i < text.length; i++) {
       let found = false;
       for (const [gr, lat] of SBL_MAP) {
         if (text.startsWith(gr, i)) {
           out += lat;
           i += gr.length - 1;
           found = true;
           break;
         }
       }
       if (!found) out += text[i];
     }
     return out;
   }

   // ── Шаг 1: подсчёт частот лемм по Strong ──
   // strong (string) → Map(lemma → count)
   const counts = new Map();
   for (const file of readdirSync(GRC_DIR).filter(f => f.endsWith('.json')).sort()) {
     const book = JSON.parse(readFileSync(path.join(GRC_DIR, file), 'utf8'));
     for (const ch of book.chapters) {
       for (const v of ch.verses) {
         for (const t of (v.tokens || [])) {
           if (!t.strong || !t.lemma) continue;
           const key = String(t.strong);
           if (!counts.has(key)) counts.set(key, new Map());
           const lemmas = counts.get(key);
           lemmas.set(t.lemma, (lemmas.get(t.lemma) || 0) + 1);
         }
       }
     }
   }

   const all = [...counts.entries()].map(([strong, lemmas]) => {
     const count = [...lemmas.values()].reduce((a, b) => a + b, 0);
     const lemma = [...lemmas.entries()]
       .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el'))[0][0];
     return { strong: Number(strong), lemma, count };
   });
   all.sort((a, b) => b.count - a.count || a.strong - b.strong);

   // ── Шаг 2: hasAlignment — участвует ли Strong в alignment-парах ──
   const alignedStrongs = new Set();
   for (const file of readdirSync(ALIGN_DIR).filter(f => f.endsWith('.json')).sort()) {
     const book = JSON.parse(readFileSync(path.join(ALIGN_DIR, file), 'utf8'));
     for (const ch of book.chapters) {
       for (const v of ch.verses) {
         const alignment = v.alignment;
         const tokens = v.tokens;
         if (!alignment || !tokens) continue;
         for (const a of alignment) {
           if (a.gr < tokens.length) {
             const s = tokens[a.gr].strong;
             if (s) alignedStrongs.add(String(s));
           }
         }
       }
     }
   }

   // ── Инварианты корпуса ──
   if (all.length < 5000 || all.length > 6000) {
     throw new Error(`инвариант: уникальных Strong ${all.length}, ожидалось 5000-6000`);
   }
   if (all[0].strong !== 3588 || all[0].count < 15000) {
     throw new Error(`инвариант: топ-1 должен быть ὁ (G3588, ~19.8k), получено G${all[0].strong}:${all[0].count}`);
   }

   const items = all.slice(0, TOP_LIMIT).map((it, i) => ({
     rank: i + 1,
     ...it,
     translit: sblTransliterate(it.lemma),
     hasAlignment: alignedStrongs.has(String(it.strong))
   }));
   writeFileSync(OUT, JSON.stringify(items));

   // Статистика для отладки
   const withAlign = items.filter(i => i.hasAlignment).length;
   const withoutAlign = items.filter(i => !i.hasAlignment).length;
   const disabledTop10 = items.slice(0, 10).filter(i => !i.hasAlignment).map(i => i.lemma);
   console.log(`frequency.json: ${items.length} лемм из ${all.length} Strong`);
   console.log(`hasAlignment=true: ${withAlign}, false: ${withoutAlign}`);
   console.log(`Топ-10 без alignment: [${disabledTop10.join(', ')}]`);
   console.log(`Топ-3: ${items.slice(0, 3).map(i => `${i.lemma} (G${i.strong}, ${i.count}, align=${i.hasAlignment})`).join(', ')}`);

3) package.json: "build:data": "node scripts/convert-alignments.js && node scripts/build-frequency.mjs"

4) Запусти npm run build:data — оба скрипта проходят, файл создан.
   npm test — тест данных зелёный. npm run build.

Лицензии: новых источников нет, frequency.json — производная уже
закоммиченных греческих данных (происхождение — docs/clear-bible-alignments/).
Транслитерация — механика (таблица замен), не контент; лицензионных рисков 0.

Коммит: "feat: corpus-derived NT lemma frequency list (top-1000) with translit and hasAlignment"
```

---

### Задача 4.2 — перестройка экрана словаря под мастер-список

**Логика:** текущий экран словаря показывает только слова, уже добавленные
пользователем (~0–80), с табами «Все/Новые/Учу/Знаю» и кнопкой «+ Добавить
слова» с панелью из `core.json`. Новый экран показывает **весь частотный
список** из `frequency.json` (~1000 строк), каждая строка = лемма + ранг +
частота + транслит + бейдж статуса (если слово в личном словаре) + чекбокс
`showInText`. Строка заблокирована (серый цвет, чекбокс disabled), если
`hasAlignment === false` — слово не может появиться в тексте ни в каком
режиме. Тап по строке раскрывает настройки слова (статус, intensity, forms) —
как сейчас, но с дополнительной информацией из частотного списка. Поиск по
лемме фильтрует список на лету.

**Файлы:** изменить `src/ui/screens/dictionary.js`, создать
`src/data/lexicon-loader.js` (добавить `loadFrequency`); изменить
`src/ui/components/word-card.js` (расширить карточку для freq-* слов).

- [x] `lexicon-loader.js`: добавить `loadFrequency()` с кешем и fail-soft (по образцу `loadCoreLexicon`)
- [x] `dictionary.js` mount: грузить `frequency.json` через `loadFrequency()`
- [x] Отрисовка списка: виртуализация или пагинация для 1000+ строк; DOM-окно по образцу `reading.js` (сразу N строк, IntersectionObserver для подгрузки)
- [x] Каждая строка: `<span class="rank">`, `<span class="lemma">`, `<span class="translit">`, `<span class="freq">` (частота), бейдж статуса (цветной, только если слово в словаре), чекбокс `showInText`
- [x] Disabled-логика: `!item.hasAlignment` → строка `.disabled`, чекбокс disabled, тултип «Не участвует в подстановках»
- [x] Поиск: `<input type="search">`, фильтр по `lemma` и `translit` на лету
- [x] Тап по строке → bottom-sheet/инспектор с полной карточкой слова (лемма, транслит, глосс, POS, Strong, частота, ранг, настройки статуса/intensity/forms/showInText)
- [x] Изменение чекбокса/статуса/intensity → запись в IndexedDB через `dictionary.js`, немедленное отражение в списке
- [x] Ручная проверка по чеклисту промпта
- [x] Коммит

**Промпт:**
```text
Перестрой экран «Словарь» в мастер-список частотных слов НЗ.

Прочитай AGENTS.md, src/ui/screens/dictionary.js (текущая реализация),
src/ui/screens/reading.js (образец: DOM-окно для глав, IntersectionObserver,
паттерн buildWordEntries), src/data/lexicon-loader.js,
src/state/dictionary.js и DEVELOPMENT_4.md «Принятые решения» (№6).

1) В lexicon-loader.js добавь loadFrequency() — по образцу loadCoreLexicon:
   кеш в модульной переменной, fetch('./data/lexicon/frequency.json'),
   fail-soft return null при 404/ошибке сети.

2) В dictionary.js mount():
   - загрузи frequency.json: const freqList = await loadFrequency();
   - сохрани в модульную переменную (нужна при переключении табов/поиске)
   - если freqList === null → покажи сообщение «Частотный список недоступен»
     и отрендери только личные слова (старое поведение как fallback)
   - загрузи coreLexicon (для глоссов) и dictionary (для статусов/чекбоксов)

3) UI экрана — полная переделка mount():

   a) Поисковая строка вверху:
      <input type="search" class="dict-search" placeholder="Поиск по лемме..."
             aria-label="Поиск слов в словаре">

   b) Список слов — контейнер <div class="dict-list">. Для 1000+ строк
      используй упрощённое DOM-окно: отрендери первые 100 строк сразу,
      остальные — по IntersectionObserver (сентинел в конце списка
      дорендеривает следующую партию из 100). Схема та же, что в reading.js
      для глав, но проще: нет сложной геометрии с placeholder'ами разной
      высоты — можно просто рендерить порциями по 100 и append'ить.

   c) Каждая строка — <div class="dict-row" data-strong="...">:

      <div class="dict-row ${!item.hasAlignment ? 'dict-row--disabled' : ''}">
        <span class="dict-rank">${item.rank}</span>
        <span class="dict-lemma">${item.lemma}</span>
        <span class="dict-translit">${item.translit}</span>
        <span class="dict-freq">${item.count}</span>
        ${statusBadge}   <!-- цветной бейдж new/learning/known или пусто -->
        <label class="dict-check">
          <input type="checkbox" ${entry?.showInText !== false ? 'checked' : ''}
                 ${!item.hasAlignment ? 'disabled' : ''}
                 aria-label="Показывать ${item.lemma} в тексте">
        </label>
      </div>

      - statusBadge: если слово есть в dictionary, показать бейдж
        (зелёный=known, золотой=learning, синий=new). Если нет в словаре —
        нет бейджа.
      - Строка с hasAlignment=false: класс dict-row--disabled даёт
        opacity: 0.4, чекбокс disabled.
      - При наведении на disabled-строку — title «Не участвует в подстановках
        (слово не выровнено ни в одном стихе НЗ)».

   d) При изменении чекбокса (событие change):
      - Если слово НЕ в dictionary: добавить запись через addWord(id, dict),
        затем setWordSetting(id, 'showInText', checked, dict).
        id = lexemeId из coreLexicon, если слово там есть, иначе `freq-<strong>`.
      - Если слово уже в dictionary: setWordSetting(id, 'showInText', checked, dict).
      - Сохранить словарь: await saveDictionary(updated).
      - Бейдж статуса обновить (появился «new» при первом добавлении).

   e) Тап по строке (не по чекбоксу) — открыть карточку слова:
      - Найти lexeme в coreLexicon (может отсутствовать для freq-*).
      - Найти dictEntry в dictionary.
      - Если lexeme найден — renderWordCard как сейчас (лемма, транслит,
        глосс, POS, Strong, кнопки статуса, настройки intensity/forms).
      - Если lexeme НЕ найден (freq-* слово) — минимальная карточка:
        лемма, транслит (из frequency.json), частота/ранг, грамматика
        (formatMorphRu — нужно будет достать morph из grc-данных;
        если сложно, опусти грамматику в первой версии), Strong.
        Внизу кнопка «Добавить в словарь» (addWord с id `freq-<strong>`).
      - Все изменения настроек в карточке пишутся через dictionary.js
        и сразу отражаются на строке в списке (обновить DOM строки точечно,
        без перерендера всего списка).

   f) Поиск: input.addEventListener('input', ...) → фильтровать freqList
      по item.lemma.includes(query) || item.translit.includes(query).
      Перерендерить список (можно без DOM-окна — отфильтрованный список
      редко бывает >100 строк). Дебаунс 150 мс.

4) Ручная проверка (npm run dev):
   - Экран «Словарь» показывает 1000 строк, прокрутка плавная.
   - Служебные слова (ὁ, καί, δέ) — в топе, но disabled (серые).
   - Включение чекбокса у θεός → слово появляется в тексте в режиме 3
     (при переходе на вкладку «Читать»).
   - Выключение чекбокса → слово исчезает из текста.
   - Поиск «αγαπ» → фильтрует до ἀγάπη, ἀγαπάω.
   - Тап по слову из core.json → полная карточка со статусом/intensity/forms.
   - Тап по freq-* слову → минимальная карточка, кнопка «Добавить в словарь».
   - 375px и 1280px, светлая и тёмная тема.
5) npm test && npm run build.

Коммит: "feat: dictionary screen as master frequency list with checkboxes"
```

---

### Задача 4.3 — buildWordEntries: все слова с showInText, включая freq-*

**Логика:** после перестройки словаря `buildWordEntries()` должен обрабатывать
ВСЕ слова с `showInText: true` — как из `core.json`, так и `freq-*`.
Текущая реализация итерирует `coreLexicon` и проверяет `dictionary[id]` — она
не видит `freq-*` записей. Новая логика: идти по `dictionary`, для каждой
записи с `showInText !== false` строить entry, подхватывая `ruMatches`-guard
из `coreLexicon` если доступен, иначе — пустой guard.

**Файлы:** изменить `src/ui/screens/reading.js` (функцию `buildWordEntries`).

- [x] `buildWordEntries()`: переписать с итерации по `coreLexicon` на итерацию по `dictionary`
- [x] Для freq-* записей: `lexemeId = id`, искать `lemma`/`strongNum` через `frequencyList` (индекс по Strong)
- [x] `npm test` зелёный, ручная проверка: freq-* слова из словаря появляются в тексте
- [x] Коммит

**Промпт:**
```text
Научи buildWordEntries обрабатывать freq-* слова из словаря.

Прочитай AGENTS.md, src/ui/screens/reading.js (buildWordEntries, ~строка 525)
и src/state/dictionary.js (getActive).

Сейчас buildWordEntries итерирует coreLexicon и для каждого слова проверяет
dictionary[id]. После задачи 4.2 в словаре могут быть freq-* записи
(с id вида `freq-<strong>`, отсутствующие в coreLexicon). Их нужно тоже
передавать в движок.

1) Перепиши buildWordEntries():

   function buildWordEntries() {
     wordEntries = [];
     const active = getActive(dictionary);  // записи с showInText !== false
     if (active.length === 0) return;

     // Индекс coreLexicon по id для быстрого поиска ruMatches
     const coreById = new Map(coreLexicon.map(l => [l.id, l]));

     // Индекс frequencyList по strong (строка) для freq-* записей
     const freqByStrong = new Map();
     if (frequencyList) {
       for (const item of frequencyList) {
         freqByStrong.set(String(item.strong), item);
       }
     }

     const intensityMap = { often: 100, sometimes: 50, rare: 25 };

     for (const { lexemeId, intensity, status, forms } of active) {
       const core = coreById.get(lexemeId);

       let lemma, strongNum, regexps, excludeRegexps;

       if (core) {
         // Слово из coreLexicon — полный guard
         lemma = core.lemma;
         strongNum = core.strong;
         regexps = core.ruMatches.map(r => new RegExp(r, 'iu'));
         excludeRegexps = (core.ruExclude || []).map(r => new RegExp(r, 'iu'));
       } else {
         // freq-* слово — ищем в frequencyList по Strong
         const strongKey = lexemeId.startsWith('freq-') ? lexemeId.replace('freq-', '') : null;
         const freqItem = strongKey ? freqByStrong.get(strongKey) : null;
         if (!freqItem) continue;  // неизвестное слово — пропускаем
         lemma = freqItem.lemma;
         strongNum = freqItem.strong;
         regexps = [];        // нет guard'а — выравнивание достаточная гарантия
         excludeRegexps = [];
       }

       wordEntries.push({
         lexemeId,
         lemma,
         strongNum,
         forms: forms || 'lemma',
         regexps,
         excludeRegexps,
         intensityPct: intensityMap[intensity] || 100,
         status: status || 'new'
       });
     }
   }

   Убедись, что intensityMap остался (intensity из IndexedDB — строка
   'often'|'sometimes'|'rare', как в DEFAULTS dictionary.js).

2) В mount() добавь загрузку frequencyList (если ещё не сделано в 4.2):
   если frequencyList ещё не загружен → frequencyList = await loadFrequency();

3) npm test (compose.test.js и form-layer.test.js не должны сломаться —
   контракт wordEntries не меняется).

4) Ручная проверка (npm run dev), режим 3, Иоанн 1:
   - На странице словаря включить чекбокс у freq-* слова (например,
     σπλαγχνίζομαι G4697, если есть в списке и имеет alignment).
   - Перейти на вкладку «Читать» → слово появляется в тексте (леммой).
   - Выключить чекбокс → слово исчезает.
   - Слова из core.json работают как раньше (guard активен).
5) npm run build.

Коммит: "feat: buildWordEntries processes all dictionary words including freq-*"
```

---

### Задача 4.4 — сквозная ручная проверка фичи

**Логика:** фазы 1–4 меняют ядро замен и экран словаря. Перед документацией —
полный ручной прогон по всем режимам и состояниям, как перед релизом (UI у нас
тестируется только руками — AGENTS.md).

**Файлы:** нет изменений кода (фиксы — отдельными коммитами в рамках задачи).

- [x] Режимы 1–2: буквенный слой без изменений (интенсивность, карточки букв); слайдер интенсивности влияет только на буквы
- [x] Режим 3: замены только по выравниванию; леммы; карточки слов; «Я знаю»; per-word интенсивность «иногда/редко» влияет на частоту замен
- [x] Режим 3: слова из словаря (включая freq-*) с `showInText: true` видны в тексте; с `showInText: false` — не видны
- [x] Экран словаря: 1000 строк, прокрутка, поиск, чекбоксы, disabled-строки для служебных слов
- [x] Режим 4: реальные формы; невыровненные слова русские; per-word интенсивность работает
- [x] Режим 5: без изменений (греческий основной, карточки токенов)
- [x] Деградация: выключить сеть, очистить кеш греческой книги → режимы 3–4 показывают тост «словарные замены отключены», буквенный слой жив
- [x] Долгий тап (показ оригинала) работает на словах всех типов замен
- [x] Книга с минимальным выравниванием (Тит) — читабельна в режиме 3
- [x] 375px/1280px, светлая/тёмная тема, скролл-позиция сохраняется
- [x] `npm test` и `npm run build` зелёные на итоговом состоянии

**Промпт:**
```text
Сквозная ручная проверка перехода на выравнивание (Фазы 1-4).

npm run dev и пройди чеклист задачи 4.4 в DEVELOPMENT_4.md по пунктам,
отмечая чекбоксы. Особое внимание:
- Ин 1:1 в режиме 3: «было» НЕ заменяется на γίνομαι (в оригинале ἦν от
  εἰμί) — это контрольный кейс точности, ради него всё затевалось.
- Экран словаря: ὁ (G3588) и καί (G2532) должны быть disabled (серые).
- Per-word интенсивность: поставь у слова словаря «редко» и убедись, что
  в режимах 3 и 4 оно заменяется заметно реже, чем при «часто».
- Деградация без сети: DevTools → Network offline, Application → Cache
  Storage → удалить кеш греческой книги, перезагрузить.
Найденные баги чини отдельными коммитами (fix: ...) с тестом, если баг
в движке. Не объявляй задачу готовой с незакрытым чекбоксом.
```

---

## Фаза 5 — Документация

### Задача 5.1 — обновить спецификацию и README

**Логика:** `DEVELOPMENT_1.md` разделы 3–4 — живой источник правды о продукте
и архитектуре (так сказано в AGENTS.md), а там режим 3 всё ещё описан как
regex-механизм и в структуре файлов значится `word-layer.js`. Документация
обязана отражать новое ядро и новый экран словаря, иначе следующий агент
построит работу на устаревшей спеке.

**Файлы:** изменить `docs/development/DEVELOPMENT_1.md`, проверить `README.md`,
`AGENTS.md`.

- [x] Таблица режимов (3.4): режим 3 → «form-layer по выравниванию (леммы); без выравнивания замен нет»
- [x] Структура файлов (3.2): убрать `word-layer.js`, обновить описание `form-layer.js` (режимы 3–5)
- [x] В 3.4 добавить абзац о частотном слое: `assets/data/lexicon/frequency.json` (корпусная частотность, топ-1000 лемм), страница словаря как мастер-список с чекбоксами, управление через `dictionary.showInText`, `hasAlignment` для disabled-логики
- [x] Грепнуть `word-layer|applyWordLayer|ruMatches` по `README.md`, `AGENTS.md`, `docs/` — поправить устаревшие упоминания (кроме архивных DEVELOPMENT_1..3-roadmap-разделов, они история)
- [x] `npm run build` чистый, коммит

**Промпт:**
```text
Приведи документацию в соответствие с новым ядром замен и экраном словаря.

1) docs/development/DEVELOPMENT_1.md:
   - Таблица режимов в 3.4: строка режима 3 → слои «form-layer по
     выравниванию (леммы) → letter-layer на остальном тексте»; добавь
     примечание под таблицей: «Замены слов в режимах 3-4 происходят только
     по Strong-выравниванию; стих без выравнивания получает только
     буквенный слой (решение от 2026-06-12, DEVELOPMENT_4.md)».
   - Структура файлов в 3.2: удали строку word-layer.js, у form-layer.js
     опиши «режимы 3-5: замены по выравниванию (леммы или реальные формы)».
   - В 3.4 после описания движка добавь абзац про частотный слой: данные
     assets/data/lexicon/frequency.json (корпусная частотность,
     scripts/build-frequency.mjs, топ-1000 лемм с рангом, частотой,
     транслитерацией, hasAlignment). Экран словаря показывает все 1000 лемм,
     пользователь управляет видимостью через чекбоксы showInText. Слова без
     alignment-пар (hasAlignment=false) отображаются как недоступные.
   - Обнови раздел 4.4 (Словарь): вместо фильтров «Все/Новые/Учу/Знаю» и
     кнопки «+ Добавить слова» — мастер-список всех слов с поиском,
     чекбоксами, disabled-логикой для служебных слов.
2) Грепни README.md, AGENTS.md и docs/ на word-layer, applyWordLayer,
   ruMatches. Правь только живые описания (README, AGENTS, разделы 3-4
   DEVELOPMENT_1) — выполненные roadmap-разделы и DEVELOPMENT_2/3 не трогай,
   это архив.
3) npm run build (докам он не нужен, но гейт перед коммитом обязателен).

Коммит: "docs: spec reflects alignment-only substitutions, frequency layer, and dictionary master list"
```

---

## За пределами этого roadmap'а (не делать без отдельного решения)

- **Внешний частотный словарь** (русские глоссы, 5000+ слов) из
  `docs/greek-nt-frequency-sources/` — заблокирован license review
  (`notes/license-review.md`). После него `frequency.json` расширится полем
  `gloss` и все слова (не только core.json) получат полноценные карточки с
  переводом.
- **Частотники по книгам** — отдельные `frequency-<bookId>.json`, фильтр
  книги на странице словаря (селектор «Весь НЗ» / конкретная книга).
  Disabled-логика тогда учитывает alignment в выбранной книге: слово,
  которое ни разу не выровнено в Марке, становится disabled при фильтре
  «Евангелие от Марка».
- **Частотный слой в режиме 4** (реальные формы топ-N слов) — механика готова
  (те же записи без форсирования леммы), нужно только продуктовое решение.
- **Удаление `ruMatches`-guard'а** — только после статистики, что guard ничего
  не отклоняет на всём корпусе (сейчас он — вторая линия защиты точности).
  Статистику частично собирает `build-frequency.mjs`.
- **Расширенная карточка freq-* слов** (грамматика, места употребления) —
  требует либо хранения morph в frequency.json, либо lookup в grc-данных на
  лету.

## Сводка фаз

| Фаза | Результат | Коммитов |
|---|---|---|
| 1 | Режим 3 заменяет по выравниванию, ложных замен нет, per-word интенсивность работает | 3 |
| 2 | Режим 4 без regex-fallback'ов | 1 |
| 3 | word-layer и мёртвый код удалены | 1 |
| 4 | Частотный словарь (frequency.json), экран-мастер-список с чекбоксами, buildWordEntries для freq-* | 3 |
| 5 | Спецификация соответствует коду | 1 |
