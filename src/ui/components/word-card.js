/**
 * Карточка буквы / слова.
 * Единый компонент для поповера (десктоп) и bottom sheet (мобайл).
 */

import { formatMorphShort, formatMorphFull } from '../../engine/morphology.js';
import { stripDiacritics } from '../../engine/rules.js';

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

function rankBucket(rank) {
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
 *   — morph: string|null        (Робинсон-код, напр. "N-NSM")
 *   — freq: object|null         ({ rank, count } из частотного списка)
 *   — dictEntry: object|null    ({ status } из словаря пользователя)
 *   — lexemeId: string|null
 *   — strong: number|null
 *   — original: string|null     (исходное русское слово)
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
    gloss = null,
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

  const card = document.createElement('div');
  card.className = 'card word-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', `Карточка слова ${surfaceForm || lemma}`);

  // --- Верхняя строка: форма + частотность ---
  const topRow = document.createElement('div');
  topRow.className = 'word-card-top';

  const formEl = document.createElement('span');
  formEl.className = 'word-card-form';
  formEl.textContent = surfaceForm || lemma;
  formEl.id = 'word-card-title';
  topRow.appendChild(formEl);

  if (freqText) {
    const freqEl = document.createElement('span');
    freqEl.className = 'word-card-freq';
    freqEl.textContent = freqText;
    if (freqLabel) {
      freqEl.setAttribute('title', freqLabel);
      freqEl.setAttribute('aria-label', freqLabel);
    }
    topRow.appendChild(freqEl);
  }

  card.appendChild(topRow);

  // --- Строка произношения: транслитерация + аудио ---
  const pronRow = document.createElement('div');
  pronRow.className = 'word-card-pron';

  if (translit) {
    const translitEl = document.createElement('span');
    translitEl.className = 'word-card-translit';
    translitEl.textContent = translit;
    pronRow.appendChild(translitEl);
  }

  const audioBtn = document.createElement('button');
  audioBtn.className = 'word-card-audio';
  audioBtn.setAttribute('aria-label', `Прослушать произношение слова ${surfaceForm || lemma}`);
  audioBtn.setAttribute('disabled', '');
  audioBtn.textContent = '🔊';
  audioBtn.title = 'Произношение пока недоступно';
  pronRow.appendChild(audioBtn);

  card.appendChild(pronRow);

  // --- Контекстный перевод ---
  if (gloss) {
    const glossSection = document.createElement('div');
    glossSection.className = 'word-card-gloss-section';

    const glossEl = document.createElement('div');
    glossEl.className = 'word-card-gloss';
    glossEl.textContent = gloss;
    glossSection.appendChild(glossEl);

    const glossLabel = document.createElement('div');
    glossLabel.className = 'word-card-gloss-label';
    glossLabel.textContent = 'значение в этом стихе';
    glossSection.appendChild(glossLabel);

    card.appendChild(glossSection);
  }

  // --- Лемма (только когда форма отличается) ---
  if (formDiffers) {
    const lemmaSection = document.createElement('div');
    lemmaSection.className = 'word-card-lemma-section';

    // Формат: форма → лемма
    const formSpan = document.createElement('span');
    formSpan.className = 'word-card-surface';
    formSpan.textContent = surfaceForm;
    lemmaSection.appendChild(formSpan);

    const arrow = document.createElement('span');
    arrow.className = 'word-card-lemma-arrow';
    arrow.textContent = '→';
    lemmaSection.appendChild(arrow);

    const lemmaSpan = document.createElement('span');
    lemmaSpan.className = 'word-card-lemma';
    lemmaSpan.textContent = lemma;
    lemmaSection.appendChild(lemmaSpan);

    const labels = document.createElement('div');
    labels.className = 'word-card-lemma-labels';
    labels.innerHTML = '<span>в тексте</span><span>словарная форма</span>';
    lemmaSection.appendChild(labels);

    card.appendChild(lemmaSection);
  }

  // --- Морфология: чипы ---
  if (morphLabels.length > 0) {
    const morphRow = document.createElement('div');
    morphRow.className = 'word-card-morph';

    for (const label of morphLabels) {
      const chip = document.createElement('span');
      chip.className = 'morph-chip';
      chip.textContent = label;
      morphRow.appendChild(chip);
    }

    card.appendChild(morphRow);
  } else if (morph && morph !== '---') {
    // Не смогли разобрать по частям — показываем полную русскую строку
    const morphRow = document.createElement('div');
    morphRow.className = 'word-card-morph';
    morphRow.textContent = formatMorphFull(morph);
    card.appendChild(morphRow);
  }

  // Если морфологии нет вообще — не показываем пустой блок

  // --- Учебный статус ---
  const statusRow = document.createElement('div');
  statusRow.className = 'word-card-status';

  const statuses = [
    { key: 'new', label: 'Не помню', cls: 'status-new' },
    { key: 'learning', label: 'Учу', cls: 'status-learning' },
    { key: 'known', label: 'Знаю', cls: 'status-known' }
  ];

  for (const st of statuses) {
    const btn = document.createElement('button');
    btn.className = 'btn status-btn';
    btn.textContent = status === st.key ? `✓ ${st.label}` : st.label;
    btn.classList.add(st.cls);
    if (status === st.key) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      if (callbacks.onMarkStatus && lexemeId) {
        callbacks.onMarkStatus(lexemeId, st.key);
        // Визуальная реакция: обновляем все кнопки
        const allBtns = statusRow.querySelectorAll('.status-btn');
        allBtns.forEach(b => {
          b.classList.remove('active');
          b.textContent = b.textContent.replace('✓ ', '');
        });
        btn.classList.add('active');
        btn.textContent = `✓ ${st.label}`;
      }
    });
    statusRow.appendChild(btn);
  }

  card.appendChild(statusRow);

  // --- Подробнее ---
  const detailsBtn = document.createElement('button');
  detailsBtn.className = 'word-card-details-btn';
  detailsBtn.textContent = 'Подробнее →';
  detailsBtn.addEventListener('click', () => {
    if (callbacks.onShowDetails) callbacks.onShowDetails(lexemeId);
  });
  card.appendChild(detailsBtn);

  return card;
}
