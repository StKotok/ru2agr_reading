/**
 * Единый виджет статуса изучения слова.
 * Переиспользуется в карточках слова (Чтение + Словарь) и в строках списка Словаря.
 *
 * Две функции:
 *   renderWordStatusActions(status, { lexemeId, onMarkStatus }) — три кнопки выбора
 *   renderWordStatusPill(status)                              — компактный pill-бейдж
 */

/** @type {Record<string, string>} */
export const STATUS_LABEL = {
  new: 'Новое',
  learning: 'Учу',
  known: 'Знаю'
};

/** @type {Array<{ key: string, cls: string }>} */
const STATUSES = [
  { key: 'new', cls: 'status-new' },
  { key: 'learning', cls: 'status-learning' },
  { key: 'known', cls: 'status-known' }
];

/**
 * Три кнопки выбора статуса — для карточек слова.
 * Использует CSS-классы .word-card-status > .status-btn (см. app.css).
 *
 * @param {string|null} currentStatus — 'new' | 'learning' | 'known' | null
 * @param {{ lexemeId: string|null, onMarkStatus: (lexemeId: string, newStatus: string) => void }} callbacks
 * @returns {HTMLElement}
 */
export function renderWordStatusActions(currentStatus, { lexemeId, onMarkStatus } = {}) {
  const row = document.createElement('div');
  row.className = 'word-card-status';

  for (const st of STATUSES) {
    const btn = document.createElement('button');
    btn.className = 'btn status-btn ' + st.cls;
    btn.textContent = currentStatus === st.key ? `✓ ${STATUS_LABEL[st.key]}` : STATUS_LABEL[st.key];
    if (currentStatus === st.key) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      if (onMarkStatus && lexemeId) {
        onMarkStatus(lexemeId, st.key);
        // Визуальная обратная связь внутри виджета
        const allBtns = row.querySelectorAll('.status-btn');
        allBtns.forEach(b => {
          b.classList.remove('active');
          b.textContent = STATUS_LABEL[b.dataset.statusKey];
        });
        btn.classList.add('active');
        btn.textContent = `✓ ${STATUS_LABEL[st.key]}`;
      }
    });
    btn.dataset.statusKey = st.key;
    row.appendChild(btn);
  }

  return row;
}

/**
 * Компактный pill-бейдж текущего статуса — для строк списка Словаря.
 * Использует CSS-классы .dict-status-pill + .badge-{status} (см. app.css).
 *
 * @param {string|null} status — 'new' | 'learning' | 'known' | null
 * @returns {HTMLElement}
 */
export function renderWordStatusPill(status) {
  const pill = document.createElement('span');
  pill.className = 'dict-status-pill';
  if (status) {
    pill.classList.add('badge-' + status);
    pill.textContent = STATUS_LABEL[status] || status;
  }
  return pill;
}
