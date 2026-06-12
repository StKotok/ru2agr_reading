# DEVELOPMENT_5.md — Стабилизация после DEVELOPMENT_4 (до release-ready)

> **Статус:** план исправлений после ревью DEVELOPMENT_4.
> **Дата:** 2026-06-12.
> **Базовое состояние (проверено):** все задачи DEVELOPMENT_4 выполнены в коммитах
> `153ec7d..af672da`; 113 тестов зелёных; `npm run build` чистый; ветка `dev2`.
> Таблица проблем ниже сверена с кодом — каждый пункт подтверждён.
>
> **Цель:** довести ветку до состояния «можно релизить»: исправить регрессии,
> сделать частотный слой честным, не расширяя скрыто продуктовый объём и не
> ломая правильные решения DEVELOPMENT_4. Сам релиз (bump версии, PR в `main`)
> владелец делает отдельно, вне этого плана.

> **Для агентов-исполнителей:** задачи выполняются строго последовательно.
> Одна задача = один коммит. Перед началом прочитай `AGENTS.md` целиком и
> `docs/development/DEVELOPMENT_1.md` разделы 3–4. Чекбоксы отмечаются в этом
> файле и коммитятся вместе с кодом задачи.

---

## Инварианты

Эти решения не пересматриваются в рамках DEVELOPMENT_5:

1. Режимы 3–4 делают словарные замены только по Strong-выравниванию.
2. Стих без `alignment` получает только буквенный слой.
3. `ruMatches`/`ruExclude` остаются guard'ом для core-лексикона.
4. Regex word-layer не возвращается.
5. Слайдер интенсивности на главном экране влияет только на буквенный слой;
   состав слов управляется через `dictionary.showInText`.
6. Новые внешние словари, глоссы и alignment-источники не добавляются без
   отдельного license review.
7. Схема IndexedDB и ключи `settings`, `progress`, `dictionary` не меняются.

**Решения владельца проекта от 2026-06-12 (зафиксированы, не обсуждаются):**

- Словарь показывает **весь топ-1000** как каталог частотности, плюс
  быстрый фильтр **«Доступные»** для 98 включаемых слов (задача 4.2).
- Карточка `freq-*` слова в читалке **не реализуется**: через UI такие записи
  создать нельзя, а alignment не содержит non-core Strong — это недостижимое
  состояние; тихий `return` в `handleWordTap` — достаточный fail-soft (YAGNI).
- План заканчивается состоянием **release-ready** (задача 6.1). Bump версии и
  merge в `main` через PR — отдельное действие владельца.

## Правила выполнения

1. Работать в ветке `dev2`, один коммит на задачу.
2. Для движка, стора, данных и чистых helper'ов — сначала тест, потом код.
3. После задач с JS-логикой — `npm test`.
4. После задач с UI — `npm run dev` и ручная проверка на 375px и 1280px,
   светлая и тёмная тема.
5. После задач с данными — `npm run build:data`, затем `npm test`.
6. Перед каждым коммитом — `npm run build`.
7. Чекбоксы в этом файле отмечаются в том же коммите, что и исправление.

## Контекст ревью (все пункты сверены с кодом)

| Приоритет | Проблема | Где подтверждено |
|---|---|---|
| P1 | Пустой `progress.letters` принудительно становится «все буквы known» | `reading.js:58-65`, блок «ВРЕМЕННО» |
| P1 | `SKIP_ONBOARDING = true` захардкожен — онбординг выключен в релизе | `app.js:66` |
| P1 | Переключение режима 1/2 → 3/4 в top-bar не догружает `grcBookData` (есть частичный лоадер только для режима 5 в `renderWindowed`) | `reading.js:155-163` (подписка), `reading.js:457-466` (mode-5 блок) |
| P1 | Инспектор ломается при **любой** смене экрана на desktop: `getInspectorPanel` возвращает detached-панель после `container.innerHTML = ''` | `inspector.js:13` (`if (panelEl) return panelEl`) |
| P1 | Карточка слова на экране словаря невидима на desktop: всегда `openBottomSheet`, который скрыт CSS при ≥900px | `dictionary.js:337` |
| P1 | `freq-*` поддержка есть в коде, но доступных non-core слов нет: `hasAlignment=true` у 98 из 1000, все 98 — слова core.json (alignment генерируется через ruMatches) | `frequency.json` (замер), `convert-alignments.js:8-10` |
| P2 | Транслитерация сломана: 832 из 1000 записей содержат греческие символы (`kaί`, `aytόs`, `dέ`); дифтонги не обрабатываются (`αὐτός` → `aytόs` вместо `autos`) | `frequency.json` (замер), `build-frequency.mjs` |
| P2 | Тултип disabled-строк лжёт: «слово не выровнено ни в одном стихе НЗ» — неправда для ὁ/καί (они в каждом стихе; их просто нет в core.json) | `dictionary.js:177,232` |
| P2 | Нет fallback личного словаря, если `frequency.json` недоступен | `dictionary.js:66-72` |
| P2 | Словарь создаёт горизонтальный скролл на 375px: `.dict-row` — flex, все колонки `flex-shrink: 0`; чекбокс 18×18 < 44px touch target | `app.css:901-977` |
| P2 | Тап по строке словаря использует устаревший `entry` из замыкания: после включения чекбокса карточка показывает «Добавить в словарь» | `dictionary.js:208-211` |
| P2 | Действия в карточке словаря зовут полный `render()` — список перерисовывается, прокрутка теряется | `dictionary.js:252,272,332` |
| P3 | README обещает деградацию «в замену леммами» и ссылается на DEVELOPMENT_2 как на живую спеку | `README.md:31-32,55` |
| P3 | `tests/bible-data.test.js` проверяет старый путь `data/...`: два теста молча skip'аются, третий грузит книги по несуществующему пути и пропускает проверки содержимого | `bible-data.test.js:13,30,67` |

## Выбранный путь

### Частотный слой

Возможные подходы:

1. **Расширить alignment на все top-1000 Strong.** Даёт настоящие `freq-*`
   подстановки, но alignment генерируется через ruMatches core-лексикона
   (`convert-alignments.js`) — для остальных слов нужен лицензированный
   источник русско-греческого соответствия или ручные `ruMatches`. Это риск
   ложных замен и нарушение цели «точность важнее покрытия».
2. **Откатить экран словаря к старой модели.** Снижает риск, но выбрасывает
   полезный частотный список и уже сделанный UX мастер-списка.
3. **Рекомендовано и принято: стабилизировать master-list как частотный
   каталог.** Весь топ-1000 виден (каталог — ценность сам по себе), фильтр
   «Доступные» показывает 98 включаемых слов, подписи честно объясняют,
   почему остальные недоступны. `freq-*` код в `buildWordEntries` остаётся
   fail-soft для будущего расширения, но UI, документация и тесты больше не
   обещают доступные non-core `freq-*` слова.

Полноценное расширение `freq-*` подстановок — отдельный roadmap после
license review (`docs/greek-nt-frequency-sources/notes/license-review.md`).

---

## Фаза 0 — Базовые guard-тесты и чистый старт

### Задача 0.1 — Починить data-тесты на актуальный путь `assets/data`

