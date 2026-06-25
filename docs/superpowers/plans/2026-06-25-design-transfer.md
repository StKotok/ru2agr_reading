# Перенос дизайна из ru2gr_design-example в проект

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Перенести дизайн из прототипа `docs/ru2gr_design-example/project/` в production-код `src/`, сохранив визуальную точность (pixel-perfect относительно прототипа) при соблюдении архитектурных ограничений проекта (vanilla JS, CSS custom properties, без фреймворков).

**Architecture:** Прототип — это React-приложение на DC-runtime с 12 темами, 3 уровнями контраста, ~70 render-функциями и инлайн-стилями. Production — vanilla JS с CSS custom properties, 2 темами (light/dark), DOM-компонентами с `mount()/unmount()`. Перенос идёт снизу вверх: токены → компоненты → экраны → полировка. Каждый слой стабилизируется до перехода к следующему.

**Tech Stack:** Vanilla JS (ES modules), CSS custom properties, Vite, Vitest, IndexedDB.

**Дата согласования:** 2026-06-25

## Глобальные ограничения

- Никаких фреймворков (React, Vue, Svelte) — см. AGENTS.md
- Никаких CSS-библиотек (Tailwind, CSS Modules, CSS-in-JS)
- Все цвета — через CSS custom properties из `tokens.css`
- Engine — чистые функции без DOM/IO
- UI-компоненты: паттерн `mount(container, ctx)` / `unmount()`
- Полная обратная совместимость: существующие тесты должны проходить на каждом шаге
- Текст интерфейса — русский

---

## Согласованные решения: что переносим, что нет

### 🔵 Перенести из прототипа (отсутствует в production)

| # | Фича | Прототип (render-функция) | Куда в production |
|---|---|---|---|
| 1 | **12 цветовых тем** | `ru2gr-tokens.js` → `window.RU2GR.THEMES` | `tokens.css` + `settings.js` |
| 2 | **3 уровня контраста** | `state.readerContrast` | `tokens.css` + `settings.js` |
| 3 | **Визуальный theme-picker** | `readerRenderSettingsThemePicker` | Новый `theme-picker.js` |
| 4 | **Буквенная карточка** | `readerRenderLetterSheet` | Новый `letter-card.js` |
| 5 | **Gear-меню карточки слова** | `readerRenderGearMenu` | В `word-card.js` |
| 6 | **Расширенные секции карточки** | `readerCardSections` (8 секций) | В `word-card.js` |
| 7 | **Вертикальный стек: слово + частотность** | Исправлено в прототипе (flexDirection:'column') | В `word-card.js` |
| 8 | **Чип режима в хедере** | `readerChipH1` + `readerLiveChipState` | В `mode-widget.js` |
| 9 | **Выпадашка режимов с кружками** | `readerModeMenuList` (4 строки, нумерованные кружки 28×28) | В `mode-widget.js` |
| 10 | **3 дропдауна фильтрации словаря** | `readerWordSV3` (Статус), `readerWordPosDropdown` (Часть речи), `readerWordShowInTextCbx` (Чекбокс) | В `dictionary.js` |
| 11 | **simpleView (глаз)** | Кнопка в `readerRenderDeskTopPanel` | В `top-bar.js` |
| 12 | **Анимации** | `scSheetUp`, `scFade`, `scToast`, `scPop` | В `app.css` |

### 🟡 Адаптировать (объединить прототип + production)

| # | Фича | Решение |
|---|---|---|
| 13 | **Слайдер интенсивности** | Оставить в `mode-widget.js` (production-вариант), стилизовать как в прототипе. Отдельный попап удалён из прототипа |
| 14 | **Группировка словаря** | Прототип: Топ-10/50/100/300. Production: Топ-10/50/100/200/500/1000. Оставить production-бакеты |

### 🟢 Оставить как есть (production-фичи — не ломать)

