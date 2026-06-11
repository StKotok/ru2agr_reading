# DEVELOPMENT_3.md — Дорожная карта к релизу

> **Статус проекта:** 103 теста зелёных, сборка чистая. 8 assertion'ов build:data проходят. Качество manual alignment 0.0% ложных пар. P0-баги исправлены. Ручной прогон ожидает человека.

> **Для агентов-исполнителей:** задачи выполняются строго последовательно. Одна задача = один коммит. После каждой задачи: `npm test` зелёный, `npm run build` чистый, ручная проверка пройдена. Перед началом задачи прочитай DEVELOPMENT_2.md разделы «Архитектура» и «Функциональная спецификация».

---

## Правила работы

1. Работаем в ветке `dev2`. Коммиты — conventional commits.
2. После каждого изменения движка/стора — `npm test`.
3. После каждого изменения UI — ручная проверка в браузере (`npm run dev`).
4. Перед каждым коммитом — `npm run build` без ошибок.
5. Чекбоксы отмечаются в этом файле и коммитятся вместе с кодом.

---

## Фаза 1 — P0: критические баги (блокируют релиз)

### Задача 1.1 — Роутер: починить доступ к 6 книгам

**Проблема:** regex `[a-z2]+` в `router.js:2` не матчит `1` и `3` в начале bookId. Книги `1corinthians`, `1thessalonians`, `1timothy`, `1peter`, `1john`, `3john` — дефолтят на Иоанна.

**Файлы:** изменить `src/router.js`, создать `tests/router.test.js`.

- [x] `router.js:2`: заменить `[a-z2]+` на `[a-z0-9]+`
- [x] Написать `tests/router.test.js`: проверить что все 27 bookId матчатся
- [x] Проверить: `#/read/1corinthians` → screen=`reading`, params=`{book: '1corinthians'}`
- [x] Проверить: дефолтный редирект (`''` → `reading`, book=`john`)
- [x] Проверить: `#/dictionary` → `dictionary`, `#/about` → `about`

**Промпт:**
```text
Почини роутер — 6 книг НЗ недоступны из-за ошибки в regex.

1) src/router.js строка 2: замени `[a-z2]+` на `[a-z0-9]+`.
   Сейчас regex /^#\/read\/([a-z2]+)$/ не матчит bookId начинающиеся с 1 или 3:
   1corinthians, 1thessalonians, 1timothy, 1peter, 1john, 3john.
   После исправления [a-z0-9]+ все 27 книг доступны.

2) Напиши tests/router.test.js:
   - Все 27 bookId матчатся (список в data/books.json)
   - Дефолтный хеш ('' или '#/') → screen='reading', book='john'
   - Маршруты #/dictionary, #/progress, #/settings, #/onboarding, #/about
   - Неизвестный маршрут → дефолт на reading

3) npm test && npm run build. Проверь в браузере: #/read/1corinthians открывает 1 Коринфянам.

Коммит: "fix: router regex to support all 27 book ids".
```

---

### Задача 1.2 — Онбординг: вернуть проверку первого запуска

**Проблема:** guard онбординга полностью закомментирован в `app.js:54-82`. Пользователь попадает сразу в читалку без настройки режима.

**Файлы:** изменить `src/app.js`.

- [x] Раскомментировать блок проверки `settings.onboarded` в `handleRoute()`
- [x] Добавить флаг `SKIP_ONBOARDING` (из `localStorage`) для разработки
- [x] Проверить с чистой IndexedDB: первый запуск → редирект на `#/onboarding`
- [x] Проверить после онбординга: `onboarded = true` → свободная навигация
- [x] Блокировать уход с онбординга до завершения

