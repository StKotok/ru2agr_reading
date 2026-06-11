import { loadBook } from '../../data/bible-loader.js';
import { loadProgress, saveProgress, markLetterKnown } from '../../state/progress.js';
import { loadSettings, saveSettings } from '../../state/settings.js';
import { loadAlphabet, loadCoreLexicon } from '../../data/lexicon-loader.js';
import { loadDictionary } from '../../state/dictionary.js';
import { composeVerse } from '../../engine/compose.js';
import { segmentsToFragment } from '../render.js';
import { createTopBar } from '../components/top-bar.js';
import { createIntensitySlider } from '../components/intensity-slider.js';
import { renderLetterCard, renderWordCard } from '../components/word-card.js';
import { openBottomSheet, closeBottomSheet, isOpen as isSheetOpen } from '../components/bottom-sheet.js';
import { getInspectorPanel, showEmptyState, showInInspector } from '../components/inspector.js';
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
let reRenderFn = null;
let plainView = false;
let longPressTimer = null;
let longPressTarget = null;
let dictionary = {};
let coreLexicon = [];
let wordEntries = [];

export async function mount(container, ctx) {
  const { store } = ctx;

  // Загружаем всё
  [progress, settings, alphabet, dictionary, coreLexicon] = await Promise.all([
    loadProgress(),
    loadSettings(),
    loadAlphabet(),
    loadDictionary(),
    loadCoreLexicon()
  ]);

  // Строим карту имён букв для aria-label
  letterNames = new Map();
  if (alphabet) {
    for (const l of alphabet) {
      letterNames.set(l.lower, l.name);
    }
  }

  // Публикуем в store
  store.update(s => ({ ...s, settings, progress }));

  const bookId = ctx.params?.book || progress.reading.lastBook || 'john';

  container.innerHTML = '';

  // Скелетон
  const skeleton = createSkeleton();
  container.appendChild(skeleton);

  // Top bar
  const { bar } = createTopBar({
    store,
    onEyeToggle: (pressed) => {
      plainView = pressed;
      reRenderWindowed();
    }
  });
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

  // Подписка на изменения прогресса (буквы)
  store.subscribe(['progress'], () => {
    const newProgress = store.get().progress;
    if (newProgress && newProgress !== progress) {
      progress = newProgress;
      reRenderWindowed();
    }
  });

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

  // Десктоп: инспектор
  if (window.innerWidth >= 900) {
    const inspector = getInspectorPanel(container);
    showEmptyState();
  }

  // Обработчик кликов по греческим вставкам
  textArea.addEventListener('click', (e) => {
    const span = e.target.closest('span.gr');
    if (!span) return;
    // Если был долгий тап — не открываем карточку
    if (span._wasLongPress) {
      span._wasLongPress = false;
      return;
    }
    const letter = span.getAttribute('data-letter');
    if (letter) {
      handleLetterTap(letter, span, container);
      return;
    }
    const lexemeId = span.getAttribute('data-lexeme');
    if (lexemeId) {
      handleWordTap(lexemeId, span, container);
    }
  });

  // Долгий тап (≥500ms) — показать оригинал
  textArea.addEventListener('pointerdown', (e) => {
    const span = e.target.closest('span.gr');
    if (!span) return;
    longPressTarget = span;
    longPressTimer = setTimeout(() => {
      if (longPressTarget) {
        longPressTarget._wasLongPress = true;
        // Показываем оригинал
        const original = longPressTarget.getAttribute('data-original');
        if (original) {
          longPressTarget.setAttribute('data-restore', longPressTarget.textContent);
          longPressTarget.textContent = original;
          longPressTarget.classList.add('show-original');
        }
      }
    }, 500);
  });

  textArea.addEventListener('pointerup', () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
  });

  textArea.addEventListener('pointerleave', () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
    // Восстанавливаем если был показан оригинал
    if (longPressTarget && longPressTarget.classList.contains('show-original')) {
      const restore = longPressTarget.getAttribute('data-restore');
      if (restore) {
        longPressTarget.textContent = restore;
      }
      longPressTarget.classList.remove('show-original');
      longPressTarget._wasLongPress = false;
    }
    longPressTarget = null;
  });

  // Восстановление после долгого тапа
  textArea.addEventListener('pointerup', (e) => {
    if (longPressTarget && longPressTarget.classList.contains('show-original')) {
      // Даём пользователю увидеть оригинал и восстанавливаем
      setTimeout(() => {
        if (longPressTarget && longPressTarget.classList.contains('show-original')) {
          const restore = longPressTarget.getAttribute('data-restore');
          if (restore) {
            longPressTarget.textContent = restore;
          }
          longPressTarget.classList.remove('show-original');
          longPressTarget._wasLongPress = false;
          longPressTarget = null;
        }
      }, 200);
    }
  });

  // Клавиатурная доступность
  textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const span = e.target.closest('span.gr');
      if (!span) return;
      const letter = span.getAttribute('data-letter');
      if (letter) {
        handleLetterTap(letter, span, container);
      }
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

  // Строим wordEntries из словаря + лексикона
  buildWordEntries();

  // Строим контекст для composeVerse
  const composeCtx = {
    mode: settings.mode,
    intensity: settings.intensity,
    progressLetters: progress.letters,
    seedPrefix: bookData.id,
    wordEntries,
    showDiacritics: settings.show?.diacritics ?? false
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

      if (plainView) {
        // Чистый русский текст
        p.appendChild(document.createTextNode(verse.text));
      } else {
        const segments = composeVerse(verse.text, composeCtx);
        const frag = segmentsToFragment(segments, renderCtx);
        p.appendChild(frag);
      }

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

function getChapterCandidates(chapterText) {
  // Находит слова core-лексикона, встречающиеся в тексте главы и отсутствующие в словаре
  if (!coreLexicon || coreLexicon.length === 0) return [];
  const candidates = [];
  for (const lexeme of coreLexicon) {
    if (dictionary[lexeme.id]) continue; // уже в словаре
    for (const matchPattern of lexeme.ruMatches) {
      const re = new RegExp(matchPattern, 'iu');
      if (re.test(chapterText)) {
        // Проверяем exclude
        let excluded = false;
        for (const excPattern of (lexeme.ruExclude || [])) {
          const excRe = new RegExp(excPattern, 'iu');
          if (excRe.test(chapterText)) { excluded = true; break; }
        }
        if (!excluded) {
          candidates.push(lexeme);
          break;
        }
      }
    }
  }
  return candidates.sort((a, b) => (b.freqNT || 0) - (a.freqNT || 0));
}

function buildWordEntries() {
  wordEntries = [];
  if (!coreLexicon || coreLexicon.length === 0) return;

  for (const lexeme of coreLexicon) {
    const entry = dictionary[lexeme.id];
    if (!entry || entry.showInText === false) continue;
    if (entry.status !== 'new' && entry.status !== 'learning' && entry.status !== 'known') continue;

    const intensityMap = { often: 100, sometimes: 50, rare: 25 };
    wordEntries.push({
      lexemeId: lexeme.id,
      lemma: lexeme.lemma,
      regexps: lexeme.ruMatches.map(r => new RegExp(r, 'iu')),
      excludeRegexps: (lexeme.ruExclude || []).map(r => new RegExp(r, 'iu')),
      intensityPct: intensityMap[entry.intensity] || 100,
      status: entry.status
    });
  }
}

function reRenderWindowed() {
  // Перерендер только уже видимых глав
  const textArea = document.getElementById('scripture-text');
  if (!textArea || !bookData) return;

  buildWordEntries();
  const composeCtx = {
    mode: settings.mode,
    intensity: settings.intensity,
    progressLetters: progress.letters,
    seedPrefix: bookData.id,
    wordEntries,
    showDiacritics: settings.show?.diacritics ?? false
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

      if (plainView) {
        p.appendChild(document.createTextNode(verse.text));
      } else {
        const segments = composeVerse(verse.text, composeCtx);
        const frag = segmentsToFragment(segments, renderCtx);
        p.appendChild(frag);
      }

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

function handleWordTap(lexemeId, span, container) {
  if (!coreLexicon) return;
  const lexeme = coreLexicon.find(l => l.id === lexemeId);
  if (!lexeme) return;

  const dictEntry = dictionary[lexemeId];
  const originalText = span.getAttribute('data-original');

  const card = renderWordCard(lexeme, dictEntry, { originalText }, {
    onMarkKnown: async (id) => {
      const { setWordStatus, saveDictionary, getActive } = await import('../../state/dictionary.js');
      dictionary = setWordStatus(id, 'known', dictionary);
      await saveDictionary(dictionary);
      // Точечное обновление
      const spans = document.querySelectorAll(`span.gr[data-lexeme="${id}"]`);
      spans.forEach(s => s.classList.add('known'));
    },
    onAddToDict: async (id) => {
      const { addWord, saveDictionary } = await import('../../state/dictionary.js');
      dictionary = addWord(id, dictionary);
      await saveDictionary(dictionary);
      buildWordEntries();
      reRenderWindowed();
    }
  });

  if (window.innerWidth >= 900) {
    showInInspector(card);
  } else {
    openBottomSheet(card);
  }
}

function handleLetterTap(letterChar, span, container) {
  if (!alphabet) return;

  const letterData = alphabet.find(l => l.lower === letterChar);
  if (!letterData) return;

  const progEntry = progress.letters[letterChar];

  const card = renderLetterCard(letterData, progEntry, async (ch) => {
    progress = markLetterKnown(ch, progress);
    await saveProgress(progress);

    // Точечное обновление классов (без перерендера)
    const spans = document.querySelectorAll(`span.gr[data-letter="${ch}"]`);
    // Просто обновляем карточку если она открыта
    const updatedCard = renderLetterCard(letterData, progress.letters[ch], () => {});
    if (window.innerWidth >= 900) {
      showInInspector(updatedCard);
    } else if (isSheetOpen()) {
      openBottomSheet(updatedCard);
    }
  });

  if (window.innerWidth >= 900) {
    showInInspector(card);
  } else {
    openBottomSheet(card);
  }

  // Режим 2: на десктопе hover-подсказка уже через title
  // title устанавливается в render.js через aria-label
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
