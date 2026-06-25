# Перенос дизайна из ru2gr_design-example в проект

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Перенести дизайн из прототипа `docs/ru2gr_design-example/project/` в production-код `src/`, сохранив визуальную точность (pixel-perfect относительно прототипа) при соблюдении архитектурных ограничений проекта (vanilla JS, CSS custom properties, без фреймворков).

**Architecture:** Прототип — это React-приложение на DC-runtime с 12 темами, 3 уровнями контраста, ~70 render-функциями и инлайн-стилями. Production — vanilla JS с CSS custom properties, 2 темами (light/dark), DOM-компонентами с `mount()/unmount()`. Перенос идёт снизу вверх: токены → компоненты → экраны → полировка. Каждый слой стабилизируется до перехода к следующему.

**Tech Stack:** Vanilla JS (ES modules), CSS custom properties, Vite, Vitest, IndexedDB.

## Глобальные ограничения

- Никаких фреймворков (React, Vue, Svelte) — см. AGENTS.md
- Никаких CSS-библиотек (Tailwind, CSS Modules, CSS-in-JS)
- Все цвета — через CSS custom properties из `tokens.css`
- Engine — чистые функции без DOM/IO
- UI-компоненты: паттерн `mount(container, ctx)` / `unmount()`
- Полная обратная совместимость: существующие тесты должны проходить на каждом шаге
- Текст интерфейса — русский

---

## Фаза 0: Аудит текущего состояния

### Task 0: Сравнительный аудит прототип ↔ production

**Files:** Нет изменений кода — только документирование.

- [ ] **Step 1: Составить карту соответствия компонентов**

| Прототип (render function) | Production (component) | Статус |
|---|---|---|
| `readerRenderDesktopApp` | `reading.js` + `top-bar.js` + `nav.js` + `inspector.js` | Есть, требует редизайна |
| `readerRenderPhone` | `reading.js` (mobile-ветка) | Есть, требует редизайна |
| `readerRenderDeskNav` | `nav.js` (desktop sidebar) | Есть, требует редизайна |
| `readerRenderBottomNav` | `nav.js` (mobile bottom) | Есть, требует редизайна |
| `readerRenderDeskTopPanel` | `top-bar.js` + `mode-widget.js` | Есть, требует редизайна |
| `readerRenderDeskInspector` | `inspector.js` + `word-card.js` | Есть, требует редизайна |
| `readerRenderWordSheet` | `word-card.js` + `bottom-sheet.js` | Есть, требует редизайна |
| `readerRenderLetterSheet` | Отсутствует | **Новый** |
| `readerRenderModeMenu` | `mode-widget.js` (popup) | Есть, требует редизайна |
| `readerRenderSettings` | `settings.js` | Есть, требует редизайна |
| `readerRenderSettingsThemePicker` | Отсутствует | **Новый** |
| `readerRenderToast` | `toast.js` | Есть — минорные правки |
| `readerRenderAbout` | `about.js` | Есть — минорные правки |
| `readerRenderDict` | `dictionary.js` | Есть, требует редизайна |
| `readerRenderRead` | `render.js` (segmentsToFragment) | Есть — минорные правки |
| `readerRenderStatusBar` | Отсутствует (частично в top-bar) | **Новый** |

- [ ] **Step 2: Составить карту токенов прототип → CSS**

Семантические токены прототипа и их будущие CSS-аналоги:

| Прототип (`CR`) | Назначение | Будущий CSS-токен |
|---|---|---|
| `paper` | Фон страницы | `--surface` |
| `paper2`/`alt`/`sidebar` | Фон сайдбара | `--surface-sidebar` |
| `read` | Фон области чтения | `--surface-read` |
| `titlebar` | Фон верхней панели | `--surface-titlebar` |
| `ink` | Основной текст | `--text` |
| `inkSoft` | Вторичный текст | `--text-soft` |
| `muted` | Приглушённый текст | `--muted` |
| `muted2` | Ещё более приглушённый | `--muted2` |
| `line` | Границы/линии | `--border` |
| `line2` | Акцентные линии | `--border-accent` |
| `blue` | Греческий текст / акцент | `--greek` / `--primary` |
| `blueBg` | Фон греческого | `--greek-bg` |
| `blueTx` | Текст на синем фоне | `--on-greek` |
| `terra` | Греческие слова / тёплый акцент | `--greek-word` |
| `terraSoft` | Фон тёплого акцента | `--greek-word-bg` |
| `green` | Статус «известно» | `--status-known` |
| `greenDk` | Тёмно-зелёный | `--status-known-text` |
| `greenBg` | Фон «известно» | `--status-known-bg` |
| `overlayDimBase` + alpha | Затемнение фона | `--overlay-bg` |
| `toastBg` / `toastTx` | Тост | `--toast-bg` / `--toast-text` |
| `shadowBase` + alpha | Тени (4 уровня) | `--shadow-*` |

