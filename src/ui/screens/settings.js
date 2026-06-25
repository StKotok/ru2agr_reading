import { loadSettings, saveSettings, applyTheme, applyContrast, THEMES, LIGHT_THEMES, DARK_THEMES, CONTRAST_LEVELS } from '../../state/settings.js';
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

  // Заголовок — как в прототипе
  const title = document.createElement('div');
  title.className = 'settings-title';
  title.textContent = 'Настройки';
  container.appendChild(title);

  // Тема
  renderThemeSection();

  // Контраст
  renderContrastSection();

  // Показывать
  renderDisplaySection();

  // Сброс
  renderResetSection();
}

// === Секция: тема ===
function renderThemeSection() {
  const label = sectionLabel('Тема');
  container.appendChild(label);

  // Режим: система / светлая / тёмная
  const modeBar = document.createElement('div');
  modeBar.className = 'settings-segmented';

  const modes = [
    { id: 'auto', label: 'Система' },
    { id: 'light', label: 'Светлая' },
    { id: 'dark', label: 'Тёмная' },
  ];

  const currentMode = settings.theme === 'auto' ? 'auto'
    : DARK_THEMES.includes(settings.theme) ? 'dark'
    : 'light';

  modes.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'settings-seg-btn' + (m.id === currentMode ? ' active' : '');
    btn.textContent = m.label;
    btn.addEventListener('click', () => {
      let newTheme;
      if (m.id === 'auto') {
        newTheme = 'auto';
      } else if (m.id === 'light') {
        newTheme = LIGHT_THEMES.includes(settings.theme) && settings.theme !== 'auto' ? settings.theme : 'pergament';
      } else {
        newTheme = DARK_THEMES.includes(settings.theme) ? settings.theme : 'dark';
      }
      settings.theme = newTheme;
      applyTheme(newTheme);
      saveSettings(settings);
      store.update(s => ({ ...s, settings: { ...settings } }));
      render();
    });
    modeBar.appendChild(btn);
  });
  container.appendChild(modeBar);

  // Слоты: светлая и тёмная тема
  const slots = document.createElement('div');
  slots.className = 'settings-slots';

  const currentLight = LIGHT_THEMES.includes(settings.theme) ? settings.theme : 'pergament';
  const currentDark = DARK_THEMES.includes(settings.theme) ? settings.theme : 'dark';

  [['light', currentLight, LIGHT_THEMES], ['dark', currentDark, DARK_THEMES]].forEach(([type, current, list]) => {
    const slot = buildThemeSlot(type, current, list);
    slots.appendChild(slot);
  });
  container.appendChild(slots);

  // Галерея тем (поповер)
  const gallery = document.createElement('div');
  gallery.className = 'settings-gallery';
  gallery.hidden = true;
  gallery.setAttribute('role', 'listbox');
  gallery.setAttribute('aria-label', 'Выбор темы');
  container.appendChild(gallery);

  let galleryType = null;

  function openGallery(type, currentTheme, themeList) {
    galleryType = type;
    gallery.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'settings-gallery-grid';

    themeList.forEach(slug => {
      const card = document.createElement('button');
      card.className = 'settings-gallery-card' + (slug === currentTheme ? ' active' : '');
      const label = themeLabel(slug);
      card.innerHTML = `
        <span class="settings-gallery-strips">
          <span class="settings-gallery-strip" style="background:var(--paper-${slug},#ece7dd)"></span>
          <span class="settings-gallery-strip" style="background:var(--ink-${slug},#272320)"></span>
          <span class="settings-gallery-strip" style="background:var(--blue-${slug},#2f5d85)"></span>
          <span class="settings-gallery-strip" style="background:var(--terra-${slug},#bb763c)"></span>
        </span>
        <span class="settings-gallery-name">${label}</span>
        ${slug === currentTheme ? '<span class="settings-gallery-check">✓</span>' : ''}
      `;
      card.addEventListener('click', () => {
        settings.theme = slug;
        applyTheme(slug);
        saveSettings(settings);
        store.update(s => ({ ...s, settings: { ...settings } }));
        closeGallery();
        render();
      });
      grid.appendChild(card);
    });

    gallery.appendChild(grid);
    gallery.hidden = false;
  }

  function closeGallery() {
    galleryType = null;
    gallery.hidden = true;
  }

  slots.querySelectorAll('.settings-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const type = slot.dataset.type;
      const current = type === 'light' ? currentLight : currentDark;
      const list = type === 'light' ? LIGHT_THEMES : DARK_THEMES;
      if (galleryType === type) {
        closeGallery();
      } else {
        openGallery(type, current, list);
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (galleryType && !container.contains(e.target)) {
      closeGallery();
    }
  }, { once: false });
}