**Зачем:** данные закоммичены в `assets/data`, но тесты проверяют старый путь
`data/...`. Итог: два теста молча skip'аются (с ложным warning), а тест
содержимого книг получает `null` от `loadJSON('data/bibles/syn/...')` и
пропускает все проверки стихов. Зелёный `npm test` не проверяет реальные JSON.
Паттерн «existsSync → warn → return» убираем совсем: данные обязаны быть в
репозитории, их отсутствие — это падение теста, а не skip.

**Файлы:** `tests/bible-data.test.js`.

- [ ] Убрать все проверки `existsSync` со старым путём `data/...` вместе с
      warning'ами — тесты падают, если файла нет.
- [ ] Тест books.json: грузить `assets/data/books.json` напрямую.
- [ ] Тест john.json: грузить `assets/data/bibles/syn/john.json` напрямую.
- [ ] Цикл по всем книгам: `loadJSON` с путём `assets/data/bibles/syn/<book.id>.json`,
      и проверки содержимого обязательны (без `if (bookData)` — книга должна быть).
- [ ] `npm test` зелёный, количество прогнанных assert'ов выросло.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Почини тесты данных, которые молча skip'аются из-за старого пути.

Прочитай AGENTS.md и tests/bible-data.test.js. Три проблемы:
1) bible-data.test.js:13 — existsSync(resolve(__dirname, '..', 'data',
   'books.json')) всегда false (данные в assets/data) → warn + return.
2) bible-data.test.js:30 — то же для john.json.
3) bible-data.test.js:67 — loadJSON(`data/bibles/syn/${book.id}.json`)
   возвращает null, и блок if (bookData) пропускает все проверки стихов.

Сделай минимальное исправление:
1) Удали existsSync-проверки и console.warn целиком: данные закоммичены,
   отсутствие файла = красный тест, а не skip.
2) Все пути переведи на assets/data: assets/data/books.json,
   assets/data/bibles/syn/john.json, assets/data/bibles/syn/${book.id}.json.
3) В цикле по книгам замени if (bookData) { ... } на жёсткие проверки:
   expect(bookData).not.toBeNull(); и дальше существующие assert'ы.
4) Не меняй структуру данных и не добавляй новый тест-фреймворк.
5) npm test (все тесты зелёные, без warning'ов про data) и npm run build.

Коммит: "test: validate bible data from assets path, no silent skips"
```

---

## Фаза 1 — Вернуть правильную деградацию и онбординг

### Задача 1.1 — Убрать временное автозаполнение всех букв

**Зачем:** `reading.js:58-65` при пустом `progress.letters` записывает все
буквы как `known` и сохраняет в IndexedDB. Это отменяет фикс `eeb80c8`
(«пустой прогресс = замен нет») и ломает сценарий нового пользователя и
сброса прогресса: текст сразу пестрит греческими буквами.

**Файлы:** `src/ui/screens/reading.js`.

- [ ] Удалить блок «ВРЕМЕННО: если онбординг пропущен…» (`reading.js:58-65`).
- [ ] Не менять `composeVerse`: тест `empty letter progress leaves text
      untouched` в `tests/compose.test.js` остаётся зелёным.
- [ ] Проверить `grep -rn "ВРЕМЕННО" src/` — таких блоков больше нет.
- [ ] `npm test` зелёный.
- [ ] Ручная проверка: с чистой IndexedDB режим 1 при intensity 100 показывает
      чистый русский текст.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Убери регрессию пустого буквенного прогресса.

Прочитай AGENTS.md, src/ui/screens/reading.js (строки 58-65) и тест
"empty letter progress leaves text untouched" в tests/compose.test.js.

Проблема: блок
  // ВРЕМЕННО: если онбординг пропущен и буквы не введены — вводим все буквы как known
  if (Object.keys(progress.letters).length === 0 && alphabet && ...) { ... }
записывает все буквы known и СОХРАНЯЕТ это в IndexedDB (saveProgress).
Это отменяет фикс eeb80c8: пустой progress.letters обязан означать
«буквы не введены, замен нет».

Сделай только это:
1) Удали блок целиком (reading.js:58-65).
2) Не добавляй обходной логики в движок и не трогай onboarding flow.
3) grep -rn "ВРЕМЕННО" src/ — пусто.
4) npm test.
5) npm run dev: удали базу ru2agr_db в DevTools → Application → IndexedDB,
   перезагрузись (с dev_skip_onboarding=1, см. задачу 1.2), открой режим 1,
   intensity 100 — текст полностью русский, пока буквы не введены.
6) npm run build.

Внимание: у пользователей, успевших получить автозаполненный прогресс,
буквы останутся known в IndexedDB — это приемлемо (исправляется сбросом
прогресса в настройках), миграцию не пиши.

Коммит: "fix: do not auto-mark letters known on empty progress"
```

### Задача 1.2 — Вернуть онбординг, skip только по dev-флагу

**Зачем:** в `app.js:66` стоит `const SKIP_ONBOARDING = true` — гвард
онбординга выключен для всех. Релиз обязан вести нового пользователя в
онбординг (там вводятся первые буквы и режим); пропуск — только по явному
dev-флагу в `localStorage`, как было сделано в DEVELOPMENT_3 (задача 1.2).

**Файлы:** `src/app.js`.

- [ ] Заменить `const SKIP_ONBOARDING = true` на чтение
      `localStorage.getItem('dev_skip_onboarding') === '1'` в try/catch.
- [ ] Если `localStorage` недоступен — skip = false (онбординг работает).
- [ ] Остальную логику гварда (она уже есть в `app.js:68-93`) не менять.
- [ ] `npm test` зелёный.
- [ ] Ручная проверка: с чистой IndexedDB и без флага открывается
      `#/onboarding`; уйти с него без завершения нельзя; после завершения —
      свободная навигация; с флагом онбординг пропускается.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Верни онбординг: skip только по явному dev-флагу.

Прочитай AGENTS.md и src/app.js (handleRoute, строки 63-96). Сейчас:
  const SKIP_ONBOARDING = true; // было: const SKIP_ONBOARDING = (() => {
Гвард ниже (проверка settings.onboarded, редирект на #/onboarding,
блокировка ухода) уже написан и работает при SKIP_ONBOARDING=false.

Сделай только это:
1) Замени строку 64-66 на:

   // Dev-флаг: пропустить онбординг (localStorage.setItem('dev_skip_onboarding','1'))
   const SKIP_ONBOARDING = (() => {
     try {
       return localStorage.getItem('dev_skip_onboarding') === '1';
     } catch (_) {
       return false;
     }
   })();

2) Гвард ниже не трогай. Роутер и IndexedDB не меняй.
3) npm test.
4) npm run dev:
   - удали базу ru2agr_db и localStorage-флаг → редирект на #/onboarding;
     попытка перейти на #/settings возвращает на онбординг;
     после завершения онбординга — чтение работает, буквы из онбординга
     введены;
   - localStorage.setItem('dev_skip_onboarding','1') → онбординг пропускается.
5) npm run build.

