import { loadDictionary, saveDictionary, addWord, setWordStatus, setWordSetting, isDictionaryEntry } from '../../state/dictionary.js';
import { loadCoreLexicon, loadFrequency } from '../../data/lexicon-loader.js';
import { loadProgress, saveProgress, trackNewWord } from '../../state/progress.js';
import { openBottomSheet } from '../components/bottom-sheet.js';
import { iconX } from '../components/icons.js';

let dict = {};
let lexicon = [];
let frequencyList = [];
let progress = null;
let container = null;
let store = null;
let filterStatus = 'all';
let filterPOS = 'all';
let searchQuery = '';
let renderedCount = 0;
let lastDividerBucket = 0;
let bucketCoverage = {};
let dictObserver = null;       // IntersectionObserver для ленивой подгрузки
const PAGE_SIZE = 100;

// Группировка частей речи для фильтра
const POS_GROUPS = {
  verb: new Set(['глаг.', 'глагол']),
  noun: new Set(['сущ., муж. род', 'сущ., жен. род', 'сущ., ср. род', 'сущ., муж. род (имя)', 'сущ., муж. род / прил.']),
  adj: new Set(['прил.', 'прич.', 'нар.']),
  func: new Set(['мест.', 'предлог', 'союз', 'част.', 'числ.', 'артикль, мест.', 'предлог/союз', 'нар./союз'])
};

function classifyPOS(rawPos) {
  if (!rawPos) return null;
  for (const [group, values] of Object.entries(POS_GROUPS)) {
    if (values.has(rawPos)) return group;
  }
  return 'func';
}

// Поповер для десктопа
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

  const rect = anchorEl.getBoundingClientRect();
  const pw = 360;
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

  // Ограничение высоты, чтобы карточка не выходила за экран
  const spaceBelow = window.innerHeight - top - 16;
  const maxH = Math.max(200, spaceBelow);
  popoverEl.style.maxHeight = maxH + 'px';
  card.style.maxHeight = 'none';
  card.style.overflowY = 'auto';

  popoverEl.style.position = 'fixed';
  popoverEl.style.top = top + 'px';
  popoverEl.style.left = left + 'px';

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

export async function mount(cnt, ctx) {
  container = cnt;
  store = ctx.store;
  [dict, lexicon, frequencyList, progress] = await Promise.all([
    loadDictionary(), loadCoreLexicon(), loadFrequency(), loadProgress()
  ]);
  // Обогащаем частотный список POS-категориями из core-словаря
  const coreByStrong = coreById();
  for (const item of frequencyList) {
    const core = coreByStrong.get(item.strong);
    item.posGroup = core ? classifyPOS(core.pos) : null;
  }
  bucketCoverage = computeBucketCoverage(frequencyList);
  renderedCount = 0;
  filterStatus = 'all';
  filterPOS = 'all';
  searchQuery = '';
  render();
}

function getFilteredList() {
  if (!frequencyList || frequencyList.length === 0) return [];

  const coreByIdMap = coreById();
  let filtered = frequencyList;

  // Поиск по лемме или транслитерации
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(item =>
      item.lemma.toLowerCase().includes(q) ||
      item.translit.toLowerCase().includes(q)
    );
  }

  // Фильтр по части речи
  if (filterPOS !== 'all') {
    filtered = filtered.filter(item => item.posGroup === filterPOS);
  }

  // Фильтр «Отмеченные»: слова, включённые для показа в тексте
  if (filterStatus === 'checked') {
    return filtered.filter(item => {
      const lex = coreByIdMap.get(item.strong);
      const entry = lex ? dict[lex.id] : dict[`freq-${item.strong}`];
      return entry && entry.showInText !== false;
    });
  }

  // Фильтр по статусу
  if (filterStatus !== 'all') {
    return filtered.filter(item => {
      const lex = coreByIdMap.get(item.strong);
      const entry = lex ? dict[lex.id] : dict[`freq-${item.strong}`];
      return entry && entry.status === filterStatus;
    });
  }

  return filtered;
}

