# Mode Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace dropdown mode selector + intensity slider with a single compact chip+popup widget managing all reading-mode state.

**Architecture:** New `mode-widget.js` component encapsulates chip and popup. `settings.js` gains migration (`migrateSettings`, `deriveMode`) converting old `mode:1-4` to new `wordMode`/`readingMode` fields while keeping `mode` as a derived integer for backward compatibility with `composeVerse`. `top-bar.js` and `reading.js` shed mode/slider code; `settings.js` screen drops mode/slider/show sections leaving only theme, diacritics, Strong numbers, and reset.

**Tech Stack:** Vanilla JS (ESM), CSS custom properties, existing `store.subscribe` pattern, existing `bottom-sheet.js`

---

### Task 1: settings.js — миграция и новые поля

**Files:**
- Modify: `src/state/settings.js`

- [ ] **Step 1: Обновить DEFAULTS и MODES**

Замени `DEFAULTS` и добавь `deriveMode` после `MODES`:

```js
export const MODES = [
  { id: 1, label: '1. Буквы + подсказки', group: 'Учебный мостик' },
  { id: 2, label: '2. Слова из словаря', group: 'Учебный мостик' },
  { id: 3, label: '3. Формы оригинала', group: 'Ближе к оригиналу' },
  { id: 4, label: '4. Почти оригинал', group: 'Ближе к оригиналу' },
];

/**
 * Вычисляет числовой mode из новых полей для обратной совместимости.
 * @param {object} s — settings с полями readingMode, wordMode, intensity
 * @returns {number} 1–4
 */
export function deriveMode(s) {
  if (s.readingMode === 'greek') return 4;
  if (s.wordMode === 'form') return 3;
  return 2; // 'lemma' — дефолт для 'mixed'
}

const DEFAULTS = {
  mode: DEFAULT_MODE,           // derived, пересчитывается deriveMode
  intensity: 35,                // 0..100
  wordMode: 'lemma',            // 'lemma' | 'form'
  readingMode: 'mixed',         // 'mixed' | 'greek'
  lastActiveTab: 'mixed',       // 'mixed' | 'greek'
  newWordsPerChapter: 3,        // 1 | 3 | 5 | 10
  pauseNewToday: false,
  show: {
    diacritics: false,
    strongs: false,
    ruHint: true
  },
  theme: 'auto',
  onboarded: false
};
```

- [ ] **Step 2: Добавить `migrateSettings` и обновить `loadSettings`**

Замени `loadSettings`:

```js
/**
 * Мигрирует старые настройки на новую схему (v1).
 * Старый формат: { mode: 1|2|3|4, intensity, show: { translit, gloss, grammar, ... } }
 * Новый формат: +wordMode, +readingMode, +lastActiveTab, mode=derived
 */
function migrateSettings(loaded) {
  if (loaded._schemaVersion === 1) return loaded;

  const migrated = { ...loaded, _schemaVersion: 1 };

  if (!migrated.wordMode) {
    migrated.wordMode = (loaded.mode === 3) ? 'form' : 'lemma';
  }
  if (!migrated.readingMode) {
    migrated.readingMode = (loaded.mode === 4) ? 'greek' : 'mixed';
  }
  if (!migrated.lastActiveTab) {
    migrated.lastActiveTab = 'mixed';
  }

  // Убираем старые поля show, которых больше нет в DEFAULTS
  if (migrated.show) {
    delete migrated.show.translit;
    delete migrated.show.gloss;
    delete migrated.show.grammar;
  }

  migrated.mode = deriveMode(migrated);
  return migrated;
}

export async function loadSettings() {
  try {
    const data = await db.get(KEY);
    if (!data) return migrateSettings({ ...DEFAULTS, show: { ...DEFAULTS.show } });
    const merged = {
      ...DEFAULTS,
      ...data,
      show: { ...DEFAULTS.show, ...(data.show || {}) }
    };
    return migrateSettings(merged);
  } catch (e) {
    console.warn('loadSettings error:', e);
    return migrateSettings({ ...DEFAULTS, show: { ...DEFAULTS.show } });
  }
}
```

- [ ] **Step 3: Запустить тесты, проверить сборку**