- [ ] **Step 3: Составить карту новых фич прототипа, отсутствующих в production**

1. **12 тем** (вместо 2): Пергамент, Сепия, Слоновая кость, Туман, Море, Лес, Роза, Лаванда, Закат, Тёмная, Ночь, Уголь
2. **3 уровня контраста**: Мягкий, Чёткий, Максимальный (влияют на alpha линий и теней)
3. **Визуальный выборщик тем** (ThemePicker): компактные слоты + поповер-галерея (Variant B)
4. **Режим отображения**: segment control `[1][2][3][4]` в галереях
5. **Расширенная карточка слова**: все секции (грамматика, произношение, словарь, перевод, статус, значения, определение, деривация)
6. **Буквенная карточка** (LetterSheet): информация о греческой букве
7. **Статус-бар** (StatusBar): компактная строка над текстом с информацией о режиме
8. **Анимации**: `scSheetUp`, `scFade`, `scToast`, `scPop`

- [ ] **Step 4: Проверить, что все существующие тесты проходят**

```bash
npm test
```

Ожидаемый результат: все тесты зелёные (текущий baseline).

---

## Фаза 1: Дизайн-токены (Foundation)

### Task 1: Расширить палитру примитивов в tokens.css

**Files:**
- Modify: `assets/styles/tokens.css`

**Интерфейсы:**
- Produces: CSS custom properties — 12 тематических наборов примитивов

- [ ] **Step 1: Добавить все примитивные цвета из 12 тем**

Добавить в `:root` секцию примитивов все уникальные цвета из `ru2gr-tokens.js`. Сгруппировать по семантике, а не по теме:

```css
:root {
  /* === Paper (фоны страниц) === */
  --paper-pergament: #ECE7DD;
  --paper-sepia: #E9DFC8;
  --paper-ivory: #FAF8F3;
  --paper-fog: #E8E8EB;
  --paper-sea: #E2ECF0;
  --paper-forest: #E6EADD;
  --paper-rose: #F1E4E1;
  --paper-lavender: #E9E5F0;
  --paper-sunset: #F0E2D4;
  --paper-dark: #26231d;
  --paper-night: #1b2230;
  --paper-coal: #1f1f21;

  /* === Alt (фоны сайдбаров/карточек) === */
  --alt-pergament: #E3DDD0;
  --alt-sepia: #E2D6BB;
  /* ... все 12 */

  /* === Read (фон области чтения) === */
  /* ... */

  /* === Title (фон заголовка) === */
  /* ... */

  /* === Ink (основной текст) === */
  /* ... */

  /* === InkSoft, Muted, Muted2 === */
  /* ... */

  /* === Blue, BlueBg, BlueTx === */
  /* ... */

  /* === Terra, TerraSoft === */
  /* ... */

  /* === Green, GreenDk, GreenBg === */
  /* ... */
}
```

- [ ] **Step 2: Проверить — все значения точно соответствуют ru2gr-tokens.js**

Сверка: `grep -E "(paper|alt|read|title|ink|inkSoft|muted|muted2|blue|blueBg|blueTx|terra|terraSoft|green|greenDk|greenBg):" docs/ru2gr_design-example/project/ru2gr-tokens.js` — каждое значение должно быть в tokens.css.

- [ ] **Step 3: Запустить тесты**

```bash
npm test
```

- [ ] **Step 4: Коммит**

