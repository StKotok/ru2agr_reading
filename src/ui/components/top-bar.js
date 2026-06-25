import { loadBooks } from '../../data/bible-loader.js';
import { navigate } from '../../router.js';
import { iconEye, iconEyeOff, iconChevron } from './icons.js';

/**
 * Top header для экрана чтения.
 * Слева: книга, глава ▾ | центр: mode-widget чип (вставляется снаружи) | справа: глаз
 */
export function createTopBar(ctx) {
  const { store, onEyeToggle } = ctx;
  const bar = document.createElement('header');
  bar.className = 'top-header';

  // ── Книга + глава ──
  const bookBtn = document.createElement('button');
  bookBtn.className = 'top-header-book';
  bookBtn.setAttribute('aria-haspopup', 'listbox');
  bookBtn.innerHTML = `
    <span class="top-header-book-name">…</span>
    <span class="top-header-book-chapter">1</span>
    <span style="transform:translateY(2px);flex:0 0 auto">${iconChevron(14)}</span>
  `;
  bar.appendChild(bookBtn);

  // ── Выпадашка книг ──
  const bookList = document.createElement('div');
  bookList.className = 'book-dropdown';
  bookList.setAttribute('role', 'listbox');
  bookList.hidden = true;
  bar.appendChild(bookList);

  // ── Кнопка «глаз» ──
  let plainView = false;
  const eyeBtn = document.createElement('button');
  eyeBtn.className = 'top-header-eye';
  eyeBtn.innerHTML = iconEye(18);
  eyeBtn.setAttribute('aria-label', 'Простой вид');
  eyeBtn.addEventListener('click', () => {
    plainView = !plainView;
    eyeBtn.classList.toggle('active', plainView);
    eyeBtn.innerHTML = plainView ? iconEyeOff(18) : iconEye(18);
    eyeBtn.setAttribute('aria-label', plainView ? 'Вернуть греческий слой' : 'Простой вид');
    if (onEyeToggle) onEyeToggle(plainView);
  });
  bar.appendChild(eyeBtn);

  // ── Загрузка книг ──
  let books = [];
  loadBooks().then(b => { books = b; updateBookLabel(); });

  function updateBookLabel() {
    const state = store.get();
    const book = books.find(b => b.id === state.book);
    bookBtn.querySelector('.top-header-book-name').textContent = book ? book.short + ',' : 'Ин,';
    bookBtn.querySelector('.top-header-book-chapter').textContent = '1';
  }

  function renderBookList() {
    const groups = {
      'Евангелия': books.filter(b => ['matthew','mark','luke','john'].includes(b.id)),
      'Деяния': books.filter(b => b.id === 'acts'),
      'Послания': books.filter(b => !['matthew','mark','luke','john','acts','revelation'].includes(b.id)),
      'Откровение': books.filter(b => b.id === 'revelation'),
    };
    bookList.innerHTML = '';
    for (const [group, items] of Object.entries(groups)) {
      if (items.length === 0) continue;
      const h = document.createElement('div');
      h.className = 'book-dropdown-group';
      h.textContent = group;
      bookList.appendChild(h);
      for (const book of items) {
        const btn = document.createElement('button');
        btn.className = 'book-dropdown-item';
        btn.textContent = book.short + ' — ' + book.title;
        btn.setAttribute('role', 'option');
        btn.addEventListener('click', () => {
          navigate(`#/read/${book.id}`);
          bookList.hidden = true;
        });
        bookList.appendChild(btn);
      }
    }
  }

  bookBtn.addEventListener('click', async () => {
    if (books.length === 0) books = await loadBooks();
    renderBookList();
    bookList.hidden = !bookList.hidden;
    if (!bookList.hidden) bookList.querySelector('button')?.focus();
  });

  document.addEventListener('click', (e) => {
    if (!bar.contains(e.target)) bookList.hidden = true;
  });

  bookList.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !bookList.hidden) { bookList.hidden = true; bookBtn.focus(); }
  });

  store.subscribe(['book'], () => updateBookLabel());
  updateBookLabel();

  return { bar, eyeBtn, bookBtn };
}
