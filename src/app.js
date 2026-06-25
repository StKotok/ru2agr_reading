import { Workbox } from 'workbox-window';
import { createStore } from './state/store.js';
import { parse, onChange } from './router.js';
import { createNav } from './ui/components/nav.js';
import { loadSettings, applyTheme, applyContrast, listenForOSThemeChanges } from './state/settings.js';
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
screenContainer.id = 'main-content';
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
    const contrast = settings.contrast || 'sharp';
    applyTheme(theme);
    applyContrast(contrast);
  } catch (_) { /* theme fallback: auto */ }
})();

// Слушатель смены OS-темы в режиме auto
listenForOSThemeChanges();

// Регистрация service worker — используем Workbox напрямую, а не virtual:pwa-register,
// потому что autoUpdate-обёртка vite-plugin-pwa не отдаёт наружу wb.update() —
// единственный метод, запускающий registration.update() (принудительную проверку sw.js).
// Без него приложение на мобильных устройствах в standalone-режиме может неделями
// не узнавать о новом деплое.
let wb = null;

if ('serviceWorker' in navigator) {
  wb = new Workbox('./sw.js', { scope: './' });

  wb.addEventListener('activated', (event) => {
    if (event.isUpdate || event.isExternal) {
      window.location.reload();
    }
  });

  // wb.register() — асинхронный. Цепляем первый вызов checkForUpdate() в .then(),
  // чтобы не вызвать wb.update() до того, как registration завершится (иначе no-op).
  wb.register({ immediate: true })
    .then(() => { checkForUpdate(); cleanupOldDataCaches(); })
    .catch(() => { wb = null; }); // без SW приложение работает, просто без PWA
}

// Cleanup старых runtime data caches.
// KEEP IN SYNC with vite.config.js runtimeCaching cacheNames.
async function cleanupOldDataCaches() {
  if (!('caches' in window)) return;
  const keep = new Set(['book-packs-v2', 'lexicon-data-v2']);
  const oldPrefixes = ['book-packs', 'lexicon-data'];
  try {
    const names = await caches.keys();
    await Promise.all(names.map(name => {
      const isOldDataCache = oldPrefixes.some(prefix => name === prefix || name.startsWith(`${prefix}-`));
      return isOldDataCache && !keep.has(name) ? caches.delete(name) : false;
    }));
  } catch (_) { /* fail-soft */ }
}

// Принудительная проверка обновления SW: каждые 5 минут и при возврате в фокус.
// В оффлайне wb.update() тихо отклоняется. Неожиданные ошибки пишем в консоль —
// в отличие от старого .catch(() => {}), который глушил вообще всё.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
let updateInterval = null;

function checkForUpdate() {
  if (!wb) return;
  wb.update().catch(e => {
    if (e instanceof TypeError && e.message === 'Failed to fetch') return; // офлайн — ок
    console.warn('SW update check failed:', e);
  });
}

if (wb) {
  updateInterval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wb) {
    checkForUpdate();
  }
});

// Реакция на hash-изменения
async function handleRoute(route) {
  // Флаг для разработки: пропустить онбординг (localStorage.setItem('dev_skip_onboarding','1'))
  const SKIP_ONBOARDING = (() => {
    try {
      return localStorage.getItem('dev_skip_onboarding') === '1';
    } catch (_) {
      return false;
    }
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
