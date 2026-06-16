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

  // Тема
  renderThemeSection();

  // Диакритика и Стронг
  renderDisplaySection();

  // Сброс
  renderResetSection();
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

function renderDisplaySection() {
  const section = document.createElement('section');
  section.className = 'progress-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Показывать';
  section.appendChild(h3);

  // show.diacritics
  const diacriticsLabel = document.createElement('label');
  diacriticsLabel.style.display = 'flex';
  diacriticsLabel.style.alignItems = 'center';
  diacriticsLabel.style.gap = '8px';
  diacriticsLabel.style.padding = '4px 0';
  const diacriticsCb = document.createElement('input');
  diacriticsCb.type = 'checkbox';
  diacriticsCb.checked = settings.show?.diacritics ?? false;
  diacriticsCb.addEventListener('change', () => {
    if (!settings.show) settings.show = {};
    settings.show.diacritics = diacriticsCb.checked;
    saveSettings(settings);
    store.update(s => ({ ...s, settings: { ...settings } }));
  });
  diacriticsLabel.appendChild(diacriticsCb);
  diacriticsLabel.appendChild(document.createTextNode('Показывать диакритику (ударения, придыхания)'));
  section.appendChild(diacriticsLabel);

  // show.strongs
  const strongsLabel = document.createElement('label');
  strongsLabel.style.display = 'flex';
  strongsLabel.style.alignItems = 'center';
  strongsLabel.style.gap = '8px';
  strongsLabel.style.padding = '4px 0';
  const strongsCb = document.createElement('input');
  strongsCb.type = 'checkbox';
  strongsCb.checked = settings.show?.strongs ?? false;
  strongsCb.addEventListener('change', () => {
    if (!settings.show) settings.show = {};
    settings.show.strongs = strongsCb.checked;
    saveSettings(settings);
    store.update(s => ({ ...s, settings: { ...settings } }));
  });
  strongsLabel.appendChild(strongsCb);
  strongsLabel.appendChild(document.createTextNode('Показывать номера Стронга (G3056)'));
  section.appendChild(strongsLabel);

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
  // Кэш для мгновенного применения при следующей загрузке (FOUC-защита)
  localStorage.setItem('theme', theme);
  // Динамический theme-color для мобильного браузерного chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const surface = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface').trim();
    meta.setAttribute('content', surface);
  }
}

export function unmount() {
  container = null;
}
