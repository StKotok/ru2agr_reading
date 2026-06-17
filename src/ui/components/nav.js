import { navigate } from '../../router.js';
import { iconSettings } from './icons.js';

const TABS = [
  { id: 'reading', label: 'Читать', hash: '#/read/john' },
  { id: 'dictionary', label: 'Слова', hash: '#/dictionary' },
  { id: 'progress', label: 'Прогресс', hash: '#/progress' },
  { id: 'settings', label: iconSettings(20), ariaLabel: 'Настройки', hash: '#/settings' },
  { id: 'about', label: 'О', hash: '#/about' },
];

export function createNav(store) {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Главная навигация');

  function render(screen) {
    nav.innerHTML = TABS.map(t =>
      `<button class="nav-tab ${t.id === screen ? 'active' : ''}"
               data-screen="${t.id}" aria-current="${t.id === screen ? 'page' : 'false'}"${t.ariaLabel ? ` aria-label="${t.ariaLabel}"` : ''}>
         ${t.label}
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
