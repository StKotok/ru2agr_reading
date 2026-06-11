import { loadBook } from '../../data/bible-loader.js';
import { loadProgress, saveProgress } from '../../state/progress.js';
import { createTopBar } from '../components/top-bar.js';
import { navigate } from '../../router.js';

const DEBOUNCE_MS = 500;
const WINDOW_SIZE = 3; // ± главы вокруг вьюпорта

let progress = null;
let bookData = null;
let scrollTimer = null;
let chapterPlaceholders = []; // { chapterIndex, height, el }
let observer = null;
let sentinels = []; // для IntersectionObserver

export async function mount(container, ctx) {
  const { store } = ctx;

  // Загружаем прогресс
  progress = await loadProgress();

  // Определяем книгу
  const bookId = ctx.params?.book || progress.reading.lastBook || 'john';

  container.innerHTML = '';

  // Скелетон
  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton';
  skeleton.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>';
  container.appendChild(skeleton);

  // Top bar
  const { bar, eyeBtn } = createTopBar(ctx);
  container.appendChild(bar);

  // Контейнер текста
  const textArea = document.createElement('div');
  textArea.className = 'scripture-text';
  textArea.id = 'scripture-text';
  container.appendChild(textArea);

  // Загружаем книгу
  try {
    bookData = await loadBook('syn', bookId);
  } catch (e) {
    skeleton.remove();
    container.appendChild(createErrorState(bookId));
    return;
  }

  if (!bookData) {
    skeleton.remove();
    container.appendChild(createOfflineState(bookId));
    return;
  }

  skeleton.remove();

  // Сохраняем позицию
  store.update(s => ({ ...s, book: bookId }));

  // Рендерим книгу с окном
  renderWindowed();

  // Восстанавливаем позицию скролла
  if (progress.reading.lastBook === bookId && progress.reading.lastScroll > 0) {
    const targetScroll = progress.reading.lastScroll * document.documentElement.scrollHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, targetScroll);
      });
    });
  } else {
    window.scrollTo(0, 0);
  }

  // Сохранение позиции при скролле
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onScroll() {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (!bookData) return;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPos = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
    progress.reading.lastScroll = Math.max(0, Math.min(1, scrollPos));
    progress.reading.lastBook = bookData.id;
    saveProgress(progress);
  }, DEBOUNCE_MS);
}

function renderWindowed() {
  const textArea = document.getElementById('scripture-text');
  if (!textArea || !bookData) return;

  // Очищаем старый observer
  if (observer) observer.disconnect();
  sentinels = [];
  chapterPlaceholders = [];

  textArea.innerHTML = '';

  const chapters = bookData.chapters;
  const chaptersEls = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const chapterEl = document.createElement('section');
    chapterEl.setAttribute('data-chapter', String(ch.n));
    chapterEl.id = `ch-${ch.n}`;

    const heading = document.createElement('h2');
    heading.textContent = `Глава ${ch.n}`;
    chapterEl.appendChild(heading);

    for (const verse of ch.verses) {
      const p = document.createElement('p');
      p.setAttribute('data-verse', `${ch.n}:${verse.n}`);
      const sup = document.createElement('sup');
      sup.textContent = String(verse.n);
      p.appendChild(sup);
      p.appendChild(document.createTextNode(' ' + verse.text));
      chapterEl.appendChild(p);
    }

    chaptersEls.push(chapterEl);
  }

  // Рендерим первые 2 главы сразу
  const initialCount = Math.min(2, chaptersEls.length);
  for (let i = 0; i < initialCount; i++) {
    textArea.appendChild(chaptersEls[i]);
  }

  // Для остальных — placeholder'ы
  for (let i = initialCount; i < chaptersEls.length; i++) {
    const placeholder = document.createElement('div');
    placeholder.className = 'chapter-placeholder';
    placeholder.setAttribute('data-chapter-idx', String(i));
    placeholder.style.minHeight = '200px'; // начальная высота
    textArea.appendChild(placeholder);
    chapterPlaceholders.push({ chapterIndex: i, height: 200, el: placeholder });
  }

  // IntersectionObserver для ленивого дорендера
  setupObserver(chaptersEls, textArea);
}