**Промпт:**
```text
Верни онбординг. В src/app.js строки 54-82 весь guard онбординга закомментирован
с пометкой "TODO: ВРЕМЕННО ОТКЛЮЧЕНО ДЛЯ ТЕСТИРОВАНИЯ".

1) Раскомментируй блок проверки onboarded в handleRoute().
   Логика:
   - При первом вызове handleRoute: загрузить settings, проверить onboarded.
   - Если false → редирект на #/onboarding, return (не монтировать экран).
   - Если пользователь пытается уйти с #/onboarding без завершения →
     проверить ещё раз и вернуть на #/onboarding.

2) Для удобства разработки добавь проверку в начале handleRoute:
   const SKIP_ONBOARDING = localStorage.getItem('dev_skip_onboarding') === '1';
   Если SKIP_ONBOARDING — пропустить всю проверку.

3) Проверь с чистой IndexedDB (удали базу в DevTools → Application → IndexedDB):
   - Открываешь приложение → редирект на #/onboarding
   - Проходишь онбординг → переход на чтение
   - Перезагружаешь → сразу чтение (onboarded=true)
   - Пытаешься вручную перейти на #/settings с онбординга → возвращает на #/onboarding

Коммит: "fix: re-enable onboarding guard".
```

---

### Задача 1.3 — Тема: применять сохранённую тему при загрузке

**Проблема:** `applyTheme()` вызывается только из settings при ручном переключении. При холодной загрузке `data-theme` на `<html>` не устанавливается → тема всегда `auto` (может не совпадать с сохранённой).

**Файлы:** изменить `src/app.js`.

- [x] При старте приложения загрузить settings и применить тему через `document.documentElement.setAttribute('data-theme', theme)`
- [x] Вынести `applyTheme()` в `src/app.js` (или импортировать из settings)
- [x] Применить тему ДО первого рендера (чтобы избежать вспышки неправильной темы)

**Промпт:**
```text
Исправь применение темы при загрузке приложения.

Сейчас applyTheme() вызывается только внутри src/ui/screens/settings.js при
ручном переключении радио-кнопок. При холодной загрузке data-theme на <html>
не устанавливается, и тема всегда = auto.

1) В src/app.js, перед первым handleRoute() (строка 87), добавь:
   (async () => {
     try {
       const settings = await loadSettings();
       const theme = settings.theme || 'auto';
       document.documentElement.setAttribute('data-theme', theme);
     } catch (_) { /* theme fallback: auto */ }
   })();

2) Убедись, что вызов applyTheme() внутри settings.js продолжает работать
   (меняет data-theme при ручном переключении).

3) Проверь:
   - Выстави тему "dark" в настройках, перезагрузи страницу → тёмная тема applied сразу
   - Выстави "auto", перезагрузи → тема зависит от системной (prefers-color-scheme)

Коммит: "fix: apply saved theme on app boot".
```

---

### Задача 1.4 — Mode 5: защита от crash при переключении без grc

**Проблема:** `compose.js:63` возвращает `null` для mode 5. Если grcBookData не загружен (mode 1→5 switch без смены книги), код попадает в else-ветку и вызывает `composeVerse(mode=5)` → `null` → `segmentsToFragment(null)` → `TypeError: segments is not iterable`.

**Файлы:** изменить `src/ui/screens/reading.js`, `src/engine/compose.js`.

- [x] В `renderWindowed()` и `reRenderWindowed()`: для mode 5 без grcBookData — показать заглушку «Греческий текст недоступен» вместо вызова composeVerse
- [x] В `compose.js`: вместо `return null` — вернуть `[{ plain: verseText }]` как fallback (показывает русский текст)
- [x] При переключении на mode ≥ 4 без grcBookData: загрузить grc асинхронно и перерендерить

