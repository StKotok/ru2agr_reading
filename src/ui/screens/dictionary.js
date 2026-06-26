import { loadDictionary, saveDictionary, addWord, setWordStatus, setWordSetting, isDictionaryEntry } from '../../state/dictionary.js';
import { loadCoreLexicon, loadFrequency } from '../../data/lexicon-loader.js';
import { loadProgress, saveProgress, trackNewWord } from '../../state/progress.js';
import { openBottomSheet } from '../components/bottom-sheet.js';
import { rankBucket } from '../components/word-card.js';
import { createPageHeader } from '../components/page-header.js';
import { getInspectorPanel, showInInspector } from '../components/inspector.js';

let dict = {};
let lexicon = [];
let frequencyList = [];
let progress = null;
let container = null;          // внешний контейнер (корень экрана)
let listContainer = null;      // контейнер списка слов
let store = null;
let filterStatus = 'all';
let filterPOS = 'all';
let searchQuery = '';
let renderedCount = 0;
let lastDividerBucket = 0;
let bucketCoverage = {};
let dictObserver = null;       // IntersectionObserver для ленивой подгрузки
let _dropdownOutsideHandler = null;  // document click listener для закрытия дропдаунов
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

export async function mount(cnt, ctx) {
  container = cnt;
  store = ctx.store;
  [dict, lexicon, frequencyList, progress] = await Promise.all([
    loadDictionary(), loadCoreLexicon(), loadFrequency(), loadProgress()
  ]);
  // Обогащаем частотный список POS-категориями из core-словаря
  const coreByStrong = coreById();
  if (frequencyList) {
    for (const item of frequencyList) {
      const core = coreByStrong.get(item.strong);
      item.posGroup = core ? classifyPOS(core.pos) : null;
    }
  }
  bucketCoverage = computeBucketCoverage(frequencyList);
  renderedCount = 0;
  filterStatus = 'all';
  filterPOS = 'all';
  searchQuery = '';

  container.innerHTML = '';

  // ── Layout: левая колонка + инспектор (desktop) ──
  const layout = document.createElement('div');
  layout.className = 'dict-layout';
  container.appendChild(layout);

  // Левая колонка
  const leftCol = document.createElement('div');
  leftCol.className = 'dict-left-col';
  layout.appendChild(leftCol);

  // Page header — внутри левой колонки, между навом и инспектором
  const { bar: header } = createPageHeader({ title: 'Словарь' });
  leftCol.appendChild(header);

  // Контейнер списка
  listContainer = document.createElement('div');
  listContainer.className = 'dict-list-panel';
  leftCol.appendChild(listContainer);

  // Инспектор (правый, desktop only)
  getInspectorPanel(layout, 'dictionary');

  render();
}

