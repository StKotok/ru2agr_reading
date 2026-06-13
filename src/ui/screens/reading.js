import { loadBook } from '../../data/bible-loader.js';
import { loadProgress, saveProgress, markLetterKnown } from '../../state/progress.js';
import { loadSettings, saveSettings } from '../../state/settings.js';
import { loadAlphabet, loadCoreLexicon, loadFrequency } from '../../data/lexicon-loader.js';
import { loadDictionary, setWordStatus, saveDictionary, addWord } from '../../state/dictionary.js';
import { composeVerse } from '../../engine/compose.js';
import { segmentsToFragment } from '../render.js';
import { createTopBar } from '../components/top-bar.js';
import { createIntensitySlider } from '../components/intensity-slider.js';
import { renderLetterCard, renderWordCard } from '../components/word-card.js';
import { openBottomSheet, closeBottomSheet, isOpen as isSheetOpen } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../../router.js';

const DEBOUNCE_MS = 500;
const WINDOW_SIZE = 3;

let progress = null;
let settings = null;
let bookData = null;
let grcBookData = null;
let grcVerseMap = null;

function buildGrcVerseMap() {
  if (!grcBookData) { grcVerseMap = null; return; }
  grcVerseMap = new Map();
  for (const ch of grcBookData.chapters) {
    for (const v of ch.verses) {
      grcVerseMap.set(`${ch.n}:${v.n}`, v);
    }
  }
}

function getGrcVerse(chapterN, verseN) {
  return grcVerseMap?.get(`${chapterN}:${verseN}`);
}
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
let frequencyList = null;
let wordEntries = [];
let grcLoadPromise = null;

async function ensureGreekBookLoaded(showToastOnFail = true) {
  if (grcBookData) return true;
  if (!bookData || settings.mode < 3) return false;
  if (!grcLoadPromise) {
    const bookId = bookData.id;
    grcLoadPromise = loadBook('grc', bookId)
      .then(grc => ({ grc, bookId }))
      .catch(() => ({ grc: null, bookId }));
  }
  const { grc, bookId } = await grcLoadPromise;
  grcLoadPromise = null;
  // Гонки: экран размонтирован (bookData=null) или книга сменилась
  if (!bookData || bookData.id !== bookId) return false;
  if (grc) {
    grcBookData = grc;
    buildGrcVerseMap();
    return true;
  }
  if (showToastOnFail && settings.mode >= 3) {
    showToast('Греческий текст недоступен — словарные замены отключены', { timeout: 5000 });
  }
  return false;
}