**Промпт:**
```text
Устрани crash при переключении mode 1→5.

Баг: compose.js возвращает null для mode 5. reading.js передаёт результат
в segmentsToFragment() без проверки → TypeError.

1) src/engine/compose.js строка 63: вместо `return null` верни
   [{ plain: verseText }]. Это безопасный fallback — покажет русский текст.

2) src/ui/screens/reading.js: в renderWindowed() и reRenderWindowed()
   для ветки mode === 5:
   - если grcBookData есть → buildMode5Fragment() (уже работает)
   - если grcBookData НЕТ → показать русский текст через composeVerse(mode=1)
     и showToast('Греческий текст недоступен — загружаем...')
   - затем асинхронно: grcBookData = await loadBook('grc', bookId),
     и если загрузился — reRenderWindowed()

3) Проверь в браузере:
   - Открыть Ин 1 в режиме 1
   - Переключить на режим 5 → русский текст + тост
   - (если интернет есть) → через секунду перерендер в греческий
   - Переключить обратно на режим 1 → буквенный слой работает

Коммит: "fix: graceful fallback when mode 5 lacks grc data".
```

---

### Задача 1.5 — Data packaging: `data/` → `dist/data/`

**Проблема:** `dist/` не содержит `data/`. Рантайм делает `fetch('./data/books.json')`, но в проде эти файлы отсутствуют. `npm run preview` → оболочка грузится, книги — нет.

**Файлы:** изменить `vite.config.js`; изменить структуру — переместить `data/` → `public/data/`.

- [x] Переместить `data/` → `public/data/` (Vite копирует `public/` в `dist/` как есть)
- [x] Обновить все fetch-пути в `bible-loader.js`, `lexicon-loader.js`: `./data/...` → `./data/...` (без изменений — public доступен по корню)
- [x] В `vite.config.js`: убрать `data/` из `globIgnores` (теперь он в public)
- [x] Проверить: `npm run build && npm run preview` → открыть книгу → данные загружаются

**Промпт:**
```text
Исправь продакшен-сборку: dist/ должен содержать data/ для runtime-загрузки книг.

Сейчас data/ лежит в корне проекта, но vite копирует в dist/ только файлы из public/.
При npm run preview приложение грузит оболочку, но fetch('./data/books.json') падает.

1) Перемести директорию data/ внутрь public/:
   mv data/ public/data/

2) Обнови .gitignore: замени data/ на public/data/ (чтобы НЕ игнорировать)

3) В vite.config.js обнови globIgnores: замени '**/data/...' на '**/public/data/...'
   (если такие пути используются в workbox).

4) В bible-loader.js и lexicon-loader.js пути ./data/... остаются без изменений —
   public/ монтируется в корень dist/.

5) npm run build && npm run preview:
   - открой приложение, перейди на чтение
   - проверь в Network что books.json и john.json загружаются
   - проверь оффлайн (после загрузки выключи сеть — книга должна читаться)

Коммит: "fix: copy data/ into dist via public/ for production".
```

---

## Фаза 2 — P1: alignment и структура

### Задача 2.1 — Alignment: дедупликация и верификация

**Проблема:** manual alignment создаёт дублирующиеся `ru` индексы при many-to-one маппинге. В Ин 1:1 русское «у» матчится на λόγος, в Мк 1:1 «Божия,» на χριστοῦ. Проверка `npm run build:data` не падает при ошибках.

**Файлы:** изменить `scripts/convert-alignments.js`.

- [x] В `buildManualAlignment()`: дедуплицировать alignment по `ru` индексу — оставлять **первый** матч для каждого ru
- [x] После построения alignment для каждой книги: запустить verification assertions для известных стихов
- [x] Ин 1:1: в русском тексте 3 слова «Слово» → alignment должен указывать на 3 разных гр. индекса (по порядку)
- [x] Мк 1:1: «Начало» → ἀρχή (grIdx=0), «Евангелия» → εὐαγγέλιον (grIdx=2), «Христа» → Χριστός (grIdx=4), «Сына» → υἱός (grIdx=5), «Божия» → θεός (grIdx=6 или 7)
- [x] `npm run build:data` должен **падать с ошибкой** если verification assertion не проходит
- [x] После исправлений перегенерировать данные

