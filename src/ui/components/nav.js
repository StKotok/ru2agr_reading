import { navigate } from '../../router.js';
import { saveSettings } from '../../state/settings.js';
import { iconRead, iconWords, iconProgress, iconGear } from './icons.js';

const TABS = [
  { id: 'reading',    label: 'Чтение',    icon: iconRead,    hash: '#/read/john' },
  { id: 'dictionary', label: 'Словарь',   icon: iconWords,   hash: '#/dictionary' },
  { id: 'progress',   label: 'Прогресс',  icon: iconProgress, hash: '#/progress' },
  { id: 'settings',   label: 'Настройки', icon: iconGear,    hash: '#/settings' },
];

const THEME_OPTIONS = [
  { label: 'Светлая', key: 'Пергамент' },
  { label: 'Тёмная',  key: 'Тёмная' },
  { label: 'Авто',    key: 'Пергамент' },
];

export function createNav(store) {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Главная навигация');

  // ── Заголовок (десктоп) ──
  const titleSection = document.createElement('div');
  titleSection.className = 'nav-title-section';
  titleSection.innerHTML = `
    <div class="nav-title">Читалка НЗ</div>
    <div class="nav-subtitle">греческий сквозь русский</div>
  `;
  nav.appendChild(titleSection);

  // ── Табы ──
  const tabContainer = document.createElement('div');
  tabContainer.className = 'nav-tab-container';
  let buttons = [];

  TABS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.setAttribute('aria-label', t.label);
    btn.innerHTML = `<span class="nav-tab-icon">${t.icon()}</span><span class="nav-tab-label">${t.label}</span>`;
    btn.addEventListener('click', () => navigate(t.hash));
    tabContainer.appendChild(btn);
    buttons.push({ btn, id: t.id });
  });
  nav.appendChild(tabContainer);

  // ── Спейсер ──
  const spacer = document.createElement('div');
  spacer.className = 'nav-spacer';
  nav.appendChild(spacer);

  // ── Переключатель темы (десктоп) ──
  const themeSection = document.createElement('div');
  themeSection.className = 'nav-theme-section';
  themeSection.innerHTML = '<div class="nav-theme-label">Тема</div>';
  const themeSwitcher = document.createElement('div');
  themeSwitcher.className = 'nav-theme-switcher';
  THEME_OPTIONS.forEach(pair => {
    const btn = document.createElement('button');
    btn.className = 'nav-theme-btn';
    btn.textContent = pair.label;
    btn.addEventListener('click', () => {
      const st = store.get();
      const ns = { ...st.settings, theme: pair.key };
      saveSettings(ns);
      store.update(s => ({ ...s, settings: ns }));
      updateThemeActive();
    });
    themeSwitcher.appendChild(btn);
  });
  themeSection.appendChild(themeSwitcher);
  nav.appendChild(themeSection);

  function updateThemeActive() {
    const st = store.get();
    const activeTheme = st.settings?.theme || 'Пергамент';
    const btns = themeSwitcher.querySelectorAll('.nav-theme-btn');
    btns.forEach((btn, i) => {
      const pair = THEME_OPTIONS[i];
      btn.classList.toggle('active', pair.key === activeTheme);
    });
  }

  function updateActive(screen) {
    const activeId = screen === 'about' ? 'settings' : screen;
    buttons.forEach(({ btn, id }) => {
      const isActive = id === activeId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  store.subscribe([], (state) => { updateActive(state.screen); updateThemeActive(); });
  updateActive(store.get().screen);
  updateThemeActive();

  return nav;
}