```bash
npm test
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/state/settings.js
git commit -m "feat: add migration, deriveMode, new DEFAULTS to settings"
```

---

### Task 2: mode-widget.js — новый компонент

**Files:**
- Create: `src/ui/components/mode-widget.js`

- [ ] **Step 1: Создать файл с полной реализацией**

```js
import { saveSettings, deriveMode } from '../../state/settings.js';
import { openBottomSheet, closeBottomSheet } from './bottom-sheet.js';
import { navigate } from '../../router.js';

const DB_SLIDER = 300;

/**
 * Создаёт виджет-чип + попап управления режимом чтения.
 * @param {object} ctx — { store }
 * @returns {{ chip: HTMLElement }}
 */
export function createModeWidget(ctx) {
  const { store } = ctx;

  // ---- Состояние ----
  let popup = null;
  let isOpen = false;
  let activeTab = 'mixed';      // 'mixed' | 'greek'
  let dictWordCount = -1;       // -1 = ещё не загружен
  let sliderDebounce = null;
  let savedActiveElement = null;

  // ---- Чип ----
  const chip = document.createElement('button');
  chip.className = 'mode-widget-chip';
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  chip.addEventListener('click', () => {
    if (isOpen) closePopup();
    else openPopup();
  });

  // ---- Попап (создаётся лениво при первом открытии) ----
  function buildPopup() {
    const state = store.get();
    const s = state.settings || {};
    activeTab = s.lastActiveTab || 'mixed';
    const grcAvail = state.grcAvailable !== false;

    const el = document.createElement('div');
    el.className = 'mode-widget-popup';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Настройки чтения');
    el.innerHTML = `
      <div class="mode-widget-tabs">
        <button class="mode-widget-tab" data-tab="mixed">Смешанный</button>
        <button class="mode-widget-tab" data-tab="greek">Греческий</button>
      </div>
      <div class="mode-widget-body" data-panel="mixed"></div>
      <div class="mode-widget-body" data-panel="greek" hidden></div>
    `;

    // Таб «Греческий» недоступен без греческого текста
    const greekTab = el.querySelector('[data-tab="greek"]');
    if (!grcAvail) {
      greekTab.disabled = true;
      greekTab.title = 'Греческий текст недоступен — нет сети или для этой книги нет греческого оригинала';
      if (activeTab === 'greek') activeTab = 'mixed';
    }

    // Табы
    const tabs = el.querySelectorAll('.mode-widget-tab');
    tabs.forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    // Панель «Смешанный»
    buildMixedPanel(el.querySelector('[data-panel="mixed"]'), s);
    // Панель «Греческий»
    buildGreekPanel(el.querySelector('[data-panel="greek"]'), s);

    switchTab(activeTab, /* silent */ true);

    return el;
  }

  // ---- Панель «Смешанный» ----
  function buildMixedPanel(panel, s) {
    const intensity = s.intensity ?? 35;
    const wordMode = s.wordMode ?? 'lemma';

    // Заголовок слайдера + мини-чип
    const sliderHeader = document.createElement('div');
    sliderHeader.className = 'mode-widget-slider-header';
    const sliderLabel = document.createElement('span');
    sliderLabel.textContent = 'Замена букв';
    const miniChip = document.createElement('span');
    miniChip.className = 'mode-widget-mini-chip';
    miniChip.textContent = `α${intensity}%`;
    sliderHeader.appendChild(sliderLabel);
    sliderHeader.appendChild(miniChip);
    panel.appendChild(sliderHeader);

    // Ползунок
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '5';
    slider.value = String(intensity);
    slider.setAttribute('aria-label', 'Интенсивность замены букв');
    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      miniChip.textContent = `α${val}%`;
      if (sliderDebounce) clearTimeout(sliderDebounce);
      sliderDebounce = setTimeout(() => {
        const st = store.get();
        const ns = { ...st.settings, intensity: val };
        ns.mode = deriveMode(ns);
        saveSettings(ns);
        store.update(s2 => ({ ...s2, settings: ns }));
        updateChip();
      }, DB_SLIDER);
    });
    panel.appendChild(slider);

    // Подписи под слайдером
    const sliderLabels = document.createElement('div');
    sliderLabels.className = 'mode-widget-slider-labels';
    sliderLabels.innerHTML = '<span>0% — чистый русский</span><span>100% — все буквы</span>';
    panel.appendChild(sliderLabels);

    // Разделитель
    const divider = document.createElement('hr');
    divider.className = 'mode-widget-divider';
    panel.appendChild(divider);

    // Тумблер «Замена слов»
    const toggleLabel = document.createElement('div');
    toggleLabel.className = 'mode-widget-toggle-label';
    toggleLabel.textContent = 'Замена слов';
    panel.appendChild(toggleLabel);

    const toggle = document.createElement('div');
    toggle.className = 'mode-widget-toggle';
    toggle.setAttribute('role', 'radiogroup');
    toggle.setAttribute('aria-label', 'Форма греческих слов');

    ['lemma', 'form'].forEach(mode => {
      const btn = document.createElement('button');
      btn.className = 'mode-widget-toggle-btn';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(mode === wordMode));
      btn.textContent = mode === 'lemma' ? 'Леммы' : 'Формы';
      btn.dataset.mode = mode;
      if (mode === wordMode) btn.classList.add('active');

      btn.addEventListener('click', () => {
        toggle.querySelectorAll('.mode-widget-toggle-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');

        const st = store.get();
        const ns = { ...st.settings, wordMode: mode };
        ns.mode = deriveMode(ns);
        saveSettings(ns);
        store.update(s2 => ({ ...s2, settings: ns }));
        updateChip();
        updateToggleHint(mode);
      });

      toggle.appendChild(btn);
    });
    panel.appendChild(toggle);

    // Подсказка под тумблером
    const hint = document.createElement('p');
    hint.className = 'mode-widget-hint';
    hint.id = 'mode-widget-word-hint';
    panel.appendChild(hint);
    updateToggleHint(wordMode);

    // Кнопка словаря
    const dictBtn = document.createElement('button');
    dictBtn.className = 'btn mode-widget-dict-btn';
    dictBtn.textContent = `📖 Словарь — выбрано ${Math.max(0, dictWordCount)} слов →`;
    dictBtn.addEventListener('click', () => {
      closePopup();
      navigate('#/dictionary');
    });
    panel.appendChild(dictBtn);
  }

  function updateToggleHint(mode) {
    const hint = document.getElementById('mode-widget-word-hint');
    if (!hint) return;
    const lemmaActive = mode === 'lemma';
    hint.innerHTML =
      '<span class="mw-hint-active">Леммы — как в словаре: λέγω  исходная форма, «говорить»</span><br>' +
      '<span class="mw-hint-dim">Формы — как в тексте: λέγει  с окончанием, «говорит»</span>';
    // Меняем классы: активная строка получает mw-hint-active, неактивная — mw-hint-dim
    if (!lemmaActive) {
      hint.innerHTML =
        '<span class="mw-hint-dim">Леммы — как в словаре: λέγω  исходная форма, «говорить»</span><br>' +
        '<span class="mw-hint-active">Формы — как в тексте: λέγει  с окончанием, «говорит»</span>';
    }
  }

  // ---- Панель «Греческий» ----
  function buildGreekPanel(panel, s) {
    const desc = document.createElement('p');
    desc.className = 'mode-widget-greek-desc';
    desc.textContent = 'Греческий текст Нового Завета как основной. Под каждым стихом — русский перевод мелким шрифтом.';
    panel.appendChild(desc);

    const label = document.createElement('label');
    label.className = 'mode-widget-checkbox';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = s.show?.ruHint !== false;
    cb.addEventListener('change', () => {
      const st = store.get();
      const ns = {
        ...st.settings,
        show: { ...st.settings.show, ruHint: cb.checked }
      };
      saveSettings(ns);
      store.update(s2 => ({ ...s2, settings: ns }));
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode('Показывать русский перевод под стихом'));
    panel.appendChild(label);

    const hint = document.createElement('p');
    hint.className = 'mode-widget-hint';
    hint.textContent = 'Нажмите на любое греческое слово — увидите перевод и разбор.';
    panel.appendChild(hint);
  }

  // ---- Переключение вкладок ----
  function switchTab(tab, silent) {
    activeTab = tab;
    const tabs = popup.querySelectorAll('.mode-widget-tab');
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    popup.querySelector('[data-panel="mixed"]').hidden = (tab !== 'mixed');
    popup.querySelector('[data-panel="greek"]').hidden = (tab !== 'greek');

    if (!silent) {
      const st = store.get();
      const ns = { ...st.settings, lastActiveTab: tab };
      saveSettings(ns);
      store.update(s2 => ({ ...s2, settings: ns }));
    }
  }

  // ---- Открытие / закрытие попапа ----
  let removeResize = null;
  let bottomSheetObserver = null;

  function openPopup() {
    if (isOpen) return;
    isOpen = true;
    savedActiveElement = document.activeElement;

    const isMobile = window.innerWidth < 900;
    popup = buildPopup();

    // Обновляем счётчик слов
    updateDictCount();

    if (isMobile) {
      openBottomSheet(popup);
      // Отслеживаем закрытие bottom-sheet пользователем (свайп/Escape/оверлей)
      const sheet = document.querySelector('.bottom-sheet');
      if (sheet && sheet.parentNode) {
        bottomSheetObserver = new MutationObserver(() => {
          if (!document.contains(sheet)) {
            isOpen = false;
            bottomSheetObserver.disconnect();
            bottomSheetObserver = null;
            cleanupPopup();
          }
        });
        bottomSheetObserver.observe(sheet.parentNode, { childList: true });
      }
    } else {
      // Десктоп: поповер рядом с чипом
      document.body.appendChild(popup);
      positionPopup();
      popup.classList.add('mode-widget-popup-visible');

      // Focus trap
      requestAnimationFrame(() => {
        const first = popup.querySelector('input, button');
        if (first) first.focus();
      });

      // Клик снаружи
      setTimeout(() => {
        document.addEventListener('click', onOutsideClick);
      }, 0);
    }

    // Escape
    document.addEventListener('keydown', onKeyDown);

    // Resize: закрыть попап при переходе через 900px
    let wasMobile = isMobile;
    removeResize = () => window.removeEventListener('resize', onResize);
    window.addEventListener('resize', onResize);
    function onResize() {
      const nowMobile = window.innerWidth < 900;
      if (nowMobile !== wasMobile && isOpen) {
        closePopup();
      }
    }

    updateChip();
  }

  function cleanupPopup() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', onOutsideClick);
    if (bottomSheetObserver) {
      bottomSheetObserver.disconnect();
      bottomSheetObserver = null;
    }
    if (removeResize) {
      removeResize();
      removeResize = null;
    }
    if (savedActiveElement) {
      savedActiveElement.focus();
      savedActiveElement = null;
    }
  }

  function closePopup() {
    if (!isOpen) return;
    isOpen = false;
    cleanupPopup();

    if (popup) {
      if (popup.closest('.bottom-sheet')) {
        closeBottomSheet();
      } else {
        popup.classList.remove('mode-widget-popup-visible');
        popup.remove();
      }
      popup = null;
    }
  }

  function onOutsideClick(e) {
    if (popup && !popup.contains(e.target) && e.target !== chip) {
      closePopup();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopup();
      return;
    }
    if (e.key === 'Tab' && popup) {
      trapFocus(e);
    }
  }

  function trapFocus(e) {
    const focusable = popup.querySelectorAll(
      'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function positionPopup() {
    if (!popup) return;
    const chipRect = chip.getBoundingClientRect();
    const popupWidth = 320;
    const left = Math.max(8, Math.min(chipRect.left, window.innerWidth - popupWidth - 8));
    popup.style.top = (chipRect.bottom + 6) + 'px';
    popup.style.left = left + 'px';
  }

  // ---- Обновление чипа ----
  function updateChip() {
    const state = store.get();
    const s = state.settings || {};
    const readingMode = s.readingMode || 'mixed';
    const intensity = s.intensity ?? 35;
    const wordMode = s.wordMode || 'lemma';
    const grcAvailable = state.grcAvailable !== false; // undefined = ещё не знаем → true
    const count = dictWordCount; // -1 = загрузка, 0+ = реальное число

    if (readingMode === 'greek') {
      chip.innerHTML = '<span class="mw-greek-label">Греч</span>';
      chip.setAttribute('aria-label', 'Режим: греческий оригинал');
      return;
    }

    // Загрузка
    if (count === -1) {
      chip.innerHTML = '<span class="mw-loading">…</span>';
      chip.setAttribute('aria-label', 'Загрузка данных…');
      return;
    }

    const showLetters = intensity > 0;
    const wordsExist = count > 0;

    // Ни букв, ни слов
    if (!showLetters && !wordsExist) {
      chip.innerHTML = '<span class="mw-rus-label">Рус</span>';
      chip.setAttribute('aria-label', 'Режим: чистый русский текст');
      return;
    }

    let html = '';
    if (showLetters) {
      html += `<span class="mw-alpha">α</span><span class="mw-pct">${intensity}%</span>`;
    }
    if (showLetters && wordsExist) {
      html += '<span class="mw-sep">·</span>';
    }
    if (wordsExist) {
      if (!grcAvailable) {
        // Греческий текст недоступен — показываем тире вместо слова+счётчика
        html += '<span class="mw-na">—</span>';
      } else {
        const indicator = wordMode === 'lemma' ? 'λέγω' : 'λέγει';
        html += `<span class="mw-word">${indicator}</span><span class="mw-count">${count}</span>`;
      }
    }

    chip.innerHTML = html;
    const desc = [];
    if (showLetters) desc.push(`буквы ${intensity}%`);
    if (wordsExist) {
      if (!grcAvailable) desc.push('греческий текст недоступен');
      else desc.push(`слова: ${wordMode === 'lemma' ? 'леммы' : 'формы'}, ${count} в словаре`);
    }
    chip.setAttribute('aria-label', `Режим чтения: ${desc.join('; ') || 'русский текст'}`);
  }

  function updateDictCount() {
    const state = store.get();
    const dict = state.dictionary || {};
    const core = state.coreLexicon || [];
    const freq = state.frequencyList || null;

    if (!state.dictionary || !state.coreLexicon) {
      dictWordCount = -1;
    } else {
      const coreById = new Map(core.map(l => [l.id, l]));
      const freqByStrong = new Map();
      if (freq) {
        for (const item of freq) freqByStrong.set(String(item.strong), item);
      }
      let c = 0;
      for (const [id, entry] of Object.entries(dict)) {
        if (!entry || entry.showInText === false) continue;
        if (entry.status !== 'new' && entry.status !== 'learning' && entry.status !== 'known') continue;
        const coreEntry = coreById.get(id);
        if (coreEntry) { c++; continue; }
        const strongKey = id.startsWith('freq-') ? id.replace('freq-', '') : null;
        if (strongKey && freqByStrong.get(strongKey)) { c++; }
      }
      dictWordCount = c;
    }
    updateChip();
    updateDictButton();
  }

  function updateDictButton() {
    if (!popup) return;
    const btn = popup.querySelector('.mode-widget-dict-btn');
    if (btn) {
      btn.textContent = `📖 Словарь — выбрано ${Math.max(0, dictWordCount)} слов →`;
    }
  }

  // ---- Подписка на store ----
  store.subscribe(['settings'], () => {
    updateChip(); // только чип — intensity/slider не влияет на счётчик слов
  });
  store.subscribe(['dictionary'], () => updateDictCount());
  store.subscribe(['coreLexicon'], () => updateDictCount());

  // Инициализация
  updateChip();
  updateDictCount();

  return { chip };
}
```

