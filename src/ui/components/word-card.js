/**
 * Карточка буквы / слова.
 * Единый компонент для поповера (десктоп) и bottom sheet (мобайл).
 */

import { formatMorphShort, formatMorphFull } from '../../engine/morphology.js';
import { stripDiacritics } from '../../engine/rules.js';
import { loadCardSettings, saveCardSettings, CARD_SECTIONS } from '../../state/card-settings.js';
import { renderWordStatusActions } from './word-status.js';

function sepDot() {
  const span = document.createElement('span');
  span.className = 'word-card-sep';
  span.textContent = '·';
  return span;
}

// === Вспомогательные функции ===

/**
 * Форматирует частотность для отображения.
 * @param {object|null} freq — { rank, count } или null
 * @returns {string|null}
 */
export function formatFrequency(freq) {
  if (!freq || !freq.count) return null;
  const formatted = new Intl.NumberFormat('ru-RU').format(freq.count);
  if (freq.rank) {
    const bucket = rankBucket(freq.rank);
    return `Топ-${bucket} · ${formatted}×`;
  }
  return `${formatted}× в НЗ`;
}

export function rankBucket(rank) {
  if (rank <= 10) return 10;
  if (rank <= 20) return 20;
  if (rank <= 50) return 50;
  if (rank <= 100) return 100;
  if (rank <= 200) return 200;
  if (rank <= 500) return 500;
  return 1000;
}

/**
 * Строит tooltip для частотности.
 * @param {object} freq
 * @param {string} lemma
 * @returns {string}
 */
function freqTooltip(freq, lemma) {
  if (!freq || !freq.count) return '';
  const l = lemma || 'слово';
  if (freq.rank) {
    return `Лемма ${l} входит в топ-${rankBucket(freq.rank)} наиболее частотных слов Нового Завета и встречается около ${freq.count} раз.`;
  }
  return `Лемма ${l} встречается около ${freq.count} раз в Новом Завете.`;
}

// === Карточка буквы ===

/**
 * @param {object} letter — { lower, upper, name, translit, sound, ruEquivalents }
 * @param {object} progressEntry — { status } или undefined
 * @param {function} onMarkKnown — callback для кнопки «Я знаю эту букву»
 * @returns {HTMLElement}
 */
export function renderLetterCard(letter, progressEntry, onMarkKnown) {
  const card = document.createElement('div');
  card.className = 'card word-card';

  const status = progressEntry?.status || null;

  card.innerHTML = `
    <div class="word-card-form">${letter.upper} ${letter.lower}</div>
    <div class="word-card-name">${letter.name}</div>
    <div class="word-card-sound">${letter.sound}</div>
    <div class="word-card-equiv">Ближе всего к русской «${letter.ruEquivalents[0]}»</div>
    <div class="word-card-actions"></div>
    <div class="word-card-disclaimer">Произношение — учебное приближение, не научная реконструкция.</div>
  `;

  const actions = card.querySelector('.word-card-actions');
  if (status === 'known') {
    const badge = document.createElement('span');
    badge.className = 'word-card-badge badge-known';
    badge.textContent = 'Освоена ✓';
    actions.appendChild(badge);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Я знаю эту букву';
    btn.addEventListener('click', () => {
      if (onMarkKnown) onMarkKnown(letter.lower);
      const badge = document.createElement('span');
      badge.className = 'word-card-badge badge-known';
      badge.textContent = 'Освоена ✓';
      btn.replaceWith(badge);
    });
    actions.appendChild(btn);
  }

  return card;
}

// === Карточка слова (режимы 3, 4, 5) ===

/**
 * @param {object} data
 *   — surfaceForm: string       (греческая форма из текста)
 *   — lemma: string             (словарная форма)
 *   — translit: string|null     (транслитерация леммы или формы)
 *   — gloss: string|null        (контекстный перевод)
 *   — senses: Array<{gloss, comment}>|null  (другие значения из UBS)
 *   — detail: {definition, derivation, pronunciation}|null  (подробности из Strong's)
 *   — morph: string|null        (Робинсон-код, напр. "N-NSM")
 *   — freq: object|null         ({ rank, count } из частотного списка)
 *   — dictEntry: object|null    ({ status } из словаря пользователя)
 *   — lexemeId: string|null
 *   — strong: number|null
 *   — original: string|null     (исходное слово перевода)
 * @param {object} callbacks
 *   — onMarkStatus: (lexemeId, newStatus) => void
 *   — onShowDetails: (lexemeId) => void
 * @returns {HTMLElement}
 */
