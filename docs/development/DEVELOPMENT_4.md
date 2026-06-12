# DEVELOPMENT_4.md — Режим 3 на Strong-выравнивании и частотный слой

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
   она работает на цель «100% точность» и не удаляется.
4. **`word-layer.js` удаляется** после перевода режимов 3–4 на выравнивание.
5. **Частотный слой строится из собственного корпуса** (`assets/data/bibles/grc`,
   137 741 токен, 5436 уникальных Strong): никаких новых внешних данных и
   лицензионных рисков. Внешний частотный словарь с глоссами
   (`docs/greek-nt-frequency-sources/`) — за пределами этого roadmap'а, ждёт
   license review.
6. **Схема настроек расширяется аддитивно:** новый ключ `freqTopN` (default 0)
   подхватывается merge'ем в `loadSettings()`; миграция данных не нужна.
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

- [ ] Написать падающий тест: `intensityPct: 0`, `status: 'new'` → замена не происходит
- [ ] Написать тест: `intensityPct: 100`, `status: 'new'` → замена происходит
- [ ] `form-layer.js`: заменить чтение `dictEntry.intensity` на `dictEntry.intensityPct ?? 100`
- [ ] `npm test` зелёный
- [ ] Коммит

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

- [ ] Написать падающие тесты (5 кейсов из промпта: лемма вместо формы; игнор персонального `forms:'all'`; нет выравнивания слова → нет замены, даже если регулярка матчит; нет `grcVerse`/`alignment` → только буквенный слой; guard `ruMatches` отклоняет непохожее слово)
- [ ] `compose.js`: ветка `mode === 3` вызывает `applyFormLayer` с записями, у которых `forms` форсирован в `'lemma'`; вызов `applyWordLayer` из ветки удалить
- [ ] Без `grcVerse`/`alignment` ветка возвращает только letter-layer
- [ ] `npm test` зелёный
- [ ] Коммит

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

### Задача 1.3 — reading.js: передавать greческие данные в режиме 3

**Логика:** греческая книга уже грузится с режима 3 (`reading.js:110`), но
`grcVerse`/`alignment` кладутся в контекст стиха только при `mode >= 4` — в
двух местах (первичный рендер и перерендер). После задачи 1.2 движок режима 3
ждёт эти данные. Заодно обновляем тост деградации: прежний текст обещал
«словарные формы» через regex-fallback, которого больше не будет.

**Файлы:** изменить `src/ui/screens/reading.js`.

- [ ] `renderWindowed()` (~строка 409): условие `grcBookData && settings.mode >= 4` → `>= 3`
- [ ] `reRenderWindowed()` (~строка 598): то же условие → `>= 3`
- [ ] Тост недоступности греческого (~строка 129): условие `settings.mode >= 4` → `>= 3`, текст: «Греческий текст недоступен — словарные замены отключены»
- [ ] Загрузку книги (строка 110, `mode >= 3`) НЕ менять — уже корректна
- [ ] `npm test` зелёный, ручная проверка в браузере
- [ ] Коммит

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

- [ ] Переписать тест `mode 4: word-layer fallback для невыровненных словарных слов` под новое поведение: невыровненное слово остаётся русским
- [ ] Добавить тест: режим 4 без `grcVerse`/`alignment` → только буквенный слой
- [ ] `compose.js`: из ветки `mode === 4` удалить вызов `applyWordToPlainSegments` и откат на `applyWordLayer`; удалить саму функцию `applyWordToPlainSegments` и импорт `applyWordLayer`
- [ ] `npm test` зелёный
- [ ] Коммит