function renderPersonalDictionaryFallback() {
  const entries = Object.entries(dict).filter(([_, e]) => isDictionaryEntry(e));
  const coreByIdMap = new Map((lexicon || []).map(l => [l.id, l]));

  // Заголовок
  const info = document.createElement('div');
  info.className = 'card';
  info.innerHTML = '<p>Частотный список недоступен — показан личный словарь.</p>';
  container.appendChild(info);

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = '<p>Частотный список недоступен. Личный словарь пока пуст.</p>';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'dict-list';
  container.appendChild(list);

  for (const [dictId, entry] of entries) {
    const core = coreByIdMap.get(dictId);
    let lemma, translit, gloss, strongNum;
    if (core) {
      lemma = core.lemma;
      translit = core.translit;
      gloss = core.ruGloss || core.glossesBerean?.[0] || '';
      strongNum = core.strongs?.[0];
    } else {
      // freq-* запись без frequencyList — показываем id
      const strongSuffix = dictId.startsWith('freq-') ? dictId.replace('freq-', '') : null;
      lemma = dictId;
      translit = '';
      gloss = strongSuffix ? `Strong G${strongSuffix}` : '';
      strongNum = strongSuffix ? parseInt(strongSuffix) : 0;
    }

    const pseudoItem = {
      strong: strongNum,
      lemma,
      translit,
      count: core ? (core.freqNT || 0) : 0,
      rank: 0,
      hasAlignment: true
    };

    const row = document.createElement('div');
    row.className = 'dict-row';
    row.setAttribute('data-strong', String(strongNum || 0));

    row.innerHTML = `
      <span class="dict-rank">–</span>
      <span class="dict-lemma">${lemma}</span>
      <span class="dict-translit">${translit}</span>
      <span class="dict-freq">${pseudoItem.count || '–'}</span>
      ${entry ? `<span class="dict-badge badge-${entry.status || 'new'}">${{ new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry.status] || 'Новое'}</span>` : '<span class="dict-badge-placeholder"></span>'}
      <label class="dict-check" title="Показывать в тексте">
        <input type="checkbox" ${entry && entry.showInText !== false ? 'checked' : ''} aria-label="Показывать ${lemma} в тексте">
      </label>
    `;

    // Чекбокс
    const checkbox = row.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', async () => {
      let updated = { ...dict };
      if (checkbox.checked) {
        updated = setWordSetting(dictId, 'showInText', true, updated);
      } else {
        if (updated[dictId]) {
          updated = setWordSetting(dictId, 'showInText', false, updated);
        }
      }
      dict = updated;
      await saveDictionary(dict);
      store.update(s => ({ ...s, dictionary: dict }));
    });

    // Тап по строке
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      showWordCard(pseudoItem, core, dict[dictId], dictId, row);
    });

    list.appendChild(row);
  }
}