Коммит: "fix: gate onboarding skip behind explicit dev flag"
```

---

## Фаза 2 — Догрузка греческих данных при смене режима

### Задача 2.1 — Единый `ensureGreekBookLoaded` для режимов 3–5

**Зачем:** `mount()` грузит греческую книгу только если `settings.mode >= 3`
на момент монтирования. Top-bar меняет режим без ремоунта: подписка
`store.subscribe(['settings'])` (`reading.js:155-163`) зовёт только
`reRenderWindowed()`, и `grcBookData` остаётся `null` — режимы 3–4 молча не
делают замен до перезагрузки. Для режима 5 в конце `renderWindowed`
(`reading.js:457-466`) уже есть частичный лоадер — но он не срабатывает при
runtime-переключении (этот путь идёт через `reRenderWindowed`). Делаем один
универсальный загрузчик и убираем частный.

**Файлы:** `src/ui/screens/reading.js`.

- [ ] Добавить module-level `grcLoadPromise` (защита от параллельных загрузок).
- [ ] Добавить `async function ensureGreekBookLoaded(showToastOnFail = true)`
      с защитой от гонок: результат применяется только если книга не сменилась
      и экран не размонтирован (`bookData` обнуляется в `unmount()` — это и
      есть признак).
- [ ] В подписке на settings: после `reRenderWindowed()` при
      `settings.mode >= 3 && !grcBookData` вызвать догрузку и по успеху
      перерендерить ещё раз.
- [ ] Заменить mode-5 блок (`reading.js:457-466`) на вызов
      `ensureGreekBookLoaded(false)` для режимов 3–5 (mount уже показал тост,
      если грузил и не смог — без дубля).
- [ ] Тост ошибки — ровно существующая строка:
      `Греческий текст недоступен — словарные замены отключены`.
- [ ] Не менять `composeVerse` и не возвращать regex fallback.
- [ ] `npm test` зелёный.
- [ ] Ручная проверка: старт в режиме 1 → top-bar режим 3: замены появляются
      без reload; то же для режима 4 (формы) и 5 (греческий текст).
- [ ] Ручная проверка: переключение 3 → 1 → 3 не делает повторной загрузки
      (Network-вкладка) и не теряет `grcBookData`.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Почини догрузку греческой книги при runtime-переключении режима.

Прочитай AGENTS.md и src/ui/screens/reading.js: mount (строки 108-117),
подписку на settings (155-163), mode-5 лоадер в конце renderWindowed
(457-466), unmount (797-805, там bookData = null).

1) Module-level: let grcLoadPromise = null;

2) Добавь функцию:

   async function ensureGreekBookLoaded(showToastOnFail = true) {
     if (grcBookData) return true;
     if (!bookData || settings.mode < 3) return false;
     if (!grcLoadPromise) {
       const bookId = bookData.id;
       grcLoadPromise = loadBook('grc', bookId)
         .then(grc => ({ grc, bookId }))
         .catch(() => ({ grc: null, bookId }));
     }
     const { grc, bookId } = await grcLoadPromise;
     grcLoadPromise = null;
     // Гонки: экран размонтирован (bookData=null) или книга сменилась
     if (!bookData || bookData.id !== bookId) return false;
     if (grc) {
       grcBookData = grc;
       return true;
     }
     if (showToastOnFail && settings.mode >= 3) {
       showToast('Греческий текст недоступен — словарные замены отключены', { timeout: 5000 });
     }
     return false;
   }

3) Подписка на settings (155-163) становится:

   store.subscribe(['settings'], () => {
     progress = store.get().progress || progress;
     const newSettings = store.get().settings;
     if (newSettings && newSettings !== settings) {
       settings = newSettings;
       saveSettings(settings);
       reRenderWindowed();
       if (settings.mode >= 3 && !grcBookData) {
         ensureGreekBookLoaded().then(ok => { if (ok) reRenderWindowed(); });
       }
     }
   });

   (Первый reRenderWindowed даёт мгновенный отклик без греческого,
   второй — после успешной догрузки.)

4) Замени блок режима 5 в конце renderWindowed (457-466):

   // Режимы 3-5: если греческий не загрузился при mount — пробуем ещё раз
   if (settings.mode >= 3 && !grcBookData && bookData) {
     ensureGreekBookLoaded(false).then(ok => { if (ok) reRenderWindowed(); });
   }

   Тост «Греческий текст недоступен — загружаем...» удали — деградация и так
   видима (русский текст), а об ошибке сообщает mount-тост.

5) Движок не трогай. npm test.
6) npm run dev:
   - старт в режиме 1, top-bar → режим 3: слово словаря заменяется без reload;
   - то же → режим 4 (реальные формы) и режим 5 (греческий текст);
   - 3 → 1 → 3: в Network нет повторной загрузки grc-книги;
   - offline + чистый кеш: переключение в режим 3 показывает тост, буквенный
     слой работает.
7) npm run build.

Коммит: "fix: load greek data when switching into aligned modes"
```

### Задача 2.2 — Регрессионный UI-чеклист деградации греческих данных

**Зачем:** после alignment-only логики деградация — главный честный контракт:
без `grc` словарные замены не обещаются.

**Файлы:** только чекбоксы в этом файле; найденные баги — отдельными
`fix:`-коммитами.

- [ ] Режим 3 при доступном `grc`: леммы видны.
- [ ] Режим 4 при доступном `grc`: формы видны.
- [ ] Режим 3 при недоступном `grc`: тост «Греческий текст недоступен —
      словарные замены отключены», буквенный слой работает.
- [ ] Режим 4 при недоступном `grc`: тот же тост, буквенный слой работает.
- [ ] Режим 5 при недоступном `grc`: стихи остаются русскими, приложение
      не падает.
- [ ] Переключение 3 → 1 → 3 не запускает лишних сетевых загрузок и не
      теряет уже загруженный `grcBookData`.
- [ ] `npm run build` зелёный.
- [ ] Коммит с отмеченными чекбоксами или fix-коммит по найденным багам.

**Промпт:**

```text
Проведи ручной regression pass деградации греческих данных.

npm run dev + DevTools. Проверь чекбоксы задачи 2.2 в DEVELOPMENT_5.md:
1) Режимы 3/4/5 online: леммы / формы / греческий текст видны.
2) Network offline + удалённый кеш grc-книги (Application → Cache Storage →
   bible-data): режимы 3-4 показывают тост про отключённые замены, буквенный
   слой работает; режим 5 показывает русский текст без падений.
3) Переключение 3 → 1 → 3: рендер цел, повторной загрузки grc нет.
4) Зафиксируй результат чекбоксами. Найденный баг — сначала отдельный
   fix-коммит, потом чекбокс.

Коммит, если только чекбоксы: "docs: record greek data degradation QA"
```

---

## Фаза 3 — Инспектор и карточки словаря

### Задача 3.1 — Сделать inspector переиспользуемым между экранами

**Зачем:** это P1 и для читалки, не только для словаря. `inspector.js:13`
делает `if (panelEl) return panelEl`: после любой смены экрана
(`container.innerHTML = ''`) панель остаётся detached, и при возврате в
читалку `getInspectorPanel(container)` возвращает её, никуда не вставляя —
карточки на desktop уходят «в никуда». Сценарий «чтение → словарь → чтение»
сейчас ломает инспектор насовсем.

**Файлы:** `src/ui/components/inspector.js`.