export function renderWordCard(data, callbacks = {}) {
  const {
    surfaceForm = '',
    lemma = '',
    translit = null,
    ruGloss = null,
    ruTopWords = null,
    gloss = null,
    senses = null,
    glossesBerean = null,
    glossesCherith = null,
    detail = null,
    pos = null,
    autoSelectedRefs = null,
    morph = null,
    freq = null,
    dictEntry = null,
    lexemeId = null,
    strong = null,
    original = null
  } = data;

  const status = dictEntry?.status || null;
  const formDiffers = !!(surfaceForm && lemma &&
    stripDiacritics(surfaceForm).toLowerCase() !== stripDiacritics(lemma).toLowerCase());
  const morphLabels = formatMorphShort(morph);
  const freqText = formatFrequency(freq);
  const freqLabel = freqTooltip(freq, lemma);
  const pronunciation = detail?.pronunciation || null;

  const cardSettings = loadCardSettings();
  /** @type {Map<string, HTMLElement>} */
  const sectionEls = new Map();

  const card = document.createElement('div');
  card.className = 'card word-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', `Карточка слова ${surfaceForm || lemma}`);

  // --- Строка 1: греческая форма + частотность ---
  const formRow = document.createElement('div');
  formRow.className = 'word-card-form-row';
  const formEl = document.createElement('span');
  formEl.className = 'word-card-form';
  formEl.textContent = surfaceForm || lemma;
  formEl.id = 'word-card-title';
  formEl.setAttribute('lang', 'el');
  formRow.appendChild(formEl);

  if (freqText) {
    const freqEl = document.createElement('span');
    freqEl.className = 'word-card-freq';
    freqEl.textContent = freqText;
    if (freqLabel) {
      freqEl.setAttribute('title', freqLabel);
      freqEl.setAttribute('aria-label', freqLabel);
    }
    formRow.appendChild(freqEl);
  }

  card.appendChild(formRow);

  // --- Строка 2: грамматика (часть речи · Стронг · морфология) ---
  const grammarRow = document.createElement('div');
  grammarRow.className = 'word-card-meta';
  sectionEls.set('grammar', grammarRow);
  if (!cardSettings.grammar) grammarRow.style.display = 'none';

  if (pos) {
    const posEl = document.createElement('span');
    posEl.className = 'word-card-pos';
    posEl.textContent = pos;
    grammarRow.appendChild(posEl);
  }

  if (strong) {
    if (grammarRow.children.length > 0) grammarRow.appendChild(sepDot());
    const strongEl = document.createElement('span');
    strongEl.className = 'word-card-strong';
    strongEl.textContent = `G${strong}`;
    strongEl.setAttribute('title', `Номер Стронга G${strong}`);
    grammarRow.appendChild(strongEl);
  }

  // Морфологические чипы здесь же
  if (morphLabels.length > 0) {
    if (grammarRow.children.length > 0) grammarRow.appendChild(sepDot());
    grammarRow.setAttribute('title', formatMorphFull(morph));
    for (const label of morphLabels) {
      const chip = document.createElement('span');
      chip.className = 'morph-chip';
      chip.textContent = label;
      grammarRow.appendChild(chip);
    }
  } else if (morph && morph !== '---') {
    if (grammarRow.children.length > 0) grammarRow.appendChild(sepDot());
    grammarRow.setAttribute('title', formatMorphFull(morph));
    const fallback = document.createElement('span');
    fallback.className = 'morph-chip';
    fallback.textContent = formatMorphFull(morph);
    grammarRow.appendChild(fallback);
  }

  card.appendChild(grammarRow);

  // --- Строка 3: транслитерация / произношение + аудио ---
  const pronRow = document.createElement('div');
  pronRow.className = 'word-card-pron';
  sectionEls.set('pron', pronRow);
  if (!cardSettings.pron) pronRow.style.display = 'none';

  if (translit) {
    const translitEl = document.createElement('span');
    translitEl.className = 'word-card-translit';
    translitEl.textContent = translit;
    pronRow.appendChild(translitEl);
  }

  if (translit && pronunciation) {
    const slash = document.createElement('span');
    slash.className = 'word-card-pron-slash';
    slash.textContent = '/';
    pronRow.appendChild(slash);
  }

  if (pronunciation) {
    const pronEl = document.createElement('span');
    pronEl.className = 'word-card-pronunciation';
    pronEl.textContent = pronunciation;
    pronRow.appendChild(pronEl);
  }

  const audioBtn = document.createElement('button');
  audioBtn.className = 'word-card-audio';
  audioBtn.setAttribute('aria-label', `Прослушать произношение слова ${surfaceForm || lemma}`);
  audioBtn.setAttribute('disabled', '');
  audioBtn.title = 'Произношение пока недоступно';
  audioBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  pronRow.appendChild(audioBtn);

  card.appendChild(pronRow);

  // --- Исходное слово в этом стихе ---
  if (original) {
    const inlineSection = document.createElement('div');
    inlineSection.className = 'word-card-inline';
    sectionEls.set('inline', inlineSection);
    if (!cardSettings.inline) inlineSection.style.display = 'none';

    const inlineLabel = document.createElement('div');
    inlineLabel.className = 'word-card-inline-label';
    inlineLabel.textContent = 'в этом стихе';
    inlineSection.appendChild(inlineLabel);

    const inlineWord = document.createElement('div');
    inlineWord.className = 'word-card-inline-word';
    inlineWord.textContent = original;
    inlineSection.appendChild(inlineWord);

    card.appendChild(inlineSection);
  }

  // --- Русское значение ---
  if (ruGloss) {
    const ruSection = document.createElement('div');
    ruSection.className = 'word-card-info-block';
    sectionEls.set('ruGloss', ruSection);
    if (!cardSettings.ruGloss) ruSection.style.display = 'none';

    const ruLabel = document.createElement('div');
    ruLabel.className = 'word-card-info-label';
    ruLabel.textContent = 'русское значение';
    ruSection.appendChild(ruLabel);

    const ruText = document.createElement('div');
    ruText.className = 'word-card-info-text';
    const parts = [ruGloss];
    if (ruTopWords && ruTopWords.length > 0) {
      for (const w of ruTopWords) {
        if (w && w !== ruGloss) parts.push(w);
      }
    }
    // Dedup keeping order
    const seen = new Set();
    ruText.textContent = parts.filter(w => { const ok = !seen.has(w); seen.add(w); return ok; }).join(', ');
    ruSection.appendChild(ruText);

    card.appendChild(ruSection);
  }

  // --- Другие значения (gloss из core.json + UBS senses) ---
  {
    const alreadyShown = original ? original.toLowerCase().trim() : '';

    const candidates = [];
    // Collect all unique glosses from all sources
    const glossSources = [];
    if (gloss) glossSources.push(gloss);
    if (glossesBerean) glossSources.push(...glossesBerean);
    if (glossesCherith) glossSources.push(...glossesCherith);

    const glossSeen = new Set();
    for (const g of glossSources) {
      for (const part of g.split(/[,;]\s*/)) {
        const w = part.trim();
        // Normalise: strip bracket artefacts like "[The] book" → "book"
        const clean = w.replace(/^\[.*?\]\s*/, '').trim();
        const key = clean.toLowerCase();
        if (clean && key !== alreadyShown && !glossSeen.has(key)) {
          glossSeen.add(key);
          candidates.push({ gloss: clean, comment: 'словарное значение' });
        }
      }
    }
    if (senses) {
      for (const s of senses) {
        const senseWords = s.gloss.toLowerCase().split(/[,;]\s*/).map(w => w.trim());
        if (!senseWords.includes(alreadyShown)) {
          candidates.push(s);
        }
      }
    }

    if (candidates.length > 0) {
      const seen = new Set();
      const parts = [];
      for (const c of candidates.slice(0, 6)) {
        const key = c.gloss.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        parts.push(c.gloss);
      }

      const block = document.createElement('div');
      block.className = 'word-card-info-block';
      sectionEls.set('senses', block);
      if (!cardSettings.senses) block.style.display = 'none';

      const label = document.createElement('div');
      label.className = 'word-card-info-label';
      label.textContent = 'также означает';
      block.appendChild(label);

      const text = document.createElement('div');
      text.className = 'word-card-info-text';
      text.textContent = parts.join(', ');
      block.appendChild(text);

      card.appendChild(block);
    }
  }

  // --- Где встречается (autoSelectedRefs) ---
  if (autoSelectedRefs && autoSelectedRefs.length > 0) {
    const reasonLabel = {
      'first-occurrence': 'первое появление',
      'common-surface-form': 'частая форма',
      'different-book': 'другая книга',
      'distinct-morphology': 'другая морфология'
    };

    const refsSection = document.createElement('div');
    refsSection.className = 'word-card-info-block';
    sectionEls.set('refs', refsSection);
    if (!cardSettings.refs) refsSection.style.display = 'none';

    const refsLabel = document.createElement('div');
    refsLabel.className = 'word-card-info-label';
    refsLabel.textContent = 'в Новом Завете';
    refsSection.appendChild(refsLabel);

    const list = document.createElement('div');
    list.className = 'word-card-info-text';
    const items = [];
    for (const entry of autoSelectedRefs.slice(0, 5)) {
      const reason = reasonLabel[entry.reason] || entry.reason;
      items.push(`${entry.ref} (${reason})`);
    }
    list.textContent = items.join(', ');
    refsSection.appendChild(list);

    card.appendChild(refsSection);
  }

  // --- Лемма (только когда форма отличается) ---
  // Сетка 2×3: верхний ряд — слова со стрелкой →, нижний — подписи со стрелкой →
  if (formDiffers) {
    const lemmaSection = document.createElement('div');
    lemmaSection.className = 'word-card-lemma-section';
    sectionEls.set('lemma', lemmaSection);
    if (!cardSettings.lemma) lemmaSection.style.display = 'none';

    const grid = document.createElement('div');
    grid.className = 'word-card-lemma-grid';

    // Ряд 1: surfaceForm  →  lemma
    const surfaceEl = document.createElement('span');
    surfaceEl.className = 'word-card-surface';
    surfaceEl.textContent = surfaceForm;
    surfaceEl.setAttribute('lang', 'el');
    grid.appendChild(surfaceEl);

    const arrow1 = document.createElement('span');
    arrow1.className = 'word-card-lemma-arrow';
    arrow1.textContent = '→';
    grid.appendChild(arrow1);

    const lemmaEl = document.createElement('span');
    lemmaEl.className = 'word-card-lemma';
    lemmaEl.textContent = lemma;
    lemmaEl.setAttribute('lang', 'el');
    grid.appendChild(lemmaEl);

    // Ряд 2: в тексте  →  словарная форма
    const labelLeft = document.createElement('span');
    labelLeft.className = 'word-card-lemma-label';
    labelLeft.textContent = 'в тексте';
    grid.appendChild(labelLeft);

    const arrow2 = document.createElement('span');
    arrow2.className = 'word-card-lemma-arrow';
    arrow2.textContent = '→';
    grid.appendChild(arrow2);

    const labelRight = document.createElement('span');
    labelRight.className = 'word-card-lemma-label';
    labelRight.textContent = 'словарная форма';
    grid.appendChild(labelRight);

    lemmaSection.appendChild(grid);
    card.appendChild(lemmaSection);
  }


  // --- Учебный статус ---
  const statusRow = renderWordStatusActions(status, { lexemeId, onMarkStatus: callbacks.onMarkStatus });
  sectionEls.set('status', statusRow);
  if (!cardSettings.status) statusRow.style.display = 'none';
  card.appendChild(statusRow);

  // --- Определение ---
  if (detail?.definition) {
    const block = document.createElement('div');
    block.className = 'word-card-info-block';
    sectionEls.set('definition', block);
    if (!cardSettings.definition) block.style.display = 'none';

    const label = document.createElement('div');
    label.className = 'word-card-info-label';
    label.textContent = 'определение';
    block.appendChild(label);
    const text = document.createElement('div');
    text.className = 'word-card-info-text';
    text.textContent = detail.definition;
    block.appendChild(text);
    card.appendChild(block);
  }

  // --- Происхождение ---
  if (detail?.derivation) {
    const block = document.createElement('div');
    block.className = 'word-card-info-block';
    sectionEls.set('derivation', block);
    if (!cardSettings.derivation) block.style.display = 'none';

    const label = document.createElement('div');
    label.className = 'word-card-info-label';
    label.textContent = 'происхождение';
    block.appendChild(label);
    const text = document.createElement('div');
    text.className = 'word-card-info-text';
    text.textContent = detail.derivation;
    block.appendChild(text);
    card.appendChild(block);
  }

  // Расставляем секции в сохранённом порядке (кроме formRow — всегда первый, gearBtn — всегда последний)
  reorderCardSections(card, sectionEls, cardSettings.order);

  // --- Шестерёнка настроек ---
  const gearBtn = document.createElement('button');
  gearBtn.className = 'card-gear-btn';
  gearBtn.setAttribute('aria-label', 'Настройки карточки');
  gearBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  gearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = card.querySelector('.card-gear-dropdown');
    if (existing) {
      existing.remove();
      return;
    }
    showGearDropdown(card, sectionEls, gearBtn, cardSettings);
  });
  card.appendChild(gearBtn);

  return card;
}