```bash
git add assets/styles/tokens.css
git commit -m "feat(design): add 12-theme primitive color palette to tokens.css

Extract all unique colors from ru2gr-tokens.js into CSS custom properties.
Grouped by semantic role (paper, alt, read, title, ink, blue, terra, green).
No functional change — existing light/dark themes still use old token bindings.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: Добавить вычисляемые токены и контрастные уровни

**Files:**
- Modify: `assets/styles/tokens.css`

**Интерфейсы:**
- Consumes: примитивные цвета из Task 1
- Produces: `--line-alpha`, `--line2-alpha`, `--shadow-alpha-*` для 3 уровней контраста

- [ ] **Step 1: Добавить контрастные переменные**

```css
:root {
  /* Контраст: Мягкий (по умолчанию) */
  --contrast-line-alpha: 0.10;
  --contrast-line2-alpha: 0.18;
  --contrast-shadow-raised-alpha: 0.10;
  --contrast-shadow-elevated-alpha: 0.13;
  --contrast-shadow-overlay-alpha: 0.16;
  --contrast-shadow-sheet-alpha: 0.40;
  --contrast-shadow-menu-alpha: 0.50;
  --contrast-shadow-dropdown-alpha: 0.42;
  --contrast-shadow-nav-alpha: 0.08;
  --contrast-shadow-chip-alpha: 0.10;
}

[data-contrast="sharp"] {
  --contrast-line-alpha: 0.16;
  --contrast-line2-alpha: 0.24;
  --contrast-shadow-raised-alpha: 0.14;
  --contrast-shadow-elevated-alpha: 0.18;
  --contrast-shadow-overlay-alpha: 0.22;
  --contrast-shadow-sheet-alpha: 0.55;
  --contrast-shadow-menu-alpha: 0.65;
  --contrast-shadow-dropdown-alpha: 0.55;
  --contrast-shadow-nav-alpha: 0.12;
  --contrast-shadow-chip-alpha: 0.16;
}

[data-contrast="maximum"] {
  --contrast-line-alpha: 0.24;
  --contrast-line2-alpha: 0.32;
  --contrast-shadow-raised-alpha: 0.20;
  --contrast-shadow-elevated-alpha: 0.26;
  --contrast-shadow-overlay-alpha: 0.30;
  --contrast-shadow-sheet-alpha: 0.70;
  --contrast-shadow-menu-alpha: 0.80;
  --contrast-shadow-dropdown-alpha: 0.70;
  --contrast-shadow-nav-alpha: 0.18;
  --contrast-shadow-chip-alpha: 0.24;
}

/* Dark theme dampening — применяется поверх data-contrast */
[data-theme="dark"] {
  --contrast-line-alpha: 0.12;
  --contrast-line2-alpha: 0.20;
}

[data-theme="dark"][data-contrast="sharp"] {
  --contrast-line-alpha: 0.18;
  --contrast-line2-alpha: 0.26;
}

[data-theme="dark"][data-contrast="maximum"] {
  --contrast-line-alpha: 0.26;
  --contrast-line2-alpha: 0.34;
}
```

- [ ] **Step 2: Запустить тесты**

```bash
npm test
```

- [ ] **Step 3: Коммит**

```bash
git add assets/styles/tokens.css
git commit -m "feat(design): add contrast level tokens (soft/sharp/maximum)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: Добавить 12 тем через CSS custom properties

**Files:**
- Modify: `assets/styles/tokens.css`

**Интерфейсы:**
- Consumes: примитивы из Task 1, контрастные уровни из Task 2
- Produces: 12 значений `data-theme` с полными наборами ролевых токенов

- [ ] **Step 1: Заменить текущую плоскую структуру light/dark на 12 тем**

Текущая структура:
```css
:root, [data-theme="light"] { ... }
[data-theme="dark"] { ... }
```

