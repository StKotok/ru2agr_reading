/**
 * Десктопная правая панель — инспектор слова/буквы.
 */

import { iconBook } from './icons.js';

let panelEl = null;

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
    showEmptyState();
  }
  if (parent && panelEl.parentElement !== parent) {
    parent.appendChild(panelEl); // appendChild перемещает узел
  }
  return panelEl;
}

/**
 * Показывает пустое состояние.
 */
export function showEmptyState() {
  if (!panelEl) return;
  panelEl.innerHTML = `
    <div class="inspector-empty">
      <span style="opacity:0.35;margin-bottom:12px">${iconBook(40)}</span>
      <p>Нажми на греческую букву в тексте</p>
    </div>`;
}

/**
 * Показывает карточку в инспекторе.
 * @param {HTMLElement} card — карточка из word-card.js
 */
export function showInInspector(card) {
  if (!panelEl) return;
  panelEl.innerHTML = '';
  panelEl.appendChild(card);
}

/**
 * Скрывает панель.
 */
export function hideInspector() {
  if (panelEl) {
    panelEl.innerHTML = '';
  }
}