export async function mount(container, ctx) {
  const { store } = ctx;

  // Загружаем всё
  [progress, settings, alphabet, dictionary, coreLexicon, frequencyList] = await Promise.all([
    loadProgress(),
    loadSettings(),
    loadAlphabet(),
    loadDictionary(),
    loadCoreLexicon(),
    loadFrequency()
  ]);

  // Строим карту имён букв для aria-label
  letterNames = new Map();
  if (alphabet) {
    for (const l of alphabet) {
      letterNames.set(l.lower, l.name);
    }
  }

  // ВРЕМЕННО: если онбординг пропущен и буквы не введены — вводим все буквы как known
  if (Object.keys(progress.letters).length === 0 && alphabet && alphabet.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    for (const l of alphabet) {
      progress.letters[l.lower] = { status: 'known', introducedAt: today };
    }
    saveProgress(progress);
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

  // Загружаем книгу (и греческий текст для режимов 3+)
  try {
    const loadPromises = [loadBook('syn', bookId)];
    // Грузим греческий текст только для режимов 3+
    if (settings.mode >= 3) {
      loadPromises.push(loadBook('grc', bookId));
    }
    const results = await Promise.all(loadPromises);
    bookData = results[0];
    grcBookData = results[1] || null;
    if (grcBookData) buildGrcVerseMap();
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

  // Если grc не загрузился для режимов 3–5 — предупреждаем
  if (!grcBookData && settings.mode >= 3) {
    showToast('Греческий текст недоступен — словарные замены отключены', { timeout: 5000 });
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
      if (settings.mode >= 3 && !grcBookData) {
        ensureGreekBookLoaded().then(ok => { if (ok) reRenderWindowed(); });
      }
    }
  });

  // === Обработка тапов по греческим вставкам ===

  // Долгий тап (≥500ms) — показать оригинал
  // Используем touchstart/mousedown для универсальности
  const onPressStart = (e) => {
    const span = e.target.closest('span.gr');
    if (!span) return;
    longPressTarget = span;
    longPressTimer = setTimeout(() => {
      if (longPressTarget) {
        longPressTarget._wasLongPress = true;
        const original = longPressTarget.getAttribute('data-original');
        if (original) {
          longPressTarget.setAttribute('data-restore', longPressTarget.textContent);
          longPressTarget.textContent = original;
          longPressTarget.classList.add('show-original');
        }
      }
    }, 500);
  };

  const onPressEnd = (e) => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;

    // Если был долгий тап (показан оригинал) — даём увидеть и восстанавливаем
    if (longPressTarget && longPressTarget.classList.contains('show-original')) {
      const target = longPressTarget;
      longPressTarget = null;
      setTimeout(() => {
        if (target.classList.contains('show-original')) {
          const restore = target.getAttribute('data-restore');
          if (restore) target.textContent = restore;
          target.classList.remove('show-original');
          target._wasLongPress = false;
        }
      }, 200);
      return;
    }

    longPressTarget = null;
  };

  textArea.addEventListener('touchstart', onPressStart, { passive: true });
  textArea.addEventListener('mousedown', onPressStart);
  textArea.addEventListener('touchend', onPressEnd);
  textArea.addEventListener('mouseup', onPressEnd);
  textArea.addEventListener('mouseleave', () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
    if (longPressTarget && longPressTarget.classList.contains('show-original')) {
      const restore = longPressTarget.getAttribute('data-restore');
      if (restore) longPressTarget.textContent = restore;
      longPressTarget.classList.remove('show-original');
      longPressTarget._wasLongPress = false;
    }
    longPressTarget = null;
  });

  // Обычный клик — открываем карточку
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
      handleLetterTap(letter, span);
      return;
    }
    const lexemeId = span.getAttribute('data-lexeme');
    if (lexemeId) {
      handleWordTap(lexemeId, span);
      return;
    }
    // Режим 5: токен с data-strong
    const strong = span.getAttribute('data-strong');
    if (strong && span.classList.contains('grc-token')) {
      handleGrcTokenTap(span);
    }
  });

  // Клавиатурная доступность
  textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const span = e.target.closest('span.gr');
      if (!span) return;
      const letter = span.getAttribute('data-letter');
      if (letter) {
        handleLetterTap(letter, span);
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

/**
 * Строит DocumentFragment для режима 5: греческие токены как основной текст,
 * русский стих снизу как подсказка.
 */
function buildMode5Fragment(grcTokens, ruText, settings) {
  const frag = document.createDocumentFragment();

  // Греческие токены
  for (const token of grcTokens) {
    if (token.w) {
      const span = document.createElement('span');
      span.className = 'gr grc-token';
      span.textContent = token.w;
      span.setAttribute('data-w', token.w);
      span.setAttribute('data-lemma', token.lemma || '');
      span.setAttribute('data-morph', token.morph || '');
      span.setAttribute('data-strong', String(token.strong || ''));
      span.setAttribute('tabindex', '0');
      span.setAttribute('role', 'button');
      span.setAttribute('aria-label', `греческое слово ${token.w}`);

      // Если слово есть в словаре пользователя — подсветка
      if (token.strong && dictionary[Object.keys(dictionary).find(id => {
        const lex = coreLexicon.find(l => l.id === id);
        return lex && lex.strong === token.strong;
      })]) {
        span.classList.add('known');
      }

      frag.appendChild(span);
      frag.appendChild(document.createTextNode(' '));
    }
  }

  // Русская подсказка под стихом
  if (settings.show?.ruHint !== false) {
    const ruHint = document.createElement('p');
    ruHint.className = 'ru-hint';
    ruHint.textContent = ruText;
    frag.appendChild(ruHint);
  }

  return frag;
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
      } else if (settings.mode === 5) {
        // Режим 5: греческий как основной текст


          const grcVerse = getGrcVerse(ch.n, verse.n);
        if (grcVerse && grcVerse.tokens) {
          const frag = buildMode5Fragment(grcVerse.tokens, verse.text, settings);
          p.appendChild(frag);
        } else {
          // Fallback: показываем русский текст через composeVerse
          const segments = composeVerse(verse.text, { ...composeCtx, mode: 1 });
          const frag = segmentsToFragment(segments, renderCtx);
          p.appendChild(frag);
        }
      } else {
        // Добавляем grcVerse и alignment для режимов 3-5
        const verseCtx = { ...composeCtx };
        if (grcBookData && settings.mode >= 3) {


          const grcVerse = getGrcVerse(ch.n, verse.n);
          if (grcVerse) {
            verseCtx.grcVerse = grcVerse;
            verseCtx.alignment = verse.alignment || null;
          }
        }
        const segments = composeVerse(verse.text, verseCtx);
        const frag = segmentsToFragment(segments, renderCtx);
        p.appendChild(frag);
      }

      chapterEl.appendChild(p);
    }

    // Sentinel для трекинга прочитанных глав
    const sentinel = document.createElement('div');
    sentinel.className = 'chapter-end-sentinel';
    sentinel.setAttribute('data-chapter-end', String(ch.n));
    sentinel.style.height = '1px';
    chapterEl.appendChild(sentinel);

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
  setupChapterTracking();

  // Режимы 3-5: если греческий не загрузился при mount — пробуем ещё раз
  if (settings.mode >= 3 && !grcBookData && bookData) {
    ensureGreekBookLoaded(false).then(ok => { if (ok) reRenderWindowed(); });
  }
}

