/**
 * Десктопная правая панель — инспектор слова/буквы.
 */

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
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true" style="opacity:0.35;margin-bottom:12px">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="8" y1="7" x2="16" y2="7"/>
        <line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
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