- [ ] **Step 2: Проверить что файл не имеет синтаксических ошибок**

```bash
node --check src/ui/components/mode-widget.js
```

Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/mode-widget.js
git commit -m "feat: add mode-widget component (chip + popup)"
```

---

### Task 3: top-bar.js — чистка

**Files:**
- Modify: `src/ui/components/top-bar.js`

- [ ] **Step 1: Убрать mode-селектор и импорт MODES**

Удали импорт `MODES` (строка 3). Убери создание `modeBtn`, `modeList`, `renderModeButton`, `renderModeList` и всех связанных обработчиков. Убери `store.subscribe(['settings'], () => renderModeButton())` и вызов `renderModeButton()`.

Замени строки 1–3:
```js
import { loadBooks } from '../../data/bible-loader.js';
import { navigate } from '../../router.js';
import { MODES, DEFAULT_MODE } from '../../state/settings.js';
```

На:
```js
import { loadBooks } from '../../data/bible-loader.js';
import { navigate } from '../../router.js';
```

Замени строки 26–78 (весь блок mode-селектора) — просто вырежи их.

Замени строки 157–163 (подписки и финальный рендер):
```js
  store.subscribe(['book'], () => renderBookButton());
  store.subscribe(['settings'], () => renderModeButton());

  // Изначальная отрисовка
  renderModeButton();

  return { bar, eyeBtn };
