import { loadDictionary, saveDictionary, addWord, setWordStatus, setWordSetting } from '../../state/dictionary.js';
import { loadCoreLexicon } from '../../data/lexicon-loader.js';
import { openBottomSheet } from '../components/bottom-sheet.js';

let dict = {};
let lexicon = [];
let container = null;
let store = null;
let filter = 'all';

export async function mount(cnt, ctx) {
  container = cnt;
  store = ctx.store;
  [dict, lexicon] = await Promise.all([loadDictionary(), loadCoreLexicon()]);
  render();
}

function render() {
  if (!container) return;
  container.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Словарь';
  container.appendChild(h2);

  const dictIds = Object.keys(dict);

  if (dictIds.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = '<p>Добавь первые слова — они начнут появляться в тексте.</p>';
    container.appendChild(empty);
  }

  // Табы-фильтры
  const tabs = document.createElement('div');
  tabs.className = 'dict-tabs';
  ['all', 'new', 'learning', 'known'].forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (f === filter ? ' btn-primary' : '');
    btn.textContent = { all: 'Все', new: 'Новые', learning: 'Учу', known: 'Знаю' }[f];
    btn.addEventListener('click', () => { filter = f; render(); });
    tabs.appendChild(btn);
  });
  container.appendChild(tabs);

  // Список слов словаря
  const list = document.createElement('div');
  list.className = 'dict-list';

  for (const id of dictIds) {
    const entry = dict[id];
    if (filter !== 'all' && entry.status !== filter) continue;

    const lexeme = lexicon.find(l => l.id === id);

    const row = document.createElement('div');
    row.className = 'dict-row card';
    row.innerHTML = `
      <div class="dict-row-main">
        <span class="dict-lemma">${lexeme?.lemma || id}</span>
        <span class="dict-gloss">${lexeme?.gloss || ''}</span>
        <span class="dict-badge badge-${entry.status}">${{ new: 'Новое', learning: 'Учу', known: 'Знаю' }[entry.status]}</span>
      </div>
    `;

    row.addEventListener('click', () => {
      showWordSettings(id, entry, lexeme);
    });

    list.appendChild(row);
  }
  container.appendChild(list);

  // Кнопка «+ Добавить слова»
  const addSection = document.createElement('div');
  addSection.className = 'dict-add-section';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Добавить слова';
  addBtn.addEventListener('click', () => showAddWords());
  addSection.appendChild(addBtn);
  container.appendChild(addSection);
}

function showWordSettings(id, entry, lexeme) {
  const sheet = document.createElement('div');
  sheet.className = 'card';
  sheet.innerHTML = `
    <h3>${lexeme?.lemma || id}</h3>
    <p>${lexeme?.gloss || ''}</p>
  `;

  // Статус
  const statusDiv = document.createElement('div');
  statusDiv.style.margin = '8px 0';
  ['new', 'learning', 'known'].forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (entry.status === s ? ' btn-primary' : '');
    btn.textContent = { new: 'Новое', learning: 'Учу', known: 'Знаю' }[s];
    btn.addEventListener('click', async () => {
      dict = setWordStatus(id, s, dict);
      await saveDictionary(dict);
      store.update(s2 => ({ ...s2, dictionary: dict }));
      render();
    });
    statusDiv.appendChild(btn);
  });
  sheet.appendChild(statusDiv);

  // Показывать в тексте
  const toggleLabel = document.createElement('label');
  toggleLabel.style.display = 'flex';
  toggleLabel.style.alignItems = 'center';
  toggleLabel.style.gap = '8px';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = entry.showInText !== false;
  toggle.addEventListener('change', async () => {
    dict = setWordSetting(id, 'showInText', toggle.checked, dict);
    await saveDictionary(dict);
  });
  toggleLabel.appendChild(toggle);
  toggleLabel.appendChild(document.createTextNode('Показывать в тексте'));
  sheet.appendChild(toggleLabel);

  // Интенсивность
  const intensityDiv = document.createElement('div');
  intensityDiv.style.margin = '8px 0';
  intensityDiv.innerHTML = '<span>Интенсивность: </span>';
  ['often', 'sometimes', 'rare'].forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (entry.intensity === opt ? ' btn-primary' : '');
    btn.textContent = { often: 'Часто', sometimes: 'Иногда', rare: 'Редко' }[opt];
    btn.addEventListener('click', async () => {
      dict = setWordSetting(id, 'intensity', opt, dict);
      await saveDictionary(dict);
      store.update(s2 => ({ ...s2, dictionary: dict }));
      render();
    });
    intensityDiv.appendChild(btn);
  });
  sheet.appendChild(intensityDiv);

  openBottomSheet(sheet);
}

function showAddWords() {
  const notInDict = lexicon.filter(l => !dict[l.id]).sort((a, b) => (b.freqNT || 0) - (a.freqNT || 0));

  const sheet = document.createElement('div');
  sheet.style.maxHeight = '60dvh';
  sheet.style.overflowY = 'auto';

  const h3 = document.createElement('h3');
  h3.textContent = 'Добавить слова';
  sheet.appendChild(h3);

  for (const lexeme of notInDict.slice(0, 30)) {
    const row = document.createElement('div');
    row.className = 'dict-row';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = '4px 0';

    row.innerHTML = `<span>${lexeme.lemma} — ${lexeme.gloss} (${lexeme.freqNT || '?'})</span>`;

    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', async () => {
      dict = addWord(lexeme.id, dict);
      await saveDictionary(dict);
      store.update(s => ({ ...s, dictionary: dict }));
      addBtn.textContent = '✓';
      addBtn.disabled = true;
    });
    row.appendChild(addBtn);
    sheet.appendChild(row);
  }

  openBottomSheet(sheet);
}

export function unmount() { container = null; }
