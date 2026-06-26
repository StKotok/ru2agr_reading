import { navigate } from '../../router.js';
import { saveSettings, resolveEffectiveTheme, applyTheme, THEMES, LIGHT_THEMES, DARK_THEMES } from '../../state/settings.js';
import { iconRead, iconWords, iconProgress, iconGear, iconInfo } from './icons.js';

const TABS = [
  { id: 'reading',    label: 'Чтение',    icon: iconRead,    hash: '#/read/john' },
  { id: 'dictionary', label: 'Словарь',   icon: iconWords,   hash: '#/dictionary' },
  { id: 'progress',   label: 'Прогресс',  icon: iconProgress, hash: '#/progress' },
  { id: 'settings',   label: 'Настройки', icon: iconGear,    hash: '#/settings' },
  { id: 'about',      label: 'О приложении', icon: iconInfo,  hash: '#/about' },
];

/**
 * Три режима темы. Каждая кнопка может быть в трёх состояниях:
 *   - нет класса (не активна)
 *   - 'active' (явно выбрана)
 *   - 'active-auto' (активна через Авто — когда выбран режим auto и OS-тема совпадает)
 */
const THEME_MODES = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark',  label: 'Тёмная' },
  { id: 'auto',  label: 'Авто' },
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

  const themeBtns = [];
  THEME_MODES.forEach(mode => {
    const btn = document.createElement('button');
    btn.className = 'nav-theme-btn';
    btn.textContent = mode.label;
    btn.addEventListener('click', () => {
      const st = store.get();
      let newTheme;
      if (mode.id === 'auto') {
        newTheme = 'auto';
      } else if (mode.id === 'light') {
        // Выбрать светлую тему по умолчанию (или текущую светлую)
        const cur = st.settings?.theme;
        newTheme = (cur && cur !== 'auto' && LIGHT_THEMES.includes(cur)) ? cur : 'pergament';
      } else {
        // Выбрать тёмную тему по умолчанию (или текущую тёмную)
        const cur = st.settings?.theme;
        newTheme = (cur && cur !== 'auto' && DARK_THEMES.includes(cur)) ? cur : 'dark';
      }
      const ns = { ...st.settings, theme: newTheme };
      applyTheme(newTheme);
      saveSettings(ns);
      store.update(s => ({ ...s, settings: ns }));
      updateThemeActive();
    });
    themeSwitcher.appendChild(btn);
    themeBtns.push({ btn, id: mode.id });
  });
  themeSection.appendChild(themeSwitcher);
  nav.appendChild(themeSection);

  function updateThemeActive() {
    const st = store.get();
    const themeSetting = st.settings?.theme || 'auto';

    // Определяем эффективную тему для индикатора auto-active
    const effectiveTheme = resolveEffectiveTheme(themeSetting);
    const effectiveIsDark = DARK_THEMES.includes(effectiveTheme);

    themeBtns.forEach(({ btn, id }) => {
      // Сброс
      btn.classList.remove('active', 'active-auto');

      if (id === 'auto') {
        // Авто активно когда settings.theme === 'auto'
        if (themeSetting === 'auto') {
          btn.classList.add('active');
        }
      } else if (id === 'light') {
        if (themeSetting !== 'auto' && LIGHT_THEMES.includes(themeSetting)) {
          // Явно выбрана светлая тема
          btn.classList.add('active');
        } else if (themeSetting === 'auto' && !effectiveIsDark) {
          // Авто + система светлая → auto-active
          btn.classList.add('active-auto');
        }
      } else if (id === 'dark') {
        if (themeSetting !== 'auto' && DARK_THEMES.includes(themeSetting)) {
          // Явно выбрана тёмная тема
          btn.classList.add('active');
        } else if (themeSetting === 'auto' && effectiveIsDark) {
          // Авто + система тёмная → auto-active
          btn.classList.add('active-auto');
        }
      }
    });
  }

  function updateActive(screen) {
    buttons.forEach(({ btn, id }) => {
      const isActive = id === screen;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  store.subscribe([], (state) => { updateActive(state.screen); updateThemeActive(); });
  updateActive(store.get().screen);
  updateThemeActive();

  return nav;
}