function setupObserver(chaptersEls, textArea) {
  // Создаём сентинелы для каждого плейсхолдера
  for (const ph of chapterPlaceholders) {
    const sentinel = document.createElement('div');
    sentinel.className = 'chapter-sentinel';
    sentinel.style.height = '1px';
    sentinel.setAttribute('data-chapter-idx', String(ph.chapterIndex));
    ph.el.parentNode?.insertBefore(sentinel, ph.el);

    sentinels.push({ el: sentinel, chapterIndex: ph.chapterIndex });
  }

  observer = new IntersectionObserver((entries) => {
    const visible = new Set();

    for (const entry of entries) {
      if (entry.isIntersecting) {
        const idx = parseInt(entry.target.getAttribute('data-chapter-idx'));
        visible.add(idx);
      }
    }

    if (visible.size === 0) return;

    // Определяем диапазон глав для рендера
    const minVisible = Math.min(...visible);
    const maxVisible = Math.max(...visible);
    const renderFrom = Math.max(0, minVisible - WINDOW_SIZE);
    const renderTo = Math.min(chaptersEls.length - 1, maxVisible + WINDOW_SIZE);

    // Обновляем плейсхолдеры
    for (const ph of chapterPlaceholders) {
      const idx = ph.chapterIndex;
      if (idx >= renderFrom && idx <= renderTo) {
        // Разворачиваем главу
        if (ph.el.querySelector('section')) continue; // уже развёрнута

        // Измеряем высоту перед заменой
        const oldHeight = ph.el.offsetHeight;

        // Заменяем placeholder реальной главой
        const chapterEl = chaptersEls[idx];
        const newEl = chapterEl.cloneNode(true);
        // Сохраняем высоту, чтобы скролл не прыгал
        newEl.style.minHeight = oldHeight + 'px';
        ph.el.parentNode?.replaceChild(newEl, ph.el);
        ph.el = newEl;

        // Через кадр убираем minHeight
        requestAnimationFrame(() => {
          newEl.style.minHeight = '';
          ph.height = newEl.offsetHeight;
        });
      } else if (idx < renderFrom || idx > renderTo) {
        // Сворачиваем обратно в плейсхолдер
        if (!ph.el.querySelector('section')) continue; // уже свёрнута

        const height = ph.el.offsetHeight;
        const placeholder = document.createElement('div');
        placeholder.className = 'chapter-placeholder';
        placeholder.setAttribute('data-chapter-idx', String(idx));
        placeholder.style.minHeight = height + 'px';
        ph.el.parentNode?.replaceChild(placeholder, ph.el);
        ph.el = placeholder;
        ph.height = height;
      }
    }
  }, { rootMargin: '200px 0px' });

  // Наблюдаем сентинелы
  for (const s of sentinels) {
    observer.observe(s.el);
  }
}

function createErrorState(bookId) {
  const div = document.createElement('div');
  div.className = 'card error-state';
  div.innerHTML = `
    <p>Не удалось загрузить книгу.</p>
    <button class="btn btn-primary retry-btn">Повторить</button>
  `;
  div.querySelector('.retry-btn').addEventListener('click', () => {
    navigate(`#/read/${bookId}`);
  });
  return div;
}

function createOfflineState(bookId) {
  const div = document.createElement('div');
  div.className = 'card error-state';
  div.innerHTML = `
    <p>Эта книга ещё не загружалась — нужен интернет.</p>
    <button class="btn btn-primary retry-btn">Повторить</button>
  `;
  div.querySelector('.retry-btn').addEventListener('click', () => {
    navigate(`#/read/${bookId}`);
  });
  return div;
}

export function unmount() {
  window.removeEventListener('scroll', onScroll);
  if (observer) observer.disconnect();
  if (scrollTimer) clearTimeout(scrollTimer);
  observer = null;
  scrollTimer = null;
  bookData = null;
}
