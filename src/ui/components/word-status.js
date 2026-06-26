/**
 * Единый виджет статуса изучения слова.
 * Переиспользуется в карточках слова (Чтение + Словарь) и в строках списка Словаря.
 *
 * Две функции:
 *   renderWordStatusActions(status, { lexemeId, onMarkStatus, heading })
 *     — три кнопки выбора, опционально в <section> с заголовком
 *   renderWordStatusPill(status)
 *     — компактный pill-бейдж (пустой span если статуса нет, скрыт через CSS)
 */

/** @type {Record<string, string>} */
export const STATUS_LABEL = {
  new: 'Новое',
  learning: 'Учу',
  known: 'Знаю'
};

const STATUS_KEYS = ['new', 'learning', 'known'];

/**
 * Три кнопки выбора статуса — для карточек слова.
 * Использует CSS-классы .word-card-status > .status-btn (см. app.css).
 *
 * Колбэк onMarkStatus вызывается с await — UI обновляется только после успеха.
 * При ошибке сохраняется предыдущее состояние (никакого визуального отката).
 *
 * @param {string|null} currentStatus — 'new' | 'learning' | 'known' | null
 * @param {object} [opts]
 * @param {string|null} [opts.lexemeId]
 * @param {(lexemeId: string, newStatus: string) => void|Promise<void>} [opts.onMarkStatus]
 * @param {string} [opts.heading] — если задан, виджет оборачивается в <section><h3>
 * @returns {HTMLElement}
 */
export function renderWordStatusActions(currentStatus, opts = {}) {
  const { lexemeId = null, onMarkStatus = null, heading = null } = opts || {};

  const row = document.createElement('div');
  row.className = 'word-card-status';

  for (const key of STATUS_KEYS) {
    const cls = 'status-' + key;
    const btn = document.createElement('button');
    btn.className = 'btn status-btn ' + cls;
    btn.textContent = currentStatus === key ? `✓ ${STATUS_LABEL[key]}` : STATUS_LABEL[key];
    if (currentStatus === key) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', async () => {
      if (!onMarkStatus || !lexemeId) return;
      try {
        await onMarkStatus(lexemeId, key);
        // UI-обновление только после успешного сохранения
        const allBtns = row.querySelectorAll('.status-btn');
        allBtns.forEach(b => {
          b.classList.remove('active');
          b.textContent = STATUS_LABEL[b.dataset.statusKey];
        });
        btn.classList.add('active');
        btn.textContent = `✓ ${STATUS_LABEL[key]}`;
      } catch (err) {
        console.warn('word-status: ошибка сохранения статуса', err);
        // UI не меняем — сохраняем предыдущее состояние
      }
    });
    btn.dataset.statusKey = key;
    row.appendChild(btn);
  }

  if (heading) {
    const section = document.createElement('section');
    const h3 = document.createElement('h3');
    h3.textContent = heading;
    section.appendChild(h3);
    section.appendChild(row);
    return section;
  }

  return row;
}

/**
 * Компактный pill-бейдж текущего статуса — для строк списка Словаря.
 * Использует CSS-классы .dict-status-pill + .badge-{status} (см. app.css).
 * Если статуса нет — возвращает пустой &lt;span&gt; (скрыт через CSS :not(.badge-*)).
 *
 * @param {string|null} status — 'new' | 'learning' | 'known' | null
 * @returns {HTMLElement}
 */
export function renderWordStatusPill(status) {
  const pill = document.createElement('span');
  pill.className = 'dict-status-pill';
  if (status) {
    pill.classList.add('badge-' + status);
    pill.textContent = STATUS_LABEL[status] || 'Новое';
  }
  return pill;
}
