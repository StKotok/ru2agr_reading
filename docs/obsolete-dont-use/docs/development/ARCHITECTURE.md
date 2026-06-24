# Архитектура ru2agr-reading — спецификация для разработчиков

## Что это

Одностраничное приложение (SPA) для чтения Нового Завета с постепенным внедрением греческого языка: русские буквы заменяются греческими, затем русские слова — греческими лексемами. Работает офлайн (PWA).

**Стек**: чистый JavaScript (ES-модули), без фреймворков. Сборка — Vite 5. Тесты — Vitest + jsdom. Нулевые runtime-зависимости.

## Слои (снизу вверх)

```
data/          — загрузка JSON-файлов (fetch + in-memory cache)
storage/       — IndexedDB (настройки, прогресс, словарь пользователя)
engine/        — чистая логика композиции текста (главный контракт: text → Segment[])
state/         — глобальное состояние (observable store на 45 строк)
router.js      — hash-роутинг (6 маршрутов)
ui/components/ — переиспользуемые UI-блоки (nav, word-card, bottom-sheet…)
ui/screens/    — экраны (reading, dictionary, progress, settings…)
app.js         — точка входа, склейка слоёв, PWA
```

Каждый слой импортирует только из слоёв ниже себя. `ui/screens/` и `ui/components/` — один уровень, компоненты друг друга не импортируют.

## Store — глобальное состояние

```js
const store = createStore({ screen: 'reading', book: 'john' })
// store.get()          — текущий state
// store.update(fn)     — атомарное обновление (prev => next)
// store.subscribe(keys, cb) — подписка на изменения конкретных ключей
```

Форма state (ключи добавляются модулями по мере загрузки):

| Ключ | Источник | Содержимое |
|------|----------|-----------|
| `screen` | app.js | `'reading' \| 'dictionary' \| …` |
| `book` | app.js | `'john' \| 'matthew' \| …` |
| `settings` | settings.js | `{ intensity, wordLayer, readingMode, theme, … }` |
| `progress` | progress.js | `{ letters, reading, wordsToday }` |
| `dictionary` | dictionary.js | `{ [lexemeId]: { status, showInText, intensity } }` |
| `coreLexicon` | reading.js | массив лексем |
| `frequencyList` | reading.js | массив слов по частотности |
| `grcStatus` | reading.js | `'idle' \| 'loading' \| 'available' \| 'unavailable'` |

`update()` уведомляет подписчиков только по изменившимся ключам. `subscribe([], cb)` — подписка на всё.

## Роутинг

Hash-маршруты:

| URL | screen | params |
|-----|--------|--------|
| `#/read/john` | reading | `{ book: 'john' }` |
| `#/dictionary` | dictionary | `{}` |
| `#/progress` | progress | `{}` |
| `#/settings` | settings | `{}` |
| `#/onboarding` | onboarding | `{}` |
| `#/about` | about | `{}` |

`router.parse(hash)` → `{ screen, params }`. `router.navigate(path)` → пишет `location.hash`. `router.onChange(cb)` — обёртка над `hashchange`.

Если пользователь не прошёл onboarding — любой маршрут принудительно редиректит на `#/onboarding`.

## Жизненный цикл экранов

Каждый экран — модуль с контрактом:

```js
export function mount(container, { store, params }) { /* строит DOM */ }
export function unmount() { /* убирает подписки, observer'ы */ }
```

`app.js.switchScreen(name, params)`:
1. `currentScreen.unmount()`
2. `container.innerHTML = ''`
3. `nextScreen.mount(container, { store, params })`
4. `store.update({ screen: name, book: params.book })`

## Рендеринг

**Никакого virtual DOM.** Везде используется нативный DOM API: `createElement`, `appendChild`, `textContent`. Шаблонные строки с `innerHTML` — только для статических частей, где нет пользовательских данных.

Ключевой модуль: `render.js` → `segmentsToFragment(segments, ctx)` превращает выход engine в `DocumentFragment` с `<span class="gr">` для греческих слов.

## Engine — композиция текста

Центральная функция: `composeVerse(verseText, ctx)` → `Segment[]`.

`Segment`:
```js
{ plain: "текст" }                              // обычный русский
{ greek: "λόγος", original: "слово", kind, ... } // греческая замена
```

### Три режима (определяются в `deriveComposeMode`)

| Режим | Константа | Что делает |
|-------|-----------|-----------|
| Только буквы | `LETTERS_ONLY` (1) | `applyLetterLayer()` — замена русских букв на греческие по правилам из `rules.js`, интенсивность из настроек, позиция буквы детерминирована FNV-1a-хэшем |
| Слово-лемма | `WORD_LEMMA` (2) | `applyFormLayer()` — замена целых русских слов на греческие лексемы (словарную форму) через alignment-данные MACULA |
| Слово-форма | `WORD_FORM` (3) | То же, но показывается поверхностная форма слова (как в тексте), а не лемма |
| Греческий оригинал | `GREEK_ORIGINAL` (4) | SBLGNT-текст как основной, русский как подсказка |