function setupChapterTracking() {
  const sentinels = document.querySelectorAll('.chapter-end-sentinel');
  if (sentinels.length === 0) return;

  const readChapters = new Set(
    progress.reading.books?.[bookData.id]?.chaptersRead || []
  );

  const chapterObserver = new IntersectionObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const chN = parseInt(entry.target.getAttribute('data-chapter-end'));
        if (!isNaN(chN) && !readChapters.has(chN)) {
          readChapters.add(chN);
          changed = true;
        }
      }
    }
    if (changed) {
      // Сохраняем прочитанные главы
      if (!progress.reading.books) progress.reading.books = {};
      if (!progress.reading.books[bookData.id]) progress.reading.books[bookData.id] = {};
      progress.reading.books[bookData.id].chaptersRead = [...readChapters];
      saveProgress(progress);
    }
  }, { threshold: 0.5 });

  for (const sentinel of sentinels) {
    chapterObserver.observe(sentinel);
  }
}

function buildWordEntries() {
  wordEntries = [];
  const intensityMap = { often: 100, sometimes: 50, rare: 25 };

  // Индекс coreLexicon по id для быстрого поиска ruMatches
  const coreById = new Map((coreLexicon || []).map(l => [l.id, l]));

  // Индекс frequencyList по strong (строка) для freq-* записей
  const freqByStrong = new Map();
  if (frequencyList) {
    for (const item of frequencyList) {
      freqByStrong.set(String(item.strong), item);
    }
  }

  // Итерируем ВСЕ записи словаря (включая freq-*)
  for (const [lexemeId, entry] of Object.entries(dictionary)) {
    if (!entry || entry.showInText === false) continue;
    if (entry.status !== 'new' && entry.status !== 'learning' && entry.status !== 'known') continue;

    const core = coreById.get(lexemeId);

    let lemma, strongNum, regexps, excludeRegexps;

    if (core) {
      // Слово из coreLexicon — полный ruMatches guard
      lemma = core.lemma;
      strongNum = core.strong;
      regexps = core.ruMatches.map(r => new RegExp(r, 'iu'));
      excludeRegexps = (core.ruExclude || []).map(r => new RegExp(r, 'iu'));
    } else {
      // freq-* запись — ищем в frequencyList по Strong
      const strongKey = lexemeId.startsWith('freq-') ? lexemeId.replace('freq-', '') : null;
      const freqItem = strongKey ? freqByStrong.get(strongKey) : null;
      if (!freqItem) continue;
      lemma = freqItem.lemma;
      strongNum = freqItem.strong;
      regexps = [];         // нет guard'а — выравнивание достаточная гарантия
      excludeRegexps = [];
    }

    wordEntries.push({
      lexemeId,
      lemma,
      strongNum,
      forms: entry.forms || 'lemma',
      regexps,
      excludeRegexps,
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
      } else if (settings.mode === 5 && grcBookData) {


          const grcVerse = getGrcVerse(ch.n, verse.n);
        if (grcVerse && grcVerse.tokens) {
          const frag = buildMode5Fragment(grcVerse.tokens, verse.text, settings);
          p.appendChild(frag);
        } else {
          p.appendChild(document.createTextNode(verse.text));
        }
      } else {
        const verseCtx = { ...composeCtx };
        if (grcBookData && settings.mode >= 3) {


          const grcVerse = getGrcVerse(ch.n, verse.n);
          if (grcVerse) {
            verseCtx.grcVerse = grcVerse;
            verseCtx.alignment = verse.alignment || null;
          }
        }
        const segments = composeVerse(verse.text, verseCtx);
        const frag = segmentsToFragment(segments, renderCtx);
        p.appendChild(frag);
      }

      section.appendChild(p);
    }
  }
}

