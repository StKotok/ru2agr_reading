/**
 * Десктопная правая панель — инспектор слова/буквы.
 * Дизайн соответствует прототипу (readerRenderDeskInspector).
 * Поддерживает ресайз перетаскиванием левого края и закрытие.
 * Ширина, видимость и последняя открытая карточка сохраняются
 * индивидуально для каждой страницы.
 */

import { iconX } from './icons.js';

const STORAGE_PREFIX = 'inspector:';

let panelEl = null;
let dragState = null;
let currentPage = null;

/** Карточки, открытые на каждой странице (детach из DOM при уходе со страницы) */
const pageCards = new Map(); // page -> HTMLElement | null

/**
 * Создаёт или возвращает панель инспектора.
 * При смене страницы сохраняет текущую карточку и восстанавливает сохранённую.
 * @param {HTMLElement} parent — контейнер для вставки панели
 * @param {string} [page] — ключ страницы ('reading', 'dictionary', ...)
 * @returns {HTMLElement}
 */
export function getInspectorPanel(parent, page) {
  const pageChanged = page && page !== currentPage;

  if (!panelEl) {
    panelEl = document.createElement('aside');
    panelEl.className = 'inspector-panel';
    panelEl.setAttribute('aria-label', 'Инспектор слова');

    // ── Кнопка закрытия (X) — как в прототипе: 32×32, border-radius 10 ──
    const closeBtn = document.createElement('button');
    closeBtn.className = 'inspector-close';
    closeBtn.setAttribute('aria-label', 'Закрыть панель');
    closeBtn.innerHTML = iconX(16);
    closeBtn.addEventListener('click', () => hideInspector());
    panelEl.appendChild(closeBtn);

    // ── Контейнер контента ──
    const content = document.createElement('div');
    content.className = 'inspector-content';
    panelEl.appendChild(content);

    // ── Drag handle (левый край) ──
    const handle = document.createElement('div');
    handle.className = 'inspector-handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.addEventListener('mousedown', onDragStart);
    panelEl.appendChild(handle);

    // Первый показ — без плейсхолдера, контент пустой
  }

  // При смене страницы: сохранить карточку текущей, восстановить карточку новой
  if (pageChanged) {
    swapPageCard(page);
  }

  if (parent && panelEl.parentElement !== parent) {
    parent.appendChild(panelEl);
  }
  return panelEl;
}

/**
 * Устанавливает текущую страницу и восстанавливает её карточку.
 * Вызывается при смене экрана.
 * @param {string} page — ключ страницы ('reading', 'dictionary', ...)
 */
export function setInspectorPage(page) {
  if (page === currentPage) return;
  swapPageCard(page);
}

/**
 * Показывает пустое состояние — dashed-рамка с иконкой и текстом.
 * Может вызываться экранами явно, если нужно показать плейсхолдер.
 * Автоматически НЕ вызывается при смене страницы.
 */
export function showEmptyState() {
  if (!panelEl) return;
  const content = panelEl.querySelector('.inspector-content');
  if (!content) return;
  const isDict = currentPage === 'dictionary';
  const icon = isDict ? 'λ' : 'α';
  const text = isDict
    ? 'Выберите слово в словаре — карточка появится здесь.'
    : 'Выберите греческое слово или букву в тексте — карточка появится здесь.';
  content.innerHTML = `
    <div class="inspector-empty">
      <div class="inspector-empty-icon">${icon}</div>
      <p class="inspector-empty-text">${text}</p>
    </div>`;
}

/**
 * Показывает карточку в инспекторе.
 * Автоматически показывает панель, если была скрыта.
 * Запоминает карточку для текущей страницы.
 * @param {HTMLElement} card — карточка из word-card.js
 */
export function showInInspector(card) {
  if (!panelEl) return;
  // Авто-показ панели
  const wasHidden = panelEl.classList.contains('hidden');
  if (wasHidden) {
    panelEl.classList.remove('hidden');
    savePageState();
  }
  const content = panelEl.querySelector('.inspector-content');
  if (!content) return;
  content.innerHTML = '';
  content.appendChild(card);

  // Запомнить карточку для текущей страницы (память + localStorage)
  if (currentPage) {
    pageCards.set(currentPage, card);
    saveCardToStorage(currentPage, card);
  }
}