```

На:
```js
  store.subscribe(['book'], () => renderBookButton());

  return { bar, eyeBtn };
```

- [ ] **Step 2: Убедиться что book-selector и eyeBtn работают**

```bash
npm run build
```

Expected: сборка без ошибок

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/top-bar.js
git commit -m "refactor: remove mode selector from top-bar"
```

---

### Task 4: reading.js — интеграция mode-widget

**Files:**
- Modify: `src/ui/screens/reading.js`

- [ ] **Step 1: Заменить импорт**

Убери импорт `createIntensitySlider` (строка 9). Добавь импорт `createModeWidget`:

```js
import { createModeWidget } from '../components/mode-widget.js';
```

Строки 8–9 должно стать:
```js
import { createTopBar } from '../components/top-bar.js';
import { createModeWidget } from '../components/mode-widget.js';
```

- [ ] **Step 2: Заменить создание слайдера на создание виджета**

Убери строки 127–139 (создание `sliderContainer` + `createIntensitySlider`). Вместо них вставь:

```js
  // Mode widget (чип + попап)
  const { chip: modeChip } = createModeWidget({ store });
  bar.appendChild(modeChip);
```

- [ ] **Step 3: Обновить `buildWordEntries`**

Найди функцию `buildWordEntries` (около строки 534). Внутри неё, в строке где создаётся `wordEntry`:

Было (строка 579):
```js
      forms: entry.forms || 'lemma',
```

Замени на:
```js
      forms: entry.forms || settings.wordMode || 'lemma',
```

- [ ] **Step 4: Публиковать dictionary, coreLexicon, frequencyList, grcAvailable в store**

Найди в `mount()` строку около 107:
```js
  store.update(s => ({ ...s, settings, progress }));
```

Замени на (публикуем dictionary, coreLexicon, frequencyList чтобы mode-widget мог вычислить счётчик слов):
```js
  store.update(s => ({ ...s, settings, progress, dictionary, coreLexicon, frequencyList }));
```

После успешной загрузки греческого текста (около строк 156–157, после `buildGrcVerseMap()`) добавь:
```js
    store.update(s => ({ ...s, grcAvailable: true }));
```

В `ensureGreekBookLoaded` (около строки 66) после `buildGrcVerseMap()`:
```js
    store.update(s => ({ ...s, grcAvailable: true }));
```

- [ ] **Step 5: Собрать и проверить**

```bash
npm run build
```

Expected: сборка без ошибок

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/reading.js
git commit -m "refactor: integrate mode-widget, update buildWordEntries"
```

---

### Task 5: settings.js screen — чистка

**Files:**
- Modify: `src/ui/screens/settings.js`

- [ ] **Step 1: Убрать импорт MODES**

Строка 1:
```js
import { loadSettings, saveSettings, MODES } from '../../state/settings.js';
```
Замени на:
```js
import { loadSettings, saveSettings } from '../../state/settings.js';
```

- [ ] **Step 2: Переписать `render()`**

Замени `render()` (строки 23–51) — убираем вызовы `renderModeSection`, `renderIntensitySection`, `renderShowSection`, `renderWordsSection`:

```js
function render() {
  if (!container) return;
  container.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Настройки';
  container.appendChild(h2);

  // Тема
  renderThemeSection();

  // Диакритика и Стронг (из бывшего «Дополнительно» — теперь на виду)
  renderDisplaySection();

  // Сброс
  renderResetSection();
}
```

- [ ] **Step 3: Переименовать `renderAdvancedSection` в `renderDisplaySection`**

Убери `<details>` обёртку и оставь только diacritics и strongs:

```js
function renderDisplaySection() {
  const section = document.createElement('section');
  section.className = 'progress-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Показывать';
  section.appendChild(h3);

  // Диакритика
  const diacriticsLabel = document.createElement('label');
  diacriticsLabel.style.display = 'flex';
  diacriticsLabel.style.alignItems = 'center';
  diacriticsLabel.style.gap = '8px';
  diacriticsLabel.style.padding = '4px 0';
  const diacriticsCb = document.createElement('input');
  diacriticsCb.type = 'checkbox';
  diacriticsCb.checked = settings.show?.diacritics ?? false;
  diacriticsCb.addEventListener('change', () => {
    if (!settings.show) settings.show = {};
    settings.show.diacritics = diacriticsCb.checked;
    saveSettings(settings);
    store.update(s => ({ ...s, settings: { ...settings } }));
  });
  diacriticsLabel.appendChild(diacriticsCb);
  diacriticsLabel.appendChild(document.createTextNode('Показывать диакритику (ударения, придыхания)'));
  section.appendChild(diacriticsLabel);

  // Номера Стронга
  const strongsLabel = document.createElement('label');
  strongsLabel.style.display = 'flex';
  strongsLabel.style.alignItems = 'center';
  strongsLabel.style.gap = '8px';
  strongsLabel.style.padding = '4px 0';
  const strongsCb = document.createElement('input');
  strongsCb.type = 'checkbox';
  strongsCb.checked = settings.show?.strongs ?? false;
  strongsCb.addEventListener('change', () => {
    if (!settings.show) settings.show = {};
    settings.show.strongs = strongsCb.checked;
    saveSettings(settings);
    store.update(s => ({ ...s, settings: { ...settings } }));
  });
  strongsLabel.appendChild(strongsCb);
  strongsLabel.appendChild(document.createTextNode('Показывать номера Стронга (G3056)'));
  section.appendChild(strongsLabel);

  container.appendChild(section);
}
```

- [ ] **Step 4: Удалить старые функции**

Удали полностью:
- `renderModeSection()` (строки 53–98)
- `renderIntensitySection()` (строки 100–136)
- `renderWordsSection()` (строки 177–226)
- `renderShowSection()` (строки 228–257)
- `renderAdvancedSection()` (строки 259–327)

- [ ] **Step 5: Собрать и проверить**

```bash
npm run build
```

Expected: сборка без ошибок

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/settings.js
git commit -m "refactor: slim settings screen — remove mode, intensity, show sections"
```