| # | Фича | Причина |
|---|---|---|
| 15 | Экран прогресса (`progress.js`) | В прототипе отсутствует. Полностью рабочая фича |
| 16 | Онбординг (`onboarding.js`) | В прототипе отсутствует. Нужен для первого запуска |
| 17 | diacritics / strongs / ruHint | Тоглы, не предусмотренные дизайном. Сохранить |
| 18 | PWA / offline / IndexedDB | Инфраструктура, невидимая в дизайне |
| 19 | Hash-роутер (`#/read/john`) | В прототипе — вкладки. Production-роутер мощнее |
| 20 | Ленивая загрузка глав (IntersectionObserver) | Прототип грузит всё сразу. Production умнее |
| 21 | Длинное нажатие — показать оригинал | В прототипе отсутствует. Полезная фича |
| 22 | Данные из MACULA v3 | Прототип — статика (Ин 1:1-11) |
| 23 | Настройки на слово (intensity/forms) | В прототипе — глобальные. Production — per-word |
| 24 | Доступность (a11y): role, aria-label, keyboard | Production лучше. Сохранить и дополнить |
| 25 | newWordsPerChapter / pauseNewToday | В прототипе отсутствует |

### 🔴 Пропустить (прототипный chrome / галерейные варианты)

| # | Фича | Причина |
|---|---|---|
| 26 | Статус-бар телефона (9:41, сигнал, батарея) | Chrome прототипа — имитация iOS |
| 27 | POS-стили «Цвет» и «Чипсы» из canvas-header | Галерейные варианты. Используем 3 дропдауна (#10) |
| 28 | macOS traffic light titlebar | Только для desktop-прототипа в браузере |
| 29 | desktop scale (resize) | Артефакт DC-рантайма |
| 30 | canvas-header с селектами темы/контраста/POS | Панель управления дизайн-системой |
| 31 | Отдельный попап интенсивности (три точки) | Удалён из прототипа 2026-06-25 |

---

## Фаза 0: Аудит текущего состояния

### Task 0: Верификация baseline

**Цель:** Убедиться, что все тесты проходят до начала изменений.

- [ ] **Step 1: Запустить тесты**

```bash
npm test
```

Ожидаемый результат: все тесты зелёные.

- [ ] **Step 2: Запустить сборку**

```bash
npm run build
```

Ожидаемый результат: сборка успешна.

---

## Фаза 1: Дизайн-токены (Foundation)

### Task 1: Расширить палитру примитивов в tokens.css

**Files:**
- Modify: `assets/styles/tokens.css`

**Источник данных:** `docs/ru2gr_design-example/project/ru2gr-tokens.js` → `window.RU2GR.THEMES`

Каждая из 12 тем содержит 18 примитивов: `paper`, `alt`, `read`, `title`, `ink`, `inkSoft`, `muted`, `muted2`, `blue`, `blueBg`, `blueTx`, `terra`, `terraSoft`, `green`, `greenDk`, `greenBg`, `overlayDimBase`, `toastBg`, `toastTx`, `shadowBase`.

- [ ] **Step 1: Добавить все примитивные цвета из 12 тем**

Сгруппировать по семантической роли (paper, alt, read, title, ink, …), а не по теме. Каждый примитив — CSS custom property вида `--paper-pergament`, `--ink-coal` и т.д.

- [ ] **Step 2: Сверить значения с ru2gr-tokens.js**

```bash
grep -E "(paper|alt|read|title|ink|inkSoft|muted|muted2|blue|blueBg|blueTx|terra|terraSoft|green|greenDk|greenBg):" docs/ru2gr_design-example/project/ru2gr-tokens.js
```

- [ ] **Step 3: `npm test`**
- [ ] **Step 4: Коммит**

### Task 2: Добавить контрастные уровни

**Files:** Modify: `assets/styles/tokens.css`

3 уровня контраста через `data-contrast` атрибут: `soft` (по умолчанию), `sharp`, `maximum`. Влияют на alpha-каналы линий и теней. Тёмные темы используют демпфированные множители.

- [ ] **Step 1: Добавить CSS-переменные для трёх уровней контраста**
- [ ] **Step 2: `npm test`**
- [ ] **Step 3: Коммит**

### Task 3: Реализовать 12 тем через CSS custom properties

**Files:** Modify: `assets/styles/tokens.css`

Заменить плоскую структуру `[data-theme="light"]` / `[data-theme="dark"]` на 12 тем: `pergament` (default), `sepia`, `ivory`, `fog`, `sea`, `forest`, `rose`, `lavender`, `sunset`, `dark`, `night`, `coal`.

Каждая тема задаёт полный набор ролевых токенов (`--surface`, `--text`, `--greek`, `--border` и т.д.) через `var(--primitive)` ссылки.

- [ ] **Step 1: Заменить light/dark на 12 тем**
- [ ] **Step 2: Проверить визуально — `npm run dev`, переключить темы через DevTools**
- [ ] **Step 3: `npm test`**
- [ ] **Step 4: Коммит**

### Task 4: Обновить settings.js для 12 тем + контраста

**Files:** Modify: `src/state/settings.js`, `index.html`

- [ ] **Step 1: Добавить константы `THEMES`, `LIGHT_THEMES`, `DARK_THEMES`, `CONTRAST_LEVELS`**
- [ ] **Step 2: Обновить `applyTheme()` — устанавливать `data-theme`**
- [ ] **Step 3: Добавить `applyContrast()` — устанавливать `data-contrast`**
- [ ] **Step 4: Обновить `loadSettings()` / `saveSettings()` — поля `theme` и `contrast`**
- [ ] **Step 5: Обновить FOUC-защиту в `index.html`**
- [ ] **Step 6: `npm test`**
- [ ] **Step 7: Коммит**

---

## Фаза 2: Базовые компоненты

### Task 5: Обновить nav.js — сайдбар и нижняя навигация

**Files:** Modify: `src/ui/components/nav.js`, `assets/styles/app.css`

**Ориентир:** `readerRenderDeskNav` (сайдбар: 236px, строки 44px, иконки 20×20) + `readerRenderBottomNav` (мобильный: 4 иконки с подписями, высота ~56px).

- [ ] **Step 1: Обновить CSS — сайдбар: `--surface-sidebar`, ширина 236px**
- [ ] **Step 2: Обновить CSS — нижняя навигация: `@media (max-width: 899px)`**
- [ ] **Step 3: Обновить JS — иконки, aria-labels, активное состояние**
- [ ] **Step 4: `npm test` + визуальная проверка**
- [ ] **Step 5: Коммит**

### Task 6: Обновить top-bar.js — верхняя панель

**Files:** Modify: `src/ui/components/top-bar.js`, `assets/styles/app.css`

**Ориентир:** `readerRenderDeskTopPanel` — высота 52px, фон `--surface-titlebar`, название книги + чип режима + кнопка «глаз» (simpleView).

- [ ] **Step 1: Обновить CSS — высота, фон, граница**
- [ ] **Step 2: Добавить кнопку simpleView («глаз»)**
- [ ] **Step 3: `npm test` + визуальная проверка**
- [ ] **Step 4: Коммит**

### Task 7: Обновить mode-widget.js — чип режима + выпадашка с кружками

**Files:** Modify: `src/ui/components/mode-widget.js`, `assets/styles/app.css`

**Ориентир:** `readerChipH1` (чип состояния: `α35% · λέγω 137`) + `readerModeMenuList` (выпадашка: 4 строки, каждая с нумерованным кружком 28×28, borderRadius:9).

Слайдер интенсивности остаётся внутри mode-widget (production-вариант), но стилизуется как в прототипе.

- [ ] **Step 1: Реализовать чип с горизонтальным прогресс-баром (как `readerChipH1`)**
- [ ] **Step 2: Реализовать выпадашку с 4 кружками (как `readerModeMenuList`)**
- [ ] **Step 3: Стилизовать слайдер интенсивности внутри меню**
- [ ] **Step 4: `npm test` + визуальная проверка**
- [ ] **Step 5: Коммит**

### Task 8: Обновить word-card.js — карточка слова + буквенная карточка

**Files:** Modify: `src/ui/components/word-card.js`, `src/ui/components/bottom-sheet.js`, Create: `src/ui/components/letter-card.js`, Modify: `assets/styles/app.css`

**Ориентир:**
- Мобильный: `readerRenderWordSheet` (bottom-sheet с 8 секциями, вертикальный стек слово+частотность, gear-меню)
- Десктоп: `readerRenderDeskInspector` (инспектор 364px справа)
- Буквы: `readerRenderLetterSheet` (bottom-sheet с информацией о букве)

**Секции карточки слова:** gram, pron, dict, trans, status, mean, defn, deriv.
**Gear-меню:** настройка видимости и порядка секций (сохранять в `card-settings.js`).
**Вертикальный стек:** слово (fontSize:36 mobile / 44 desktop) + частотность снизу.

- [ ] **Step 1: Добавить недостающие секции (pron, dict, deriv) в word-card.js**
- [ ] **Step 2: Реализовать вертикальный стек: слово + частотность**
- [ ] **Step 3: Реализовать gear-меню (видимость/порядок секций)**
- [ ] **Step 4: Создать letter-card.js — буквенная карточка**
- [ ] **Step 5: Обновить bottom-sheet.js — анимация `scSheetUp`**
- [ ] **Step 6: Обновить CSS для инспектора (desktop): ширина 364px**
- [ ] **Step 7: `npm test` + визуальная проверка**
- [ ] **Step 8: Коммит**

---

## Фаза 3: Экраны

### Task 9: Редизайн reading.js — основной экран чтения

**Files:** Modify: `src/ui/screens/reading.js`, `src/ui/render.js`, `assets/styles/app.css`

**Ориентир:** `readerRenderDeskRead` — ширина контента 700px, fontSize:16, lineHeight:1.72. Desktop-лейаут: сайдбар | чтение | инспектор.

- [ ] **Step 1: Обновить CSS — область чтения, стихи, нумерация**
- [ ] **Step 2: Обновить render.js — цвета греческих вставок (`.gr`, `.gr-word`)**
- [ ] **Step 3: Обновить desktop-лейаут (flex: сайдбар | чтение | инспектор)**
- [ ] **Step 4: `npm test` + визуальная проверка**
- [ ] **Step 5: Коммит**

### Task 10: Редизайн dictionary.js — экран словаря

**Files:** Modify: `src/ui/screens/dictionary.js`, `assets/styles/app.css`

**Ориентир:** `readerWordDeskContent` — поисковая строка, 3 дропдауна фильтрации (Статус, Часть речи, Чекбокс «показывать в тексте»), список слов с группировкой по частотности, карточка слова справа (desktop) / bottom-sheet (mobile).

**3 дропдауна из прототипа:**
1. **Статус** (`readerWordSV3` / `readerWordSOpts`): Все / Новые / Учу / Знаю
2. **Часть речи** (`readerWordPosDropdown` / `readerWordPosOpts`): Все / Сущ. / Глаг. / Прил. / Служ.
3. **Чекбокс** (`readerWordShowInTextCbx`): Показывать слова в тексте чтения

- [ ] **Step 1: Реализовать 3 дропдауна фильтрации (Статус, Часть речи, Чекбокс)**
- [ ] **Step 2: Обновить CSS — поиск, группировка, строки слов**
- [ ] **Step 3: Обновить JS — логика фильтрации**
- [ ] **Step 4: `npm test` + визуальная проверка**
- [ ] **Step 5: Коммит**

### Task 11: Редизайн settings.js + новый ThemePicker

**Files:** Modify: `src/ui/screens/settings.js`, Create: `src/ui/components/theme-picker.js`, Modify: `assets/styles/app.css`

**Ориентир:** `readerRenderSettingsThemePicker` — Variant B из `settings_idea1_variants.md`:
- Два компактных слота (светлая / тёмная тема) с цветовым свотчем и названием
- Клик → popover (desktop) / bottom-sheet (mobile) с сеткой из 12 тем
- Каждая карточка: мини-превью (полоски paper/ink/blue/terra) + название

- [ ] **Step 1: Создать theme-picker.js (слоты + поповер-галерея)**
- [ ] **Step 2: Обновить settings.js — выбор темы и контраста**
- [ ] **Step 3: Обновить CSS для theme-picker**
- [ ] **Step 4: `npm test` + визуальная проверка**
- [ ] **Step 5: Коммит**

### Task 12: Минорные правки — progress.js, about.js, toast.js

**Files:** Modify: `src/ui/screens/progress.js`, `src/ui/screens/about.js`, `src/ui/components/toast.js`, `assets/styles/app.css`

- [ ] **Step 1: Обновить progress.js — цвета и отступы (алфавит, статистика)**
- [ ] **Step 2: Обновить about.js — цвета и отступы**
- [ ] **Step 3: Обновить toast.js — анимация `scToast`, позиционирование**
- [ ] **Step 4: `npm test` + визуальная проверка**
- [ ] **Step 5: Коммит**

---

## Фаза 4: Полировка

### Task 13: Анимации и переходы

**Files:** Modify: `assets/styles/app.css`

- [ ] **Step 1: Добавить @keyframes: `scSheetUp`, `scFade`, `scToast`, `scPop`**
- [ ] **Step 2: Применить к компонентам: bottom-sheet, popover, toast**
- [ ] **Step 3: Добавить `@media (prefers-reduced-motion: reduce)`**
- [ ] **Step 4: `npm test`**
- [ ] **Step 5: Коммит**

### Task 14: Финальный аудит

**Files:** Все изменённые файлы.

- [ ] **Step 1: Проверить все 12 тем — визуально в браузере**
- [ ] **Step 2: Проверить контрастность текста (WCAG AA ≥ 4.5:1)**
- [ ] **Step 3: Проверить accessibility — focus-visible, aria-labels, 44px touch targets**
- [ ] **Step 4: Проверить responsive — desktop (900+), tablet (600-899), phone (< 600)**
- [ ] **Step 5: Пройти полный гейт**

```bash
npm test
npm run build
npm run build:data
```

- [ ] **Step 6: Коммит**

---

## Что НЕ трогаем (production-фичи вне скоупа дизайна)

Эти файлы и фичи остаются без изменений — они либо отсутствуют в прототипе, либо являются инфраструктурой:

- `src/ui/screens/onboarding.js` — онбординг (нет в прототипе)
- `src/engine/**` — чистые функции (не затрагиваются дизайном)
- `src/storage/db.js` — IndexedDB (инфраструктура)
- `src/data/**` — загрузчики данных (инфраструктура)
- `src/router.js` — hash-роутер (нет в прототипе)
- `src/state/dictionary.js` — логика словаря (данные, не дизайн)
- `src/state/progress.js` — логика прогресса (данные, не дизайн)
- `src/state/card-settings.js` — используется в Task 8, но логика сохраняется
- PWA / Service Worker — инфраструктура

---

## Self-Review

### Spec Coverage

| Требование | Задача |
|---|---|
| 12 тем | Task 1, 3, 4 |
| 3 уровня контраста | Task 2, 4 |
| Визуальный theme-picker | Task 11 |
| Сайдбар + нижняя навигация | Task 5 |
| Верхняя панель + simpleView | Task 6 |
| Чип режима + выпадашка с кружками | Task 7 |
| Слайдер интенсивности (в mode-widget) | Task 7 |
| Карточка слова: 8 секций + gear-меню | Task 8 |
| Буквенная карточка | Task 8 |
| Вертикальный стек слово+частотность | Task 8 |
| Bottom-sheet + inspector | Task 8 |
| Экран чтения | Task 9 |
| Экран словаря + 3 дропдауна | Task 10 |
| Экран настроек | Task 11 |
| Прогресс / About / Toast | Task 12 |
| Анимации | Task 13 |
| Accessibility + Responsive | Task 14 |
| Все тесты проходят | Каждая задача |

### Не переносим (согласовано)

- ❌ Отдельный попап интенсивности (три точки) — удалён из прототипа
- ❌ Статус-бар телефона (chrome прототипа)
- ❌ POS-стили «Цвет» и «Чипсы» (галерейные варианты)
- ❌ macOS traffic light titlebar
- ❌ desktop scale (артефакт DC-рантайма)
- ❌ canvas-header с селектами (панель управления дизайн-системой)