/**
 * Скрывает панель.
 */
export function hideInspector() {
  if (panelEl) {
    panelEl.classList.add('hidden');
    savePageState();
  }
}

/**
 * Проверяет, скрыта ли панель.
 */
export function isInspectorHidden() {
  return panelEl ? panelEl.classList.contains('hidden') : true;
}

// ── Сохранение / восстановление per-page ──

function storageKey(prop) {
  return `${STORAGE_PREFIX}${currentPage || 'default'}:${prop}`;
}

function savePageState() {
  if (!currentPage || !panelEl) return;
  try {
    const hidden = panelEl.classList.contains('hidden');
    const width = panelEl.style.width || '';
    localStorage.setItem(storageKey('hidden'), String(hidden));
    localStorage.setItem(storageKey('width'), width);
  } catch (_) { /* localStorage может быть недоступен */ }
}

function restorePageState() {
  if (!currentPage || !panelEl) return;
  try {
    const hidden = localStorage.getItem(storageKey('hidden'));
    const width = localStorage.getItem(storageKey('width'));

    if (hidden === 'true') {
      panelEl.classList.add('hidden');
    } else {
      panelEl.classList.remove('hidden');
    }

    if (width) {
      panelEl.style.width = width;
      panelEl.style.flex = `0 0 ${width}`;
    } else {
      // Сброс к дефолту токенов
      panelEl.style.width = '';
      panelEl.style.flex = '';
    }
  } catch (_) { /* localStorage может быть недоступен */ }
}

/**
 * Сохраняет карточку текущей страницы (detach из DOM),
 * затем восстанавливает карточку новой страницы.
 */
function swapPageCard(newPage) {
  if (!panelEl) {
    currentPage = newPage;
    return;
  }

  // ── Сохранить карточку уходящей страницы ──
  if (currentPage) {
    const content = panelEl.querySelector('.inspector-content');
    if (content && content.firstElementChild) {
      const card = content.firstElementChild;
      card.remove();                         // detach, не destroy
      pageCards.set(currentPage, card);
    } else {
      pageCards.set(currentPage, null);
    }
    savePageState();
  }

  // ── Переключить страницу ──
  currentPage = newPage;

  // ── Восстановить ширину/видимость новой страницы ──
  restorePageState();

  // ── Восстановить карточку новой страницы ──
  const content = panelEl.querySelector('.inspector-content');
  if (content) {
    content.innerHTML = '';
    let savedCard = pageCards.get(newPage);
    // После перезагрузки страницы памяти нет — восстанавливаем из localStorage
    if (!savedCard) {
      savedCard = restoreCardFromStorage(newPage);
      if (savedCard) pageCards.set(newPage, savedCard);
    }
    if (savedCard) {
      content.appendChild(savedCard);
    }
  }
}

// ── Сохранение / восстановление карточки из localStorage ──

function saveCardToStorage(page, cardEl) {
  if (!page || !cardEl) return;
  try {
    const html = cardEl.outerHTML;
    if (html.length < 50000) { // защита от гигантских карточек
      localStorage.setItem(`${STORAGE_PREFIX}${page}:card`, html);
    }
  } catch (_) { /* localStorage может быть недоступен */ }
}

function restoreCardFromStorage(page) {
  if (!page) return null;
  try {
    const html = localStorage.getItem(`${STORAGE_PREFIX}${page}:card`);
    if (!html) return null;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.firstElementChild; // detached, статичный (без обработчиков)
  } catch (_) { return null; }
}

// ── Drag-to-resize ──

function onDragStart(e) {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = panelEl.offsetWidth;

  dragState = { startX, startWidth };

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onDragMove(e) {
  if (!dragState) return;
  const dx = dragState.startX - e.clientX;
  const newWidth = Math.min(600, Math.max(260, dragState.startWidth + dx));
  panelEl.style.width = newWidth + 'px';
  panelEl.style.flex = '0 0 ' + newWidth + 'px';
}

function onDragEnd() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  dragState = null;
  savePageState();
}
