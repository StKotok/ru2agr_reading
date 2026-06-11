import { createStore } from './state/store.js';
import { parse, onChange } from './router.js';
import { createNav } from './ui/components/nav.js';
import * as readingScreen from './ui/screens/reading.js';
import * as dictionaryScreen from './ui/screens/dictionary.js';
import * as progressScreen from './ui/screens/progress.js';
import * as settingsScreen from './ui/screens/settings.js';

const SCREENS = {
  reading: readingScreen,
  dictionary: dictionaryScreen,
  progress: progressScreen,
  settings: settingsScreen,
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

// Реакция на hash-изменения
function handleRoute(route) {
  switchScreen(route.screen, route.params);
}

// Начальная загрузка
handleRoute(parse(location.hash));

// Если дефолтного хеша нет — редиректим
if (!location.hash) {
  location.hash = '#/read/john';
}

onChange(handleRoute);
