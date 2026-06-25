import { navigate } from '../../router.js';
import { iconRead, iconWords, iconProgress, iconGear } from './icons.js';

const TABS = [
  { id: 'reading',    label: 'Чтение',    icon: iconRead,    hash: '#/read/john' },
  { id: 'dictionary', label: 'Словарь',   icon: iconWords,   hash: '#/dictionary' },
  { id: 'progress',   label: 'Прогресс',  icon: iconProgress, hash: '#/progress' },
  { id: 'settings',   label: 'Ещё',       icon: iconGear,    hash: '#/settings' },
];

export function createNav(store) {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Главная навигация');

  let buttons = [];

  TABS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.setAttribute('aria-label', t.label);
    btn.innerHTML = `<span class="nav-tab-icon">${t.icon(22)}</span><span class="nav-tab-label">${t.label}</span>`;
    btn.addEventListener('click', () => navigate(t.hash));
    nav.appendChild(btn);
    buttons.push({ btn, id: t.id });
  });

  function updateActive(screen) {
    // Map 'about' to 'settings' — both live under Ещё
    const activeId = screen === 'about' ? 'settings' : screen;
    buttons.forEach(({ btn, id }) => {
      const isActive = id === activeId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  store.subscribe([], (state) => updateActive(state.screen));
  updateActive(store.get().screen);

  return nav;
}