- [ ] `getInspectorPanel(parent)`: если панель есть, но
      `panelEl.parentElement !== parent` — `parent.appendChild(panelEl)`
      (appendChild сам перемещает узел; это покрывает и detached-случай).
- [ ] Не создавать вторую панель никогда.
- [ ] `showEmptyState()` работает после перемещения.
- [ ] `npm test` зелёный.
- [ ] Ручная проверка desktop: чтение (карточка работает) → словарь →
      чтение — карточка снова работает.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Сделай inspector.js безопасным при смене экранов.

Прочитай AGENTS.md и src/ui/components/inspector.js. Бага: строка 13
`if (panelEl) return panelEl;` возвращает detached-панель после того, как
роутер очистил контейнер экрана. На desktop после «чтение → словарь →
чтение» карточки слов перестают показываться.

Реализация — замени getInspectorPanel на:

   export function getInspectorPanel(parent) {
     if (!panelEl) {
       panelEl = document.createElement('aside');
       panelEl.className = 'inspector-panel';
       panelEl.setAttribute('aria-label', 'Инспектор слова');
       showEmptyState();
     }
     if (parent && panelEl.parentElement !== parent) {
       parent.appendChild(panelEl); // appendChild перемещает узел
     }
     return panelEl;
   }

Остальные функции (showEmptyState, showInInspector, hideInspector) не трогай.

npm test. npm run dev на 1280px: открой чтение, кликни греческую вставку
(карточка справа); перейди в словарь, вернись в чтение, кликни снова —
карточка работает. npm run build.

Коммит: "fix: reattach inspector panel across screens"
```

### Задача 3.2 — Карточка словаря на desktop через inspector + свежий entry

**Зачем:** `dictionary.js:337` всегда зовёт `openBottomSheet(card)`, а CSS
скрывает шторку при ≥900px — на desktop карточка создаётся, но невидима.
Используем тот же паттерн, что в читалке: desktop — inspector, mobile —
шторка. Заодно чиним смежный баг той же функции: клик по строке передаёт
`entry`, захваченный при рендере строки (`dictionary.js:208-211`), — после
включения чекбокса карточка ошибочно показывает «Добавить в словарь».

**Файлы:** `src/ui/screens/dictionary.js`.

- [ ] Импортировать `getInspectorPanel`, `showEmptyState`, `showInInspector`.
- [ ] В конце `render()` при `window.innerWidth >= 900` —
      `getInspectorPanel(container)` + `showEmptyState()` (render() очищает
      контейнер, панель надо переподключать после каждого рендера; задача 3.1
      делает это безопасным).
- [ ] В `showWordCard()`: desktop → `showInInspector(card)`,
      mobile → `openBottomSheet(card)`.
- [ ] Клик по строке читает свежую запись:
      `showWordCard(item, lex, dict[dictId], dictId)`.
- [ ] CSS шторки и глобальное правило desktop-hidden не трогать.
- [ ] `npm test` зелёный.
- [ ] Ручная проверка 1280px: клик по строке показывает карточку справа;
      375px — открывается шторка; чекбокс → клик по строке → карточка
      показывает настройки слова, а не «Добавить в словарь».
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Почини невидимую карточку слова на desktop-экране словаря.

Прочитай AGENTS.md, src/ui/screens/dictionary.js (render ~54, renderBatch
~156, showWordCard ~218), src/ui/components/inspector.js и паттерн
инспектора в src/ui/screens/reading.js (строки 165-169 и конец
handleWordTap).

Две проблемы в одной функции:
a) dictionary.js:337 — всегда openBottomSheet(card); CSS скрывает шторку
   при min-width:900px → на desktop карточка невидима.
b) dictionary.js:208-211 — row click передаёт entry, захваченный при
   рендере строки; после изменения чекбокса карточка показывает устаревшее
   состояние («Добавить в словарь» у уже добавленного слова).

Сделай так:
1) Импорт: import { getInspectorPanel, showEmptyState, showInInspector }
   from '../components/inspector.js';
2) В конце render() добавь:
     if (window.innerWidth >= 900) {
       getInspectorPanel(container);
       showEmptyState();
     }
   (render() очищает container.innerHTML — панель переподключается заново;
   после задачи 3.1 getInspectorPanel умеет это делать.)
3) В showWordCard() замени финальный openBottomSheet(card) на:
     if (window.innerWidth >= 900) showInInspector(card);
     else openBottomSheet(card);
4) В renderBatch() обработчик клика строки:
     row.addEventListener('click', (e) => {
       if (e.target.tagName === 'INPUT') return;
       showWordCard(item, lex, dict[dictId], dictId);
     });
   (dict[dictId] на момент клика, а не захваченный entry.)
5) CSS не трогай. Весь видимый текст по-русски.
6) npm test.
7) npm run dev:
   - 1280px: клик по строке → карточка в инспекторе справа; пустое
     состояние при загрузке экрана;
   - 375px: клик → шторка;
   - включи чекбокс слова, кликни по строке → карточка со статусом
     и настройками (не «Добавить в словарь»).
8) npm run build.

Коммит: "fix: show dictionary word cards in desktop inspector, fresh entry on tap"
```

### Задача 3.3 — Точечные обновления словаря из карточки (без потери прокрутки)

**Зачем:** кнопки статуса, тумблер «Показывать в тексте» и «Добавить в
словарь» в карточке зовут полный `render()` (`dictionary.js:252,272,332`):
список из сотен строк перерисовывается, прокрутка прыгает в начало, открытая
карточка остаётся со старым содержимым. По принципу 8 из DEVELOPMENT_1 3.1
статусы и подсветка — точечные мутации, не перерендер.

**Файлы:** `src/ui/screens/dictionary.js`.

- [ ] Helper `updateRow(strong)`: находит
      `.dict-row[data-strong="${strong}"]`, точечно обновляет бейдж статуса и
      состояние чекбокса по текущему `dict`.
- [ ] Helper `refreshCard(item, dictId)`: строит новую карточку
      `showWordCard`-логикой и заменяет старую через `card.replaceWith(...)`
      (работает и в инспекторе, и в открытой шторке).
- [ ] Все обработчики карточки (статус, тумблер, intensity, forms,
      «Добавить») вместо `render()` зовут `updateRow` + `refreshCard`.
- [ ] Поиск/табы продолжают звать полный `render()` — это смена картины
      списка, там перерендер легален.
- [ ] `npm test` зелёный.
- [ ] Ручная проверка: прокрутить список до ~200-й строки, открыть карточку,
      сменить статус — список не прыгает, бейдж строки обновился, карточка
      показывает новый статус.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Замени полный render() на точечные обновления при действиях в карточке.

Прочитай AGENTS.md, DEVELOPMENT_1.md раздел 3.1 принцип 8 (точечные
мутации вместо перерендера) и src/ui/screens/dictionary.js: showWordCard
(~218-338) — обработчики статуса (252), тумблера (272) и addBtn (332)
зовут render(), что перерисовывает весь список и сбрасывает прокрутку.