function showGearDropdown(card, sectionEls, anchor, settings) {
  const dropdown = document.createElement('div');
  dropdown.className = 'card-gear-dropdown';

  let dragSrc = null;

  // Строки в сохранённом порядке
  const order = settings.order || CARD_SECTIONS.map(s => s.key);
  const labelMap = Object.fromEntries(CARD_SECTIONS.map(s => [s.key, s.label]));

  function buildRows() {
    dropdown.innerHTML = '';
    for (const key of order) {
      const label = labelMap[key];
      if (!label) continue;

      const id = `gear-${key}-${Math.random().toString(36).slice(2,6)}`;

      const row = document.createElement('div');
      row.className = 'card-gear-row';
      row.setAttribute('draggable', 'true');
      row.setAttribute('data-gear-key', key);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.checked = settings[key];
      cb.addEventListener('change', () => {
        settings[key] = cb.checked;
        saveCardSettings(settings);
        const el = sectionEls.get(key);
        if (el) el.style.display = cb.checked ? '' : 'none';
      });

      const lbl = document.createElement('label');
      lbl.setAttribute('for', id);
      lbl.textContent = label;

      row.appendChild(cb);
      row.appendChild(lbl);

      // Drag handle справа
      const handle = document.createElement('span');
      handle.className = 'card-gear-handle';
      handle.textContent = '⠿';
      row.appendChild(handle);

      // Drag events
      row.addEventListener('dragstart', (e) => {
        dragSrc = row;
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        dragSrc = null;
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragSrc || dragSrc === row) return;
        const srcKey = dragSrc.getAttribute('data-gear-key');
        const dstKey = row.getAttribute('data-gear-key');
        const srcIdx = order.indexOf(srcKey);
        const dstIdx = order.indexOf(dstKey);
        order.splice(srcIdx, 1);
        order.splice(dstIdx, 0, srcKey);
        settings.order = order;
        saveCardSettings(settings);
        reorderCardSections(card, sectionEls, order);
        buildRows();
      });

      dropdown.appendChild(row);
    }
  }

  buildRows();

  function closeHandler(e) {
    if (!dropdown.contains(e.target) && e.target !== anchor) {
      dropdown.remove();
      document.removeEventListener('click', closeHandler);
    }
  }
  setTimeout(() => document.addEventListener('click', closeHandler), 0);

  card.appendChild(dropdown);
}

function reorderCardSections(card, sectionEls, order) {
  // formRow всегда первый, gearBtn всегда последний — их не трогаем
  const formRow = card.querySelector('.word-card-form-row');
  const gearBtn = card.querySelector('.card-gear-btn');
  let anchor = formRow;
  for (const key of order) {
    const el = sectionEls.get(key);
    if (el && el.parentElement === card) {
      anchor.after(el);
      anchor = el;
    }
  }
  // gearBtn в конец
  if (gearBtn) {
    anchor.after(gearBtn);
  }
}
