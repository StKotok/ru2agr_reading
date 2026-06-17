/**
 * Мобильная шторка — открытие тапом, закрытие свайпом вниз / тапом по оверлею / Esc.
 */

let overlayEl = null;
let sheetEl = null;
let startY = 0;
let currentY = 0;
let isDragging = false;

/**
 * Открывает шторку с содержимым.
 * @param {HTMLElement} content — содержимое шторки
 */
export function openBottomSheet(content) {
  closeBottomSheet();

  overlayEl = document.createElement('div');
  overlayEl.className = 'bottom-sheet-overlay';
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('role', 'dialog');

  sheetEl = document.createElement('div');
  sheetEl.className = 'bottom-sheet';

  // Ручка для свайпа
  const handle = document.createElement('div');
  handle.className = 'bottom-sheet-handle';
  sheetEl.appendChild(handle);

  sheetEl.appendChild(content);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn bottom-sheet-close';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.addEventListener('click', closeBottomSheet);
  sheetEl.appendChild(closeBtn);

  overlayEl.appendChild(sheetEl);
  document.body.appendChild(overlayEl);

  // Закрытие по оверлею
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) {
      closeBottomSheet();
    }
  });

  // Свайп вниз
  sheetEl.addEventListener('touchstart', onTouchStart, { passive: false });
  sheetEl.addEventListener('touchmove', onTouchMove, { passive: false });
  sheetEl.addEventListener('touchend', onTouchEnd);

  // Esc
  document.addEventListener('keydown', onKeyDown);

  // Фокус-ловушка
  requestAnimationFrame(() => {
    const focusable = sheetEl.querySelector('button, [tabindex]');
    if (focusable) focusable.focus();
  });
}

function onTouchStart(e) {
  startY = e.touches[0].clientY;
  isDragging = true;
}

function onTouchMove(e) {
  if (!isDragging) return;
  currentY = e.touches[0].clientY;
  const delta = currentY - startY;
  if (delta > 0) {
    sheetEl.style.transform = `translateY(${delta}px)`;
    e.preventDefault();
  }
}

function onTouchEnd() {
  if (!isDragging) return;
  isDragging = false;
  const delta = currentY - startY;
  if (delta > 80) {
    closeBottomSheet();
  } else {
    sheetEl.style.transform = '';
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    closeBottomSheet();
  }
}

/**
 * Закрывает шторку с анимацией.
 */
export function closeBottomSheet() {
  if (!overlayEl) return;
  // Если уже закрывается — не дублируем
  if (overlayEl.hasAttribute('data-closing')) return;

  document.removeEventListener('keydown', onKeyDown);

  overlayEl.setAttribute('data-closing', '');
  const el = overlayEl;
  overlayEl = null;
  sheetEl = null;

  // Удаляем после окончания анимации (250ms sheet-down)
  setTimeout(() => {
    el.remove();
  }, 260);
}

/**
 * Проверяет, открыта ли шторка.
 * @returns {boolean}
 */
export function isOpen() {
  return !!overlayEl;
}
