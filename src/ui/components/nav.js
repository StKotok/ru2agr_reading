import { navigate } from '../../router.js';
import { iconRead, iconWords, iconProgress, iconGear, iconInfo } from './icons.js';

const TABS = [
  { id: 'reading',    label: 'Читать',    icon: iconRead,     hash: '#/read/john' },
  { id: 'dictionary', label: 'Слова',     icon: iconWords,    hash: '#/dictionary' },
  { id: 'progress',   label: 'Прогресс',  icon: iconProgress, hash: '#/progress' },
  { id: 'settings',   label: 'Настр',     icon: iconGear,     hash: '#/settings' },
  { id: 'about',      label: 'О',         icon: iconInfo,     hash: '#/about' },
];

export function createNav(store) {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Главная навигация');

  function render(screen) {
    nav.innerHTML = TABS.map(t =>
      `<button class="nav-tab ${t.id === screen ? 'active' : ''}"
               data-screen="${t.id}"
               aria-current="${t.id === screen ? 'page' : 'false'}"
               aria-label="${t.label}">
         <span class="nav-tab-icon">${t.icon(20)}</span>
         <span class="nav-tab-label">${t.label}</span>
       </button>`
    ).join('');
  }

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-tab');
    if (!btn) return;
    const tab = TABS.find(t => t.id === btn.dataset.screen);
    if (tab) navigate(tab.hash);
  });

  // Определяем текущий экран из store
  store.subscribe([], (state) => {
    render(state.screen);
  });

  render(store.get().screen);

  return nav;
}