Все рандомизации — **детерминированы**: `hash01(seed)` = FNV-1a хэш строки, нормализованный в `[0,1)`. `Math.random()` в engine запрещён. При одинаковых входных данных результат всегда идентичен — это даёт стабильный рендеринг при перемотке и перерисовке.

### Правила замены букв (`rules.js`)

50 правил: от простых однобуквенных (`т→τ`, `ф→φ`) до многосимвольных (`кс→ξ`, `пс→ψ`) и regex-правил (`г(?=[еи])→γ`). Применяются по порядку, диграфы раньше одиночных. Финальная сигма (ς) на конце слова.

### Alignment (MACULA v3)

Привязка русских слов к греческим токенам: `{ span: [start, end], tokenId, lexemeKey, q }`. Пары с `q === 'u'` (uncertain) никогда не показываются. Данные грузятся лениво при первом включении слоя слов для текущей книги.

## Загрузка данных

Все данные грузятся через `fetch()` из `assets/data/` во время выполнения. Кэшируются в памяти в `Map`. Схема данных описана в `assets/data/schema/`. Service Worker кэширует с `StaleWhileRevalidate`.

Основные загрузчики:

| Функция | Данные |
|---------|--------|
| `loadBooks()` | Манифест книг |
| `loadBook('syn', id)` | Синодальный перевод (главы → стихи → текст) |
| `loadBook('grc', id)` | SBLGNT (главы → стихи → токены с морфологией) |
| `loadAlignment(id)` | Alignment-пары |
| `loadAlphabet()` | Греческий алфавит |
| `loadUnifiedLexicon()` | Лексикон (лемма, глоссы, частотность, грамматика) |

## Персистентность

**IndexedDB** (`storage/db.js`, БД `ru2agr_db`, store `app_state`):
- `settings` — настройки пользователя
- `progress` — прогресс чтения, буквы, слова
- `dictionary` — пользовательский словарь

**localStorage**:
- `theme` — кэш темы для FOUC-защиты (читается в `<script>` внутри `index.html`)
- `ru2agr_card_display` — видимость и порядок секций карточки слова

## Экран чтения — ключевые механики

Самый сложный экран (`ui/screens/reading.js`, ~1050 строк):

- **Ленивый рендеринг глав**: `IntersectionObserver` раскрывает placeholder'ы глав при подкрутке. Окно: ±3 главы от видимой области.
- **Перерисовка**: `reRenderWindowed()` обновляет только уже раскрытые главы (не весь список).
- **Тап по слову**: собирает `wordData` из data-атрибутов span'а + лексикона + словаря. Показывает карточку в popover (≥900px) или bottom sheet (<900px, с swipe-to-dismiss).
- **Долгое нажатие** (≥500ms): временно показывает оригинальное русское слово под греческой заменой.
- **Свитки и главы**: IntersectionObserver на sentinel'ах в конце глав (50% видимости = глава прочитана). debounce 500ms на сохранение позиции скролла.

## Компоненты

| Компонент      | Файл              | Назначение                                                                      |
|----------------|-------------------|---------------------------------------------------------------------------------|
| `nav`          | `nav.js`          | Нижняя панель вкладок (5 экранов)                                               |
| `top-bar`      | `top-bar.js`      | Верхняя панель: выбор книги + переключатель режимов                             |
| `mode-widget`  | `mode-widget.js`  | Чип-кнопка → popup/bottom-sheet: слайдер интенсивности, переключатель слоя слов |
| `word-card`    | `word-card.js`    | Карточка слова/буквы с грамматикой, глоссами, статусом                          |
| `bottom-sheet` | `bottom-sheet.js` | Полноэкранная шторка с swipe-to-dismiss                                         |
| `toast`        | `toast.js`        | Неблокирующее уведомление                                                       |
| `inspector`    | `inspector.js`    | Боковая панель для карточек на десктопе                                         |

## Responsive-граница

`>= 900px` — десктоп (popover'ы, боковая панель). `< 900px` — мобильный (bottom sheet'ы, swipe-жесты). Определяется через `window.matchMedia` и `resize`-события в компонентах.

## Полезные команды

```bash
npm run dev          # dev-сервер (Vite)
npm test             # тесты (Vitest)
npm run build        # продакшн-сборка
npm run build:data   # полная пересборка данных (MACULA + alignment)
```

## Конвенции кода

- Никаких `Math.random()` в engine — только `hash01()` из `engine/hash.js`
- `fetch()` всегда с `.catch(() => null)` — приложение должно работать офлайн
- IndexedDB-операции fail-soft: ошибка → warn в консоль, приложение продолжает работу
- Мутации state — только через `store.update(fn)`, где `fn` возвращает новый объект
- Компоненты не импортируют друг друга
- Имена функций на английском, данные и UI-тексты на русском
