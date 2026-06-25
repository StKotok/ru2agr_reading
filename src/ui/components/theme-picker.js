/**
 * Theme Picker — визуальный выборщик тем (Variant B: слоты + поповер-галерея).
 * Соответствует readerRenderSettingsThemePicker из дизайн-прототипа.
 */
import { THEMES, LIGHT_THEMES, DARK_THEMES, applyTheme, applyContrast, CONTRAST_LEVELS } from '../../state/settings.js';

// Мини-превью: полоски цветов темы
function colorStrips(themeSlug) {
  const el = document.createElement('span');
  el.className = 'tp-strips';
  el.setAttribute('aria-hidden', 'true');
  // Читаем CSS-переменные темы через временный data-theme
  const style = getComputedStyle(document.documentElement);
  // Показываем мини-превью как градиент из ключевых цветов
  el.innerHTML = `
    <span class="tp-strip" style="background:var(--surface, #ece7dd)"></span>
    <span class="tp-strip" style="background:var(--text, #272320)"></span>
    <span class="tp-strip" style="background:var(--greek, #2f5d85)"></span>
    <span class="tp-strip" style="background:var(--greek-word, #bb763c)"></span>
  `;
  return el;
}

// Название темы по слагу
const THEME_LABELS = {
  pergament: 'Пергамент', sepia: 'Сепия', ivory: 'Слоновая кость',
  fog: 'Туман', sea: 'Море', forest: 'Лес', rose: 'Роза',
  lavender: 'Лаванда', sunset: 'Закат',
  dark: 'Тёмная', night: 'Ночь', coal: 'Уголь'
};

/**
 * Создаёт слот-превью текущей темы (светлая / тёмная).
 */
function createSlot(label, currentTheme, onClick) {
  const slot = document.createElement('button');
  slot.className = 'tp-slot';
  slot.setAttribute('aria-label', `${label}: ${THEME_LABELS[currentTheme] || currentTheme}`);
  slot.innerHTML = `
    <span class="tp-slot-label">${label}</span>
    <span class="tp-slot-swatch">${colorStrips(currentTheme).outerHTML}</span>
    <span class="tp-slot-name">${THEME_LABELS[currentTheme] || currentTheme}</span>
    <span class="tp-slot-chevron">▾</span>
  `;
  slot.addEventListener('click', onClick);
  return slot;
}

/**
 * Создаёт карточку темы в галерее.
 */
function createThemeCard(slug, isActive, onSelect) {
  const card = document.createElement('button');
  card.className = 'tp-card' + (isActive ? ' active' : '');
  card.setAttribute('aria-pressed', String(isActive));
  card.setAttribute('aria-label', THEME_LABELS[slug] || slug);
  const isDark = DARK_THEMES.includes(slug);
  card.innerHTML = `
    <span class="tp-card-strips">
      <span class="tp-card-strip" style="background:var(--${isDark ? 'surface-dark' : 'paper'}-${slug}, ${isDark ? '#26231d' : '#ECE7DD'})"></span>
      <span class="tp-card-strip" style="background:var(--${isDark ? 'text' : 'ink'}-${slug}, ${isDark ? '#ece6da' : '#272320'})"></span>
      <span class="tp-card-strip" style="background:var(--${isDark ? 'greek' : 'blue'}-${slug}, ${isDark ? '#5a93cc' : '#2f5d85'})"></span>
      <span class="tp-card-strip" style="background:var(--${isDark ? 'greek-word' : 'terra'}-${slug}, ${isDark ? '#d99a5f' : '#bb763c'})"></span>
    </span>
    <span class="tp-card-name">${THEME_LABELS[slug] || slug}</span>
    ${isActive ? '<span class="tp-card-check">✓</span>' : ''}
  `;
  card.addEventListener('click', () => onSelect(slug));
  return card;
}

/**
 * Строит галерею тем (сетка карточек).
 */
function buildGallery(activeTheme, onSelect) {
  const gallery = document.createElement('div');
  gallery.className = 'tp-gallery';
  gallery.setAttribute('role', 'listbox');
  gallery.setAttribute('aria-label', 'Выбор темы');

  const grid = document.createElement('div');
  grid.className = 'tp-gallery-grid';

  for (const slug of THEMES) {
    grid.appendChild(createThemeCard(slug, slug === activeTheme, onSelect));
  }

  gallery.appendChild(grid);
  return gallery;
}