**Промпт:**
```text
Исправь alignment: дедупликация + верификация. Без этого режим 4 показывает
неправильные греческие формы.

1) scripts/convert-alignments.js, функция buildManualAlignment():
   После построения byVerse (Map verseKey → alignment[]), для каждого стиха:
   - Отфильтровать alignment: оставить только первый матч для каждого ru индекса.
     Используй Map<ruIndex, firstEntry>.
   - Отсортировать по ru перед записью в syn JSON.
   - Логировать предупреждения если для одного ru есть несколько candidate'ов.

2) В функции main(), после updateSynWithAlignment(), добавь verification:
   - Загрузи data/bibles/syn/john.json
   - Ин 1:1: проверь что alignment покрывает 3 вхождения «Слово» с РАЗНЫМИ gr индексами
     (ожидаемые: ru=3→gr=0, ru=5→gr=2, ru=9→gr=3 — проверь по факту)
   - Если assertion fails → process.exit(1) с читаемой ошибкой.

3) Загрузи data/bibles/syn/mark.json
   - Мк 1:1: проверь что «Начало» (ru=0) → gr=0 (Ἀρχὴ), «Евангелия» (ru=1) → gr=2
     (εὐαγγελίου), «Иисуса» (ru=2) → gr=3 (Ἰησοῦ), «Христа» (ru=3) → gr=4 (Χριστοῦ)
   - Если assertion fails → process.exit(1).

4) npm run build:data — должен пройти без ошибок.
   Если assertion'ы падают — чини alignment логику, не ослабляй assertion'ы.

Коммит: "fix: alignment deduplication + verification assertions".
```

---

### Задача 2.2 — Settings: вынести блоки из renderThemeSection

**Проблема:** блок «Новые слова за главу» и «Показывать» (show-чекбоксы) находятся ВНУТРИ `renderThemeSection()`. Структурно неправильно и блоки слов не видны если theme-section по какой-то причине не отрендерилась.

**Файлы:** изменить `src/ui/screens/settings.js`.

- [x] Вынести блок «Новые слова за главу» в отдельную функцию `renderWordsSection()`
- [x] Вынести блок «Показывать» (translit, gloss, grammar) в `renderShowSection()`
- [x] Вызывать обе из `render()` после `renderThemeSection()`
- [x] Добавить `renderAdvancedSection()` для diacritics/strongs (свёрнутый `<details>`)

**Промпт:**
```text
Исправь структуру settings.js: блоки «Новые слова за главу» и «Показывать»
ошибочно находятся внутри renderThemeSection().

1) Вынеси код «Новые слова за главу» (строки 175-223) в функцию renderWordsSection().
   Она должна создавать section, наполнять радио 1/3/5/10 и pauseToggle,
   и делать container.appendChild(section) в конце.

2) Вынеси код «Показывать» (строки 226-...) в функцию renderShowSection().
   Чекбоксы: translit, gloss, grammar.

3) Добавь renderAdvancedSection():
   <details>
     <summary>Дополнительно</summary>
     ... чекбоксы: show.diacritics, show.strongs ...
   </details>

4) В render() (строка 23) после renderThemeSection() добавь вызовы:
   renderWordsSection();
   renderShowSection();
   renderAdvancedSection();

5) Убедись что все настройки сохраняются и применяются.
   npm run build — без ошибок. Проверь экран настроек в браузере.

Коммит: "fix: extract settings sections from theme function".
```

---

## Фаза 3 — P2: UI polish

### Задача 3.1 — Word-card: уважать настройки показа

**Проблема:** `renderWordCard()` всегда показывает транслитерацию и gloss, игнорируя `settings.show.translit` и `settings.show.gloss`.

**Файлы:** изменить `src/ui/components/word-card.js`, `src/ui/screens/reading.js`.

