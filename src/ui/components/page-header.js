/**
 * Переиспользуемый заголовок страницы.
 * Единый стиль для всех экранов: Чтение, Словарь, Прогресс, Настройки.
 *
 * @param {object} opts
 * @param {string} opts.title — текст заголовка
 * @param {HTMLElement} [opts.left] — контрол слева от заголовка
 * @param {HTMLElement} [opts.center] — контрол по центру (слот)
 * @param {HTMLElement} [opts.right] — контрол справа
 * @returns {{ bar: HTMLElement, centerSlot: HTMLElement }}
 */
export function createPageHeader(opts = {}) {
  const { title, left, center, right } = opts;

  const bar = document.createElement('header');
  bar.className = 'page-header';

  // ── Левая часть ──
  if (left) {
    left.classList.add('page-header-left');
    bar.appendChild(left);
  }

  // ── Заголовок ──
  const titleEl = document.createElement('span');
  titleEl.className = 'page-header-title';
  titleEl.textContent = title;
  bar.appendChild(titleEl);

  // ── Центральный слот ──
  const centerSlot = document.createElement('div');
  centerSlot.className = 'page-header-center';
  if (center) {
    centerSlot.appendChild(center);
  }
  bar.appendChild(centerSlot);

  // ── Правая часть ──
  if (right) {
    right.classList.add('page-header-right');
    bar.appendChild(right);
  }

  return { bar, centerSlot };
}
