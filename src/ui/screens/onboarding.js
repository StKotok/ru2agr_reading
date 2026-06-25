import { loadSettings, saveSettings } from '../../state/settings.js';
import { loadProgress, saveProgress, introduceLetters } from '../../state/progress.js';
import { loadAlphabet } from '../../data/bible-loader.js';
import { navigate } from '../../router.js';

const STRIPE_COLORS = ['var(--greek)', 'var(--greek-word)', 'var(--progress)'];

const PRESETS = [
  {
    id: 1,
    title: 'Знаю часть букв, хочу видеть больше греческого',
    desc: 'Смешанный текст — буквы с подсказками. Вводятся первые 8 букв.',
    readingMode: 'mixed', wordLayer: 'off', intensity: 35,
    introduce: 8, allLettersKnown: false
  },
  {
    id: 2,
    title: 'Хочу узнавать греческие слова',
    desc: 'Смешанный текст — слова из личного словаря заменяются на греческие леммы.',
    readingMode: 'mixed', wordLayer: 'lemma', intensity: 35,
    introduce: 0, allLettersKnown: true,
    example: 'Пример: «Слово» → λόγος (лемма, всегда одна словарная форма)'
  },
  {
    id: 3,
    title: 'Хочу читать ближе к оригиналу',
    desc: 'Смешанный текст — реальные формы слов (падежи, спряжения).',
    readingMode: 'mixed', wordLayer: 'form', intensity: 35,
    introduce: 0, allLettersKnown: true,
    example: 'Пример: «Слову» → λόγῳ (реальная форма, зависит от падежа!)'
  },
];

let settings = null;
let progress = null;
let alphabet = null;
let container = null;
let step = 1;

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
    card.style.setProperty('--onboarding-stripe', STRIPE_COLORS[preset.id - 1] || 'var(--primary)');
    card.innerHTML = `<strong>${preset.title}</strong><p>${preset.desc}</p>`;
    if (preset.example) {
      card.innerHTML += `<small class="onboarding-example">${preset.example}</small>`;
    }
    if (preset.note) {
      card.innerHTML += `<small>${preset.note}</small>`;
    }
    card.addEventListener('click', () => {
      applyPreset(preset);
      step = 2;
      renderStep2();
    });
    cards.appendChild(card);
  }

  container.appendChild(cards);
}

function applyPreset(preset) {
  if (preset.readingMode !== undefined) settings.readingMode = preset.readingMode;
  if (preset.wordLayer !== undefined) settings.wordLayer = preset.wordLayer;
  if (preset.intensity !== undefined) settings.intensity = preset.intensity;
  settings.onboarded = true;

  if (preset.allLettersKnown) {
    const today = new Date().toISOString().split('T')[0];
    if (alphabet) {
      for (const l of alphabet) {
        if (!progress.letters[l.lower]) {
          progress.letters[l.lower] = { status: 'known', introducedAt: today };
        }
      }
    }
  } else if (preset.introduce > 0 && alphabet) {
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
  johnCard.style.setProperty('--onboarding-stripe', STRIPE_COLORS[0]);
  johnCard.innerHTML = '<strong>Иоанн 1</strong><p>В начале было Слово — классический старт</p>';
  johnCard.addEventListener('click', () => finish('john'));
  cards.appendChild(johnCard);

  // Марк 1
  const markCard = document.createElement('button');
  markCard.className = 'card onboarding-card';
  markCard.style.setProperty('--onboarding-stripe', STRIPE_COLORS[1]);
  markCard.innerHTML = '<strong>Марк 1</strong><p>Самое короткое Евангелие</p>';
  markCard.addEventListener('click', () => finish('mark'));
  cards.appendChild(markCard);

  // Продолжить (если есть)
  if (progress.reading.lastBook) {
    const continueCard = document.createElement('button');
    continueCard.className = 'card onboarding-card';
    continueCard.style.setProperty('--onboarding-stripe', STRIPE_COLORS[2]);
    continueCard.innerHTML = '<strong>Продолжить с последнего места</strong>';
    continueCard.addEventListener('click', () => finish(progress.reading.lastBook));
    cards.appendChild(continueCard);
  }

  container.appendChild(cards);
}

function finish(bookId) {
  navigate(`#/read/${bookId}`);
}

export function unmount() {
  container = null;
}