function statusCount(statusValue) {
  if (!frequencyList) return 0;
  const coreByIdMap = coreById();
  const q = searchQuery.trim().toLowerCase();
  return frequencyList.filter(item => {
    if (filterPOS !== 'all' && item.posGroup !== filterPOS) return false;
    if (filterStatus === 'checked') {
      const lex = coreByIdMap.get(item.strong);
      const dictId = lex ? lex.id : `freq-${item.strong}`;
      const entry = dict[dictId];
      if (!entry || entry.showInText === false) return false;
    }
    if (q && !item.lemma.toLowerCase().includes(q) && !(item.transliteration || '').toLowerCase().includes(q)) return false;
    if (statusValue !== 'all') {
      const lex = coreByIdMap.get(item.strong);
      const dictId = lex ? lex.id : `freq-${item.strong}`;
      const entry = dict[dictId];
      if (!entry || entry.status !== statusValue) return false;
    }
    return true;
  }).length;
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
      (item.transliteration || '').toLowerCase().includes(q)
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
  listContainer.appendChild(info);

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = '<p>Частотный список недоступен. Личный словарь пока пуст.</p>';
    listContainer.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'dict-list';
  listContainer.appendChild(list);

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
  if (!listContainer) return;
  listContainer.innerHTML = '';
  renderedCount = 0;
  lastDividerBucket = 0;

  const filtered = getFilteredList();

  // Частотный список недоступен — показываем личный словарь
  if (!frequencyList || frequencyList.length === 0) {
    renderPersonalDictionaryFallback();
    return;
  }

  // ═══ Header: поиск + фильтры + кол-во слов ═══
  const header = document.createElement('div');
  header.className = 'dict-header';
  header.innerHTML = `
    <div class="dict-title-row">
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

  // ═══ Filter row: status dropdown + POS dropdown + show-in-text toggle ═══
  const filterRow = document.createElement('div');
  filterRow.className = 'dict-filter-row';

  // --- Status dropdown (prototype: readerWordSV3) ---
  const statusOpts = [
    { value: 'all', label: 'Все' },
    { value: 'new', label: 'Новые' },
    { value: 'learning', label: 'Учу' },
    { value: 'known', label: 'Знаю' },
  ];
  const curStatus = statusOpts.find(o => o.value === filterStatus) || statusOpts[0];

  const statusDD = document.createElement('div');
  statusDD.className = 'dict-dropdown';
  let statusMenuOpen = false;
  const statusBtn = document.createElement('button');
  statusBtn.className = 'dict-dropdown-btn';
  statusBtn.innerHTML = `<span class="dict-dropdown-label">Статус:</span> <span class="dict-dropdown-value">${curStatus.label}</span> <span class="dict-dropdown-count">${statusCount(filterStatus)}</span> <span class="dict-dropdown-caret">▾</span>`;
  statusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllDropdowns();
    statusMenuOpen = !statusMenuOpen;
    toggleStatusMenu();
  });
  statusDD.appendChild(statusBtn);

  const statusMenu = document.createElement('div');
  statusMenu.className = 'dict-dropdown-menu';
  statusMenu.hidden = true;
  statusDD.appendChild(statusMenu);

  function toggleStatusMenu() {
    statusMenu.innerHTML = '';
    if (!statusMenuOpen) { statusMenu.hidden = true; return; }
    statusOpts.forEach(({ value, label }) => {
      const item = document.createElement('button');
      item.className = 'dict-dropdown-item';
      const on = filterStatus === value;
      if (on) item.classList.add('active');
      item.innerHTML = `<span>${label}</span> <span>${statusCount(value)}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        filterStatus = value;
        statusMenuOpen = false;
        statusMenu.hidden = true;
        renderedCount = 0;
        render();
      });
      statusMenu.appendChild(item);
    });
    statusMenu.hidden = false;
  }

  filterRow.appendChild(statusDD);

  // Desktop separator
  if (window.innerWidth >= 900) {
    const sep = document.createElement('div');
    sep.className = 'dict-filter-sep';
    filterRow.appendChild(sep);
  }

  // --- POS dropdown (prototype: readerWordPosDropdown) ---
  const posOpts = [
    { value: 'all', label: 'Все' },
    { value: 'noun', label: 'Сущ.' },
    { value: 'verb', label: 'Глаг.' },
    { value: 'adj', label: 'Прил.' },
    { value: 'func', label: 'Служ.' },
  ];
  const curPOS = posOpts.find(o => o.value === filterPOS) || posOpts[0];

  const posDD = document.createElement('div');
  posDD.className = 'dict-dropdown';
  let posMenuOpen = false;
  const posBtn = document.createElement('button');
  posBtn.className = 'dict-dropdown-btn dict-dropdown-btn--pos';
  posBtn.innerHTML = `<span class="dict-dropdown-label">Часть речи:</span> <span class="dict-dropdown-value">${curPOS.label}</span> <span class="dict-dropdown-caret">▾</span>`;
  posBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllDropdowns();
    posMenuOpen = !posMenuOpen;
    togglePOSMenu();
  });
  posDD.appendChild(posBtn);

  const posMenu = document.createElement('div');
  posMenu.className = 'dict-dropdown-menu';
  posMenu.hidden = true;
  posDD.appendChild(posMenu);

  function togglePOSMenu() {
    posMenu.innerHTML = '';
    if (!posMenuOpen) { posMenu.hidden = true; return; }
    posOpts.forEach(({ value, label }) => {
      const item = document.createElement('button');
      item.className = 'dict-dropdown-item';
      const on = filterPOS === value;
      if (on) item.classList.add('active');
      item.innerHTML = `<span>${label}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        filterPOS = value;
        posMenuOpen = false;
        posMenu.hidden = true;
        renderedCount = 0;
        render();
      });
      posMenu.appendChild(item);
    });
    posMenu.hidden = false;
  }

  filterRow.appendChild(posDD);

  // --- Close all dropdowns ---
  function closeAllDropdowns() {
    statusMenuOpen = false; statusMenu.hidden = true;
    posMenuOpen = false; posMenu.hidden = true;
  }

  // Убираем старый обработчик перед добавлением нового (render() вызывается многократно)
  if (_dropdownOutsideHandler) {
    document.removeEventListener('click', _dropdownOutsideHandler);
  }
  _dropdownOutsideHandler = (e) => {
    if (!statusDD.contains(e.target) && !posDD.contains(e.target)) {
      closeAllDropdowns();
    }
  };
  document.addEventListener('click', _dropdownOutsideHandler);

  // --- Show-in-text toggle ---
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
  listContainer.appendChild(header);

  // ═══ Word list ═══
  const listScroll = document.createElement('div');
  listScroll.className = 'dict-list-scroll';

  const list = document.createElement('div');
  list.className = 'dict-list';
  listScroll.appendChild(list);
  listContainer.appendChild(listScroll);

  // Render first PAGE_SIZE, rest via Observer
  renderBatch(list, filtered);

  // Всегда отключаем старый observer (может остаться от предыдущего render с >200 результатов)
  if (dictObserver) { dictObserver.disconnect(); dictObserver = null; }

  if (filtered.length > PAGE_SIZE * 2) {
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

    // Group divider at frequency bucket change (only when not searching)
    if (showDividers) {
      const bucket = rankBucket(item.rank);
      if (bucket > lastDividerBucket) {
        lastDividerBucket = bucket;
        const pct = bucketCoverage[bucket];
        const pctText = pct !== undefined ? `≈${pct}% текста НЗ` : '';
        const divider = document.createElement('div');
        divider.className = 'dict-divider';
        divider.innerHTML = `
          <span class="dict-divider-label">Топ ${bucket}</span>
          <span class="dict-divider-line"></span>
          <span class="dict-divider-cov">${pctText}</span>`;
        list.appendChild(divider);
      }
    }

    const isActive = false; // active row tracking done via click
    const hasStatus = entry && entry.status;
    const statusLabel = { new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry?.status] || '';
    const checked = entry && entry.showInText !== false;
    const gloss = lex ? (lex.ruGloss || lex.glossesBerean?.[0] || '') : '';

    const row = document.createElement('div');
    row.className = `dict-row${!available ? ' dict-row--disabled' : ''}${isActive ? ' dict-row--active' : ''}`;
    row.setAttribute('data-strong', String(item.strong));

    row.innerHTML = `
      <span class="dict-rank">${item.rank}</span>
      <div class="dict-word-col">
        <div class="dict-word-line1">
          <span class="dict-lemma">${item.lemma}</span>
          <span class="dict-translit">${item.transliteration || ''}</span>
          <span class="dict-freq">${item.count}&nbsp;в НЗ</span>
        </div>
        ${gloss ? `<div class="dict-gloss">${gloss}</div>` : ''}
      </div>
      ${hasStatus ? `<span class="dict-status-pill badge-${entry.status}">${statusLabel}</span>` : ''}
      ${available
        ? `<button class="dict-cbx${checked ? ' on' : ''}" aria-label="${checked ? 'Убрать из текста' : 'Показывать в тексте'}" title="${checked ? 'Убрать из текста' : 'Показывать в тексте'}">${checked ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>' : ''}</button>`
        : `<span class="dict-cbx-na" title="Нет соответствия в тексте">–</span>`}
    `;

    // Checkbox toggle
    const cbxBtn = row.querySelector('.dict-cbx');
    if (cbxBtn) {
      cbxBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        let updated = { ...dict };
        if (!updated[dictId]) {
          updated = addWord(dictId, updated);
          if (progress) { progress = trackNewWord(dictId, progress); saveProgress(progress); }
        }
        const newVal = !(updated[dictId]?.showInText !== false);
        updated = setWordSetting(dictId, 'showInText', newVal, updated);
        dict = updated;
        await saveDictionary(dict);
        store.update(s => ({ ...s, dictionary: dict }));
        // Refresh just this row
        updateRow(item);
      });
    }

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
  if (!listContainer) return;
  const row = listContainer.querySelector(`.dict-row[data-strong="${item.strong}"]`);
  if (!row) return;
  const coreByIdMap = coreById();
  const lex = coreByIdMap.get(item.strong);
  const dictId = lex ? lex.id : `freq-${item.strong}`;
  const entry = dict[dictId];

  // Status pill
  const pill = row.querySelector('.dict-status-pill');
  if (entry) {
    if (!pill) {
      // Create pill if it doesn't exist (was empty before)
      const pillEl = document.createElement('span');
      pillEl.className = `dict-status-pill badge-${entry.status || 'new'}`;
      pillEl.textContent = { new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry.status] || 'Новое';
      row.querySelector('.dict-word-col')?.after(pillEl);
    } else {
      pill.className = `dict-status-pill badge-${entry.status || 'new'}`;
      pill.textContent = { new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry.status] || 'Новое';
    }
  }

  // Custom checkbox
  const cbx = row.querySelector('.dict-cbx');
  if (cbx) {
    const checked = !!entry && entry.showInText !== false;
    cbx.classList.toggle('on', checked);
    cbx.innerHTML = checked
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>'
      : '';
  }
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

  // Header (close button is provided by popover / bottom-sheet)
  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
      <div>
        <div class="word-card-lemma">${item.lemma}</div>
        <div class="word-card-translit">${item.transliteration || ''}</div>
      </div>
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
    showInInspector(card);
  } else {
    openBottomSheet(card);
  }
}

export function unmount() {
  if (dictObserver) { dictObserver.disconnect(); dictObserver = null; }
  if (_dropdownOutsideHandler) { document.removeEventListener('click', _dropdownOutsideHandler); _dropdownOutsideHandler = null; }
  container = null;
  listContainer = null;
}