Реализация:
1) function updateRow(item) {
     const row = container.querySelector(`.dict-row[data-strong="${item.strong}"]`);
     if (!row) return; // строка может быть не отрендерена (DOM-окно)
     const coreById = new Map((lexicon || []).map(l => [l.strong, l]));
     const lex = coreById.get(item.strong);
     const dictId = lex ? lex.id : `freq-${item.strong}`;
     const entry = dict[dictId];
     // Бейдж
     const badge = row.querySelector('.dict-badge, .dict-badge-placeholder');
     if (badge) {
       if (entry) {
         badge.className = `dict-badge badge-${entry.status || 'new'}`;
         badge.textContent = { new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry.status] || 'Новое';
       } else {
         badge.className = 'dict-badge-placeholder';
         badge.textContent = '';
       }
     }
     // Чекбокс
     const checkbox = row.querySelector('input[type="checkbox"]');
     if (checkbox) checkbox.checked = !!entry && entry.showInText !== false;
   }

2) function refreshCard(card, item, lexeme, dictId) {
     const fresh = buildWordCard(item, lexeme, dict[dictId], dictId);
     card.replaceWith(fresh);
   }
   Для этого вынеси из showWordCard построение DOM карточки в
   buildWordCard(item, lexeme, dictEntry, dictId) → HTMLElement, а
   showWordCard оставь тонкой: const card = buildWordCard(...); затем
   inspector/шторка (логика из задачи 3.2).

3) Во всех обработчиках карточки замени render() на:
     updateRow(item);
     refreshCard(card, item, lexeme, dictId);
   У intensity/forms-кнопок render() не было — добавь refreshCard, чтобы
   подсветка btn-primary обновлялась.

4) Поиск и табы оставь на полном render().
5) npm test.
6) npm run dev (375px и 1280px):
   - прокрути до ~200-й строки, открой карточку, смени статус: список не
     прыгает, бейдж обновился, карточка показывает новый статус;
   - «Добавить в словарь» → карточка превращается в полную с настройками,
     бейдж «Новое» появился у строки;
   - тумблер «Показывать в тексте» обновляет чекбокс строки.
7) npm run build.

Коммит: "fix: targeted dictionary row/card updates instead of full rerender"
```

---

## Фаза 4 — Честный и стабильный частотный список

### Задача 4.1 — Нормализовать транслитерацию frequency.json

**Зачем:** 832 из 1000 записей содержат греческие символы (`kaί`, `aytόs`,
`dέ`): таблица в `build-frequency.mjs` не покрывает буквы с tonos/oxia и не
знает дифтонгов (`αὐτός` → `aytόs` вместо `autos`). Поиск латиницей не
работает. Переписываем на маленький helper: NFD-нормализация, дифтонги,
густое придыхание, носовая гамма; вывод — чистый ASCII (η → e, ω → o):
поле используется для поиска с клавиатуры, макроны там вредны.

**Файлы:** создать `scripts/lib/greek-translit.mjs`,
`tests/greek-translit.test.js`; изменить `scripts/build-frequency.mjs`,
`tests/frequency-data.test.js`; перегенерировать
`assets/data/lexicon/frequency.json`.

- [ ] Написать падающие тесты helper'а (таблица кейсов из промпта).
- [ ] Реализовать `transliterateGreek` в `scripts/lib/greek-translit.mjs`.
- [ ] `build-frequency.mjs`: импортировать helper, удалить inline SBL_MAP.
- [ ] В `frequency-data.test.js` добавить проверку: `translit` — чистый ASCII
      (`/^[A-Za-z]+$/`).
- [ ] `npm run build:data` перегенерирует `frequency.json`.
- [ ] `npm test` зелёный, `npm run build` зелёный.
- [ ] Данные/лицензии: новых источников нет; транслитерация — механика.
- [ ] Коммит (helper + скрипт + данные + тесты вместе).

**Промпт:**

```text
Почини транслитерацию frequency.json (TDD, без внешних данных).

Прочитай AGENTS.md, scripts/build-frequency.mjs и
tests/frequency-data.test.js. Проблема: translit содержит греческие символы
(kaί, aytόs, dέ) — буквы с акцентами не входят в таблицу, дифтонги не
обрабатываются.

1) Сначала тесты tests/greek-translit.test.js:

   import { describe, it, expect } from 'vitest';
   import { transliterateGreek } from '../scripts/lib/greek-translit.mjs';

   describe('transliterateGreek', () => {
     const cases = [
       ['καί', 'kai'],
       ['θεός', 'theos'],
       ['λόγος', 'logos'],
       ['δέ', 'de'],
       ['ὁ', 'ho'],                // густое придыхание
       ['αὐτός', 'autos'],         // дифтонг αυ
       ['οὐρανός', 'ouranos'],     // дифтонг ου
       ['υἱός', 'huios'],          // дифтонг υι + придыхание
       ['εὑρίσκω', 'heurisko'],    // придыхание на дифтонге ευ
       ['ῥῆμα', 'rhema'],          // ῥ → rh
       ['ἄγγελος', 'angelos'],     // носовая γγ → ng
       ['Ἰησοῦς', 'Iesous'],       // заглавная сохраняется
       ['ψυχή', 'psyche'],         // одиночная υ → y
       ['ζωή', 'zoe'],
     ];
     for (const [grc, lat] of cases) {
       it(`${grc} → ${lat}`, () => expect(transliterateGreek(grc)).toBe(lat));
     }
     it('возвращает чистый ASCII', () => {
       for (const [grc] of cases) {
         expect(transliterateGreek(grc)).toMatch(/^[A-Za-z]+$/);
       }
     });
   });

2) Реализация scripts/lib/greek-translit.mjs:

   const SINGLE = new Map(Object.entries({
     'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z',
     'η': 'e', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm',
     'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's',
     'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps',
     'ω': 'o'
   }));
   const DIPHTHONGS = new Map(Object.entries({
     'αυ': 'au', 'ευ': 'eu', 'ηυ': 'eu', 'ου': 'ou', 'υι': 'ui'
   }));
   const ROUGH = '\u0314'; // густое придыхание (дасия)

   /**
    * Учебная ASCII-транслитерация греческой леммы (для поиска).
    * η→e, ω→o (без макронов — поле используется для поиска латиницей).
    */
   export function transliterateGreek(text) {
     const nfd = text.normalize('NFD');
     const hasRough = nfd.includes(ROUGH);
     const stripped = nfd.replace(/[\u0300-\u036f]/g, '');
     const lower = stripped.toLowerCase();
     const isCapital = stripped.length > 0 && stripped[0] !== lower[0];

     let body = '';
     for (let i = 0; i < lower.length; i++) {
       // Носовая гамма: γγ/γκ/γξ/γχ → n + следующая буква
       if (lower[i] === 'γ' && 'γκξχ'.includes(lower[i + 1] || '')) {
         body += 'n';
         continue;
       }
       const two = lower.slice(i, i + 2);
       if (DIPHTHONGS.has(two)) {
         body += DIPHTHONGS.get(two);
         i++;
         continue;
       }
       body += SINGLE.get(lower[i]) ?? lower[i];
     }

     // Густое придыхание: ῥ → rh, иначе h в начале слова
     if (hasRough) {
       body = body.startsWith('r') ? 'rh' + body.slice(1) : 'h' + body;
     }

     if (isCapital && body.length > 0) {
       body = body[0].toUpperCase() + body.slice(1);
     }
     return body;
   }

   Известное упрощение (допустимо): диерезис не разрывает дифтонг
   (Μωϋσῆς → Mouses вместо Moyses) — для поиска некритично, в код не
   усложняем. Если тест с этим конфликтует — не добавляй такой тест.