---

### Task 6: Удалить intensity-slider.js

**Files:**
- Delete: `src/ui/components/intensity-slider.js`

- [ ] **Step 1: Удалить файл**

```bash
git rm src/ui/components/intensity-slider.js
```

- [ ] **Step 2: Убедиться что нигде нет импортов intensity-slider**

```bash
grep -r 'intensity-slider' src/
```

Expected: no results

- [ ] **Step 3: Собрать**

```bash
npm run build
```

Expected: сборка без ошибок

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: remove intensity-slider.js (logic moved to mode-widget)"
```

---

### Task 7: CSS — стили чипа и попапа

**Files:**
- Modify: `assets/styles/app.css`, `assets/styles/tokens.css`

- [ ] **Step 1: Удалить старые стили top-bar-slider и intensity-slider**

Найди и удали блоки:
- `.top-bar-slider` (строки 1158–1164)
- `.intensity-slider` (строки 1166–1174)
- `.intensity-slider input[type="range"]` (строки 1176–1178)
- `.intensity-value` (строки 1180–1183)

- [ ] **Step 2: Добавить `--font-greek` в tokens.css**

В `assets/styles/tokens.css`, в блок `:root, [data-theme="light"]` добавить после `--hint`:

```css
  --font-greek: 'Gentium Plus', serif;
