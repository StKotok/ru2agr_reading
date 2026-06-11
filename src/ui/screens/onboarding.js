import { loadSettings, saveSettings } from '../../state/settings.js';
import { loadProgress, saveProgress, introduceLetters } from '../../state/progress.js';
import { loadAlphabet } from '../../data/lexicon-loader.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../../router.js';

const PRESETS = [
  {
    id: 1,
    title: 'Хочу читать почти по-русски и привыкать к буквам',
    desc: 'Режим 1 — только греческие буквы. Вводятся первые 3 буквы (α, ο, κ).',
    mode: 1, introduce: 3, allLettersKnown: false
  },
  {
    id: 2,
    title: 'Знаю часть букв, хочу видеть больше греческого',
    desc: 'Режим 2 — буквы с подсказками. Вводятся первые 8 букв.',
    mode: 2, introduce: 8, allLettersKnown: false
  },
  {
    id: 3,
    title: 'Хочу узнавать греческие слова',
    desc: 'Режим 3 (пока режим 2) — слова из личного словаря. Все буквы известны.',
    mode: 3, introduce: 0, allLettersKnown: true
  },
  {
    id: 4,
    title: 'Хочу читать ближе к оригиналу',
    desc: 'Режим 4 (пока режим 3) — греческий текст с русской подсказкой.',
    mode: 3, introduce: 0, allLettersKnown: true, note: 'TODO: режим 4 в MVP 3'
  },
];

let settings = null;
let progress = null;
let alphabet = null;
let container = null;
let step = 1;
let selectedPreset = null;

export async function mount(cnt, ctx) {
  container = cnt;
  const { store } = ctx;

  [settings, progress, alphabet] = await Promise.all([
    loadSettings(),
    loadProgress(),
    loadAlphabet()
  ]);

  store.update(s => ({ ...s, settings, progress }));

  renderStep1();
}

function renderStep1() {
  if (!container) return;
  container.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Что тебе ближе?';
  container.appendChild(h2);

  const cards = document.createElement('div');
  cards.className = 'onboarding-cards';

  for (const preset of PRESETS) {
    const card = document.createElement('button');
    card.className = 'card onboarding-card';
    card.innerHTML = `<strong>${preset.title}</strong><p>${preset.desc}</p>`;
    if (preset.note) {
      card.innerHTML += `<small>${preset.note}</small>`;
    }
    card.addEventListener('click', () => {
      selectedPreset = preset;
      applyPreset(preset);
      step = 2;
      renderStep2();
    });
    cards.appendChild(card);
  }

  container.appendChild(cards);
}

function applyPreset(preset) {
  settings.mode = preset.mode;
  settings.onboarded = true;

  if (preset.allLettersKnown) {
    const today = new Date().toISOString().split('T')[0];
    for (const l of alphabet) {
      if (!progress.letters[l.lower]) {
        progress.letters[l.lower] = { status: 'known', introducedAt: today };
      }
    }
  } else if (preset.introduce > 0) {
    const result = introduceLetters(preset.introduce, progress, alphabet);
    progress = result.progress;
  }

  saveSettings(settings);
  saveProgress(progress);
}

function renderStep2() {
  if (!container) return;
  container.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'С чего начнём чтение?';
  container.appendChild(h2);

  const cards = document.createElement('div');
  cards.className = 'onboarding-cards';

  // Иоанн 1
  const johnCard = document.createElement('button');
  johnCard.className = 'card onboarding-card';
  johnCard.innerHTML = '<strong>Иоанн 1</strong><p>В начале было Слово — классический старт</p>';
  johnCard.addEventListener('click', () => finish('john'));
  cards.appendChild(johnCard);

  // Марк 1
  const markCard = document.createElement('button');
  markCard.className = 'card onboarding-card';
  markCard.innerHTML = '<strong>Марк 1</strong><p>Самое короткое Евангелие</p>';
  markCard.addEventListener('click', () => finish('mark'));
  cards.appendChild(markCard);

  // Продолжить (если есть)
  if (progress.reading.lastBook) {
    const continueCard = document.createElement('button');
    continueCard.className = 'card onboarding-card';
    continueCard.innerHTML = '<strong>Продолжить с последнего места</strong>';
    continueCard.addEventListener('click', () => finish(progress.reading.lastBook));
    cards.appendChild(continueCard);
  }

  container.appendChild(cards);
}

function finish(bookId) {
  if (selectedPreset) {
    const introduced = alphabet
      .filter(l => progress.letters[l.lower]?.status === 'learning')
      .slice(0, 3);

    if (introduced.length > 0 && selectedPreset.id === 1) {
      const names = introduced.map(l => `${l.lower} = ${l.ruEquivalents[0]}`).join(', ');
      showToast(`Сегодня добавим 3 буквы: ${names}. Читай как обычно. При нажатии увидишь подсказку.`, { timeout: 8000 });
    }
  }

  navigate(`#/read/${bookId}`);
}

export function unmount() {
  container = null;
}
