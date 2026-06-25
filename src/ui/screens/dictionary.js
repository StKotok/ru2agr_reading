import { loadDictionary, saveDictionary, addWord, setWordStatus, setWordSetting, isDictionaryEntry } from '../../state/dictionary.js';
import { loadCoreLexicon, loadFrequency } from '../../data/lexicon-loader.js';
import { loadProgress, saveProgress, trackNewWord } from '../../state/progress.js';
import { openBottomSheet } from '../components/bottom-sheet.js';

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
  const coreByStrong = new Map((lexicon || []).map(l => [l.strong, l]));
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

  const coreById = new Map((lexicon || []).map(l => [l.strong, l]));
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
      const lex = coreById.get(item.strong);
      const entry = lex ? dict[lex.id] : dict[`freq-${item.strong}`];
      return entry && entry.showInText !== false;
    });
  }

  // Фильтр по статусу
  if (filterStatus !== 'all') {
    return filtered.filter(item => {
      const lex = coreById.get(item.strong);
      const entry = lex ? dict[lex.id] : dict[`freq-${item.strong}`];
      return entry && entry.status === filterStatus;
    });
  }

  return filtered;
}

function renderPersonalDictionaryFallback() {
  const entries = Object.entries(dict).filter(([_, e]) => isDictionaryEntry(e));
  const coreById = new Map((lexicon || []).map(l => [l.id, l]));

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
    const core = coreById.get(dictId);
    let lemma, translit, gloss, strongNum;
    if (core) {
      lemma = core.lemma;
      translit = core.translit;
      gloss = core.gloss;
      strongNum = core.strong;
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

  const h2 = document.createElement('h2');
  h2.textContent = 'Словарь';
  container.appendChild(h2);

  const filtered = getFilteredList();

  // Частотный список недоступен — показываем личный словарь
  if (!frequencyList || frequencyList.length === 0) {
    renderPersonalDictionaryFallback();
    return;
  }

  // Поисковая строка
  const searchContainer = document.createElement('div');
  searchContainer.className = 'dict-search-container';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'dict-search';
  searchInput.placeholder = 'Поиск по лемме...';
  searchInput.value = searchQuery;
  searchInput.setAttribute('aria-label', 'Поиск слов в словаре');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value;
      renderedCount = 0;
      render();
    }, 150);
  });
  searchContainer.appendChild(searchInput);
  container.appendChild(searchContainer);

  // Табы-фильтры по статусу
  const tabs = document.createElement('div');
  tabs.className = 'dict-tabs';
  [
    { value: 'all', label: 'Все' },
    { value: 'checked', label: 'Отмеченные' },
    { value: 'new', label: 'Новые' },
    { value: 'learning', label: 'Учу' },
    { value: 'known', label: 'Знаю' }
  ].forEach(({ value, label }) => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (value === filterStatus ? ' btn-primary' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      filterStatus = value;
      renderedCount = 0;
      render();
    });
    tabs.appendChild(btn);
  });
  container.appendChild(tabs);

  // Табы-фильтры по части речи
  const posTabs = document.createElement('div');
  posTabs.className = 'dict-tabs';
  [
    { value: 'all', label: 'Все' },
    { value: 'verb', label: 'Глаголы' },
    { value: 'noun', label: 'Существ.' },
    { value: 'adj', label: 'Прил.' },
    { value: 'func', label: 'Служебн.' }
  ].forEach(({ value, label }) => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (value === filterPOS ? ' btn-primary' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      filterPOS = value;
      renderedCount = 0;
      render();
    });
    posTabs.appendChild(btn);
  });
  container.appendChild(posTabs);

  // Счётчик
  const counter = document.createElement('div');
  counter.className = 'dict-counter';
  counter.textContent = `Найдено: ${filtered.length}`;
  container.appendChild(counter);

  // Список
  const list = document.createElement('div');
  list.className = 'dict-list';
  container.appendChild(list);

  // DOM-окно: отрендерить первые PAGE_SIZE, остальные через Observer
  renderBatch(list, filtered);

  if (filtered.length > PAGE_SIZE * 2) {
    // Отключаем предыдущий observer если есть
    if (dictObserver) dictObserver.disconnect();

    // Сентинел для подгрузки
    const sentinel = document.createElement('div');
    sentinel.className = 'dict-sentinel';
    sentinel.style.height = '1px';
    list.appendChild(sentinel);

    dictObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        dictObserver.disconnect();
        sentinel.remove();
        renderBatch(list, filtered);
        if (renderedCount < filtered.length) {
          // Добавляем новый сентинел
          const nextSentinel = document.createElement('div');
          nextSentinel.className = 'dict-sentinel';
          nextSentinel.style.height = '1px';
          list.appendChild(nextSentinel);
          dictObserver.observe(nextSentinel);
        } else {
          dictObserver = null;
        }
      }
    });
    dictObserver.observe(sentinel);
  }
}