3) В build-frequency.mjs: import { transliterateGreek } from
   './lib/greek-translit.mjs'; удали inline SBL_MAP и sblTransliterate;
   в сборке items используй translit: transliterateGreek(it.lemma).

4) В tests/frequency-data.test.js замени тест «translit присутствует и
   непустой» на:

   it('translit — чистый ASCII, непустой', () => {
     items.forEach(i => expect(i.translit).toMatch(/^[A-Za-z]+$/));
   });

5) npm test — тесты helper'а зелёные, frequency-data падает (старые данные).
6) npm run build:data — frequency.json перегенерирован.
7) npm test — всё зелёное. npm run build.

Лицензии: новых источников нет, транслитерация — механика.

Коммит: "fix(data): normalize greek frequency transliteration to ASCII"
```

### Задача 4.2 — Честная доступность + фильтр «Доступные»

**Зачем:** включить можно только 98 слов из 1000 (alignment генерируется через
ruMatches core-лексикона — non-core Strong в alignment не попадают). Два
обмана чиним: (а) тултип «слово не выровнено ни в одном стихе НЗ» — неправда
для ὁ/καί, честная причина — «нет проверенного русско-греческого
соответствия»; (б) каталог из 90% серых строк без фильтра выглядит сломанным —
по решению владельца добавляем таб «Доступные» (показывает только включаемые
слова), по умолчанию остаётся «Все». Ограничение фиксируем тестами данных.

**Файлы:** `tests/frequency-data.test.js`, `src/ui/screens/dictionary.js`.

- [ ] Тест: каждая запись `hasAlignment=true` имеет Strong, присутствующий в
      `core.json` (фиксация текущего ограничения; при будущем расширении
      alignment тест осознанно обновят).
- [ ] Тест: записей `hasAlignment=true` больше 50 (защита от случайного
      обнуления включаемого словаря).
- [ ] Таб «Доступные» в ряду фильтров (`getFilteredList`:
      `item.hasAlignment === true`), счётчик «Найдено: N» работает.
- [ ] Тултип и предупреждение в карточке: «Нет проверенного русско-греческого
      соответствия — слово пока не участвует в подстановках».
- [ ] `npm test` зелёный.
- [ ] Ручная проверка: таб «Доступные» показывает 98 строк, все с активными
      чекбоксами; «Все» — весь каталог; disabled-строки честно объясняют
      причину.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Сделай ограничение частотного списка явным: тесты, честные подписи,
фильтр «Доступные».

Прочитай AGENTS.md, DEVELOPMENT_5.md «Выбранный путь»,
tests/frequency-data.test.js и src/ui/screens/dictionary.js
(getFilteredList ~27, табы ~96, тексты в renderBatch:177 и showWordCard:232).

Контекст: alignment генерируется convert-alignments.js через ruMatches
core.json, поэтому hasAlignment=true только у core-слов (98 из 1000).
Это сознательное ограничение точности, и UI/тесты должны говорить о нём
честно.

1) В tests/frequency-data.test.js добавь:

   import { readFileSync } from 'node:fs';
   const core = Object.values(JSON.parse(readFileSync('assets/data/lexicon/core.json', 'utf8')));
   const coreStrongs = new Set(core.map(e => e.strong));

   it('hasAlignment=true ⊆ core.json (текущее ограничение alignment)', () => {
     items.filter(i => i.hasAlignment)
          .forEach(i => expect(coreStrongs.has(i.strong)).toBe(true));
   });

   it('включаемых слов больше 50', () => {
     expect(items.filter(i => i.hasAlignment).length).toBeGreaterThan(50);
   });

2) В dictionary.js добавь таб «Доступные» в существующий ряд табов:
   { value: 'available', label: 'Доступные' } — между «Все» и «Новые».
   В getFilteredList: if (filterStatus === 'available') return
   filtered.filter(item => item.hasAlignment);
   (Старые табы-статусы работают как раньше.)

3) Замени оба ложных текста (renderBatch:177 title и showWordCard:232
   warning) на: «Нет проверенного русско-греческого соответствия — слово
   пока не участвует в подстановках».

4) buildWordEntries в reading.js не трогай: freq-* ветка остаётся fail-soft.
5) npm test.
6) npm run dev: таб «Доступные» → 98 строк, все чекбоксы активны;
   таб «Все» → 1000 строк, серые строки с честным тултипом; карточка
   серого слова показывает то же объяснение. 375px/1280px, обе темы.
7) npm run build.

Коммит: "fix: honest frequency availability with «Доступные» filter"
```

### Задача 4.3 — Fallback личного словаря при недоступном `frequency.json`

**Зачем:** PWA offline-first обязана показывать личный словарь, даже если
частотный список не загрузился (`dictionary.js:66-72` сейчас показывает
только «Частотный список недоступен» и выходит).

**Файлы:** `src/ui/screens/dictionary.js`.

- [ ] Если `loadFrequency()` вернул `null`/пустой массив — рендерить
      fallback-список личных слов из `dict` + `coreLexicon`.
- [ ] Fallback поддерживает карточку и действия: статус, `showInText`,
      `intensity`, `forms` (через тот же `showWordCard`/`buildWordCard`).
- [ ] Если словарь пользователя пуст: «Частотный список недоступен. Личный
      словарь пока пуст.»
- [ ] Кнопку массового добавления слов не возвращать.
- [ ] `npm test` зелёный.
- [ ] Ручная проверка: блокировка `frequency.json` в DevTools → экран не
      пустой, личные слова видны и управляются.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Добавь fallback личного словаря, если frequency.json недоступен.

Прочитай AGENTS.md, src/ui/screens/dictionary.js и src/state/dictionary.js.

Проблема: при !frequencyList render() показывает «Частотный список
недоступен» и выходит (строки 66-72) — пользователь offline теряет доступ
к своим словам.

Реализация:
1) В render(), если frequencyList null/пустой — вызови
   renderPersonalDictionaryFallback() и return.
2) Fallback:
   - заголовок-карточка: «Частотный список недоступен — показан личный
     словарь.»;
   - строки из Object.entries(dict): для каждого id ищи лексему в
     coreLexicon (по l.id === id); для freq-* записей без частотного списка
     лемма недоступна — покажи id и Strong из суффикса, без леммы;
   - каждая строка: лемма (или id), глосс из лексемы (если есть), бейдж
     статуса, чекбокс showInText — переиспользуй разметку dict-row;
   - клик по строке → карточка с настройками. Для core-слов построй
     псевдо-item: { strong: lex.strong, lemma: lex.lemma,
     translit: lex.translit, count: lex.freqNT || 0, rank: 0,
     hasAlignment: true } и вызови showWordCard(item, lex, dict[id], id);
   - если dict пуст: карточка «Частотный список недоступен. Личный словарь
     пока пуст.»
3) Кнопку «+ Добавить слова» не возвращай.
4) npm test.
5) npm run dev: DevTools → Network → блокировка запроса frequency.json
   (или временно переименуй файл в dist при preview) → экран показывает
   личные слова, статус/чекбоксы работают; с пустым словарём — карточка
   с текстом из п. 2.