function setupObserver(chaptersEls, textArea) {
  // Создаём sentinel'ы как независимые элементы перед каждым placeholder'ом
  const sentinels = [];
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

  // Observe sentinels напрямую (они не удаляются при expand/collapse)
  for (const s of sentinels) {
    observer.observe(s.el);
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

//
// Popover для десктопа — всплывающая карточка рядом с элементом
//
let popoverEl = null;
let popoverOutsideHandler = null;

function closePopover() {
  if (popoverOutsideHandler) {
    document.removeEventListener('click', popoverOutsideHandler);
    popoverOutsideHandler = null;
  }
  if (popoverEl) {
    popoverEl.remove();
    popoverEl = null;
  }
}

function showPopover(card, anchorEl) {
  closePopover();

  popoverEl = document.createElement('div');
  popoverEl.className = 'popover-card';
  popoverEl.setAttribute('role', 'dialog');
  popoverEl.setAttribute('aria-label', 'Карточка слова');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'popover-close';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', closePopover);
  popoverEl.appendChild(closeBtn);

  popoverEl.appendChild(card);
  document.body.appendChild(popoverEl);

  // Позиционирование рядом с anchor
  const rect = anchorEl.getBoundingClientRect();
  const pw = 320;
  let top = rect.bottom + 8;
  let left = rect.left;

  if (left + pw > window.innerWidth - 16) {
    left = window.innerWidth - pw - 16;
  }
  if (left < 16) left = 16;

  const ph = popoverEl.offsetHeight || 200;
  if (top + ph > window.innerHeight - 16) {
    top = rect.top - ph - 8;
  }
  if (top < 16) top = 16;

  popoverEl.style.position = 'fixed';
  popoverEl.style.top = top + 'px';
  popoverEl.style.left = left + 'px';

  // Клик снаружи — закрыть
  popoverOutsideHandler = (e) => {
    if (!popoverEl) return;
    if (!popoverEl.contains(e.target) && e.target !== anchorEl) {
      closePopover();
    }
  };
  requestAnimationFrame(() => {
    document.addEventListener('click', popoverOutsideHandler);
  });
}

function handleWordTap(lexemeId, span) {
  if (!coreLexicon) return;
  const lexeme = coreLexicon.find(l => l.id === lexemeId);
  if (!lexeme) return;

  const dictEntry = dictionary[lexemeId];
  const originalText = span.getAttribute('data-original');

  const card = renderWordCard(lexeme, dictEntry, { originalText }, {
    onMarkKnown: async (id) => {
      dictionary = setWordStatus(id, 'known', dictionary);
      await saveDictionary(dictionary);
      const spans = document.querySelectorAll(`span.gr[data-lexeme="${id}"]`);
      spans.forEach(s => s.classList.add('known'));
    },
    onAddToDict: async (id) => {
      dictionary = addWord(id, dictionary);
      await saveDictionary(dictionary);
      buildWordEntries();
      reRenderWindowed();
    }
  }, settings.show || {});

  if (window.innerWidth >= 900) {
    showPopover(card, span);
  } else {
    openBottomSheet(card);
  }
}

function handleGrcTokenTap(span) {
  const w = span.getAttribute('data-w');
  const lemma = span.getAttribute('data-lemma');
  const morph = span.getAttribute('data-morph');
  const strong = parseInt(span.getAttribute('data-strong')) || 0;

  if (!w) return;

  const card = document.createElement('div');
  card.className = 'card word-card';
  const showGrammar = settings.show?.grammar !== false;
  const showStrongs = settings.show?.strongs === true;
  card.innerHTML = `
    <h3 class="greek-word">${w}</h3>
    ${lemma ? `<p><strong>Лемма:</strong> ${lemma}</p>` : ''}
    ${showGrammar && morph ? `<p><strong>Грамматика:</strong> ${morph}</p>` : ''}
    ${showStrongs && strong ? `<p><strong>Strong:</strong> G${strong}</p>` : ''}
  `;

  if (window.innerWidth >= 900) {
    showPopover(card, span);
  } else {
    openBottomSheet(card);
  }
}

function handleLetterTap(letterChar, span) {
  if (!alphabet) return;

  const letterData = alphabet.find(l => l.lower === letterChar);
  if (!letterData) return;

  const progEntry = progress.letters[letterChar];

  const card = renderLetterCard(letterData, progEntry, async (ch) => {
    progress = markLetterKnown(ch, progress);
    await saveProgress(progress);
    const updatedCard = renderLetterCard(letterData, progress.letters[ch], () => {});
    if (window.innerWidth >= 900) {
      closePopover();
      showPopover(updatedCard, span);
    } else if (isSheetOpen()) {
      openBottomSheet(updatedCard);
    }
  });

  if (window.innerWidth >= 900) {
    showPopover(card, span);
  } else {
    openBottomSheet(card);
  }
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
