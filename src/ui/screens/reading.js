import { loadBook, loadAlignment } from '../../data/bible-loader.js';
import { loadProgress, saveProgress, markLetterKnown, trackNewWord } from '../../state/progress.js';
import { loadSettings, saveSettings, deriveComposeMode, shouldLoadGreek } from '../../state/settings.js';
import { loadCoreLexicon, loadFrequency } from '../../data/lexicon-loader.js';
import { loadAlphabet } from '../../data/bible-loader.js';
import { loadDictionary, setWordStatus, saveDictionary, addWord, countActiveWords, isDictionaryEntry, migrateDictionaryData, saveMigrationResults } from '../../state/dictionary.js';
import { composeVerse } from '../../engine/compose.js';
import { segmentsToFragment } from '../render.js';
import { createTopBar } from '../components/top-bar.js';
import { createModeWidget } from '../components/mode-widget.js';
import { renderLetterCard, renderWordCard } from '../components/word-card.js';
import { openBottomSheet, closeBottomSheet, isOpen as isSheetOpen } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../../router.js';
import { iconX } from '../components/icons.js';

const DEBOUNCE_MS = 500;
const WINDOW_SIZE = 3;
const DATA_NOTICE_VERSION = '1.1-bsb-source';

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
let chaptersEls = [];            // обновляется в renderWindowed и reRenderWindowed
let observer = null;
let reRenderFn = null;
let destroyModeWidget = null;
let plainView = false;
let longPressTimer = null;
let longPressTarget = null;
let dictionary = {};
let coreLexicon = [];
let frequencyList = null;
let wordEntries = [];
let grcLoadPromise = null;
let alignmentBookData = null;
// Безопасная ссылка на store для модульных функций (ensureGreekBookLoaded и др.)
let storeRef = null;

/** Сбрасывает всё модульное состояние греческой книги.
 *  Защита от устаревших результатов — capture bookId перед загрузкой
 *  и проверка bookData.id !== bookId после await (см. ensureGreekBookLoaded). */
function resetGreekBookState() {
  grcBookData = null;
  grcVerseMap = null;
  grcLoadPromise = null;
  alignmentBookData = null;
}
function setGrcStatus(status) {
  if (storeRef) storeRef.update(s => ({ ...s, grcStatus: status }));
}
// Подписки на store для очистки в unmount
let unsubProgress = null;
let unsubSettings = null;
// Кэш индексных карт (coreLexicon и frequencyList не меняются во время сессии)
let coreByIdCache = null;
let coreByLegacyKey = null;
let freqByKeyCache = null;
let lexemeIdKnownSet = null; // Set<string> — какие lexemeId есть в словаре

async function ensureGreekBookLoaded(showToastOnFail = true) {
  // Греческие данные есть и принадлежат текущей книге — быстрый успех
  if (grcBookData && bookData && grcBookData.id === bookData.id) return true;
  // Греческие данные есть, но от другой книги — сбросить и продолжить загрузку
  if (grcBookData && bookData && grcBookData.id !== bookData.id) {
    resetGreekBookState();
  }
  // Греческие данные есть, но bookData нет (экран размонтирован) — ничего не делаем
  if (grcBookData && !bookData) return false;

  if (!bookData || !shouldLoadGreek(settings, getActiveWordCount())) return false;
  if (!grcLoadPromise) {
    const bookId = bookData.id;
    setGrcStatus('loading');
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
    setGrcStatus('available');
    return true;
  }
  // Греческий текст не загрузился для текущей книги
  setGrcStatus('unavailable');
  if (showToastOnFail && shouldLoadGreek(settings, getActiveWordCount())) {
    showToast('Греческий текст недоступен — словарные замены отключены', { timeout: 5000 });
  }
  return false;
}