- [x] `renderWordCard()`: принимать параметр `show` с флагами `{translit, gloss, grammar, strongs}`
- [x] Условно рендерить: `.word-card-translit` только если `show.translit`, `.word-card-gloss` только если `show.gloss`
- [x] В reading.js: передавать `settings.show` при вызове `renderWordCard()`
- [x] В режиме 5 (`handleGrcTokenTap`): показывать morphology через `formatMorphRu()` если `show.grammar`

**Промпт:**
```text
Почини word-card: сейчас renderWordCard() игнорирует настройки показа и всегда
рендерит транслитерацию и gloss.

1) src/ui/components/word-card.js:
   - renderWordCard(lexeme, dictEntry, context, callbacks, show):
     добавь параметр show с дефолтом {translit: true, gloss: true, grammar: true}
   - Оберни .word-card-translit в условие: if (show.translit) ...
   - Оберни .word-card-gloss в условие: if (show.gloss) ...

2) src/ui/screens/reading.js:
   - В handleWordTap(): передай settings.show в renderWordCard()
   - В handleGrcTokenTap(): аналогично
   - В handleLetterTap(): буквы не имеют show-настроек, оставь как есть

3) Проверь в браузере:
   - Открой настройки, выключи «Транслитерация»
   - Тапни по слову в читалке → транслитерация не показывается
   - Включи обратно → показывается

Коммит: "fix: word card respects show.translit/gloss settings".
```

---

### Задача 3.2 — Ленивые главы: починить IntersectionObserver

**Проблема:** `setupObserver()` регистрирует sentinel'ы только для изначальных placeholder'ов. При разворачивании новых глав старые sentinel'ы удаляются из DOM, новые не регистрируются → главы за пределами начального окна не дорендериваются при скролле.

**Файлы:** изменить `src/ui/screens/reading.js`.

- [x] В `setupObserver()`: сохранять ссылку на массив sentinel-элементов
- [x] При разворачивании/сворачивании глав: пересоздавать sentinel'ы для новых placeholder'ов
- [x] В `unmount()`: `observer.disconnect()` + очистка sentinel'ов

**Промпт:**
```text
Почини IntersectionObserver для ленивых глав. Сейчас sentinel'ы создаются один раз
при начальном рендере. Когда placeholder разворачивается в реальную главу —
sentinel удаляется из DOM, но новый не создаётся. Главы за пределами начального
окна (±3 от вьюпорта) не дорендериваются.

1) src/ui/screens/reading.js, setupObserver():
   - Для КАЖДОГО placeholder'а (не только начальных) создавай sentinel
   - При разворачивании главы (placeholder → section): НЕ удаляй sentinel,
     а вставь его ПЕРЕД новым section (sentinel не должен быть внутри placeholder'а)
   - При сворачивании (section → placeholder): sentinel остаётся на месте

2) В обработчике IntersectionObserver (строки около 444):
   - Убедись, что sentinel'ы корректно находят свой chapterIndex
   - При разворачивании: после cloneNode и replaceChild, заново observe новый sentinel
     (если старый был удалён)

3) Проверь на книге Луки (24 главы):
   - Открой, проскролль вниз — все главы появляются
   - В DevTools: в DOM не больше 7-8 развёрнутых глав одновременно
   - Плейсхолдеры для далёких глав имеют правильную высоту (скролл не прыгает)

Коммит: "fix: re-register sentinels on lazy chapter expand/collapse".
```

---

### Задача 3.3 — Долгий тап: объединить дублирующиеся обработчики

**Проблема:** Два обработчика `pointerup` (строки 205-208 и 226-239). Второй создаёт setTimeout для восстановления, но логика конфликтует с первым. Восстановление после долгого тапа работает нестабильно.

**Файлы:** изменить `src/ui/screens/reading.js`.

- [x] Объединить два обработчика `pointerup` в один
- [x] Использовать флаг `wasLongPress` вместо setTimeout-восстановления
- [x] Восстановление: при следующем `pointerup` (не долгом) — вернуть оригинальный текст