function renderBatch(list, filtered) {
  const coreById = new Map((lexicon || []).map(l => [l.strong, l]));
  const end = Math.min(renderedCount + PAGE_SIZE, filtered.length);
  const showDividers = !searchQuery.trim();

  for (let i = renderedCount; i < end; i++) {
    const item = filtered[i];
    const lex = coreById.get(item.strong);
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

    row.innerHTML = `
      <span class="dict-rank">${item.rank}</span>
      <span class="dict-lemma">${item.lemma}</span>
      <span class="dict-translit">${item.translit}</span>
      <span class="dict-freq">${item.count}</span>
      ${entry ? `<span class="dict-badge badge-${entry.status || 'new'}">${{ new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry.status] || 'Новое'}</span>` : '<span class="dict-badge-placeholder"></span>'}
      <label class="dict-check" title="${available ? 'Показывать в тексте' : 'Нет проверенного соответствия в тексте — слово пока не участвует в подстановках'}">
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
  const coreById = new Map((lexicon || []).map(l => [l.strong, l]));
  const lex = coreById.get(item.strong);
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
  return new Map((lexicon || []).map(l => [l.strong, l]));
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

  card.innerHTML = `
    <div class="word-card-lemma">${item.lemma}</div>
    <div class="word-card-translit">${item.translit}</div>
    ${lexeme ? `<div class="word-card-gloss">${lexeme.gloss}</div>` : ''}
    ${lexeme ? `<div class="word-card-pos">${lexeme.pos || ''}</div>` : ''}
    <div class="word-card-freq">Частота: ${item.count} (ранг ${item.rank} в НЗ)</div>
    ${lexeme && lexeme.strong ? `<div class="word-card-strong">Strong G${lexeme.strong}</div>` : ''}
    ${!item.hasAlignment ? '<p class="word-card-warning">⚠️ Нет проверенного соответствия в тексте — слово пока не участвует в подстановках</p>' : ''}
    <div class="word-card-actions"></div>
  `;

  const actions = card.querySelector('.word-card-actions');

  if (inDict) {
    // Статус
    const statusDiv = document.createElement('div');
    statusDiv.style.margin = '4px 0';
    ['new', 'learning', 'known'].forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (status === s ? ' btn-primary' : '');
      btn.textContent = { new: 'Новое', learning: 'Учу', known: 'Знаю' }[s];
      btn.style.fontSize = '0.8rem';
      btn.addEventListener('click', async () => {
        dict = setWordStatus(dictId, s, dict);
        await saveDictionary(dict);
        store.update(s2 => ({ ...s2, dictionary: dict }));
        updateRow(item);
        refreshCard(card, item, dict[dictId], dictId);
      });
      statusDiv.appendChild(btn);
    });
    actions.appendChild(statusDiv);

    // Показывать в тексте
    const toggleLabel = document.createElement('label');
    toggleLabel.style.display = 'flex';
    toggleLabel.style.alignItems = 'center';
    toggleLabel.style.gap = '8px';
    toggleLabel.style.margin = '8px 0';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = dictEntry.showInText !== false;
    toggle.disabled = !item.hasAlignment;
    toggle.addEventListener('change', async () => {
      dict = setWordSetting(dictId, 'showInText', toggle.checked, dict);
      await saveDictionary(dict);
      store.update(s => ({ ...s, dictionary: dict }));
      updateRow(item);
      refreshCard(card, item, dict[dictId], dictId);
    });
    toggleLabel.appendChild(toggle);
    toggleLabel.appendChild(document.createTextNode('Показывать в тексте'));
    actions.appendChild(toggleLabel);

    // Интенсивность
    if (item.hasAlignment) {
      const intensityDiv = document.createElement('div');
      intensityDiv.style.margin = '4px 0';
      const intensityLabel = document.createElement('span');
      intensityLabel.textContent = 'Интенсивность: ';
      intensityLabel.style.fontSize = '0.85rem';
      intensityDiv.appendChild(intensityLabel);
      ['often', 'sometimes', 'rare'].forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn' + ((dictEntry.intensity || 'often') === opt ? ' btn-primary' : '');
        btn.textContent = { often: 'Часто', sometimes: 'Иногда', rare: 'Редко' }[opt];
        btn.style.fontSize = '0.75rem';
        btn.addEventListener('click', async () => {
          dict = setWordSetting(dictId, 'intensity', opt, dict);
          await saveDictionary(dict);
          store.update(s2 => ({ ...s2, dictionary: dict }));
          refreshCard(card, item, dict[dictId], dictId);
        });
        intensityDiv.appendChild(btn);
      });
      actions.appendChild(intensityDiv);

      // Формы: по виджету / лемма / форма оригинала
      const formsDiv = document.createElement('div');
      formsDiv.style.margin = '4px 0';
      const formsLabel = document.createElement('span');
      formsLabel.textContent = 'В тексте: ';
      formsLabel.style.fontSize = '0.85rem';
      formsDiv.appendChild(formsLabel);
      const currentForms = dictEntry.forms; // undefined = По виджету
      [{ value: undefined, label: 'По виджету' },
       { value: 'lemma', label: 'Лемма' },
       { value: 'form', label: 'Форма оригинала' }].forEach(opt => {
        const btn = document.createElement('button');
        const isActive = currentForms === opt.value; // undefined === undefined → true
        btn.className = 'btn' + (isActive ? ' btn-primary' : '');
        btn.textContent = opt.label;
        btn.style.fontSize = '0.75rem';
        btn.addEventListener('click', async () => {
          dict = setWordSetting(dictId, 'forms', opt.value, dict);
          await saveDictionary(dict);
          store.update(s2 => ({ ...s2, dictionary: dict }));
          refreshCard(card, item, dict[dictId], dictId);
        });
        formsDiv.appendChild(btn);
      });
      actions.appendChild(formsDiv);
    }
  } else {
    // Слово не в словаре — кнопка «Добавить»
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.textContent = 'Добавить в словарь';
    addBtn.disabled = !item.hasAlignment;
    addBtn.addEventListener('click', async () => {
      dict = addWord(dictId, dict);
      await saveDictionary(dict);
      store.update(s => ({ ...s, dictionary: dict }));
      updateRow(item);
      refreshCard(card, item, dict[dictId], dictId);
    });
    actions.appendChild(addBtn);
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