**Промпт:**
```text
Убери regex-fallback'и из режима 4 (TDD).

Прочитай AGENTS.md, src/engine/compose.js и DEVELOPMENT_4.md «Принятые
решения» (№1-2). Невыровненные слова в режиме 4 должны оставаться русскими,
без greческих данных словарных замен нет вообще.

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

- [ ] Убедиться grep'ом, что `applyWordLayer` не используется вне `word-layer.js`
- [ ] Удалить `src/engine/word-layer.js` и `tests/word-layer.test.js`
- [ ] Удалить `getChapterCandidates` из `reading.js` (вызовов нет)
- [ ] Убедиться, что компиляция `regexps`/`excludeRegexps` в `buildWordEntries()` осталась нетронутой
- [ ] `npm test` зелёный (минус 5 тестов word-layer), `npm run build` чистый
- [ ] Коммит

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

## Фаза 4 — Частотный слой: слайдер «топ-N слов»

Продуктовая суть: пользователь в режиме 3 двигает регулятор «частотные слова»
(выкл / топ-50 / топ-100 / топ-200 / топ-300 / топ-500) и видит леммы самых
частотных слов НЗ поверх личного словаря. Замены идут только по выравниванию —
ровно тем же механизмом, что и словарные. Личные настройки слова всегда
приоритетнее частотного слоя.

### Задача 4.1 — корпусная частотность: скрипт и frequency.json

**Логика:** частотность считаем по собственным греческим данным
(`assets/data/bibles/grc/*.json`: 137 741 токен, 5436 уникальных Strong) —
ноль новых внешних источников, ноль лицензионных вопросов (данные уже в репо,
происхождение зафиксировано в v1.0.x). У 137 Strong-номеров встречается
несколько вариантов леммы — берём самую частотную с детерминированным
tie-break'ом. В файл кладём только топ-1000 (слайдеру нужно максимум 500;
запас ×2): меньше asset — быстрее оффлайн-кеш.

**Файлы:** создать `scripts/build-frequency.mjs`,
`tests/frequency-data.test.js`, сгенерировать
`assets/data/lexicon/frequency.json`; изменить `package.json` (`build:data`).

- [ ] Написать тест данных `tests/frequency-data.test.js` (он падает: файла ещё нет)
- [ ] Написать `scripts/build-frequency.mjs` с инвариантами (счётчики из промпта)
- [ ] Подключить скрипт к `npm run build:data` (после `convert-alignments.js`)
- [ ] Сгенерировать `assets/data/lexicon/frequency.json`, тест зелёный
- [ ] `npm run build:data` целиком проходит (старые инварианты не ослаблены)
- [ ] Коммит (скрипт + данные + тест вместе)

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
   const OUT = 'assets/data/lexicon/frequency.json';
   const TOP_LIMIT = 1000;

   // strong → Map(lemma → count)
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
     // Самая частотная лемма для Strong; tie-break по алфавиту — детерминизм
     const lemma = [...lemmas.entries()]
       .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el'))[0][0];
     return { strong: Number(strong), lemma, count };
   });
   all.sort((a, b) => b.count - a.count || a.strong - b.strong);

   // Инварианты корпуса (фактические значения на 2026-06: 5436 Strong,
   // топ-1 ὁ G3588 = 19794). Запрещено ослаблять — только разбираться.
   if (all.length < 5000 || all.length > 6000) {
     throw new Error(`инвариант: уникальных Strong ${all.length}, ожидалось 5000-6000`);
   }
   if (all[0].strong !== 3588 || all[0].count < 15000) {
     throw new Error(`инвариант: топ-1 должен быть ὁ (G3588, ~19.8k), получено G${all[0].strong}:${all[0].count}`);
   }

   const items = all.slice(0, TOP_LIMIT).map((it, i) => ({ rank: i + 1, ...it }));
   writeFileSync(OUT, JSON.stringify(items));
   console.log(`frequency.json: ${items.length} лемм из ${all.length} Strong, топ-3: ${items.slice(0, 3).map(i => i.lemma).join(', ')}`);

3) package.json: "build:data": "node scripts/convert-alignments.js && node scripts/build-frequency.mjs"

4) Запусти npm run build:data — оба скрипта проходят, файл создан.
   npm test — тест данных зелёный. npm run build.

Лицензии: новых источников нет, frequency.json — производная уже
закоммиченных greческих данных (происхождение — docs/clear-bible-alignments/).

Коммит: "feat: corpus-derived NT lemma frequency list (top-1000)"
```

---

### Задача 4.2 — настройка `freqTopN` и регулятор в настройках

**Логика:** новый ключ настроек `freqTopN` (0 = выкл, иначе 50–500) с
аддитивным дефолтом — merge в `loadSettings()` уже подхватит его для старых
пользователей без миграции (решение №6). UI — дискретный слайдер в настройках,
по образцу существующего слайдера интенсивности; подпись объясняет, что слой
работает в режиме 3. Изменение `freqTopN` меняет картину замен → читалка
перечитает настройки при следующем монтировании (переход между экранами —
смена hash-маршрута, читалка перемонтируется).

**Файлы:** изменить `src/state/settings.js`, `src/ui/screens/settings.js`.

- [ ] `settings.js` (state): добавить `freqTopN: 0` в `DEFAULTS`
- [ ] Экран настроек: секция «Частотные слова» со слайдером по шкале `[0, 50, 100, 200, 300, 500]` и живой подписью («выкл» / «топ-N»)
- [ ] Подсказка под слайдером: «Леммы самых частотных слов НЗ в режиме 3. Замены — только по выравниванию с оригиналом»
- [ ] Сохранение через `saveSettings` по паттерну соседних контролов
- [ ] Ручная проверка (включая возврат в читалку и перемонтирование)
- [ ] Коммит

**Промпт:**
```text
Добавь настройку частотного слоя freqTopN со слайдером.

Прочитай AGENTS.md (доступность, весь текст по-русски, никакой «умной»
адаптации — только ручное управление) и src/ui/screens/settings.js
(секция «Интенсивность греческого», строки ~111-145 — образец слайдера).

1) src/state/settings.js: в DEFAULTS добавь
     freqTopN: 0,            // 0=выкл | 50 | 100 | 200 | 300 | 500 — частотный слой режима 3
   Больше ничего: loadSettings() уже мержит DEFAULTS с сохранённым объектом,
   старые пользователи получат 0 автоматически. Ключи IndexedDB не меняются.

2) src/ui/screens/settings.js: после секции «Интенсивность греческого»
   добавь секцию (тот же паттерн: section.progress-section + h3):
   - h3: «Частотные слова»
   - слайдер: <input type="range" min="0" max="5" step="1">, индекс
     маппится в STOPS = [0, 50, 100, 200, 300, 500];
     value = STOPS.indexOf(settings.freqTopN), при отсутствии — 0.
   - живая подпись рядом со слайдером: «выкл» при 0, иначе «топ-N слов»;
     обновляется на input.
   - aria: label связан со слайдером, aria-valuetext = текст подписи.
   - под слайдером поясняющий <p class="hint">: «Леммы самых частотных слов
     Нового Завета подмешиваются в режиме 3. Замены — только по выравниванию
     с оригиналом.»
   - сохранение: на change → settings.freqTopN = STOPS[+input.value];
     saveSettings(settings) — тем же способом, что соседние контролы
     (посмотри, как сохраняет слайдер интенсивности, и повтори паттерн,
     включая дебаунс, если он там есть).

3) Ручная проверка (npm run dev):
   - Слайдер двигается по 6 позициям, подпись меняется, значение
     сохраняется после перезагрузки страницы.
   - Touch target и фокус: слайдер достижим с клавиатуры, виден
     :focus-visible.
   - 375px и 1280px, светлая и тёмная тема.
4) npm test && npm run build.

Коммит: "feat: freqTopN setting with discrete slider in settings screen"
```

---

### Задача 4.3 — подмешивание частотных слов в читалке

**Логика:** частотный слой — это просто дополнительные записи в `wordEntries`
перед вызовом `composeVerse`: для каждого Strong из топ-N, не покрытого личным
словарём, создаётся запись с `forms: 'lemma'` и `intensityPct: 100` (слово либо
в топ-N и заменяется всегда, либо нет — пользователь управляет одним числом N).
Если Strong есть в `core.json`, берём оттуда id и `ruMatches` (guard работает,
тап открывает полноценную карточку с «Добавить в словарь»); иначе — виртуальная
запись `freq-<strong>` без guard'а, тап показывает минимальную карточку
(лемма + грамматика + Strong) по образцу карточки токена режима 5. Личное слово
со `showInText: false` (скрыто пользователем) частотный слой не воскрешает.

**Файлы:** изменить `src/data/lexicon-loader.js`, `src/ui/screens/reading.js`.

- [ ] `lexicon-loader.js`: `loadFrequency()` с кешем и fail-soft `null` (по образцу `loadCoreLexicon`)
- [ ] `reading.js` mount: грузить frequency.json, если `settings.freqTopN > 0`
- [ ] `buildWordEntries()`: после личных записей подмешать топ-N (только при `settings.mode === 3 && freqTopN > 0`; пропуск покрытых Strong и скрытых слов)
- [ ] Тап по частотному слову: core-слова — обычная карточка; `freq-*` — минимальная карточка (лемма, грамматика через `formatMorphRu`, Strong)
- [ ] Ручная проверка по чеклисту промпта
- [ ] Коммит

**Промпт:**
```text
Подмешай частотные слова в режим 3 читалки.

Прочитай AGENTS.md, src/ui/screens/reading.js (buildWordEntries ~строка 525,
handleWordTap ~строка 699, handleGrcTokenTap ~строка 730) и
src/data/lexicon-loader.js.

1) lexicon-loader.js — по образцу loadCoreLexicon добавь:

   let frequencyCache = null;

   export async function loadFrequency() {
     if (frequencyCache) return frequencyCache;
     try {
       const res = await fetch('./data/lexicon/frequency.json');
       if (!res.ok) {
         if (res.status === 404) return null;
         throw new Error(`HTTP ${res.status}`);
       }
       frequencyCache = await res.json();
       return frequencyCache;
     } catch (e) {
       console.warn('loadFrequency error:', e);
       return null;
     }
   }

2) reading.js:
   - модульная переменная let frequencyList = null;
   - в mount(), там где грузятся settings/coreLexicon: если
     settings.freqTopN > 0 → frequencyList = await loadFrequency();
     (фейл тихий: frequencyList останется null, слой просто не включится).
     Грузим при freqTopN > 0 независимо от режима: режим переключается
     из топ-бара без перемонтирования экрана.

3) buildWordEntries() — после цикла по личному словарю добавь:

   // Частотный слой (только режим 3): топ-N лемм по корпусной частоте.
   // Личные настройки слова приоритетны; скрытые слова не воскрешаем.
   if (settings.mode === 3 && settings.freqTopN > 0 && frequencyList) {
     const covered = new Set(wordEntries.map(e => String(e.strongNum)));
     for (const item of frequencyList.slice(0, settings.freqTopN)) {
       const key = String(item.strong);
       if (covered.has(key)) continue;
       const lex = coreLexicon.find(l => l.strong === item.strong);
       if (lex && dictionary[lex.id]) continue; // скрыто или особый статус — решает словарь
       wordEntries.push({
         lexemeId: lex ? lex.id : `freq-${key}`,
         lemma: item.lemma,
         strongNum: item.strong,
         forms: 'lemma',
         regexps: lex ? lex.ruMatches.map(r => new RegExp(r, 'iu')) : [],
         excludeRegexps: lex ? (lex.ruExclude || []).map(r => new RegExp(r, 'iu')) : [],
         intensityPct: 100,
         status: 'new'
       });
     }
   }

4) Карточка по тапу. handleWordTap сейчас молча выходит, если lexemeId нет в
   coreLexicon — для freq-* добавь фолбэк:

   const lexeme = coreLexicon.find(l => l.id === lexemeId);
   if (!lexeme) {
     if (lexemeId.startsWith('freq-')) handleFreqWordTap(span, container);
     return;
   }

   Новая функция handleFreqWordTap — по образцу handleGrcTokenTap, но для
   span'а замены (данные лежат в data-атрибутах, см. render.js):

   function handleFreqWordTap(span, container) {
     const lemma = span.textContent;
     const morph = span.getAttribute('data-morph');
     const strong = parseInt(span.getAttribute('data-strong')) || 0;
     const original = span.getAttribute('data-original');
     const showGrammar = settings.show?.grammar !== false;
     const showStrongs = settings.show?.strongs === true;

     const card = document.createElement('div');
     card.className = 'card word-card';
     card.innerHTML = `
       <div class="word-card-lemma">${lemma}</div>
       ${original ? `<div class="word-card-replaces">Сейчас заменяет: «${original}»</div>` : ''}
       ${showGrammar && morph ? `<p><strong>Грамматика:</strong> ${formatMorphRu(morph)}</p>` : ''}
       ${showStrongs && strong ? `<p><strong>Strong:</strong> G${strong}</p>` : ''}
       <p class="word-card-note">Частотное слово — вне личного словаря</p>
     `;
     if (window.innerWidth >= 900) showInInspector(card); else openBottomSheet(card);
   }

   Импортируй formatMorphRu из ../../engine/morphology.js (в reading.js его
   ещё нет — проверь и добавь). Слова из core.json, попавшие через частотный
   слой, идут по обычной ветке handleWordTap: lexeme найдётся, dictEntry
   будет undefined → карточка покажет «Добавить в словарь» (это уже
   работает в renderWordCard).

5) Ручная проверка (npm run dev), режим 3, Иоанн 1:
   - freqTopN=выкл → только слова личного словаря.
   - freqTopN=топ-50 → в тексте появились леммы (ὁ и καί почти не появятся —
     артикли и союзы редко выравнены, это норма; смотри на θεός, λέγω, ζωή).
   - Тап по частотному слову из core.json → полная карточка с «Добавить
     в словарь»; добавление переводит слово в личный словарь.
   - Тап по слову вне core.json → минимальная карточка с леммой,
     грамматикой, Strong (Strong виден только при включённой настройке).
   - Личное слово со скрытым показом (showInText=false) не появляется.
   - Режим 4: частотный слой НЕ активен.
   - Переключение режима из топ-бара 3↔4 сразу перестраивает замены.
   - 375px и 1280px, светлая и тёмная тема.
6) npm test && npm run build.

Коммит: "feat: frequency layer mixes top-N lemmas into mode 3"
```

---

### Задача 4.4 — сквозная ручная проверка фичи

**Логика:** фазы 1–4 меняют ядро замен. Перед документацией — полный ручной
прогон по всем режимам и состояниям, как перед релизом (UI у нас тестируется
только руками — AGENTS.md).

**Файлы:** нет изменений кода (фиксы — отдельными коммитами в рамках задачи).

- [ ] Режимы 1–2: буквенный слой без изменений (интенсивность, карточки букв)
- [ ] Режим 3: замены только по выравниванию; леммы; карточки; «Я знаю»; per-word интенсивность «иногда/редко» влияет на частоту замен
- [ ] Режим 3 + freqTopN: 0/50/500 — плотность замен растёт с N
- [ ] Режим 4: реальные формы; невыровненные слова русские; per-word интенсивность работает
- [ ] Режим 5: без изменений (греческий основной, карточки токенов)
- [ ] Деградация: выключить сеть, очистить кеш греческой книги → режимы 3–4 показывают тост «словарные замены отключены», буквенный слой жив
- [ ] Долгий тап (показ оригинала) работает на словах всех типов замен
- [ ] Книга с минимальным выравниванием (Тит) — читабельна в режиме 3
- [ ] 375px/1280px, светлая/тёмная тема, скролл-позиция сохраняется
- [ ] `npm test` и `npm run build` зелёные на итоговом состоянии

**Промпт:**
```text
Сквозная ручная проверка перехода на выравнивание (Фазы 1-4).

npm run dev и пройди чеклист задачи 4.4 в DEVELOPMENT_4.md по пунктам,
отмечая чекбоксы. Особое внимание:
- Ин 1:1 в режиме 3: «было» НЕ заменяется на γίνομαι (в оригинале ἦν от
  εἰμί) — это контрольный кейс точности, ради него всё затевалось.
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
обязана отражать новое ядро, иначе следующий агент построит работу на
устаревшей спеке.

**Файлы:** изменить `docs/development/DEVELOPMENT_1.md`, проверить `README.md`,
`AGENTS.md`.

- [ ] Таблица режимов (3.4): режим 3 → «form-layer по выравниванию (леммы); без выравнивания замен нет»
- [ ] Структура файлов (3.2, ~строка 90): убрать `word-layer.js`, обновить описание `form-layer.js` (режимы 3–5)
- [ ] В 3.4 добавить абзац о частотном слое (`freqTopN`, frequency.json, только режим 3)
- [ ] Грепнуть `word-layer|applyWordLayer|ruMatches` по `README.md`, `AGENTS.md`, `docs/` — поправить устаревшие упоминания (кроме архивных DEVELOPMENT_1..3-roadmap-разделов, они история)
- [ ] `npm run build` чистый, коммит

**Промпт:**
```text
Приведи документацию в соответствие с новым ядром замен.

1) docs/development/DEVELOPMENT_1.md:
   - Таблица режимов в 3.4: строка режима 3 → слои «form-layer по
     выравниванию (леммы) → letter-layer на остальном тексте»; добавь
     примечание под таблицей: «Замены слов в режимах 3-4 происходят только
     по Strong-выравниванию; стих без выравнивания получает только
     буквенный слой (решение от 2026-06-12, DEVELOPMENT_4.md)».
   - Структура файлов в 3.2: удали строку word-layer.js, у form-layer.js
     опиши «режимы 3-5: замены по выравниванию (леммы или реальные формы)».
   - В 3.4 после описания движка добавь абзац про частотный слой: настройка
     freqTopN (0/50/100/200/300/500), данные assets/data/lexicon/frequency.json
     (корпусная частотность, scripts/build-frequency.mjs, топ-1000),
     работает только в режиме 3, intensityPct 100, личный словарь приоритетен.
2) Грепни README.md, AGENTS.md и docs/ на word-layer, applyWordLayer,
   ruMatches. Правь только живые описания (README, AGENTS, разделы 3-4
   DEVELOPMENT_1) — выполненные roadmap-разделы и DEVELOPMENT_2/3 не трогай,
   это архив.
3) npm run build (докам он не нужен, но гейт перед коммитом обязателен).

Коммит: "docs: spec reflects alignment-only substitutions and frequency layer"
```

---

## За пределами этого roadmap'а (не делать без отдельного решения)

- **Внешний частотный словарь** (глоссы, транслитерация, 5000+ слов) из
  `docs/greek-nt-frequency-sources/` — заблокирован license review
  (`notes/license-review.md`). После него частотные слова получат полноценные
  карточки и «Добавить в словарь» для слов вне `core.json`.
- **Частотный слой в режиме 4** (реальные формы топ-N слов) — механика готова
  (те же записи без форсирования леммы), нужно только продуктовое решение.
- **Удаление `ruMatches`-guard'а** — только после статистики, что guard ничего
  не отклоняет на всём корпусе (сейчас он — вторая линия защиты точности).
- **Пер-словная интенсивность для частотного слоя** — сейчас намеренно
  фиксированная 100, управление — одним числом N.

## Сводка фаз

| Фаза | Результат | Коммитов |
|---|---|---|
| 1 | Режим 3 заменяет по выравниванию, ложных замен нет | 3 |
| 2 | Режим 4 без regex-fallback'ов | 1 |
| 3 | word-layer и мёртвый код удалены | 1 |
| 4 | Частотный слайдер топ-N работает в режиме 3 | 4 |
| 5 | Спецификация соответствует коду | 1 |