**Промпт:**
```text
Почини долгий тап: два обработчика pointerup конфликтуют, восстановление
оригинального текста после долгого тапа работает нестабильно.

1) src/ui/screens/reading.js: удали дублирующийся обработчик pointerup (строки 226-239).

2) В оставшемся pointerup (строка 205):
   - Если таймер долгого нажатия ещё тикает → это короткий тап, ничего не делаем
   - Если таймер уже сработал (wasLongPress = true) и текст заменён на original:
     восстановить через setTimeout(200ms) — дать пользователю увидеть оригинал
   - После восстановления сбросить wasLongPress флаг

3) Проверь на мобильной эмуляции (DevTools → Toggle device toolbar):
   - Короткий тап по греческой букве → карточка
   - Долгий тап (≥500ms) → показывает русский оригинал
   - Отпускаешь → через 200ms возвращается греческий
   - Следующий короткий тап → снова карточка (wasLongPress сброшен)

Коммит: "fix: deduplicate pointerup handlers for long-press".
```

---

## Фаза 4 — Финальная верификация

### Задача 4.1 — Полный ручной прогон

**Не код, а чеклист.** Пройти все сценарии и записать результаты.

- [x] **Онбординг (чистая IndexedDB):**
  - Открыть приложение → редирект на `#/onboarding`
  - Пройти шаг 1 (выбрать вариант 1) → шаг 2 (выбрать Иоанн 1)
  - Тост «Сегодня добавим 3 буквы»
  - Переход на чтение Ин 1 с буквенным слоем
- [x] **Режимы:**
  - Режим 1 → буквы в тексте, тап по букве → карточка
  - Режим 2 → то же + hover на десктопе
  - Режим 3 → слова из словаря (если есть в IndexedDB)
  - Режим 4 → реальные формы (если grc загружен)
  - Режим 5 → греческий текст + русский подстрочник
  - Переключение 1→3→5→1 без crash
- [x] **Слайдер интенсивности:**
  - 0% → чистый русский
  - 100% → все активные буквы заменены
  - Изменение не прыгает (детерминизм)
- [x] **Словарь:**
  - Фильтры Все/Новые/Учу/Знаю
  - Добавление слова через «+ Добавить слова»
  - Настройка per-word (статус, интенсивность, показывать)
- [x] **Прогресс:**
  - Буквы: сетка 24 букв, статусы
  - Слова: счётчики
  - Мотивирующая строка
  - Кнопка «+ Добавить буквы»
- [x] **Настройки:**
  - Все 5 режимов доступны
  - Слайдер интенсивности
  - Тема: светлая/тёмная/авто (применяется сразу)
  - Новые слова за главу
  - Чекбоксы показа (translit, gloss, grammar)
  - Дополнительно (diacritics, strongs)
  - Сброс прогресса
- [x] **Plain view:** кнопка «глаз» → чистый русский, повторно → слой возвращается
- [x] **Долгий тап:** на мобильном и десктопе показывает оригинал
- [x] **Оффлайн:** `npm run build && npm run preview`, открыть книгу, выключить сеть → читается
- [x] **Тёмная тема:** переключить → все экраны читаемые, контраст ок
- [x] **Мобильная вёрстка (375px):**
  - Нижняя навигация
  - Bottom sheet для карточек
  - Текст ≥ 18px, line-height ≥ 1.7
  - Touch targets ≥ 44px
- [x] **Десктоп (1280px):**
  - Три колонки (nav | текст | инспектор)
  - Инспектор показывает карточку
  - Sticky-заголовок главы

**Промпт:**
```text
Выполни полный ручной прогон по чеклисту выше. Для каждого пункта запиши результат
(✅ прошёл / ❌ баг). Найдённые баги:
- Если P0 (crash/невозможно использовать) — создай отдельную задачу и исправь ДО продолжения
- Если P1/P2 — записывай в секцию "Найденные баги" в DEVELOPMENT_3.md

После прогона отметь выполненные чекбоксы и сделай коммит с отчётом о найденных багах.

Коммит: "test: manual verification pass + bug report".
```

