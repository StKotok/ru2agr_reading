import { loadBook } from '../../data/bible-loader.js';
import { loadProgress, saveProgress } from '../../state/progress.js';
import { loadSettings, saveSettings } from '../../state/settings.js';
import { loadAlphabet } from '../../data/lexicon-loader.js';
import { composeVerse } from '../../engine/compose.js';
import { segmentsToFragment } from '../render.js';
import { createTopBar } from '../components/top-bar.js';
import { createIntensitySlider } from '../components/intensity-slider.js';
import { navigate } from '../../router.js';

const DEBOUNCE_MS = 500;
const WINDOW_SIZE = 3;

let progress = null;
let settings = null;
let bookData = null;
let alphabet = null;
let letterNames = null;
let scrollTimer = null;
let chapterPlaceholders = [];
let observer = null;
let reRenderFn = null; // для вызова при изменении настроек

export async function mount(container, ctx) {
  const { store } = ctx;

  // Загружаем всё
  [progress, settings, alphabet] = await Promise.all([
    loadProgress(),
    loadSettings(),
    loadAlphabet()
  ]);

  // Строим карту имён букв для aria-label
  letterNames = new Map();
  if (alphabet) {
    for (const l of alphabet) {
      letterNames.set(l.lower, l.name);
    }
  }

  // TODO (временно): если прогресс букв пуст — задаём первые 3 буквы для теста
  // Уберёт онбординг (задача 1.7)
  if (Object.keys(progress.letters).length === 0 && alphabet && alphabet.length > 0) {
    const first3 = alphabet.filter(l => l.learnOrder <= 3);
    const today = new Date().toISOString().split('T')[0];
    for (const l of first3) {
      progress.letters[l.lower] = { status: 'known', introducedAt: today };
    }
    await saveProgress(progress);
  }

  // Публикуем в store
  store.update(s => ({ ...s, settings, progress }));

  const bookId = ctx.params?.book || progress.reading.lastBook || 'john';

  container.innerHTML = '';

  // Скелетон
  const skeleton = createSkeleton();
  container.appendChild(skeleton);

  // Top bar
  const { bar } = createTopBar(ctx);
  container.appendChild(bar);

  // Добавляем слайдер интенсивности в top-bar
  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'top-bar-slider';
  const slider = createIntensitySlider({
    store,
    onUpdate: (key, val) => {
      settings.intensity = val;
      saveSettings(settings);
      store.update(s => ({ ...s, settings: { ...settings } }));
    }
  });
  sliderContainer.appendChild(slider);
  bar.appendChild(sliderContainer);

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
  store.update(s => ({ ...s, book: bookId }));

  // Функция рендера/перерендера видимых глав
  reRenderFn = () => renderWindowed();
  renderWindowed();

  // Восстановление позиции скролла
  restoreScroll(bookId);

  // Подписка на изменения настроек
  store.subscribe(['settings'], () => {
    progress = store.get().progress || progress;
    const newSettings = store.get().settings;
    if (newSettings && newSettings !== settings) {
      settings = newSettings;
      saveSettings(settings);
      reRenderWindowed();
    }
  });

  window.addEventListener('scroll', onScroll, { passive: true });
}

function createSkeleton() {
  const div = document.createElement('div');
  div.className = 'skeleton';
  div.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>';
  return div;
}

function restoreScroll(bookId) {
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

  if (observer) observer.disconnect();
  chapterPlaceholders = [];

  textArea.innerHTML = '';

  const chapters = bookData.chapters;
  const chaptersEls = [];

  // Строим контекст для composeVerse
  const composeCtx = {
    mode: settings.mode,
    intensity: settings.intensity,
    progressLetters: progress.letters,
    seedPrefix: bookData.id
  };

  const renderCtx = { letterNames };

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
      p.appendChild(document.createTextNode(' '));

      // Применяем греческий слой
      const segments = composeVerse(verse.text, composeCtx);
      const frag = segmentsToFragment(segments, renderCtx);
      p.appendChild(frag);

      chapterEl.appendChild(p);
    }

    chaptersEls.push(chapterEl);
  }

  // Рендерим первые 2 главы
  const initialCount = Math.min(2, chaptersEls.length);
  for (let i = 0; i < initialCount; i++) {
    textArea.appendChild(chaptersEls[i]);
  }

  // Placeholder'ы для остальных
  for (let i = initialCount; i < chaptersEls.length; i++) {
    const placeholder = document.createElement('div');
    placeholder.className = 'chapter-placeholder';
    placeholder.setAttribute('data-chapter-idx', String(i));
    placeholder.style.minHeight = '200px';
    textArea.appendChild(placeholder);
    chapterPlaceholders.push({ chapterIndex: i, height: 200, el: placeholder });
  }

  setupObserver(chaptersEls, textArea);
}

