# H1 · Тонкая полоска прогресса — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить тонкую горизонтальную полоску прогресса (3px) в mode-widget-chip, визуализирующую интенсивность замены букв.

**Architecture:** Три файла: tokens.css (новый токен `--greek-bar-track`), app.css (обновление стилей чипа + новые классы `.mw-bar`/`.mw-bar-fill`), mode-widget.js (реструктуризация `updateChip()` — текстовая строка и полоска внутри column flex).

**Tech Stack:** Vanilla JS (DOM API), CSS custom properties, без зависимостей.

---

### Task 1: Новый дизайн-токен `--greek-bar-track`

**Files:**
- Modify: `assets/styles/tokens.css`

- [ ] **Step 1: Добавить токен в светлую тему**

В секции `:root, [data-theme="light"]`, после строки `--greek-word: ...` (строка 42), добавить:

```css
  --greek-bar-track: rgba(38, 78, 131, 0.15);
```

- [ ] **Step 2: Добавить токен в тёмную тему**

В секции `[data-theme="dark"]`, после строки `--greek-word: ...` (строка 102), добавить:

```css
  --greek-bar-track: rgba(123, 163, 204, 0.15);
```

- [ ] **Step 3: Проверить синтаксис**

```bash
npx lightningcss --minify assets/styles/tokens.css > /dev/null && echo "OK"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add assets/styles/tokens.css
git commit -m "feat: add --greek-bar-track design token

- Light theme: rgba(38, 78, 131, 0.15)
- Dark theme: rgba(123, 163, 204, 0.15)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Обновление стилей чипа + новые классы полоски

**Files:**
- Modify: `assets/styles/app.css:1165-1236`

- [ ] **Step 1: Обновить `.mode-widget-chip`**

Заменить блок `.mode-widget-chip` (строки 1165–1179):

```css
.mode-widget-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-card);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1;
  user-select: none;
  min-height: 32px;
  justify-content: center;
}
```

Изменения: `flex-direction: column`, `align-items: stretch`, `gap: 0`, `padding: 6px 12px`, `border-radius: 8px`, `font-weight: 600`, `line-height: 1`, `justify-content: center`.

- [ ] **Step 2: Обновить `.mw-pct` и `.mw-count`**

Заменить блок `.mw-pct, .mw-count` (строки 1197–1202):

```css
.mw-pct,
.mw-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
}
```

Изменение: `font-size: 11px` → `12px`.

- [ ] **Step 3: Обновить `.mw-word`**

Заменить блок `.mw-word` (строки 1204–1209):

```css
.mw-word {
  font-family: var(--font-greek, 'Gentium Plus', serif);
  font-size: 14px;
  font-weight: 500;
  color: var(--greek-word);
}
```

Изменение: `font-size: 18px` → `14px`.

- [ ] **Step 4: Обновить `.mw-sep`**

Заменить блок `.mw-sep` (строки 1211–1214):

```css
.mw-sep {
  color: var(--muted);
  margin: 0 4px;
}
```

Изменение: `margin: 0 1px` → `margin: 0 4px`.

- [ ] **Step 5: Добавить `.mw-row` (строка текста внутри чипа)**

После блока `.mw-sep` (после строки 1214) добавить:

```css
.mw-row {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
```

- [ ] **Step 6: Добавить `.mw-bar` и `.mw-bar-fill` (полоска прогресса)**

После блока `.mw-row` добавить:

```css
.mw-bar {
  display: block;
  height: 3px;
  border-radius: 3px;
  background: var(--greek-bar-track);
  margin-top: 4px;
}

.mw-bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--greek);
  transition: width 0.2s ease;
}
```

- [ ] **Step 7: Проверить синтаксис CSS**

```bash
npx lightningcss --minify assets/styles/app.css > /dev/null && echo "OK"
```
Expected: `OK`

- [ ] **Step 8: Commit**

```bash
git add assets/styles/app.css
git commit -m "feat: update mode-widget-chip styles and add progress bar classes

- Chip: flex column, border-radius 8px, padding 6px 12px, font-weight 600, line-height 1
- Sizes: mw-pct/mw-count 12px, mw-word 14px, mw-sep margin 4px
- New: mw-row (inline-flex row), mw-bar (3px track), mw-bar-fill (animated fill)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: DOM-структура полоски в `updateChip()`

