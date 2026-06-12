import { loadDictionary, saveDictionary, addWord, setWordStatus, setWordSetting } from '../../state/dictionary.js';
import { loadCoreLexicon, loadFrequency } from '../../data/lexicon-loader.js';
import { openBottomSheet } from '../components/bottom-sheet.js';

let dict = {};
let lexicon = [];
let frequencyList = [];
let container = null;
let store = null;
let filterStatus = 'all';
let searchQuery = '';
let renderedCount = 0;
const PAGE_SIZE = 100;

export async function mount(cnt, ctx) {
  container = cnt;
  store = ctx.store;
  [dict, lexicon, frequencyList] = await Promise.all([
    loadDictionary(), loadCoreLexicon(), loadFrequency()
  ]);
  renderedCount = 0;
  filterStatus = 'all';
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

function render() {
  if (!container) return;
  container.innerHTML = '';
  renderedCount = 0;

  const h2 = document.createElement('h2');
  h2.textContent = 'Словарь';
  container.appendChild(h2);

  const filtered = getFilteredList();

  // Частотный список недоступен
  if (!frequencyList || frequencyList.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = '<p>Частотный список недоступен.</p>';
    container.appendChild(empty);
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
    // Сентинел для подгрузки
    const sentinel = document.createElement('div');
    sentinel.className = 'dict-sentinel';
    sentinel.style.height = '1px';
    list.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        sentinel.remove();
        renderBatch(list, filtered);
        if (renderedCount < filtered.length) {
          // Добавляем новый сентинел
          const nextSentinel = document.createElement('div');
          nextSentinel.className = 'dict-sentinel';
          nextSentinel.style.height = '1px';
          list.appendChild(nextSentinel);
          observer.observe(nextSentinel);
        }
      }
    });
    observer.observe(sentinel);
  }
}

function renderBatch(list, filtered) {
  const coreById = new Map((lexicon || []).map(l => [l.strong, l]));
  const end = Math.min(renderedCount + PAGE_SIZE, filtered.length);

  for (let i = renderedCount; i < end; i++) {
    const item = filtered[i];
    const lex = coreById.get(item.strong);
    const dictId = lex ? lex.id : `freq-${item.strong}`;
    const entry = dict[dictId];
    const available = item.hasAlignment;

    const row = document.createElement('div');
    row.className = `dict-row${!available ? ' dict-row--disabled' : ''}`;
    row.setAttribute('data-strong', String(item.strong));

    row.innerHTML = `
      <span class="dict-rank">${item.rank}</span>
      <span class="dict-lemma">${item.lemma}</span>
      <span class="dict-translit">${item.translit}</span>
      <span class="dict-freq">${item.count}</span>
      ${entry ? `<span class="dict-badge badge-${entry.status || 'new'}">${{ new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry.status] || 'Новое'}</span>` : '<span class="dict-badge-placeholder"></span>'}
      <label class="dict-check" title="${available ? 'Показывать в тексте' : 'Не участвует в подстановках (слово не выровнено ни в одном стихе НЗ)'}">
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
      showWordCard(item, lex, entry, dictId);
    });

    list.appendChild(row);
  }
  renderedCount = end;
}

function showWordCard(item, lexeme, dictEntry, dictId) {
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
    ${!item.hasAlignment ? '<p class="word-card-warning">⚠️ Не участвует в подстановках — это слово не выровнено ни в одном стихе НЗ</p>' : ''}
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
        // Перерисовать строку
        render();
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
      render();
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
        });
        intensityDiv.appendChild(btn);
      });
      actions.appendChild(intensityDiv);

      // Формы: лемма / все формы
      const formsDiv = document.createElement('div');
      formsDiv.style.margin = '4px 0';
      const formsLabel = document.createElement('span');
      formsLabel.textContent = 'Формы: ';
      formsLabel.style.fontSize = '0.85rem';
      formsDiv.appendChild(formsLabel);
      [{ value: 'lemma', label: 'Лемма' },
       { value: 'all', label: 'Все формы' }].forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn' + ((dictEntry.forms || 'lemma') === opt.value ? ' btn-primary' : '');
        btn.textContent = opt.label;
        btn.style.fontSize = '0.75rem';
        btn.addEventListener('click', async () => {
          dict = setWordSetting(dictId, 'forms', opt.value, dict);
          await saveDictionary(dict);
          store.update(s2 => ({ ...s2, dictionary: dict }));
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
      render();
    });
    actions.appendChild(addBtn);
  }

  openBottomSheet(card);
}

export function unmount() { container = null; }
