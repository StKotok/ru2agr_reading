import { registerSW } from 'virtual:pwa-register';
import { createStore } from './state/store.js';
import { parse, onChange } from './router.js';
import { createNav } from './ui/components/nav.js';
import { loadSettings } from './state/settings.js';
import * as readingScreen from './ui/screens/reading.js';
import * as dictionaryScreen from './ui/screens/dictionary.js';
import * as progressScreen from './ui/screens/progress.js';
import * as settingsScreen from './ui/screens/settings.js';
import * as onboardingScreen from './ui/screens/onboarding.js';
import * as aboutScreen from './ui/screens/about.js';

const SCREENS = {
  reading: readingScreen,
  dictionary: dictionaryScreen,
  progress: progressScreen,
  settings: settingsScreen,
  onboarding: onboardingScreen,
  about: aboutScreen,
};

const store = createStore({ screen: 'reading', book: 'john' });

const appEl = document.getElementById('app');

// Навигация
const nav = createNav(store);
appEl.appendChild(nav);

// Контейнер экрана
const screenContainer = document.createElement('main');
screenContainer.className = 'screen-container';
appEl.appendChild(screenContainer);

let currentScreen = null;
let onboardingChecked = false;

function switchScreen(screenName, params) {
  if (currentScreen && currentScreen.unmount) {
    currentScreen.unmount();
  }
  currentScreen = SCREENS[screenName] || SCREENS.reading;
  screenContainer.innerHTML = '';
  const ctx = { store, params };
  currentScreen.mount(screenContainer, ctx);

  store.update(s => ({ ...s, screen: screenName, book: params.book || s.book }));
}

// Применяем сохранённую тему до первого рендера
(async () => {
  try {
    const settings = await loadSettings();
    const theme = settings.theme || 'auto';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (_) { /* theme fallback: auto */ }
})();

// Регистрация service worker (vite-plugin-pwa)
registerSW({ immediate: true });

// Реакция на hash-изменения
async function handleRoute(route) {
  // Флаг для разработки: пропустить онбординг
  const SKIP_ONBOARDING = (() => {
    try { return localStorage.getItem('dev_skip_onboarding') === '1'; } catch (_) { return false; }
  })();

  if (!SKIP_ONBOARDING) {
    // Проверка онбординга
    if (!onboardingChecked) {
      try {
        const settings = await loadSettings();
        onboardingChecked = true;
        if (!settings.onboarded) {
          location.hash = '#/onboarding';
          return;
        }
      } catch (_) {
        onboardingChecked = true;
      }
    }

    // Если пытаемся уйти с онбординга без завершения — блокируем
    if (route.screen !== 'onboarding') {
      try {
        const settings = await loadSettings();
        if (!settings.onboarded) {
          location.hash = '#/onboarding';
          return;
        }
      } catch (_) { /* ignore */ }
    }
  }

  switchScreen(route.screen, route.params);
}

// Начальная загрузка
handleRoute(parse(location.hash));

// Если дефолтного хеша нет — редиректим
if (!location.hash) {
  location.hash = '#/read/john';
}

onChange(handleRoute);
