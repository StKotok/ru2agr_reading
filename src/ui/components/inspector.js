/**
 * Десктопная правая панель — инспектор слова/буквы.
 * Дизайн соответствует прототипу (readerRenderDeskInspector).
 * Поддерживает ресайз перетаскиванием левого края и закрытие.
 */

import { iconX } from './icons.js';

let panelEl = null;
let dragState = null;

/**
 * Создаёт или возвращает панель инспектора.
 * @param {HTMLElement} parent — контейнер для вставки панели
 * @returns {HTMLElement}
 */
export function getInspectorPanel(parent) {
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

    showEmptyState();
  }
  if (parent && panelEl.parentElement !== parent) {
    parent.appendChild(panelEl);
  }
  return panelEl;
}

/**
 * Показывает пустое состояние — точно как в прототипе:
 * dashed-рамка с буквой α и текст serif-шрифтом.
 */
export function showEmptyState() {
  if (!panelEl) return;
  const content = panelEl.querySelector('.inspector-content');
  if (!content) return;
  content.innerHTML = `
    <div class="inspector-empty">
      <div class="inspector-empty-icon">α</div>
      <p class="inspector-empty-text">Выберите греческое слово или букву в тексте — карточка появится здесь.</p>
    </div>`;
}

/**
 * Показывает карточку в инспекторе.
 * Автоматически показывает панель, если была скрыта.
 * @param {HTMLElement} card — карточка из word-card.js
 */
export function showInInspector(card) {
  if (!panelEl) return;
  // Авто-показ панели
  if (panelEl.classList.contains('hidden')) {
    panelEl.classList.remove('hidden');
  }
  const content = panelEl.querySelector('.inspector-content');
  if (!content) return;
  content.innerHTML = '';
  content.appendChild(card);
}

/**
 * Скрывает панель.
 */
export function hideInspector() {
  if (panelEl) {
    panelEl.classList.add('hidden');
  }
}

/**
 * Проверяет, скрыта ли панель.
 */
export function isInspectorHidden() {
  return panelEl ? panelEl.classList.contains('hidden') : true;
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
}