6) npm run build.

Коммит: "fix: fall back to personal dictionary without frequency list"
```

### Задача 4.4 — Убрать горизонтальный скролл словаря на 375px

**Зачем:** `.dict-row` — flex, у всех колонок `flex-shrink: 0`
(`app.css:901-977`): rank 36px + lemma min-width 100px + translit + freq 48px
+ бейдж + чекбокс не помещаются в 375px → `scrollWidth > viewport`. Чекбокс
18×18 — меньше требуемых 44px touch target (AGENTS.md).

**Файлы:** `assets/styles/app.css`; `src/ui/screens/dictionary.js` — только
если нужны классы/обёртки.

- [ ] Перевести `.dict-row` на CSS grid: мобильная раскладка в две строки
      (лемма + транслит под ней), без фиксированных ширин, `min-width: 0` у
      сжимаемых колонок.
- [ ] Touch target чекбокса ≥ 44×44 (увеличить область `label.dict-check`).
- [ ] Desktop (≥900px): плотная одна строка rank/lemma/translit/freq/бейдж/
      чекбокс.
- [ ] На 375px `document.documentElement.scrollWidth <= window.innerWidth`.
- [ ] Светлая и тёмная тема, контраст в норме.
- [ ] `npm test` зелёный, `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Почини mobile overflow экрана словаря (CSS-only).

Прочитай AGENTS.md (touch targets ≥ 44px), src/ui/screens/dictionary.js
(разметка строки в renderBatch) и assets/styles/app.css (901-977).

Проблема: .dict-row — flex, все колонки flex-shrink:0 → на 375px
scrollWidth > innerWidth. Чекбокс 18×18 меньше 44px.

Сделай так:
1) .dict-row → display: grid. Мобильная раскладка (по умолчанию):
     grid-template-columns: auto 1fr auto auto;
     grid-template-areas:
       "rank lemma   freq  check"
       "rank translit badge check";
   lemma/translit: min-width: 0; overflow-wrap: anywhere;
   rank — узкий, freq/badge — компактные, check — справа на обе строки.
2) ≥900px (медиазапрос уже используется в app.css) — одна строка:
     grid-template-columns: 40px minmax(120px, max-content) 1fr 56px auto 44px;
     grid-template-areas: "rank lemma translit freq badge check";
3) label.dict-check: min-width/min-height 44px, display:flex, центрирование —
   сам input оставь 18×18.
4) Назначь grid-area каждому span'у через существующие классы
   (.dict-rank, .dict-lemma, .dict-translit, .dict-freq, .dict-badge и
   .dict-badge-placeholder, .dict-check). Если без правки разметки никак —
   минимально поправь renderBatch, не меняя данных и обработчиков.
5) JS для измерения ширин не используй.
6) npm test.
7) npm run dev:
   - 375px: в консоли document.documentElement.scrollWidth <=
     window.innerWidth; длинные леммы переносятся, не выталкивают чекбокс;
   - 1280px: плотная строка, всё читается;
   - light/dark: контраст бейджей и muted-текста в норме.
8) npm run build.

Коммит: "fix: prevent dictionary horizontal overflow on mobile"
```

---

## Фаза 5 — Документация и живые спецификации

### Задача 5.1 — Привести README к текущему поведению

**Зачем:** README:31-32 обещает деградацию стихов без выравнивания «в замену
леммами» (это убрано в DEVELOPMENT_4) и README:55 называет DEVELOPMENT_2
живым источником архитектуры (живой — DEVELOPMENT_1 разделы 3–4, по
AGENTS.md).

**Файлы:** `README.md`.

- [ ] Деградация: без alignment словарных замен нет, буквенный слой остаётся.
- [ ] Источник архитектуры: DEVELOPMENT_1.md (разделы 3–4); DEVELOPMENT_2/3 —
      архив.
- [ ] Упомянуть `frequency.json`: корпусный частотный каталог top-1000,
      генерируется `npm run build:data`; включаемые подстановки — только
      слова core-лексикона (без обещаний non-core).
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Обнови README под alignment-only поведение.

Прочитай AGENTS.md, README.md (строки 23-35 про данные и 50-60 про
архитектуру) и DEVELOPMENT_1.md раздел 3.4.

1) README:31-32: фразу про деградацию стихов без выравнивания «в замену
   леммами» замени на: стихи без выравнивания не получают словарных замен —
   работает только буквенный слой (решение DEVELOPMENT_4: точность важнее
   покрытия).
2) README:55: ссылку на DEVELOPMENT_2.md замени на DEVELOPMENT_1.md
   (разделы 3-4 — живая спецификация); DEVELOPMENT_2/3 упомяни как архив.
3) В раздел про данные добавь 1-2 предложения: build:data также генерирует
   assets/data/lexicon/frequency.json — корпусный частотный каталог
   top-1000 лемм (ранг, частота, транслитерация, доступность); включать в
   текст можно слова core-лексикона.
4) README целиком не переписывай.
5) npm run build.

Коммит: "docs: align README with alignment-only behavior"
```

### Задача 5.2 — Почистить живые разделы DEVELOPMENT_1

**Зачем:** в живой спецификации (разделы 3–4) остались формулировки
эпохи regex-замен и старые пути (`tools/...`, `data/...`).

**Файлы:** `docs/development/DEVELOPMENT_1.md`.

- [ ] 3.3: `ruMatches`/`ruExclude` — не fallback замен, а guard для core-слов
      при alignment-only заменах (runtime в form-layer + генерация alignment).
- [ ] 3.5: пути и скрипты — текущие `assets/data/...` и `scripts/...`.
- [ ] 3.4/4.4: frequency.json — каталог top-1000; включаемые подстановки
      только для core-слов с проверенным соответствием; non-core `freq-*`
      подстановки не обещать; упомянуть фильтр «Доступные».
- [ ] Архивные roadmap-блоки (раздел 5+) не трогать.
- [ ] `grep -n "fallback\|word-layer\|tools/\|данные в data/" docs/development/DEVELOPMENT_1.md`
      просмотрен, живые устаревшие места исправлены.
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Почисти живые разделы DEVELOPMENT_1 от формулировок эпохи regex-замен.

Прочитай AGENTS.md и docs/development/DEVELOPMENT_1.md разделы 3-4.
Правь ТОЛЬКО живую спецификацию (разделы 3-4); roadmap-задачи ниже —
исторический архив, их не трогай.

1) 3.3: формулировки про ruMatches как fallback замен замени на:
   ruMatches/ruExclude — guard двух применений: генерация alignment
   (scripts/convert-alignments.js) и runtime-валидация в form-layer.
2) 3.5: обнови пути (assets/data/..., scripts/...) и имена скриптов на
   фактические: scripts/build-syn.mjs, scripts/convert-alignments.js,
   scripts/build-frequency.mjs.
3) 3.4 и 4.4 (экран словаря): словарь — мастер-список top-1000 с поиском,
   табами (Все/Доступные/Новые/Учу/Знаю) и чекбоксами showInText;
   включаемые слова — только core-лексикон с проверенным соответствием
   (hasAlignment); non-core freq-* подстановки не обещать — отдельный
   roadmap после license review.
