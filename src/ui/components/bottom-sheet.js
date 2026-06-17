/**
 * Мобильная шторка — открытие тапом, закрытие свайпом вниз / тапом по оверлею / Esc.
 */

import { iconX } from './icons.js';

let overlayEl = null;
let sheetEl = null;
let startY = 0;
let currentY = 0;
let isDragging = false;

/**
 * Открывает шторку с содержимым.
 * @param {HTMLElement} content — содержимое шторки
 * @returns {HTMLElement} sheet — DOM-элемент шторки (чтобы caller не делал querySelector)
 */
export function openBottomSheet(content) {
  // Закрываем предыдущую шторку с анимацией, но не ждём её
  if (overlayEl && !overlayEl.hasAttribute('data-closing')) {
    _startClose(overlayEl);
  }

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
  closeBtn.innerHTML = iconX(20);
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

  return sheetEl;
}

function onTouchStart(e) {
  startY = e.touches[0].clientY;
  isDragging = true;
}

function onTouchMove(e) {
  if (!isDragging || !sheetEl) return;
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
  if (!sheetEl) return;
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

function _startClose(el) {
  // Очищаем touch-слушатели со старого sheetEl
  if (sheetEl) {
    sheetEl.removeEventListener('touchstart', onTouchStart);
    sheetEl.removeEventListener('touchmove', onTouchMove);
    sheetEl.removeEventListener('touchend', onTouchEnd);
  }

  document.removeEventListener('keydown', onKeyDown);

  // Скрываем от accessibility tree немедленно
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('inert', '');

  el.setAttribute('data-closing', '');

  let removed = false;
  const doRemove = () => {
    if (removed) return;
    removed = true;
    el.removeEventListener('animationend', onAnimEnd);
    clearTimeout(fallbackTimer);
    el.remove();
  };

  // Удаляем по окончании анимации
  const onAnimEnd = () => doRemove();
  el.addEventListener('animationend', onAnimEnd);

  // Fallback: если animation не проигрывается (prefers-reduced-motion),
  // удаляем элемент не позже чем через 300ms
  const fallbackTimer = setTimeout(doRemove, 300);
}

/**
 * Закрывает шторку с анимацией.
 */
export function closeBottomSheet() {
  if (!overlayEl) return;
  // Если уже закрывается — не дублируем
  if (overlayEl.hasAttribute('data-closing')) return;

  const el = overlayEl;
  overlayEl = null;
  sheetEl = null;

  _startClose(el);
}

/**
 * Проверяет, открыта ли шторка.
 * @returns {boolean}
 */
export function isOpen() {
  return !!overlayEl;
}