```

Значение одинаковое для светлой и тёмной тем — шрифт один.

- [ ] **Step 3: Добавить стили для mode-widget**

Добавь в конец `assets/styles/app.css`:

```css
/* ---- Mode Widget Chip ---- */
.mode-widget-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-card);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 0.8125rem;
  line-height: 1.4;
  user-select: none;
  min-height: 32px;
}

.mode-widget-chip:hover {
  background: var(--selection);
}

.mode-widget-chip:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.mw-alpha {
  font-family: var(--font-greek, 'Gentium Plus', serif);
  font-size: 18px;
  font-weight: 500;
  color: var(--greek);
}

.mw-pct,
.mw-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--muted);
}

.mw-word {
  font-family: var(--font-greek, 'Gentium Plus', serif);
  font-size: 18px;
  font-weight: 500;
  color: var(--greek-word);
}

.mw-sep {
  color: var(--muted);
  margin: 0 1px;
}

.mw-greek-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--greek);
}

.mw-rus-label {
  font-size: 14px;
  font-weight: 400;
  color: var(--text);
}

.mw-loading {
  font-size: 16px;
  color: var(--muted);
}

.mw-na {
  font-size: 16px;
  color: var(--muted);
}

/* ---- Mode Widget Popup ---- */
.mode-widget-popup {
  position: fixed;
  z-index: 200;
  width: 320px;
  max-width: calc(100vw - 16px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.mode-widget-popup-visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* Когда внутри bottom-sheet — другие стили */
.bottom-sheet .mode-widget-popup {
  position: static;
  width: 100%;
  max-width: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

/* ---- Tabs ---- */
.mode-widget-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}

.mode-widget-tab {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.mode-widget-tab.active {
  color: var(--text);
  border-bottom-color: var(--greek);
}

.mode-widget-tab:hover {
  color: var(--text);
}

.mode-widget-tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- Body panels ---- */
.mode-widget-body {
  padding: 16px;
}

/* ---- Slider ---- */
.mode-widget-slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.875rem;
  color: var(--text);
}

.mode-widget-mini-chip {
  font-family: var(--font-greek, 'Gentium Plus', serif);
  font-size: 16px;
  color: var(--greek);
}

.mode-widget-body input[type="range"] {
  width: 100%;
  accent-color: var(--greek);
  margin: 0 0 4px 0;
}

.mode-widget-slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 4px;
}

/* ---- Divider ---- */
.mode-widget-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 16px 0;
}

