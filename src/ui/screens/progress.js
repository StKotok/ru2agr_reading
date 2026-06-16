import { loadProgress, saveProgress, introduceLetters, markLetterKnown } from '../../state/progress.js';
import { loadAlphabet } from '../../data/lexicon-loader.js';
import { loadBooks } from '../../data/bible-loader.js';
import { renderLetterCard } from '../components/word-card.js';
import { openBottomSheet } from '../components/bottom-sheet.js';
import { showInInspector, getInspectorPanel, showEmptyState } from '../components/inspector.js';
import { showToast } from '../components/toast.js';

let progress = null;
let alphabet = null;
let books = null;
let container = null;
let store = null;

export async function mount(cnt, ctx) {
  container = cnt;
  store = ctx.store;

  [progress, alphabet, books] = await Promise.all([
    loadProgress(),
    loadAlphabet(),
    loadBooks()
  ]);

  render();
}

function render() {
  if (!container) return;
  container.innerHTML = '';

  // Заголовок
  const h2 = document.createElement('h2');
  h2.textContent = 'Прогресс';
  container.appendChild(h2);

  // Блок «Буквы»
  renderLettersSection();

  // Блок «Слова»
  renderWordsSection();

  // Блок «Чтение»
  renderReadingSection();
}

function renderWordsSection() {
  const dict = store.get().dictionary || {};
  const entries = Object.entries(dict).filter(([_, e]) => e && typeof e === 'object');
  if (entries.length === 0) return;

  const section = document.createElement('section');
  section.className = 'progress-section';
  const h3 = document.createElement('h3');
  h3.textContent = 'Слова';
  section.appendChild(h3);

  const known = entries.filter(([_, e]) => e.status === 'known').length;
  const learning = entries.filter(([_, e]) => e.status === 'learning').length;
  const newWords = entries.filter(([_, e]) => e.status === 'new').length;
  const today = new Date().toISOString().split('T')[0];
  const todayNew = (progress.wordsToday?.date === today) ? (progress.wordsToday.added || []).length : 0;

  const p = document.createElement('p');
  p.textContent = `${known} знакомы / ${learning} в изучении / ${todayNew} новых сегодня`;
  section.appendChild(p);
  container.appendChild(section);
}

function renderLettersSection() {
  const section = document.createElement('section');
  section.className = 'progress-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Буквы';
  section.appendChild(h3);

  // Мотивирующая строка
  const knownLetters = alphabet.filter(l => {
    const e = progress.letters[l.lower];
    return e && (e.status === 'known' || e.status === 'learning');
  });
  const dict = store.get().dictionary || {};
  const knownWords = Object.entries(dict).filter(([_, e]) => e && typeof e === 'object' && (e.status === 'known' || e.status === 'learning'));

  if (knownLetters.length > 0 || knownWords.length > 0) {
    const p = document.createElement('p');
    p.className = 'progress-motto';
    const parts = [];
    if (knownLetters.length > 0) parts.push(knownLetters.map(l => l.lower).join(' '));
    if (knownWords.length > 0) {
      const coreLex = store.get().coreLexicon || [];
      const wordNames = knownWords.slice(0, 5).map(([id]) => {
        const lex = coreLex.find(l => l.id === id);
        return lex ? lex.lemma : id;
      });
      parts.push(wordNames.join(' '));
    }
    p.textContent = 'Ты уже узнаёшь: ' + parts.join(' ');
    section.appendChild(p);
  }

  // Сетка букв
  const grid = document.createElement('div');
  grid.className = 'letter-grid';

  for (const l of alphabet) {
    const cell = document.createElement('button');
    cell.className = 'letter-cell';
    const entry = progress.letters[l.lower];
    if (entry?.status === 'known') {
      cell.classList.add('letter-known');
    } else if (entry?.status === 'learning') {
      cell.classList.add('letter-learning');
    } else {
      cell.classList.add('letter-locked');
    }
    cell.textContent = l.lower;

    cell.addEventListener('click', () => {
      const card = renderLetterCard(l, entry, async (ch) => {
        progress = markLetterKnown(ch, progress);
        await saveProgress(progress);
        render();
      });
      if (window.innerWidth >= 900) {
        showInInspector(card);
      } else {
        openBottomSheet(card);
      }
    });

    grid.appendChild(cell);
  }
  section.appendChild(grid);

  // Кнопка «+ Добавить буквы»
  const addSection = document.createElement('div');
  addSection.className = 'progress-add-section';

  const addLabel = document.createElement('span');
  addLabel.textContent = 'Добавить буквы: ';
  addSection.appendChild(addLabel);

  [1, 3, 5].forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '+' + n;
    btn.addEventListener('click', () => {
      const result = introduceLetters(n, progress, alphabet);
      if (result.introduced.length > 0) {
        progress = result.progress;
        saveProgress(progress);
        store.update(s => ({ ...s, progress }));

        const names = result.introduced.map(ch => {
          const letter = alphabet.find(l => l.lower === ch);
          return letter ? `${ch} = ${letter.ruEquivalents[0]}` : ch;
        }).join(', ');
        showToast(`Сегодня добавим: ${names}`);

        render();
      }
    });
    addSection.appendChild(btn);
  });

  section.appendChild(addSection);

  container.appendChild(section);
}

function renderReadingSection() {
  const section = document.createElement('section');
  section.className = 'progress-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Чтение';
  section.appendChild(h3);

  if (!books || books.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'Нет данных о книгах.';
    section.appendChild(p);
    container.appendChild(section);
    return;
  }

  for (const book of books) {
    const readingData = progress.reading.books[book.id];
    const row = document.createElement('div');
    row.className = 'progress-book-row';

    const title = document.createElement('span');
    title.textContent = book.short + ' — ' + book.title;
    row.appendChild(title);

    const status = document.createElement('span');
    status.className = 'progress-book-status';
    if (readingData && readingData.chaptersRead && readingData.chaptersRead.length === book.chapters) {
      status.textContent = 'прочитано';
      status.classList.add('status-read');
    } else if (readingData && readingData.chaptersRead && readingData.chaptersRead.length > 0) {
      status.textContent = `начато (${readingData.chaptersRead.length} из ${book.chapters} глав)`;
      status.classList.add('status-started');
    }
    row.appendChild(status);

    section.appendChild(row);
  }

  container.appendChild(section);
}

export function unmount() {
  container = null;
}