function reRenderWindowed() {
  // Перерендер только уже видимых глав
  const textArea = document.getElementById('scripture-text');
  if (!textArea || !bookData) return;

  const composeCtx = {
    mode: settings.mode,
    intensity: settings.intensity,
    progressLetters: progress.letters,
    seedPrefix: bookData.id
  };
  const renderCtx = { letterNames };

  // Находим все развёрнутые главы (с section внутри)
  const sections = textArea.querySelectorAll('section[data-chapter]');
  for (const section of sections) {
    const chN = parseInt(section.getAttribute('data-chapter'));
    const ch = bookData.chapters.find(c => c.n === chN);
    if (!ch) continue;

    // Перестраиваем стихи
    const heading = section.querySelector('h2');
    section.innerHTML = '';
    if (heading) section.appendChild(heading);

    for (const verse of ch.verses) {
      const p = document.createElement('p');
      p.setAttribute('data-verse', `${ch.n}:${verse.n}`);
      const sup = document.createElement('sup');
      sup.textContent = String(verse.n);
      p.appendChild(sup);
      p.appendChild(document.createTextNode(' '));

      const segments = composeVerse(verse.text, composeCtx);
      const frag = segmentsToFragment(segments, renderCtx);
      p.appendChild(frag);

      section.appendChild(p);
    }
  }
}

function setupObserver(chaptersEls, textArea) {
  for (const ph of chapterPlaceholders) {
    const sentinel = document.createElement('div');
    sentinel.className = 'chapter-sentinel';
    sentinel.style.height = '1px';
    sentinel.setAttribute('data-chapter-idx', String(ph.chapterIndex));
    ph.el.parentNode?.insertBefore(sentinel, ph.el);
  }

  observer = new IntersectionObserver((entries) => {
    const visible = new Set();
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const idx = parseInt(entry.target.getAttribute('data-chapter-idx'));
        if (!isNaN(idx)) visible.add(idx);
      }
    }
    if (visible.size === 0) return;

    const minVisible = Math.min(...visible);
    const maxVisible = Math.max(...visible);
    const renderFrom = Math.max(0, minVisible - WINDOW_SIZE);
    const renderTo = Math.min(chaptersEls.length - 1, maxVisible + WINDOW_SIZE);

    for (const ph of chapterPlaceholders) {
      const idx = ph.chapterIndex;
      if (idx >= renderFrom && idx <= renderTo) {
        if (ph.el.querySelector('section')) continue;
        const oldHeight = ph.el.offsetHeight;
        const chapterEl = chaptersEls[idx].cloneNode(true);
        chapterEl.style.minHeight = oldHeight + 'px';
        ph.el.parentNode?.replaceChild(chapterEl, ph.el);
        ph.el = chapterEl;
        requestAnimationFrame(() => {
          chapterEl.style.minHeight = '';
          ph.height = chapterEl.offsetHeight;
        });
      } else if (idx < renderFrom || idx > renderTo) {
        if (!ph.el.querySelector('section')) continue;
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

  for (const ph of chapterPlaceholders) {
    const sentinel = ph.el.previousElementSibling;
    if (sentinel && sentinel.classList.contains('chapter-sentinel')) {
      observer.observe(sentinel);
    }
  }
}

function createErrorState(bookId) {
  const div = document.createElement('div');
  div.className = 'card error-state';
  div.innerHTML = `<p>Не удалось загрузить книгу.</p><button class="btn btn-primary retry-btn">Повторить</button>`;
  div.querySelector('.retry-btn').addEventListener('click', () => {
    location.hash = `#/read/${bookId}`;
    location.reload();
  });
  return div;
}

function createOfflineState(bookId) {
  const div = document.createElement('div');
  div.className = 'card error-state';
  div.innerHTML = `<p>Эта книга ещё не загружалась — нужен интернет.</p><button class="btn btn-primary retry-btn">Повторить</button>`;
  div.querySelector('.retry-btn').addEventListener('click', () => {
    location.hash = `#/read/${bookId}`;
    location.reload();
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
  reRenderFn = null;
}