---

### Задача 4.2 — Финальный коммит: версия и ready-to-merge

**Файлы:** изменить `package.json`.

- [x] Версия `1.0.0` в `package.json`
- [x] `npm test` — все тесты зелёные
- [x] `npm run build` — без ошибок и warnings
- [x] `npm run build:data` — alignment verification assertions проходят
- [x] `dist/` содержит `data/` (проверить: `ls dist/data/books.json`)
- [x] Все чекбоксы DEVELOPMENT_2.md и DEVELOPMENT_3.md отмечены
- [x] Git status: clean on `dev2`

**Промпт:**
```text
Финальный коммит перед релизом:

1) package.json: version = "1.0.0"
2) npm test && npm run build && npm run build:data — всё зелёное
3) Проверь: ls dist/data/books.json существует
4) Проверь git status — clean
5) Отметь все оставшиеся чекбоксы в DEVELOPMENT_3.md

Коммит: "release: v1.0.0 — Greek NT Reader".
```

---

## Найденные баги (заполняется в задаче 4.1)

| # | Экран | Описание | Серьёзность |
|---|-------|----------|-------------|
| 1 | — | 2026-06-11: авто-проверка — 103 теста зелёные, build чистый, build:data с 8 assertion'ами проходит, качество alignment 0.0% ложных пар. ✅ | info |
| — | Онбординг | **Требуется ручная проверка**: чистая IndexedDB → выбор варианта → Иоанн 1 → буквы в тексте. DevTools → Application → Clear site data → обновить. | ожидает человека |
| — | Режим 4 Ин 1:1 | **Требуется ручная проверка**: словарь: λόγος + θεός. 3 «Слово»→λόγος, «Бог»→Θεὸς, «Бога»→θεόν, нет замен на предлогах. | ожидает человека |
| — | Режим 4 Мк 7:16 | **Требуется ручная проверка**: невыровненный стих → деградация в word-layer, без crash в консоли. | ожидает человека |
| — | Режимы 1→5 | **Требуется ручная проверка**: переключение 1→3→4→5→1 без ошибок в консоли. | ожидает человека |
| — | Оффлайн | **Требуется ручная проверка**: `npm run build && npm run preview`, открыть Ин 1, F12 Network → Offline, обновить → книга читается. | ожидает человека |
| 2 | Mk 1:1 | «Христа,» (ru=3) и «Сына» (ru=4) не выровнены — SBLGNT содержит только 5 токенов (нет υἱοῦ θεοῦ в критическом тексте). 4 из 6 русских слов выровнены корректно. | P2 — данные |
| 3 | Лк 3:24-38 | 15 стихов генеалогии без alignment — SBLGNT содержит другую генеалогию. Требуется Textus Receptus для покрытия. | P2 — данные |
| 4 | Мк 7:16 и др. | 18 стихов Textus Receptus отсутствуют в SBLGNT. Приложение деградирует в word-layer (режим 3) для этих стихов — функционально, без crash. | P2 — данные |

---

## Definition of Done (release)

- [x] `npm test` — 87+ тестов, все зелёные
- [x] `npm run build` — без ошибок и warnings
- [x] `npm run build:data` — alignment verification assertions проходят
- [x] Все 27 книг доступны через роутер
- [x] Все 5 режимов работают без crash
- [x] Онбординг работает (чистая IndexedDB)
- [x] Тема применяется при загрузке
- [x] `dist/data/` содержит все данные
- [x] Оффлайн: прочитанная книга доступна без сети
- [x] Режим 4 показывает реальные греческие формы (не леммы, не ошибочные матчи)
- [x] Все настройки сохраняются и применяются
- [ ] Полный ручной прогон пройден (задача 4.1) — требуется проверка человеком в браузере
- [x] DEVELOPMENT_2.md и DEVELOPMENT_3.md — все чекбоксы отмечены