4) Грепни: fallback, word-layer, tools/, "data/bibles". Исправь только
   живые разделы.
5) npm run build.

Коммит: "docs: clean live spec after frequency stabilization"
```

### Задача 5.3 — Отметить чекбоксы DEVELOPMENT_4 по факту

**Зачем:** все задачи DEVELOPMENT_4 выполнены (коммиты `153ec7d..af672da`),
но чекбоксы в файле остались пустыми — это нарушает собственное правило
плана («чекбоксы отмечаются и коммитятся вместе с кодом») и собьёт следующего
агента, который решит, что план не выполнен.

**Файлы:** `docs/development/DEVELOPMENT_4.md`.

- [ ] Отметить `[x]` все чекбоксы выполненных задач (фазы 1–5).
- [ ] В заголовок статуса добавить строку: «Выполнено в `153ec7d..af672da`;
      стабилизация и доводка до релиза — DEVELOPMENT_5.md».
- [ ] Содержание задач не редактировать (это уже история).
- [ ] `npm run build` зелёный.
- [ ] Коммит.

**Промпт:**

```text
Отметь чекбоксы DEVELOPMENT_4 по фактическому состоянию.

Сверь задачи docs/development/DEVELOPMENT_4.md с git log 153ec7d..af672da
(9 коммитов, по одному на задачу + docs). Все задачи фаз 1-5 выполнены.

1) Проставь [x] во всех чекбоксах задач 1.1-5.1.
2) В блок статуса (начало файла) добавь строку:
   «Статус выполнения: все фазы выполнены в 153ec7d..af672da (2026-06-12).
   Найденные при ревью регрессии и доводка до release-ready —
   docs/development/DEVELOPMENT_5.md.»
3) Текст задач не меняй.
4) npm run build (гейт перед коммитом).

Коммит: "docs: mark DEVELOPMENT_4 tasks as completed"
```

---

## Фаза 6 — Сквозная проверка: release-ready

### Задача 6.1 — Полный regression pass

**Зачем:** изменения затрагивают режимы, загрузку данных, словарь и
документацию. Перед объявлением release-ready — один честный прогон.
**Release-ready означает:** все фазы 0–5 выполнены, три команды-гейта
зелёные, чеклист ниже пройден без незакрытых пунктов. Bump версии и PR в
`main` владелец делает сам — в этот план они не входят.

**Файлы:** если багов нет — только чекбоксы в этом файле; баги — отдельными
`fix:`-коммитами.

- [ ] `npm run build:data` зелёный (инварианты не ослаблены).
- [ ] `npm test` зелёный, data-тесты не skip'аются.
- [ ] `npm run build` зелёный.
- [ ] Онбординг: чистая IndexedDB без dev-флага → онбординг, после
      завершения — чтение с введёнными буквами.
- [ ] Режим 1: пустой `progress.letters` не даёт замен.
- [ ] Режимы 1–2: введённые буквы заменяются детерминированно, интенсивность
      влияет только на буквы.
- [ ] Режим 3: core-слово из словаря заменяется леммой по alignment.
- [ ] Режим 3: Ин 1:1 «было» НЕ заменяется на γίνομαι (контрольный кейс).
- [ ] Режим 3: стих без alignment не делает словарных замен.
- [ ] Режим 4: реальные формы; невыровненные слова остаются русскими;
      per-word интенсивность «редко» заметно снижает частоту замен.
- [ ] Режим 5: греческий основной текст работает как раньше.
- [ ] Переключение режимов 1 → 3 → 4 → 5 без reload догружает `grc` один раз.
- [ ] Деградация offline: режимы 3–4 — тост, буквенный слой жив; режим 5 —
      русский текст без падений.
- [ ] Инспектор desktop: чтение → словарь → чтение — карточки работают везде.
- [ ] Словарь desktop 1280px: клик по строке → карточка в инспекторе.
- [ ] Словарь mobile 375px: клик по строке → шторка; нет горизонтального
      скролла; чекбокс — touch target ≥ 44px.
- [ ] Словарь: таб «Доступные» — 98 строк с активными чекбоксами; «Все» —
      1000; disabled-строки с честным объяснением.
- [ ] Словарь: поиск латиницей `kai`, `theos`, `autos`, `logos` находит
      слова (новый translit).
- [ ] Словарь: статус/чекбокс из карточки обновляют строку точечно, прокрутка
      не сбрасывается; карточка после «Добавить» показывает настройки.
- [ ] Fallback без `frequency.json`: личный словарь виден, управляется.
- [ ] Включение чекбокса слова в словаре → слово появляется в тексте режима 3
      (после возврата на чтение); выключение — исчезает.
- [ ] Долгий тап (показ оригинала) работает на заменах.
- [ ] Книга с минимальным выравниванием (Тит) читабельна в режиме 3.
- [ ] Светлая и тёмная тема: чтение и словарь.
- [ ] `git status`: только ожидаемые файлы; raw-источники
      (`docs/greek-nt-frequency-sources/raw/`) не закоммичены.
- [ ] Коммит с отмеченным чеклистом.

**Промпт:**

```text
Проведи финальный regression pass DEVELOPMENT_5 (release-ready).

Прочитай AGENTS.md и docs/development/DEVELOPMENT_5.md Фазу 6.

1) Запусти и убедись в зелёном статусе:
   npm run build:data
   npm test
   npm run build
2) npm run dev и пройди чеклист задачи 6.1 по пунктам, отмечая чекбоксы.
   Browser-проверки: 375px и 1280px, light/dark.
   Контрольные кейсы: Ин 1:1 «было» ≠ γίνομαι; переключение режимов из
   top-bar без reload; словарь — фильтр «Доступные», поиск «autos»,
   отсутствие горизонтального скролла на 375px.
3) Найден баг → чекбокс не отмечается; сначала отдельный fix-коммит
   (с тестом, если баг в чистой логике/данных), потом повторная проверка.
4) Всё зелёное → отметь чекбоксы и сделай docs-коммит. В финальном отчёте
   явно напиши: «Состояние release-ready; bump версии и PR в main — за
   владельцем».

Коммит, если только чекбоксы: "docs: record DEVELOPMENT_5 regression pass — release-ready"
```

---

## За пределами DEVELOPMENT_5

Не делать в рамках этого плана без отдельного решения владельца:

- Bump версии и merge в `main` (PR) — действие владельца после release-ready.
- Подключать внешний частотный словарь с русскими глоссами (license review).
- Расширять alignment на весь top-1000 без доказуемо безопасного
  русско-греческого соответствия.
- Карточка `freq-*` слова в читалке — вместе с расширением alignment
  (сейчас это недостижимое состояние, решение от 2026-06-12).
- Добавлять аналитику, телеметрию или скрытые учебные метрики.
- Добавлять framework, UI kit, Tailwind, новый test framework или CI.
- Ослаблять инварианты `scripts/convert-alignments.js` и
  `scripts/build-frequency.mjs`.

## Финальный отчёт исполнителя

В конце каждой задачи сообщать:

```text
Checks: команды и ручные проверки (pass/fail)
Changed files: список
Данные/лицензии: что перегенерировано; новые источники или «не менялись»
Notes: риски, пропущенные проверки с причиной
Git status: clean или список оставшихся изменений
```