function render() {
  if (!container) return;
  closePopover();
  container.innerHTML = '';
  renderedCount = 0;
  lastDividerBucket = 0;

  const filtered = getFilteredList();

  // Частотный список недоступен — показываем личный словарь
  if (!frequencyList || frequencyList.length === 0) {
    renderPersonalDictionaryFallback();
    return;
  }

  // ═══ Header: Словарь + N слов ═══
  const header = document.createElement('div');
  header.className = 'dict-header';
  header.innerHTML = `
    <div class="dict-title-row">
      <span class="dict-title">Словарь</span>
      <span class="dict-title-count">${filtered.length}&nbsp;слов</span>
    </div>
  `;

  // Search bar
  const searchContainer = document.createElement('div');
  searchContainer.className = 'dict-search-container';
  searchContainer.innerHTML = `
    <div class="dict-search-bar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--muted);flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="search" placeholder="Поиск: λόγος или logos…" value="${searchQuery.replace(/"/g, '&quot;')}" aria-label="Поиск слов в словаре">
    </div>`;
  const searchInput = searchContainer.querySelector('input');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value;
      renderedCount = 0;
      render();
    }, 150);
  });
  header.appendChild(searchContainer);

  // Filter row: status buttons + POS select + show-in-text toggle
  const filterRow = document.createElement('div');
  filterRow.className = 'dict-filter-row';

  const statusBtns = [
    { value: 'all', label: 'Все' },
    { value: 'new', label: 'Новые' },
    { value: 'learning', label: 'Учу' },
    { value: 'known', label: 'Знаю' },
  ];
  statusBtns.forEach(({ value, label }) => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (filterStatus === value ? ' btn-primary' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      filterStatus = value;
      renderedCount = 0;
      render();
    });
    filterRow.appendChild(btn);
  });

  // POS dropdown
  const posSelect = document.createElement('select');
  posSelect.className = 'dict-filter-select';
  posSelect.setAttribute('aria-label', 'Фильтр по части речи');
  [
    { value: 'all', label: 'Все' },
    { value: 'noun', label: 'Сущ.' },
    { value: 'verb', label: 'Глаг.' },
    { value: 'adj', label: 'Прил.' },
    { value: 'func', label: 'Служ.' }
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    if (value === filterPOS) opt.selected = true;
    posSelect.appendChild(opt);
  });
  posSelect.addEventListener('change', () => {
    filterPOS = posSelect.value;
    renderedCount = 0;
    render();
  });
  filterRow.appendChild(posSelect);

  // Show-in-text toggle
  const isChecked = filterStatus === 'checked';
  const showToggle = document.createElement('button');
  showToggle.className = 'dict-show-toggle' + (isChecked ? ' on' : '');
  showToggle.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>
    В тексте`;
  showToggle.addEventListener('click', () => {
    filterStatus = filterStatus === 'checked' ? 'all' : 'checked';
    renderedCount = 0;
    render();
  });
  filterRow.appendChild(showToggle);

  header.appendChild(filterRow);
  container.appendChild(header);

  // ═══ Word list ═══
  const listScroll = document.createElement('div');
  listScroll.className = 'dict-list-scroll';

  const list = document.createElement('div');
  list.className = 'dict-list';
  listScroll.appendChild(list);
  container.appendChild(listScroll);

  // Render first PAGE_SIZE, rest via Observer
  renderBatch(list, filtered);

  if (filtered.length > PAGE_SIZE * 2) {
    if (dictObserver) dictObserver.disconnect();
    const sentinel = document.createElement('div');
    sentinel.className = 'dict-sentinel';
    listScroll.appendChild(sentinel);
    dictObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        dictObserver.disconnect();
        sentinel.remove();
        renderBatch(list, filtered);
        if (renderedCount < filtered.length) {
          const nextSentinel = document.createElement('div');
          nextSentinel.className = 'dict-sentinel';
          listScroll.appendChild(nextSentinel);
          dictObserver.observe(nextSentinel);
        } else dictObserver = null;
      }
    });
    dictObserver.observe(sentinel);
  }
}

function renderBatch(list, filtered) {
  const coreByIdMap = coreById();
  const end = Math.min(renderedCount + PAGE_SIZE, filtered.length);
  const showDividers = !searchQuery.trim();

  for (let i = renderedCount; i < end; i++) {
    const item = filtered[i];
    const lex = coreByIdMap.get(item.strong);
    const dictId = lex ? lex.id : `freq-${item.strong}`;
    const entry = dict[dictId];
    const available = item.hasAlignment;

    // Дивайдер при смене частотной группы (только без поиска)
    if (showDividers) {
      const bucket = rankBucket(item.rank);
      if (bucket > lastDividerBucket) {
        lastDividerBucket = bucket;
        const pct = bucketCoverage[bucket];
        const pctText = pct !== undefined ? ` · приблизительно ${pct}% текста НЗ` : '';
        const divider = document.createElement('div');
        divider.className = 'dict-divider';
        divider.innerHTML = `<span>Топ ${bucket}${pctText}</span>`;
        list.appendChild(divider);
      }
    }

    const row = document.createElement('div');
    row.className = `dict-row${!available ? ' dict-row--disabled' : ''}`;
    row.setAttribute('data-strong', String(item.strong));
    const statusLabel = { new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry?.status] || '';

    row.innerHTML = `
      <span class="dict-rank">${item.rank}</span>
      <span class="dict-lemma">${item.lemma}</span>
      <span class="dict-translit">${item.translit}</span>
      <span class="dict-freq">${item.count}</span>
      ${entry ? `<span class="dict-badge badge-${entry.status || 'new'}">${statusLabel}</span>` : '<span class="dict-badge-placeholder"></span>'}
      <label class="dict-check" title="${available ? 'Показывать в тексте' : 'Нет проверенного соответствия — слово не участвует в подстановках'}">
        <input type="checkbox" ${entry && entry.showInText !== false ? 'checked' : ''} ${!available ? 'disabled' : ''} aria-label="Показывать ${item.lemma} в тексте">
      </label>
    `;

    // Чекбокс
    const checkbox = row.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', async () => {
      let updated = { ...dict };
      if (checkbox.checked) {
        if (!updated[dictId]) {
          updated = addWord(dictId, updated);
          if (progress) {
            progress = trackNewWord(dictId, progress);
            saveProgress(progress);
          }
        }
        updated = setWordSetting(dictId, 'showInText', true, updated);
      } else {
        if (updated[dictId]) {
          updated = setWordSetting(dictId, 'showInText', false, updated);
        }
      }
      dict = updated;
      await saveDictionary(dict);
      store.update(s => ({ ...s, dictionary: dict }));
      // Точечное обновление бейджа строки
      const badge = row.querySelector('.dict-badge, .dict-badge-placeholder');
      if (checkbox.checked && !entry) {
        badge.className = 'dict-badge badge-new';
        badge.textContent = 'Новое';
      }
    });

    // Тап по строке (не по чекбоксу) → карточка
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      showWordCard(item, lex, dict[dictId], dictId, row);
    });

    list.appendChild(row);
  }
  renderedCount = end;
}

/**
 * Точечное обновление строки словаря (бейдж + чекбокс) без перерендера.
 */
function updateRow(item) {
  if (!container) return;
  const row = container.querySelector(`.dict-row[data-strong="${item.strong}"]`);
  if (!row) return; // строка может быть не отрендерена (DOM-окно)
  const coreByIdMap = coreById();
  const lex = coreByIdMap.get(item.strong);
  const dictId = lex ? lex.id : `freq-${item.strong}`;
  const entry = dict[dictId];

  // Бейдж
  const badge = row.querySelector('.dict-badge, .dict-badge-placeholder');
  if (badge) {
    if (entry) {
      badge.className = `dict-badge badge-${entry.status || 'new'}`;
      badge.textContent = { new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry.status] || 'Новое';
    } else {
      badge.className = 'dict-badge-placeholder';
      badge.textContent = '';
    }
  }

  // Чекбокс
  const checkbox = row.querySelector('input[type="checkbox"]');
  if (checkbox) checkbox.checked = !!entry && entry.showInText !== false;
}

/**
 * Заменяет старую карточку свежей (без перерендера списка).
 */
function refreshCard(card, item, dictEntry, dictId) {
  const fresh = buildWordCard(item, coreById().get(item.strong), dictEntry, dictId);
  card.replaceWith(fresh);
}

function coreById() {
  return new Map((lexicon || []).map(l => [l.strongs?.[0], l]));
}

function rankBucket(rank) {
  if (rank <= 10) return 10;
  if (rank <= 50) return 50;
  if (rank <= 100) return 100;
  return Math.ceil(rank / 100) * 100;
}

function computeBucketCoverage(list) {
  // Реальный объём греческого НЗ (NA28) ≈ 137 741 слово
  const TOTAL_NT_WORDS = 137741;
  if (!list || list.length === 0) return {};
  let cumulative = 0;
  const cov = {};
  for (const item of list) {
    cumulative += item.count;
    const bucket = rankBucket(item.rank);
    if (!(bucket in cov)) {
      cov[bucket] = Math.round(cumulative / TOTAL_NT_WORDS * 100);
    }
  }
  return cov;
}

/**
 * Строит DOM карточки слова (возвращает HTMLElement).
 */
function buildWordCard(item, lexeme, dictEntry, dictId) {
  const card = document.createElement('div');
  card.className = 'card word-card';

  const status = dictEntry?.status || null;
  const inDict = !!dictEntry;
  const ruGloss = lexeme?.ruGloss || lexeme?.glossesBerean?.[0] || '';
  const strongNum = lexeme?.strongs?.[0] || '';
  const hasAlignment = item.hasAlignment;

  // Close button + header
  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
      <div>
        <div class="word-card-lemma">${item.lemma}</div>
        <div class="word-card-translit">${item.translit}</div>
      </div>
      <button class="word-card-close" aria-label="Закрыть" onclick="this.closest('.popover-card, .bottom-sheet-content')?.querySelector('.popover-close, .bottom-sheet-close')?.click()">${iconX(18)}</button>
    </div>
    ${ruGloss ? `
    <div class="word-card-gloss">
      <div class="word-card-gloss-text">${ruGloss}</div>
      <div class="word-card-meta">
        ${lexeme?.pos ? `<span class="word-card-pos">${lexeme.pos}</span>` : ''}
        <span class="word-card-freq">Частота: ${item.count}</span>
        <span class="word-card-rank">ранг ${item.rank} в НЗ</span>
        ${strongNum ? `<span class="word-card-strong">Strong G${strongNum}</span>` : ''}
      </div>
    </div>` : ''}
    ${!hasAlignment ? '<p class="word-card-warning">Нет проверенного соответствия в тексте — слово пока не участвует в подстановках</p>' : ''}
    <section>
      <h3>Статус изучения</h3>
      <div class="word-card-actions">
        <button class="btn${status === 'new' ? ' btn-primary' : ''}" data-status="new">Новое</button>
        <button class="btn${status === 'learning' ? ' btn-learning' : ''}" data-status="learning">Учу</button>
        <button class="btn${status === 'known' ? ' btn-known' : ''}" data-status="known">Знаю</button>
      </div>
    </section>
    <div class="word-card-toggle">
      <div>
        <div class="word-card-toggle-label">${inDict ? 'Показывать в тексте' : 'Добавить в словарь'}</div>
        <div class="word-card-toggle-hint">${hasAlignment ? 'Заменяет слово в тексте чтения' : 'Нет соответствия в тексте'}</div>
      </div>
      ${hasAlignment
        ? `<button class="word-card-toggle-switch${inDict && dictEntry.showInText !== false ? ' on' : ''}" aria-label="Показывать в тексте"></button>`
        : '<span style="font-size:18px;color:var(--muted2);flex-shrink:0">–</span>'}
    </div>
  `;

  // Status buttons
  card.querySelectorAll('.word-card-actions .btn, .word-card-actions .btn-learning, .word-card-actions .btn-known').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = btn.dataset.status;
      if (!dict[dictId]) {
        dict = addWord(dictId, dict);
        progress = trackNewWord(dictId, progress);
        saveProgress(progress);
      }
      dict = setWordStatus(dictId, s, dict);
      await saveDictionary(dict);
      store.update(s2 => ({ ...s2, dictionary: dict }));
      updateRow(item);
      refreshCard(card, item, dict[dictId], dictId);
    });
  });

  // Toggle switch
  const toggleBtn = card.querySelector('.word-card-toggle-switch');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      if (!dict[dictId]) {
        dict = addWord(dictId, dict);
        progress = trackNewWord(dictId, progress);
        saveProgress(progress);
      }
      const newShow = !(dict[dictId]?.showInText !== false);
      dict = setWordSetting(dictId, 'showInText', newShow, dict);
      await saveDictionary(dict);
      store.update(s => ({ ...s, dictionary: dict }));
      updateRow(item);
      refreshCard(card, item, dict[dictId], dictId);
    });
  }

  return card;
}

function showWordCard(item, lexeme, dictEntry, dictId, anchorEl) {
  const card = buildWordCard(item, lexeme, dictEntry, dictId);
  if (window.innerWidth >= 900) {
    showPopover(card, anchorEl);
  } else {
    openBottomSheet(card);
  }
}

export function unmount() { closePopover(); if (dictObserver) { dictObserver.disconnect(); dictObserver = null; } container = null; }