**Files:**
- Modify: `src/ui/components/mode-widget.js:433-489`

- [ ] **Step 1: Реструктурировать `updateChip()` — добавить row + bar**

Заменить функцию `updateChip()` (строки 432–489) на:

```javascript
  // ---- Обновление чипа ----
  function updateChip() {
    const state = store.get();
    const s = state.settings || {};
    const readingMode = s.readingMode || 'mixed';
    const intensity = s.intensity ?? 35;
    const wordLayer = s.wordLayer || 'off';
    const grcStatus = state.grcStatus || 'idle';
    const grcUnavailable = grcStatus === 'unavailable';
    const count = dictWordCount;

    if (readingMode === 'greek') {
      chip.innerHTML = '<span class="mw-greek-label">Греч</span>';
      chip.setAttribute('aria-label', 'Вид чтения: греческий оригинал');
      return;
    }

    if (count === -1) {
      chip.innerHTML = '<span class="mw-loading">…</span>';
      chip.setAttribute('aria-label', 'Загрузка данных…');
      return;
    }

    const showLetters = intensity > 0;
    const showWordLayer = wordLayer !== 'off';
    const activeWordsExist = count > 0;

    if (!showLetters && !showWordLayer) {
      chip.innerHTML = '<span class="mw-rus-label">Рус</span>';
      chip.setAttribute('aria-label', 'Греческий слой: выключен');
      return;
    }

    // Строим строку текста
    let rowHtml = '';
    if (showLetters) {
      rowHtml += `<span class="mw-alpha">α</span><span class="mw-pct">${intensity}%</span>`;
    }
    if (showLetters && showWordLayer) {
      rowHtml += '<span class="mw-sep">·</span>';
    }
    if (showWordLayer) {
      if (grcUnavailable && activeWordsExist) {
        rowHtml += '<span class="mw-na">—</span>';
      } else {
        const indicator = wordLayer === 'lemma' ? 'λέγω' : 'λέγει';
        rowHtml += `<span class="mw-word">${indicator}</span><span class="mw-count">${count}</span>`;
      }
    }

    // Строим полоску прогресса (только когда есть замена букв)
    const barHtml = `<div class="mw-bar"><div class="mw-bar-fill" style="width:${intensity}%"></div></div>`;

    chip.innerHTML = `<div class="mw-row">${rowHtml}</div>${barHtml}`;

    const desc = [];
    if (showLetters) desc.push(`буквы ${intensity}%`);
    if (showWordLayer) {
      if (grcUnavailable && activeWordsExist) desc.push('греческий текст недоступен');
      else desc.push(`слова: ${wordLayer === 'lemma' ? 'леммы' : 'формы'}, ${count} в словаре`);
    }
    chip.setAttribute('aria-label', `Греческий слой: ${desc.join('; ') || 'выключен'}`);
  }
```

- [ ] **Step 2: Запустить тесты**

```bash
npm test
```
Expected: все существующие тесты проходят.

- [ ] **Step 3: Проверить сборку**

```bash
npm run build
```
Expected: успешная сборка без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/mode-widget.js
git commit -m "feat: add H1 thin progress bar to mode-widget chip

- Wrap text in mw-row, add mw-bar with mw-bar-fill below
- Bar visible only when intensity > 0 (letter replacement active)
- Bar width = intensity%, animated via CSS transition

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Финальная проверка

- [ ] **Step 1: Полный прогон**

```bash
npm test && npm run build
```
Expected: всё зелено, сборка чистая.

- [ ] **Step 2: Визуальная проверка состояний чипа**

Запустить приложение, проверить все состояния чипа:
- `Рус` — нет полоски, текст по центру
- `α 35%` — полоска есть, залита на 35%
- `α 35% · λέγω N` — полоска есть, текст полный
- `α 35% · —` — полоска есть, слово заменено на прочерк
- `Греч` — нет полоски, тёмный фон

- [ ] **Step 3: Проверить анимацию**

Открыть попап, подвигать слайдер — полоска должна плавно менять ширину.

- [ ] **Step 4: Проверить тёмную тему**

Переключить тему — цвета полоски должны соответствовать тёмным токенам.