// === Секция: контраст ===
function renderContrastSection() {
  const label = sectionLabel('Контраст');
  container.appendChild(label);

  const bar = document.createElement('div');
  bar.className = 'settings-segmented';

  const current = settings.contrast || 'sharp';
  const labels = { soft: 'Мягкий', sharp: 'Чёткий', maximum: 'Максимальный' };

  CONTRAST_LEVELS.forEach(level => {
    const btn = document.createElement('button');
    btn.className = 'settings-seg-btn' + (level === current ? ' active' : '');
    btn.textContent = labels[level];
    btn.addEventListener('click', () => {
      settings.contrast = level;
      applyContrast(level);
      saveSettings(settings);
      store.update(s => ({ ...s, settings: { ...settings } }));
      render();
    });
    bar.appendChild(btn);
  });
  container.appendChild(bar);
}

// === Секция: показывать ===
function renderDisplaySection() {
  const label = sectionLabel('Показывать');
  container.appendChild(label);

  [
    ['diacritics', 'Показывать диакритику (ударения, придыхания)'],
    ['strongs', 'Показывать номера Стронга (G3056)'],
    ['ruHint', 'Показывать русские подсказки']
  ].forEach(([key, text]) => {
    const cbLabel = document.createElement('label');
    cbLabel.className = 'settings-check-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = settings.show?.[key] ?? (key === 'ruHint');
    cb.addEventListener('change', () => {
      if (!settings.show) settings.show = {};
      settings.show[key] = cb.checked;
      saveSettings(settings);
      store.update(s => ({ ...s, settings: { ...settings } }));
    });
    cbLabel.appendChild(cb);
    cbLabel.appendChild(document.createTextNode(' ' + text));
    container.appendChild(cbLabel);
  });
}

// === Секция: сброс ===
function renderResetSection() {
  const label = sectionLabel('Сброс');
  container.appendChild(label);

  const btn = document.createElement('button');
  btn.className = 'btn btn-danger';
  btn.textContent = 'Сбросить прогресс и словарь';
  btn.addEventListener('click', () => {
    if (confirm('Сбросить весь прогресс и словарь? Это действие нельзя отменить.')) {
      Promise.allSettled([db.del('progress'), db.del('dictionary')]).finally(() => {
        location.reload();
      });
    }
  });
  container.appendChild(btn);
}

// === Хелперы ===

function sectionLabel(text) {
  const el = document.createElement('div');
  el.className = 'settings-section-label';
  el.textContent = text;
  return el;
}

const THEME_LABELS = {
  pergament: 'Пергамент', sepia: 'Сепия', ivory: 'Слоновая кость',
  fog: 'Туман', sea: 'Море', forest: 'Лес', rose: 'Роза',
  lavender: 'Лаванда', sunset: 'Закат',
  dark: 'Тёмная', night: 'Ночь', coal: 'Уголь'
};

function themeLabel(slug) {
  return THEME_LABELS[slug] || slug;
}

function buildThemeSlot(type, currentTheme, themeList) {
  const slot = document.createElement('button');
  slot.className = 'settings-slot';
  slot.dataset.type = type;
  const label = type === 'light' ? 'Светлая' : 'Тёмная';

  slot.innerHTML = `
    <span class="settings-slot-swatch" style="background:var(--paper-${currentTheme},${type === 'light' ? '#ECE7DD' : '#26231d'})"></span>
    <span class="settings-slot-name">${themeLabel(currentTheme)}</span>
    <span class="settings-slot-chevron">▾</span>
  `;
  return slot;
}

export function unmount() {
  container = null;
}