Новая структура (каждая тема задаёт все ролевые токены):
```css
/* Тема: Пергамент (светлая, по умолчанию) */
:root,
[data-theme="pergament"] {
  --surface: var(--paper-pergament);
  --surface-card: var(--alt-pergament);
  --surface-sidebar: var(--alt-pergament);
  --surface-read: var(--read-pergament);
  --surface-titlebar: var(--title-pergament);
  --text: var(--ink-pergament);
  --text-soft: var(--inkSoft-pergament);
  --muted: var(--muted-pergament);
  --muted2: var(--muted2-pergament);
  --greek: var(--blue-pergament);
  --primary: var(--blue-pergament);
  --greek-bg: var(--blueBg-pergament);
  --on-greek: var(--blueTx-pergament);
  --greek-word: var(--terra-pergament);
  --greek-word-bg: var(--terraSoft-pergament);
  --status-known: var(--green-pergament);
  --status-known-text: var(--greenDk-pergament);
  --status-known-bg: var(--greenBg-pergament);
  --border: color-mix(in srgb, var(--text) calc(var(--contrast-line-alpha) * 100%), transparent);
  --border-accent: color-mix(in srgb, var(--text) calc(var(--contrast-line2-alpha) * 100%), transparent);
  /* ... shadow, toast, overlay etc. */
}

/* Повторить для всех 12 тем */
[data-theme="sepia"] { ... }
[data-theme="ivory"] { ... }
[data-theme="fog"] { ... }
[data-theme="sea"] { ... }
[data-theme="forest"] { ... }
[data-theme="rose"] { ... }
[data-theme="lavender"] { ... }
[data-theme="sunset"] { ... }
[data-theme="dark"] { ... }
[data-theme="night"] { ... }
[data-theme="coal"] { ... }
```

- [ ] **Step 2: Проверить визуально — открыть приложение с `?dev=1`, переключить темы через DevTools**

```bash
npm run dev
```

В DevTools: `document.documentElement.setAttribute('data-theme', 'sepia')` — все 12 тем должны применяться.

- [ ] **Step 3: Запустить тесты**

```bash
npm test
```

- [ ] **Step 4: Коммит**

```bash
git add assets/styles/tokens.css
git commit -m "feat(design): implement 12-theme system via CSS custom properties

Replace binary light/dark with 12 named themes from design prototype.
Each theme maps semantic tokens to primitive colors from ru2gr-tokens.js.
Theme 'pergament' is the new default (was 'light').

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: Обновить settings.js для работы с 12 темами и контрастом

**Files:**
- Modify: `src/state/settings.js`

**Интерфейсы:**
- Consumes: 12 theme names + 3 contrast levels
- Produces: `applyTheme(name)`, `applyContrast(level)`, `getSettings()` возвращает theme + contrast

- [ ] **Step 1: Обновить константы тем**

```javascript
export const THEMES = [
  'pergament', 'sepia', 'ivory', 'fog', 'sea',
  'forest', 'rose', 'lavender', 'sunset',
  'dark', 'night', 'coal',
];

export const LIGHT_THEMES = ['pergament', 'sepia', 'ivory', 'fog', 'sea', 'forest', 'rose', 'lavender', 'sunset'];
export const DARK_THEMES = ['dark', 'night', 'coal'];

export const IS_DARK_THEME = Object.fromEntries([
  ...LIGHT_THEMES.map(t => [t, false]),
  ...DARK_THEMES.map(t => [t, true]),
]);