/**
 * Строит панель контраста.
 */
function buildContrastPanel(currentContrast, onChange) {
  const panel = document.createElement('div');
  panel.className = 'tp-contrast';

  const label = document.createElement('div');
  label.className = 'tp-contrast-label';
  label.textContent = 'Контрастность';
  panel.appendChild(label);

  const row = document.createElement('div');
  row.className = 'tp-contrast-row';

  const labels = { soft: 'Мягкий', sharp: 'Чёткий', maximum: 'Максимальный' };
  for (const level of CONTRAST_LEVELS) {
    const btn = document.createElement('button');
    btn.className = 'tp-contrast-btn' + (level === currentContrast ? ' active' : '');
    btn.textContent = labels[level];
    btn.addEventListener('click', () => {
      row.querySelectorAll('.tp-contrast-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(level);
    });
    row.appendChild(btn);
  }

  panel.appendChild(row);
  return panel;
}

/**
 * Монтирует выборщик тем в контейнер.
 * @param {HTMLElement} container
 * @param {object} ctx — { store }
 */
export function mountThemePicker(container, ctx) {
  const { store } = ctx;
  const state = store.get();
  const settings = state.settings || {};
  const activeTheme = settings.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'pergament')
    : (THEMES.includes(settings.theme) ? settings.theme : 'pergament');
  const activeContrast = settings.contrast || 'sharp';

  let lightTheme = activeTheme;
  let darkTheme = 'dark';
  if (DARK_THEMES.includes(activeTheme)) {
    darkTheme = activeTheme;
    lightTheme = 'pergament';
  }

  let galleryOpen = false;
  let galleryTarget = null; // 'light' | 'dark'

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'theme-picker';

  // Секция: слоты тем
  const slotsRow = document.createElement('div');
  slotsRow.className = 'tp-slots';

  const lightSlot = createSlot('Светлая', lightTheme, () => toggleGallery('light', lightSlot));
  const darkSlot = createSlot('Тёмная', darkTheme, () => toggleGallery('dark', darkSlot));

  slotsRow.appendChild(lightSlot);
  slotsRow.appendChild(darkSlot);
  wrapper.appendChild(slotsRow);

  // Галерея (поповер)
  const galleryPopover = document.createElement('div');
  galleryPopover.className = 'tp-popover';
  galleryPopover.hidden = true;
  wrapper.appendChild(galleryPopover);

  // Контраст
  const contrastPanel = buildContrastPanel(activeContrast, (level) => {
    applyContrast(level);
    const st = store.get();
    store.update(s => ({ ...s, settings: { ...(s.settings || {}), contrast: level } }));
  });
  wrapper.appendChild(contrastPanel);

  container.appendChild(wrapper);

  function toggleGallery(target, slotEl) {
    if (galleryOpen && galleryTarget === target) {
      closeGallery();
      return;
    }
    galleryOpen = true;
    galleryTarget = target;
    const theme = target === 'light' ? lightTheme : darkTheme;
    galleryPopover.innerHTML = '';
    galleryPopover.appendChild(buildGallery(theme, (slug) => {
      if (target === 'light') lightTheme = slug;
      else darkTheme = slug;
      applyTheme(slug);
      const st = store.get();
      store.update(s => ({ ...s, settings: { ...(s.settings || {}), theme: slug } }));
      // Обновить слот
      slotEl.querySelector('.tp-slot-name').textContent = THEME_LABELS[slug] || slug;
      closeGallery();
    }));
    galleryPopover.hidden = false;
    slotEl.classList.add('active');
  }

  function closeGallery() {
    galleryOpen = false;
    galleryTarget = null;
    galleryPopover.hidden = true;
    wrapper.querySelectorAll('.tp-slot.active').forEach(s => s.classList.remove('active'));
  }

  // Закрытие по клику вне
  document.addEventListener('click', (e) => {
    if (galleryOpen && !wrapper.contains(e.target)) {
      closeGallery();
    }
  });
}
