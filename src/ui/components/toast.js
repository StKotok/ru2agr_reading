/**
 * Неблокирующее уведомление снизу, автоскрытие.
 * @param {string} html — содержимое
 * @param {object} opts — { timeout: 5000 }
 */
export function showToast(html, opts = {}) {
  const { timeout = 5000 } = opts;

  // Удаляем предыдущий тост
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = html;

  document.body.appendChild(toast);

  if (timeout > 0) {
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, timeout);
  }

  return toast;
}
