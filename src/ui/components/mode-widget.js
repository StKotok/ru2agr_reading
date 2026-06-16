import { saveSettings } from '../../state/settings.js';
import { countActiveWords } from '../../state/dictionary.js';
import { openBottomSheet, closeBottomSheet } from './bottom-sheet.js';
import { navigate } from '../../router.js';

// 300ms debounce перед сохранением слайдера в IndexedDB
const DB_SLIDER = 300;

/**
 * Создаёт виджет-чип + попап управления греческим слоем.
 * @param {object} ctx — { store }
 * @returns {{ chip: HTMLElement, destroy: Function }}
 */
export function createModeWidget(ctx) {
  const { store, onChange } = ctx;

  // ---- Состояние ----
  let popup = null;
  let isOpen = false;
  let activeTab = 'mixed';
  let dictWordCount = -1;
  let sliderDebounce = null;
  let savedActiveElement = null;
  let outsideClickTimer = null;

  // ---- Чип ----
  const chip = document.createElement('button');
  chip.className = 'mode-widget-chip';
  chip.addEventListener('click', () => {
    if (isOpen) closePopup();
    else openPopup();
  });

  // ---- Хелпер: сохранить патч настроек ----
  function persistSetting(patch) {
    const st = store.get();
    const ns = { ...st.settings, ...patch };
    saveSettings(ns);
    store.update(s2 => ({ ...s2, settings: ns }));
    return ns;
  }

  // ---- Попап (создаётся лениво при первом открытии) ----
  function buildPopup() {
    const state = store.get();
    const s = state.settings || {};
    activeTab = s.readingMode === 'greek' ? 'greek' : 'mixed';
    const grcStatus = state.grcStatus || 'idle';
    const greekDisabled = grcStatus === 'unavailable';

    const isMobile = window.innerWidth < 900;
    const el = document.createElement('div');
    el.className = 'mode-widget-popup';
    if (!isMobile) {
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Настройки чтения');
    }
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
    if (greekDisabled) {
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

    switchTab(activeTab, /* silent */ true, el);

    return el;
  }

  // ---- Панель «Смешанный» ----
  function buildMixedPanel(panel, s) {
    const intensity = s.intensity ?? 35;
    const wordLayer = s.wordLayer ?? 'off';

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
        saveSettings(ns);
        store.update(s2 => ({ ...s2, settings: ns }));
        updateChip();
        if (onChange) onChange(ns);
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

    [
      { value: 'off', label: 'Выкл' },
      { value: 'lemma', label: 'Леммы' },
      { value: 'form', label: 'Формы' }
    ].forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'mode-widget-toggle-btn';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(opt.value === wordLayer));
      btn.textContent = opt.label;
      btn.dataset.wordLayer = opt.value;
      if (opt.value === wordLayer) btn.classList.add('active');

      btn.addEventListener('click', () => {
        toggle.querySelectorAll('.mode-widget-toggle-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');

        const ns = persistSetting({ wordLayer: opt.value });
        updateChip();
        updateToggleHint(opt.value);
        if (onChange) onChange(ns);
      });

      toggle.appendChild(btn);
    });
    panel.appendChild(toggle);

    // Подсказка под тумблером
    const hint = document.createElement('p');
    hint.className = 'mode-widget-hint';
    hint.id = 'mode-widget-word-hint';
    hint.innerHTML =
      '<span class="mw-hint-off">Выкл — только буквы, без загрузки греческих слов</span><br>' +
      '<span class="mw-hint-lemma">Леммы — как в словаре: λέγω  исходная форма, «говорить»</span><br>' +
      '<span class="mw-hint-form">Формы — как в тексте: λέγει  с окончанием, «говорит»</span>';
    panel.appendChild(hint);
    updateToggleHint(wordLayer);

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

  function updateToggleHint(layer) {
    const hint = document.getElementById('mode-widget-word-hint');
    if (!hint) return;
    const offLine = hint.querySelector('.mw-hint-off');
    const lemmaLine = hint.querySelector('.mw-hint-lemma');
    const formLine = hint.querySelector('.mw-hint-form');
    if (!offLine || !lemmaLine || !formLine) return;
    offLine.className = 'mw-hint-off ' + (layer === 'off' ? 'mw-hint-active' : 'mw-hint-dim');
    lemmaLine.className = 'mw-hint-lemma ' + (layer === 'lemma' ? 'mw-hint-active' : 'mw-hint-dim');
    formLine.className = 'mw-hint-form ' + (layer === 'form' ? 'mw-hint-active' : 'mw-hint-dim');
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
      persistSetting({ show: { ...st.settings.show, ruHint: cb.checked } });
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
  function switchTab(tab, silent, root) {
    activeTab = tab;
    const el = root || popup;
    const tabs = el.querySelectorAll('.mode-widget-tab');
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    el.querySelector('[data-panel="mixed"]').hidden = (tab !== 'mixed');
    el.querySelector('[data-panel="greek"]').hidden = (tab !== 'greek');

    if (!silent) {
      const ns = persistSetting({ readingMode: tab === 'greek' ? 'greek' : 'mixed' });
      if (onChange) onChange(ns);
    }
  }

  // ---- Открытие / закрытие попапа ----
  let removeResize = null;
  let bottomSheetObserver = null;
  let wasMobileOnOpen = false;

  function onResize() {
    const nowMobile = window.innerWidth < 900;
    if (nowMobile !== wasMobileOnOpen && isOpen) {
      closePopup();
    }
  }

  function openPopup() {
    if (isOpen) return;
    isOpen = true;
    savedActiveElement = document.activeElement;

    wasMobileOnOpen = window.innerWidth < 900;
    popup = buildPopup();

    updateDictCount();

    if (wasMobileOnOpen) {
      openBottomSheet(popup);
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
      document.body.appendChild(popup);
      positionPopup();
      popup.classList.add('mode-widget-popup-visible');

      requestAnimationFrame(() => {
        const first = popup.querySelector('input, button');
        if (first) first.focus();
      });

      outsideClickTimer = setTimeout(() => {
        outsideClickTimer = null;
        if (isOpen) document.addEventListener('click', onOutsideClick);
      }, 0);
    }

    document.addEventListener('keydown', onKeyDown);

    removeResize = () => window.removeEventListener('resize', onResize);
    window.addEventListener('resize', onResize);

    updateChip();
  }

  function cleanupPopup() {
    if (outsideClickTimer) {
      clearTimeout(outsideClickTimer);
      outsideClickTimer = null;
    }
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
    popup = null;
  }

  function closePopup() {
    if (!isOpen) return;
    isOpen = false;
    const currentPopup = popup;
    cleanupPopup();

    if (currentPopup) {
      if (currentPopup.closest('.bottom-sheet')) {
        closeBottomSheet();
      } else {
        currentPopup.classList.remove('mode-widget-popup-visible');
        currentPopup.remove();
      }
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

    let html = '';
    if (showLetters) {
      html += `<span class="mw-alpha">α</span><span class="mw-pct">${intensity}%</span>`;
    }
    if (showLetters && showWordLayer) {
      html += '<span class="mw-sep">·</span>';
    }
    if (showWordLayer) {
      if (grcUnavailable && activeWordsExist) {
        html += '<span class="mw-na">—</span>';
      } else {
        const indicator = wordLayer === 'lemma' ? 'λέγω' : 'λέγει';
        html += `<span class="mw-word">${indicator}</span><span class="mw-count">${count}</span>`;
      }
    }

    chip.innerHTML = html;
    const desc = [];
    if (showLetters) desc.push(`буквы ${intensity}%`);
    if (showWordLayer) {
      if (grcUnavailable && activeWordsExist) desc.push('греческий текст недоступен');
      else desc.push(`слова: ${wordLayer === 'lemma' ? 'леммы' : 'формы'}, ${count} в словаре`);
    }
    chip.setAttribute('aria-label', `Греческий слой: ${desc.join('; ') || 'выключен'}`);
  }

  function updateDictCount() {
    const state = store.get();
    if (!state.dictionary || !state.coreLexicon) {
      dictWordCount = -1;
    } else {
      dictWordCount = countActiveWords(state.dictionary, state.coreLexicon, state.frequencyList);
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
  const unsubs = [
    store.subscribe(['settings'], () => {
      updateChip();
    }),
    store.subscribe(['dictionary'], () => updateDictCount()),
    store.subscribe(['coreLexicon'], () => updateDictCount()),
    store.subscribe(['grcStatus'], () => updateChip())
  ];

  function destroy() {
    closePopup();
    unsubs.forEach(fn => fn());
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', onOutsideClick);
    if (removeResize) { removeResize(); removeResize = null; }
    if (bottomSheetObserver) { bottomSheetObserver.disconnect(); bottomSheetObserver = null; }
  }

  // Инициализация
  updateChip();
  updateDictCount();

  return { chip, destroy };
}