export async function mount(container, ctx) {
  const { store } = ctx;
  storeRef = store;

  // Сбрасываем греческое состояние от предыдущего монтирования
  resetGreekBookState();

  // Загружаем всё
  [progress, settings, alphabet, dictionary, coreLexicon, frequencyList] = await Promise.all([
    loadProgress(),
    loadSettings(),
    loadAlphabet(),
    loadDictionary(),
    loadCoreLexicon(),
    loadFrequency()
  ]);

  // Миграция словаря: перенос legacy-ключей → lexemeId (идемпотентно).
  if (dictionary && coreLexicon && Object.keys(dictionary).length > 0) {
    try {
      const migrated = migrateDictionaryData(dictionary, progress, coreLexicon);
      if (migrated.warnings.length > 0) {
        console.warn('dictionary migration warnings:', migrated.warnings);
      }
      dictionary = migrated.dictionary;
      progress = migrated.progress;
      await saveMigrationResults(migrated);
    } catch (e) {
      console.warn('dictionary migration error:', e);
    }
  }

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

  // Публикуем в store (начальное состояние — idle, Greek не нужен до проверки)
  store.update(s => ({ ...s, settings, progress, dictionary, coreLexicon, frequencyList, grcStatus: 'idle' }));

  // Ранняя подписка на settings — до создания mode-widget, чтобы изменения
  // во время загрузки книги не терялись. bookData ещё null, поэтому
  // перерендер и дозагрузка греческого откладываются до появления bookData.
  unsubSettings = store.subscribe(['settings'], () => {
    progress = store.get().progress || progress;
    const newSettings = store.get().settings;
    if (newSettings && newSettings !== settings) {
      settings = newSettings;
      if (bookData) {
        reRenderWindowed();
        if (shouldLoadGreek(settings, getActiveWordCount()) && !grcBookData) {
          ensureGreekBookLoaded().then(ok => { if (ok) reRenderWindowed(); });
        }
      }
    }
  });

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

  // Mode widget (чип + попап)
  const modeWidget = createModeWidget({ store });
  destroyModeWidget = modeWidget.destroy;
  bar.appendChild(modeWidget.chip);

  // Семантический заголовок страницы (скрыт визуально, доступен скринридерам)
  const pageHeading = document.createElement('h1');
  pageHeading.className = 'visually-hidden';
  pageHeading.id = 'reading-heading';
  container.appendChild(pageHeading);

  // Wrapper для текста + инспектора (desktop layout)
  const readingLayout = document.createElement('div');
  readingLayout.className = 'reading-layout';
  container.appendChild(readingLayout);

  // Контейнер текста
  const textArea = document.createElement('div');
  textArea.className = 'scripture-text';
  textArea.id = 'scripture-text';
  readingLayout.appendChild(textArea);

  // Инспектор (desktop: панель справа 364px, mobile: скрыт)
  const inspector = document.createElement('div');
  inspector.className = 'reading-inspector';
  inspector.id = 'reading-inspector';
  inspector.innerHTML = `
    <div class="inspector-empty">
      <div class="inspector-empty-icon">α</div>
      <div class="inspector-empty-text">Выберите греческое слово или букву в тексте — карточка появится здесь.</div>
    </div>
  `;
  readingLayout.appendChild(inspector);

  // Загружаем книгу (и греческий текст + alignment если нужен для словарного слоя)
  try {
    const needsGreek = shouldLoadGreek(settings, getActiveWordCount());
    const loadPromises = [loadBook('eng', bookId)];
    if (needsGreek) {
      setGrcStatus('loading');
      loadPromises.push(loadBook('grc', bookId));
      loadPromises.push(loadAlignment(bookId));
    }
    const results = await Promise.all(loadPromises);
    bookData = results[0];
    if (needsGreek) {
      grcBookData = results[1] || null;
      alignmentBookData = results[2] || null;
      if (grcBookData) {
        buildGrcVerseMap();
        setGrcStatus('available');
      } else {
        setGrcStatus('unavailable');
      }
    }
    // Если Greek не нужен — grcStatus остаётся 'idle'
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

  // One-time BSB source notice (non-blocking banner)
  const dismissedNotices = settings.dismissedNotices || [];
  if (!dismissedNotices.includes(DATA_NOTICE_VERSION)) {
    const notice = document.createElement('div');
    notice.className = 'data-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = `
      <span>В версии 1.1 основной текст чтения временно английский (Berean Standard Bible),
      потому что это источник с чистой лицензией. Русский интерфейс и греческий слой
      сохраняются. Русский перевод вернётся отдельным этапом после проверки лицензии.</span>
      <button class="data-notice-close" aria-label="Понятно">
        ${iconX(16)}
      </button>
    `;
    notice.querySelector('.data-notice-close').addEventListener('click', async () => {
      notice.remove();
      settings.dismissedNotices = [...(settings.dismissedNotices || []), DATA_NOTICE_VERSION];
      await saveSettings(settings);
    });
    // Insert after top-bar, above scripture-text
    const textArea = container.querySelector('#scripture-text');
    if (textArea && textArea.parentNode) {
      textArea.parentNode.insertBefore(notice, textArea);
    }
  }

  // Обновляем заголовок страницы для скринридеров
  const heading = container.querySelector('#reading-heading');
  if (heading) heading.textContent = `Чтение — ${bookData.title}`;

  // Обновляем settings из store — пользователь мог изменить их во время загрузки
  settings = store.get().settings || settings;

  // Сверка: если настройки теперь требуют греческий, а он не загружен (или упал),
  // пробуем загрузить до первого рендера, чтобы избежать видимой смены режима.
  if (shouldLoadGreek(settings, getActiveWordCount()) && !grcBookData) {
    const ok = await ensureGreekBookLoaded(false);
    if (!ok) {
      showToast('Греческий текст недоступен — словарные замены отключены', { timeout: 5000 });
    }
  }

  // Функция рендера/перерендера видимых глав
  reRenderFn = () => renderWindowed();
  renderWindowed();

  // Восстановление позиции скролла
  restoreScroll(bookId);

  // Подписка на изменения прогресса (буквы)
  unsubProgress = store.subscribe(['progress'], () => {
    const newProgress = store.get().progress;
    if (newProgress && newProgress !== progress) {
      progress = newProgress;
      reRenderWindowed();
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
    // Слово: лексема, форма или греческий токен
    if (span.getAttribute('data-lexeme') || span.getAttribute('data-strong') || span.getAttribute('data-w')) {
      handleWordTap(span);
      return;
    }
  });

  // Клавиатурная доступность
  textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const span = e.target.closest('span.gr');
      if (!span) return;
      e.preventDefault(); // предотвращает синтетический click на role="button" в Chromium
      const letter = span.getAttribute('data-letter');
      if (letter) {
        handleLetterTap(letter, span);
        return;
      }
      if (span.getAttribute('data-lexeme') || span.getAttribute('data-strong') || span.getAttribute('data-w')) {
        handleWordTap(span);
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
        window.scrollTo({ top: targetScroll, behavior: 'instant' });
      });
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

/**
 * Строит DocumentFragment для греческого оригинала: греческие токены как основной текст,
 * английский BSB стих снизу как подсказка.
 */
function buildGreekTextFragment(grcTokens, sourceText, settings) {
  const frag = document.createDocumentFragment();

  // Греческие токены
  for (const token of grcTokens) {
    const surface = token.s || token.w;
    if (surface) {
      const span = document.createElement('span');
      span.className = 'gr grc-token';
      span.textContent = surface;
      span.setAttribute('data-s', surface);
      span.setAttribute('data-lemma', token.lemma || '');
      span.setAttribute('data-morph', token.morph || '');
      span.setAttribute('data-lexeme-id', token.lexemeId || '');
      span.setAttribute('data-lexeme', token.lexemeId || token.lexemeKey || '');
      span.setAttribute('data-lexeme-key', token.lexemeSlug || token.lexemeKey || token.lexemeId || '');
      span.setAttribute('tabindex', '0');
      span.setAttribute('role', 'button');
      span.setAttribute('aria-label', `греческое слово ${surface}`);

      // Если слово есть в словаре пользователя — подсветка по lexemeId
      const tokenLexId = token.lexemeId || token.lexemeKey;
      if (tokenLexId && lexemeIdKnownSet && lexemeIdKnownSet.has(tokenLexId)) {
        span.classList.add('known');
      }

      frag.appendChild(span);
      frag.appendChild(document.createTextNode(' '));
    }
  }

  // Английская подсказка BSB под стихом
  if (settings.show?.ruHint !== false) {
    const sourceHint = document.createElement('p');
    sourceHint.className = 'ru-hint';
    sourceHint.textContent = sourceText;
    frag.appendChild(sourceHint);
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
  chaptersEls = [];

  // Строим wordEntries из словаря + лексикона
  buildWordEntries();

  // Строим контекст для composeVerse
  const composeCtx = {
    mode: deriveComposeMode(settings, wordEntries.length),
    intensity: settings.intensity,
    progressLetters: progress.letters,
    seedPrefix: bookData.id,
    wordEntries,
    showDiacritics: settings.show?.diacritics ?? false,
    script: 'latin'                // BSB English — латиница
  };

  const renderCtx = { letterNames };

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const chapterEl = document.createElement('section');
    chapterEl.setAttribute('data-chapter', String(ch.n));
    chapterEl.id = `ch-${ch.n}`;

    const heading = document.createElement('div');
    heading.className = 'chapter-label';
    heading.textContent = `${bookData.short || bookData.title} · глава ${ch.n}`;
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
      } else if (settings.readingMode === 'greek') {
        // Греческий оригинал как основной текст
        const grcVerse = getGrcVerse(ch.n, verse.n);
        if (grcVerse && grcVerse.tokens) {
          const frag = buildGreekTextFragment(grcVerse.tokens, verse.text, settings);
          p.appendChild(frag);
        } else {
          // Fallback: показываем русский текст через composeVerse
          const segments = composeVerse(verse.text, { ...composeCtx, mode: 1 });
          const frag = segmentsToFragment(segments, renderCtx);
          p.appendChild(frag);
        }
      } else {
        // MACULA v3: передаём words (translation), grcTokens (original), alignment (pairsByRef)
        const verseCtx = { ...composeCtx };
        if (grcBookData) {
          const grcVerse = getGrcVerse(ch.n, verse.n);
          if (grcVerse) {
            verseCtx.grcTokens = grcVerse.tokens || null;
            verseCtx.words = verse.words || null;
            verseCtx.alignment = alignmentBookData?.pairsByRef?.[verse.ref] || null;
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

  // Если греческий не загрузился при mount — пробуем ещё раз
  if (!grcBookData && bookData && shouldLoadGreek(settings, getActiveWordCount())) {
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

function getActiveWordCount() {
  return countActiveWords(dictionary, coreLexicon, frequencyList);
}

function buildWordEntries() {
  wordEntries = [];
  const intensityMap = { often: 100, sometimes: 50, rare: 25 };

  // Индекс coreLexicon по lexemeId (канонический) + legacyKey fallback
  coreByIdCache = new Map((coreLexicon || []).map(l => [l.lexemeId, l]).filter(([key]) => key));
  coreByLegacyKey = new Map((coreLexicon || []).flatMap(l =>
    [l.lexemeKey, l.lexemeSlug, ...(l.legacyKeys || [])]
      .filter(Boolean)
      .map(k => [k, l])
  ));

  // Индекс frequencyList по lexemeId первым, legacy fallback
  freqByKeyCache = new Map();
  if (frequencyList) {
    for (const item of frequencyList) {
      const key = item.lexemeId || item.lexemeKey || item.lexemeSlug;
      if (key) freqByKeyCache.set(key, item);
    }
  }

  // Индекс lexemeId, присутствующих в словаре (для buildGreekTextFragment)
  lexemeIdKnownSet = new Set();

  // Итерируем ВСЕ записи словаря (включая legacy)
  for (const [dictKey, entry] of Object.entries(dictionary)) {
    if (!isDictionaryEntry(entry)) continue;
    if (entry.showInText === false) continue;
    if (entry.status !== 'new' && entry.status !== 'learning' && entry.status !== 'known') continue;

    const core = coreByIdCache.get(dictKey) || coreByLegacyKey.get(dictKey);

    let lemma, lexemeKey, regexps, excludeRegexps;
    const canonicalLexemeId = core?.lexemeId || dictKey;

    if (core) {
      // Слово из coreLexicon — полный ruMatches guard
      lemma = core.lemma;
      lexemeKey = core.lexemeKey || core.lexemeSlug || canonicalLexemeId;
      regexps = (core.ruMatches || []).map(r => new RegExp(r, 'iu'));
      excludeRegexps = (core.ruExclude || []).map(r => new RegExp(r, 'iu'));
    } else {
      // legacy запись — ищем в frequencyList
      const freqItem = freqByKeyCache.get(dictKey)
        || (frequencyList || []).find(f => (f.lexemeId || f.lexemeKey) === dictKey);
      if (!freqItem) continue;
      lemma = freqItem.lemma;
      lexemeKey = freqItem.lexemeKey || freqItem.lexemeId || dictKey;
      regexps = [];
      excludeRegexps = [];
    }

    if (canonicalLexemeId) lexemeIdKnownSet.add(canonicalLexemeId);

    wordEntries.push({
      lexemeId: canonicalLexemeId,
      lexemeKey: lexemeKey || canonicalLexemeId,
      lemma,
      forms: (entry.forms != null) ? entry.forms : (settings.wordLayer === 'form' ? 'form' : 'lemma'),
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
    mode: deriveComposeMode(settings, wordEntries.length),
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
      } else if (settings.readingMode === 'greek') {
        const grcVerse = grcBookData ? getGrcVerse(ch.n, verse.n) : null;
        if (grcVerse && grcVerse.tokens) {
          const frag = buildGreekTextFragment(grcVerse.tokens, verse.text, settings);
          p.appendChild(frag);
        } else {
          // Fallback: без греческих данных показываем буквенную замену (как в renderWindowed)
          const segments = composeVerse(verse.text, { ...composeCtx, mode: 1 });
          const frag = segmentsToFragment(segments, renderCtx);
          p.appendChild(frag);
        }
      } else {
        // MACULA v3: words + grcTokens + alignment
        const verseCtx = { ...composeCtx };
        if (grcBookData) {
          const grcVerse = getGrcVerse(ch.n, verse.n);
          if (grcVerse) {
            verseCtx.grcTokens = grcVerse.tokens || null;
            verseCtx.words = verse.words || null;
            verseCtx.alignment = alignmentBookData?.pairsByRef?.[verse.ref] || null;
          }
        }
        const segments = composeVerse(verse.text, verseCtx);
        const frag = segmentsToFragment(segments, renderCtx);
        p.appendChild(frag);
      }

      section.appendChild(p);
    }
    // Синхронизируем chaptersEls — клонируем свежий DOM для будущей ленивой загрузки
    if (chaptersEls[chN - 1]) {
      chaptersEls[chN - 1] = section.cloneNode(true);
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
  closeBtn.innerHTML = iconX(18);
  closeBtn.addEventListener('click', closePopover);
  popoverEl.appendChild(closeBtn);

  popoverEl.appendChild(card);
  document.body.appendChild(popoverEl);

  // Позиционирование рядом с anchor
  const rect = anchorEl.getBoundingClientRect();
  const pw = 440;
  const margin = 16;
  let left = rect.left;

  if (left + pw > window.innerWidth - margin) {
    left = window.innerWidth - pw - margin;
  }
  if (left < margin) left = margin;

  // Доступное место снизу и сверху от anchor
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;

  // Выбираем сторону с большим местом
  let top;
  let maxH;
  if (spaceBelow >= spaceAbove) {
    top = rect.bottom + 8;
    maxH = spaceBelow - 8;
  } else {
    maxH = spaceAbove - 8;
    top = Math.max(margin, rect.top - maxH - 8);
  }
  // Не даём карточке быть меньше 200px
  if (maxH < 200) maxH = 200;
  if (top < margin) top = margin;

  popoverEl.style.position = 'fixed';
  popoverEl.style.top = top + 'px';
  popoverEl.style.left = left + 'px';
  popoverEl.style.maxHeight = maxH + 'px';

  // Скролл внутри карточки, а не на поповере
  card.style.maxHeight = 'none';
  card.style.overflowY = 'auto';

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

/**
 * Собирает все данные о слове из span'а и загруженных структур.
 * Работает единообразно для всех видов греческого слоя.
 * @param {HTMLElement} span — span.gr элемент
 * @returns {object|null} wordData или null если данных недостаточно
 */
function collectWordData(span) {
  // Поверхностная форма: в словарном слое — textContent,
  // в греческом оригинале — data-s
  const sAttr = span.getAttribute('data-s');
  const surfaceForm = sAttr || span.textContent.trim();
  if (!surfaceForm) return null;

  // Канонический ключ первый: data-lexeme-id, затем data-lexeme, затем data-lexeme-key
  const lexemeIdFromAttr = span.getAttribute('data-lexeme-id') || span.getAttribute('data-lexeme');
  const legacyKeyFromAttr = span.getAttribute('data-lexeme-key');
  const lemmaFromAttr = span.getAttribute('data-lemma');
  const morph = span.getAttribute('data-morph') || null;
  const strongs = span.getAttribute('data-strongs') || null;

  // Ищем в лексиконе — по lexemeId первым, затем legacy
  const core = lexemeIdFromAttr
    ? (coreByIdCache?.get(lexemeIdFromAttr) || null)
    : (coreByLegacyKey?.get(legacyKeyFromAttr) || null);

  const lemma = lemmaFromAttr || core?.lemma || surfaceForm;

  // Частотность: lexemeId первым
  const lookupKey = lexemeIdFromAttr || legacyKeyFromAttr;
  const freq = lookupKey
    ? (freqByKeyCache?.get(lookupKey)
        || (frequencyList || []).find(f => (f.lexemeId || f.lexemeKey) === lookupKey))
    : null;

  const translit = core?.translit || freq?.translit || freq?.transliteration || null;
  const gloss = core?.ruGloss || core?.gloss || null;
  const shortGloss = core?.shortGloss || null;
  const senses = core?.senses || null;
  const detail = core?.detail || null;
  const pos = core?.pos || core?.posLabelRu || null;
  const posLabelRu = core?.posLabelRu || null;
  const ref = core?.ref || null;
  const allRefs = core?.allRefs || null;
  const allRefsCount = core?.allRefsCount || null;
  const glossesBerean = core?.glossesBerean || null;
  const glossesCherith = core?.glossesCherith || null;

  // Словарная запись: канонический lexemeId первым
  let dictEntry = null;
  const effectiveLexemeId = lexemeIdFromAttr || legacyKeyFromAttr || core?.lexemeId || core?.id || null;
  if (effectiveLexemeId) {
    dictEntry = dictionary[effectiveLexemeId] || null;
  }

  const original = span.getAttribute('data-original') || null;

  return {
    surfaceForm,
    lemma,
    translit,
    gloss,
    shortGloss,
    senses,
    detail,
    pos,
    posLabelRu,
    ref,
    allRefs,
    allRefsCount,
    glossesBerean,
    glossesCherith,
    morph,
    freq: freq ? { rank: freq.rank, count: freq.count || freq.tokenCount } : null,
    dictEntry,
    lexemeId: effectiveLexemeId,
    strong: strongs,
    original
  };
}

function handleWordTap(span) {
  const wordData = collectWordData(span);
  if (!wordData) return;

  const card = renderWordCard(wordData, {
    onMarkStatus: async (lexemeId, newStatus) => {
      // Добавляем в словарь если ещё нет
      if (!dictionary[lexemeId]) {
        dictionary = addWord(lexemeId, dictionary);
        progress = trackNewWord(lexemeId, progress);
        saveProgress(progress);
      }
      dictionary = setWordStatus(lexemeId, newStatus, dictionary);
      await saveDictionary(dictionary);
      if (storeRef) storeRef.update(s => ({ ...s, dictionary, progress }));

      // Визуальная подсветка в тексте — канонический lexemeId
      const escaped = CSS.escape(lexemeId);
      const spans = document.querySelectorAll(
        `span.gr[data-lexeme-id="${escaped}"], span.gr[data-lexeme="${escaped}"]`
      );
      spans.forEach(s => {
        if (newStatus === 'known') s.classList.add('known');
        else s.classList.remove('known');
      });

      buildWordEntries();
      reRenderWindowed();
    },
    onShowDetails: (lexemeId) => {
      showToast('Подробная карточка появится в следующем обновлении');
    }
  });

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
  chaptersEls = [];
  storeRef = null;
  if (unsubProgress) { unsubProgress(); unsubProgress = null; }
  if (unsubSettings) { unsubSettings(); unsubSettings = null; }
  if (destroyModeWidget) { destroyModeWidget(); destroyModeWidget = null; }
  resetGreekBookState();
}
