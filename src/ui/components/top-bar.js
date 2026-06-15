import { loadBooks } from '../../data/bible-loader.js';
import { navigate } from '../../router.js';

/**
 * Верхняя панель экрана чтения.
 * Книга ▾ | Режим ▾ | Греческий: N% | глаз
 */
export function createTopBar(ctx) {
  const { store, onEyeToggle } = ctx;
  const bar = document.createElement('div');
  bar.className = 'top-bar';

  // Селектор книги
  const bookBtn = document.createElement('button');
  bookBtn.className = 'btn top-bar-btn book-selector';
  bookBtn.setAttribute('aria-haspopup', 'listbox');
  bar.appendChild(bookBtn);

  const bookList = document.createElement('div');
  bookList.className = 'book-dropdown';
  bookList.setAttribute('role', 'listbox');
  bookList.hidden = true;
  bar.appendChild(bookList);

  // Селектор режима
  const modeBtn = document.createElement('button');
  modeBtn.className = 'btn top-bar-btn mode-selector';
  modeBtn.setAttribute('aria-haspopup', 'listbox');
  bar.appendChild(modeBtn);

  const modeList = document.createElement('div');
  modeList.className = 'book-dropdown mode-dropdown';
  modeList.setAttribute('role', 'listbox');
  modeList.hidden = true;
  bar.appendChild(modeList);

  const MODES = [
    { id: 2, label: '2. Буквы + подсказки', group: 'Учебный мостик', enabled: true },
    { id: 3, label: '3. Слова из словаря', group: 'Учебный мостик', enabled: true },
    { id: 4, label: '4. Формы оригинала', group: 'Ближе к оригиналу', enabled: true },
    { id: 5, label: '5. Почти оригинал', group: 'Ближе к оригиналу', enabled: true },
  ];

  function renderModeButton() {
    const state = store.get();
    const m = MODES.find(m => m.id === (state.settings?.mode || 2)) || MODES[0];
    modeBtn.textContent = 'Режим ' + m.id + ' ▾';
  }

  function renderModeList() {
    modeList.innerHTML = '';
    let currentGroup = '';
    for (const m of MODES) {
      if (m.group !== currentGroup) {
        currentGroup = m.group;
        const header = document.createElement('div');
        header.className = 'book-dropdown-group';
        header.textContent = currentGroup;
        modeList.appendChild(header);
      }
      const btn = document.createElement('button');
      btn.className = 'book-dropdown-item';
      btn.textContent = m.label + (m.note ? ' (' + m.note + ')' : '');
      btn.setAttribute('role', 'option');
      if (!m.enabled) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      } else {
        btn.addEventListener('click', () => {
          const state = store.get();
          if (state.settings) {
            state.settings.mode = m.id;
            store.update(s => ({ ...s, settings: { ...state.settings } }));
          }
          modeList.hidden = true;
          renderModeButton();
        });
      }
      modeList.appendChild(btn);
    }
  }

  modeBtn.addEventListener('click', () => {
    renderModeList();
    modeList.hidden = !modeList.hidden;
    if (!modeList.hidden) {
      const firstEnabled = modeList.querySelector('button:not([disabled])');
      firstEnabled?.focus();
    }
  });

  // Кнопка «глаз» — plain view
  const eyeBtn = document.createElement('button');
  eyeBtn.className = 'btn top-bar-btn';
  eyeBtn.textContent = '👁';
  eyeBtn.title = 'Показать обычный русский текст';
  eyeBtn.setAttribute('aria-pressed', 'false');
  eyeBtn.addEventListener('click', () => {
    const pressed = eyeBtn.getAttribute('aria-pressed') === 'true';
    const newPressed = !pressed;
    eyeBtn.setAttribute('aria-pressed', String(newPressed));
    eyeBtn.style.background = newPressed ? 'var(--selection)' : '';
    eyeBtn.title = newPressed ? 'Вернуть греческий слой' : 'Показать обычный русский текст';
    if (onEyeToggle) onEyeToggle(newPressed);
  });
  bar.appendChild(eyeBtn);

  // Загрузка списка книг
  let books = [];
  loadBooks().then(b => {
    books = b;
    renderBookButton();
  });

  function renderBookButton() {
    const state = store.get();
    const currentBook = books.find(b => b.id === state.book) || { short: 'Ин' };
    bookBtn.textContent = currentBook.short + ' ▾';
  }

  // Строим выпадашку книг
  function renderBookList() {
    const groups = {
      'Евангелия': books.filter(b => ['matthew', 'mark', 'luke', 'john'].includes(b.id)),
      'Деяния': books.filter(b => b.id === 'acts'),
      'Послания': books.filter(b => !['matthew', 'mark', 'luke', 'john', 'acts', 'revelation'].includes(b.id)),
      'Откровение': books.filter(b => b.id === 'revelation'),
    };

    bookList.innerHTML = '';
    for (const [group, items] of Object.entries(groups)) {
      if (items.length === 0) continue;
      const header = document.createElement('div');
      header.className = 'book-dropdown-group';
      header.textContent = group;
      bookList.appendChild(header);

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
    if (books.length === 0) {
      books = await loadBooks();
    }
    renderBookList();
    bookList.hidden = !bookList.hidden;
    if (!bookList.hidden) bookList.querySelector('button')?.focus();
  });

  // Закрытие выпадашки по клику вне
  document.addEventListener('click', (e) => {
    if (!bar.contains(e.target)) {
      bookList.hidden = true;
    }
  });

  store.subscribe(['book'], () => renderBookButton());
  store.subscribe(['settings'], () => renderModeButton());

  // Изначальная отрисовка
  renderModeButton();

  return { bar, eyeBtn };
}