/* ---- Toggle ---- */
.mode-widget-toggle-label {
  font-size: 0.875rem;
  color: var(--text);
  margin-bottom: 8px;
}

.mode-widget-toggle {
  display: flex;
  background: var(--surface-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  padding: 2px;
}

.mode-widget-toggle-btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.mode-widget-toggle-btn.active {
  background: var(--surface);
  color: var(--text);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* ---- Hint ---- */
.mode-widget-hint {
  font-size: 11px;
  color: var(--muted);
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.mw-hint-active {
  font-weight: 600;
  color: var(--text);
}

.mw-hint-dim {
  color: var(--muted);
}

/* ---- Dictionary button ---- */
.mode-widget-dict-btn {
  width: 100%;
  margin-top: 16px;
  padding: 10px;
  font-size: 0.875rem;
  text-align: left;
  background: var(--surface-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
}

.mode-widget-dict-btn:hover {
  background: var(--selection);
}

/* ---- Greek panel ---- */
.mode-widget-greek-desc {
  font-size: 13px;
  color: var(--text);
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.mode-widget-checkbox {
  font-size: 0.875rem;
  color: var(--text);
  cursor: pointer;
}
```

- [ ] **Step 4: Проверить что старые стили не сломали сборку**

```bash
npm run build
```

Expected: сборка без ошибок

- [ ] **Step 5: Commit**

```bash
git add assets/styles/app.css assets/styles/tokens.css
git commit -m "style: add mode-widget chip and popup styles, --font-greek token, remove old slider styles"
```

---

### Task 8: Финальная сборка и тесты

**Files:** все изменённые

- [ ] **Step 1: Полный прогон**

```bash
npm test && npm run build
```

Expected: тесты PASS, сборка без ошибок

- [ ] **Step 2: Проверить что нет битых импортов**

```bash
grep -r 'intensity-slider' src/ | grep -v 'node_modules'
grep -r "from '../../state/settings.js'" src/ --include='*.js' -l | xargs -r grep "MODES\|DEFAULT_MODE"
```

Expected: первый grep — пусто, второй — только если MODES/DEFAULT_MODE реально используется

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, build clean"
```