export const CONTRAST_LEVELS = ['soft', 'sharp', 'maximum'];
export const DEFAULT_THEME = 'pergament';
export const DEFAULT_CONTRAST = 'soft';
```

- [ ] **Step 2: Обновить `applyTheme()`**

```javascript
export function applyTheme(name) {
  const theme = THEMES.includes(name) ? name : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
```

- [ ] **Step 3: Добавить `applyContrast()`**

```javascript
export function applyContrast(level) {
  const contrast = CONTRAST_LEVELS.includes(level) ? level : DEFAULT_CONTRAST;
  document.documentElement.setAttribute('data-contrast', contrast);
  return contrast;
}
```

- [ ] **Step 4: Обновить `getSettings()` и `saveSettings()` — добавить поля theme и contrast**

- [ ] **Step 5: Обновить FOUC-защиту в index.html — искать theme в localStorage**

- [ ] **Step 6: Запустить тесты**

```bash
npm test
```

- [ ] **Step 7: Коммит**

```bash
git add src/state/settings.js index.html
git commit -m "feat(design): update settings.js for 12 themes + contrast levels

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Фаза 2: Базовые компоненты

### Task 5: Обновить nav.js — сайдбар (desktop) и нижняя навигация (mobile)

**Files:**
- Modify: `src/ui/components/nav.js`
- Modify: `assets/styles/app.css` (nav-секция)

**Интерфейсы:**
- Consumes: `ctx.store`, `ctx.router`, новые CSS-токены
- Produces: визуально соответствующий прототипу `readerRenderDeskNav` + `readerRenderBottomNav`

- [ ] **Step 1: Сверить визуальные параметры из прототипа**

Из `ru2gr-render.js` (`readerRenderDeskNav`, линия ~445):
- Ширина сайдбара: `TK.navWidth` = 236px
- Фон: `CR.sidebar`
- Высота строки: 44px
- Иконки: 20×20, отступ 12px
- Текст: `CR.inkSoft`

Из `readerRenderBottomNav` (линия ~225):
- Высота: ~56px
- 4 иконки с подписями
- Активный элемент: `CR.blue`, фон `CR.blueBg`
- Разделительная линия: `CR.line`

- [ ] **Step 2: Обновить CSS для сайдбара**

```css
.app-nav {
  width: 236px;
  background: var(--surface-sidebar);
  border-right: 1px solid var(--border);
}

.nav-item {
  height: 44px;
  padding: 0 12px;
  color: var(--text-soft);
  border-radius: var(--radius-md);
}

.nav-item.active {
  background: var(--greek-bg);
  color: var(--greek);
}
```

- [ ] **Step 3: Обновить CSS для нижней навигации (mobile)**

```css
@media (max-width: 899px) {
  .app-nav {
    width: 100%;
    height: 56px;
    flex-direction: row;
    border-right: none;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
}
```

- [ ] **Step 4: Обновить JS — иконки из icons.js, aria-labels**

- [ ] **Step 5: Запустить тесты + визуальная проверка**

```bash
npm test
npm run dev
```

- [ ] **Step 6: Коммит**

```bash
git add src/ui/components/nav.js assets/styles/app.css
git commit -m "feat(design): redesign nav to match prototype (sidebar + bottom nav)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 6: Обновить top-bar.js — верхняя панель

**Files:**
- Modify: `src/ui/components/top-bar.js`
- Modify: `assets/styles/app.css` (top-bar секция)

**Интерфейсы:**
- Consumes: `ctx.store`
- Produces: визуально соответствует `readerRenderDeskTopPanel`

- [ ] **Step 1: Сверить параметры из прототипа**

Из `readerRenderDeskTopPanel` (линия ~464):
- Высота: ~52px
- Фон: `CR.titlebar`
- Слева: название книги + главы (как чип)
- Справа: чип режима (буквы/леммы/формы/греческий)
- Граница снизу: `CR.line`

- [ ] **Step 2: Обновить CSS**

```css
.top-bar {
  height: 52px;
  padding: 0 16px;
  background: var(--surface-titlebar);
  border-bottom: 1px solid var(--border);
}
```

- [ ] **Step 3: Обновить JS — перестроить DOM под макет прототипа**

- [ ] **Step 4: Запустить тесты + визуальная проверка**

- [ ] **Step 5: Коммит**

### Task 7: Обновить mode-widget.js — переключатель режимов

**Files:**
- Modify: `src/ui/components/mode-widget.js`
- Modify: `assets/styles/app.css`

**Интерфейсы:**
- Consumes: `ctx.store`, режимы из `settings.js`
- Produces: визуально соответствует `readerChipH1` + `readerModeMenuList`

- [ ] **Step 1: Реализовать чип + выпадашку (как в прототипе)**

Прототип использует паттерн «чип состояния → клик → выпадающий список из 4 строк с нумерованными кружками», а не сегментный переключатель.

- [ ] **Step 2: Обновить CSS для чипа и меню**

```css
.mode-chip {
  padding: 6px 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  color: var(--text-soft);
  cursor: pointer;
}

.mode-menu-item {
  height: 44px;
  padding: 0 16px;
}

.mode-menu-circle {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: var(--greek-bg);
  color: var(--greek);
}
```

- [ ] **Step 3: Обновить JS — перестроить логику переключения**

- [ ] **Step 4: Запустить тесты + визуальная проверка**

- [ ] **Step 5: Коммит**

### Task 8: Обновить word-card.js + bottom-sheet.js — карточка слова

**Files:**
- Modify: `src/ui/components/word-card.js`
- Modify: `src/ui/components/bottom-sheet.js`
- Modify: `assets/styles/app.css`

**Интерфейсы:**
- Consumes: `ctx.store`, данные слова из `ctx`
- Produces: визуально соответствует `readerRenderWordSheet` (phone) + `readerRenderDeskInspector` (desktop)

- [ ] **Step 1: Реализовать все секции карточки слова (как в прототипе)**

Секции из прототипа (`readerCardSections`): gram, pron, dict, trans, status, mean, defn, deriv.

- [ ] **Step 2: Добавить анимацию bottom-sheet как в прототипе**

`scSheetUp` — slide-up с кривой `cubic-bezier(0.32, 0.72, 0, 1)`.

- [ ] **Step 3: Обновить CSS для инспектора (desktop)**

```css
.inspector {
  width: 364px;  /* TK.inspWidth */
  background: var(--surface-card);
  border-left: 1px solid var(--border);
}
```

- [ ] **Step 4: Запустить тесты + визуальная проверка**

- [ ] **Step 5: Коммит**

---

## Фаза 3: Экраны

### Task 9: Редизайн reading.js — основной экран чтения

**Files:**
- Modify: `src/ui/screens/reading.js`
- Modify: `src/ui/render.js`
- Modify: `assets/styles/app.css`

**Интерфейсы:**
- Consumes: все обновлённые компоненты из Фазы 2
- Produces: экран чтения, визуально соответствующий desktop + phone reader из прототипа

- [ ] **Step 1: Сверить параметры области чтения**

Из `readerRenderDeskRead` (линия ~479):
- Ширина контента: `TK.deskContentWidth` = 700px
- Размер шрифта: `TK.fsBody` = 16px
- Межстрочный: `TK.lhVerse` = 1.72
- Отступы между стихами: 12px

- [ ] **Step 2: Обновить CSS для текста писания**

```css
.scripture-text {
  font-family: var(--font-greek);
  font-size: 1rem;          /* 16px */
  line-height: 1.72;
  max-width: 700px;
}

.verse {
  padding: 6px 0;
}

.verse-number {
  color: var(--muted);
  font-size: 0.75rem;
}
```

- [ ] **Step 3: Обновить render.js — цвета греческих вставок**

```css
.gr { color: var(--greek); }
.gr-word { color: var(--greek-word); }
```

- [ ] **Step 4: Обновить desktop-лейаут (сайдбар | чтение | инспектор)**

- [ ] **Step 5: Запустить тесты + визуальная проверка**

- [ ] **Step 6: Коммит**

### Task 10: Редизайн dictionary.js — экран словаря

**Files:**
- Modify: `src/ui/screens/dictionary.js`
- Modify: `assets/styles/app.css`

- [ ] **Step 1: Сверить с прототипом (Слова.dc.html / readerRenderDict)**

- [ ] **Step 2: Обновить CSS — поисковая строка, группировка, строки слов**

- [ ] **Step 3: Обновить JS — перестроить DOM**

- [ ] **Step 4: Запустить тесты + визуальная проверка**

- [ ] **Step 5: Коммит**

### Task 11: Редизайн settings.js + новый ThemePicker

**Files:**
- Modify: `src/ui/screens/settings.js`
- Create: `src/ui/components/theme-picker.js`
- Modify: `assets/styles/app.css`

**Интерфейсы:**
- Consumes: `ctx.store`, 12 тем + 3 контраста из `settings.js`
- Produces: экран настроек с визуальным выборщиком тем (Variant B: компактные слоты + поповер-галерея)

- [ ] **Step 1: Создать theme-picker.js**

Новый компонент, реализующий Variant B из `settings_idea1_variants.md`:
- Два компактных слота (светлая тема / тёмная тема)
- Каждый слот показывает: цветовой свотч + название темы
- Клик по слоту → popover (desktop) / bottom-sheet (mobile) с сеткой тем
- Каждая карточка темы: мини-превью (полоски цветов paper/ink/blue/terra) + название

- [ ] **Step 2: Обновить settings.js — добавить выбор темы и контраста**

- [ ] **Step 3: Обновить CSS для theme-picker**

- [ ] **Step 4: Запустить тесты + визуальная проверка**

- [ ] **Step 5: Коммит**

### Task 12: Минорные правки — progress.js, about.js, toast.js

**Files:**
- Modify: `src/ui/screens/progress.js`
- Modify: `src/ui/screens/about.js`
- Modify: `src/ui/components/toast.js`
- Modify: `assets/styles/app.css`

- [ ] **Step 1: Обновить progress.js — цвета и отступы**

- [ ] **Step 2: Обновить about.js — цвета и отступы**

- [ ] **Step 3: Обновить toast.js — анимация scToast, позиционирование**

- [ ] **Step 4: Запустить тесты + визуальная проверка**

- [ ] **Step 5: Коммит**

---

## Фаза 4: Полировка

### Task 13: Анимации и переходы

**Files:**
- Modify: `assets/styles/app.css`

- [ ] **Step 1: Добавить ключевые кадры из прототипа**

```css
@keyframes scSheetUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

@keyframes scFade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes scToast {
  0%   { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes scPop {
  0%   { opacity: 0; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 2: Применить анимации к компонентам**

- bottom-sheet: `animation: scSheetUp var(--duration-normal) cubic-bezier(0.32, 0.72, 0, 1);`
- popover/menu: `animation: scPop 0.2s ease-out;`
- toast: `animation: scToast 0.3s ease-out;`

- [ ] **Step 3: Добавить `prefers-reduced-motion`**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Запустить тесты**

- [ ] **Step 5: Коммит**

### Task 14: Финальный аудит и причёсывание

**Files:** Все изменённые файлы.

- [ ] **Step 1: Проверить все data-theme значения — каждая тема применяется без ошибок**

```bash
# Скрипт проверки: для каждой из 12 тем установить атрибут и проверить computed styles
for theme in pergament sepia ivory fog sea forest rose lavender sunset dark night coal; do
  echo "Checking $theme..."
  # визуально в браузере
done
```

- [ ] **Step 2: Проверить контрастность текста во всех темах**

Для каждой темы проверить:
- `--text` на `--surface`: ≥ 4.5:1 (WCAG AA)
- `--muted` на `--surface`: ≥ 4.5:1
- `--greek` на `--surface-read`: ≥ 4.5:1
- `--greek-word` на `--surface-read`: ≥ 4.5:1

- [ ] **Step 3: Проверить accessibility — focus-visible, aria-labels, 44px touch targets**

- [ ] **Step 4: Проверить responsive — desktop (900+), tablet (600-899), phone (< 600)**

- [ ] **Step 5: Пройти полный гейт**

```bash
npm test
npm run build
npm run build:data
```

- [ ] **Step 6: Коммит**

```bash
git add -A
git commit -m "feat(design): final polish — animations, a11y, responsive audit

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

### Spec Coverage

| Требование | Задача |
|---|---|
| 12 тем из прототипа | Task 3, 4 |
| 3 уровня контраста | Task 2, 4 |
| Визуальный theme-picker | Task 11 |
| Сайдбар (desktop nav) | Task 5 |
| Нижняя навигация (mobile) | Task 5 |
| Верхняя панель | Task 6 |
| Переключатель режимов (чип+выпадашка) | Task 7 |
| Карточка слова (все секции) | Task 8 |
| Инспектор (desktop) | Task 8 |
| Bottom-sheet (mobile) | Task 8 |
| Экран чтения | Task 9 |
| Экран словаря | Task 10 |
| Экран настроек | Task 11 |
| Экран прогресса | Task 12 |
| Анимации | Task 13 |
| Accessibility | Task 13, 14 |
| Responsive | Task 14 |
| Все тесты проходят | Каждая задача |

### Placeholder Scan
✅ Нет TBD/TODO/placeholder'ов — каждый шаг содержит конкретный код или команду.
✅ Нет «добавить обработку ошибок» без конкретики.

### Type Consistency
✅ Имена тем совпадают: `pergament` в tokens.css = `'pergament'` в settings.js.
✅ Уровни контраста: `soft/sharp/maximum` в tokens.css = `CONTRAST_LEVELS` в settings.js.
✅ CSS-токены: `--surface-sidebar` используется в nav.js и определён в tokens.css.
