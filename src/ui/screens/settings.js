import { loadSettings, saveSettings } from '../../state/settings.js';
import { loadProgress, saveProgress } from '../../state/progress.js';
import { db } from '../../storage/db.js';

let settings = null;
let progress = null;
let container = null;
let store = null;

export async function mount(cnt, ctx) {
  container = cnt;
  store = ctx.store;

  [settings, progress] = await Promise.all([
    loadSettings(),
    loadProgress()
  ]);

  store.update(s => ({ ...s, settings, progress }));
  render();
}

function render() {
  if (!container) return;
  container.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Настройки';
  container.appendChild(h2);

  // Режим
  renderModeSection();

  // Интенсивность
  renderIntensitySection();

  // Тема
  renderThemeSection();

  // Сброс
  renderResetSection();
}

function renderModeSection() {
  const section = document.createElement('section');
  section.className = 'progress-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Режим обучения';
  section.appendChild(h3);

  const modes = [
    { id: 1, label: '1. Только греческие буквы', group: 'Учебный мостик', enabled: true },
    { id: 2, label: '2. Буквы + подсказки', group: 'Учебный мостик', enabled: true },
    { id: 3, label: '3. Слова из моего словаря', group: 'Учебный мостик', enabled: true }
    { id: 4, label: '4. Реальные формы оригинала', group: 'Ближе к оригиналу', enabled: false, note: 'после привязки к оригиналу' },
    { id: 5, label: '5. Почти оригинал', group: 'Ближе к оригиналу', enabled: false, note: 'после привязки к оригиналу' },
  ];

  let currentGroup = '';
  for (const m of modes) {
    if (m.group !== currentGroup) {
      currentGroup = m.group;
      const groupHeader = document.createElement('p');
      groupHeader.className = 'settings-group-header';
      groupHeader.textContent = currentGroup;
      section.appendChild(groupHeader);
    }

    const label = document.createElement('label');
    label.className = 'settings-radio';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    label.style.padding = '4px 0';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'mode';
    radio.value = String(m.id);
    radio.checked = settings.mode === m.id;
    radio.disabled = !m.enabled;

    radio.addEventListener('change', () => {
      if (radio.checked) {
        settings.mode = m.id;
        saveSettings(settings);
        store.update(s => ({ ...s, settings: { ...settings } }));
      }
    });

    label.appendChild(radio);
    label.appendChild(document.createTextNode(m.label + (m.note ? ' (' + m.note + ')' : '')));
    if (!m.enabled) label.style.opacity = '0.5';
    section.appendChild(label);
  }

  container.appendChild(section);
}

function renderIntensitySection() {
  const section = document.createElement('section');
  section.className = 'progress-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Интенсивность греческого';
  section.appendChild(h3);

  const container2 = document.createElement('div');
  container2.style.display = 'flex';
  container2.style.alignItems = 'center';
  container2.style.gap = '8px';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '5';
  slider.value = String(settings.intensity);

  const valSpan = document.createElement('span');
  valSpan.textContent = settings.intensity + '%';

  slider.addEventListener('input', () => {
    const val = parseInt(slider.value);
    valSpan.textContent = val + '%';
    settings.intensity = val;
    saveSettings(settings);
    store.update(s => ({ ...s, settings: { ...settings } }));
  });

  container2.appendChild(slider);
  container2.appendChild(valSpan);
  section.appendChild(container2);

  container.appendChild(section);
}

function renderThemeSection() {
  const section = document.createElement('section');
  section.className = 'progress-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Тема';
  section.appendChild(h3);

  ['light', 'dark', 'auto'].forEach(theme => {
    const label = document.createElement('label');
    label.className = 'settings-radio';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    label.style.padding = '4px 0';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = theme;
    radio.checked = settings.theme === theme;
    radio.addEventListener('change', () => {
      if (radio.checked) {
        settings.theme = theme;
        saveSettings(settings);
        applyTheme(theme);
        store.update(s => ({ ...s, settings: { ...settings } }));
      }
    });

    const names = { light: 'Светлая', dark: 'Тёмная', auto: 'Авто (как система)' };
    label.appendChild(radio);
    label.appendChild(document.createTextNode(names[theme]));
    section.appendChild(label);
  });

  container.appendChild(section);
}

function renderResetSection() {
  const section = document.createElement('section');
  section.className = 'progress-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Сброс';
  section.appendChild(h3);

  const btn = document.createElement('button');
  btn.className = 'btn btn-danger';
  btn.textContent = 'Сбросить прогресс и словарь';
  btn.addEventListener('click', () => {
    if (confirm('Сбросить весь прогресс и словарь? Это действие нельзя отменить.')) {
      db.del('progress').then(() => {
        db.del('dictionary').then(() => {
          location.reload();
        });
      });
    }
  });
  section.appendChild(btn);

  container.appendChild(section);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function unmount() {
  container = null;
}
