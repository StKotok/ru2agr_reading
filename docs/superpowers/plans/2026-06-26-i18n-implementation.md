# i18n Localization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English/Russian UI localization with URL-based language switching, auto-detection, and data-driven strings (book names, glosses).

**Architecture:** Lightweight custom `I18n` class (~100 lines) with flat JSON translation dictionaries, `Intl.PluralRules` for pluralization, and `{{var}}` interpolation. Language stored in settings, reflected in URL (`#/ru/read/john`). No dependencies.

**Tech Stack:** Vanilla JS, Vite (JSON imports via dynamic `import()`), IndexedDB (settings persistence).

**Spec:** `docs/superpowers/specs/2026-06-26-i18n-design.md`

## Global Constraints

- UI language: `'ru'` | `'en'`, stored as `settings.uiLang` (null = auto-detect)
- URL scheme: `#/{ru|en}/read/{book}`, backward-compatible with old `#/read/{book}`
- No new npm dependencies
- No changes to IndexedDB topology, PWA caches, or data schemas
- `npm test` must stay green (220+ tests)
- `npm run build` must succeed
- Books source: `docs/source-data/app-config/books.json` → copied to `assets/data/books.json`
- All strings in `src/i18n/{ru,en}.json`, loaded dynamically per language

## File Map

```
Create:
  src/i18n/index.js          I18n class + singleton export (~100 lines)
  src/i18n/ru.json           Russian translations (~120 keys)
  src/i18n/en.json           English translations (~120 keys)

Modify:
  src/router.js              New URL patterns with (ru|en) prefix
  src/app.js                 i18n.init() integration
  src/state/settings.js      Add uiLang field; remove THEME_LABELS, CONTRAST_LABELS
  src/ui/components/nav.js   i18n.t() for tab labels, theme labels
  src/ui/components/inspector.js  i18n.t() for empty state, aria-labels
  src/ui/components/top-bar.js    i18n.t() for book groups, aria-labels
  src/ui/components/word-card.js  i18n.t() for labels, gloss helper
  src/ui/components/mode-widget.js i18n.t() for all labels, hints, chip
  src/state/card-settings.js      CARD_SECTIONS labels → i18n keys
  src/ui/screens/about.js         i18n.t() for all content
  src/ui/screens/onboarding.js    i18n.t() for presets, steps
  src/ui/screens/progress.js      i18n.t() for sections, labels
  src/ui/screens/settings.js      i18n.t() + language selector section
  src/ui/screens/reading.js       i18n.t() for all labels, notices, toasts
  src/ui/screens/dictionary.js    i18n.t() for filters, labels, cards
  docs/source-data/app-config/books.json  Add shortEn, titleEn fields
```

---

### Task 1: I18n module — class + Russian dictionary

**Files:**
- Create: `src/i18n/index.js`
- Create: `src/i18n/ru.json`

**Interfaces:**
- Produces: `export const i18n` (singleton). Methods: `init(store, settings) → string`, `t(key, params?) → string`, `get lang`, `setLang(lang)`, `detectBrowserLang() → string`, `langFromPath(path) → string|null`, `langPrefix(lang?) → string`, `bookName(book) → {short, title}`, `gloss(lexeme) → string|null`, `themeLabel(slug) → string`, `contrastLabel(level) → string`, `destroy()`

**Produces:** Singleton `i18n` ready for import by all other modules.

- [ ] **Step 1: Create `src/i18n/index.js`**

```js
// src/i18n/index.js
/**
 * I18n singleton — language detection, translation, pluralization.
 *
 * Usage:
 *   import { i18n } from '../i18n/index.js';
 *   await i18n.init(store, settings);  // once in app.js
 *   i18n.t('nav.reading')              // → 'Чтение' / 'Reading'
 *   i18n.t('dict.wordsCount', { count: 5 })  // → '5 слов' / '5 words'
 *   i18n.bookName(book).short          // → 'Ин' / 'Jn'
 *   i18n.gloss(lexeme)                 // → 'слово' / 'word'
 */

class I18n {
  constructor() {
    /** @type {'ru'|'en'} */
    this._lang = 'ru';
    /** @type {Record<string, object>} */
    this._translations = {};
    /** @type {object|null} */
    this._store = null;
    /** @type {Function|null} */
    this._unsubscribe = null;
  }

  /**
   * Initialize: detect language, load translations, subscribe to store.
   * Call ONCE in app.js before any screen mounts.
   *
   * @param {object} store — app store (for subscribing to settings.uiLang changes)
   * @param {object} settings — loaded settings object
   * @returns {Promise<string>} detected/restored language ('ru'|'en')
   */
  async init(store, settings) {
    this._store = store;

    const lang = settings.uiLang || this.detectBrowserLang();
    await this.setLang(lang);

    // Subscribe to external language changes (e.g., URL redirect, settings sync)
    this._unsubscribe = store.subscribe(['settings'], async () => {
      const s = store.get().settings;
      if (s?.uiLang && s.uiLang !== this._lang) {
        await this.setLang(s.uiLang);
      }
    });

    return lang;
  }

  /**
   * Translate a key with optional interpolation and pluralization.
   *
   * @param {string} key — dot-separated path, e.g. 'nav.reading'
   * @param {object} [params] — interpolation values, e.g. { count: 5, title: 'John' }
   * @returns {string} translated string, or key itself if not found
   */
  t(key, params = {}) {
    const keys = key.split('.');
    let val = this._translations[this._lang];
    for (const k of keys) {
      if (val == null) break;
      val = val[k];
    }

    if (val == null) {
      console.warn(`i18n: missing key "${key}" for lang "${this._lang}"`);
      return key;
    }

    // Pluralization: if value is { one, few, many } or { one, other }
    if (typeof val === 'object' && !Array.isArray(val) && ('one' in val || 'other' in val)) {
      const count = params.count ?? 1;
      const rule = new Intl.PluralRules(this._lang).select(count);
      val = val[rule] || val.one || val.other || key;
    }

    // Interpolation: {{var}} → params.var
    if (typeof val === 'string' && Object.keys(params).length > 0) {
      return val.replace(/\{\{(\w+)\}\}/g, (_, name) =>
        params[name] != null ? String(params[name]) : `{{${name}}}`
      );
    }

    return typeof val === 'string' ? val : key;
  }

  /** @returns {'ru'|'en'} */
  get lang() {
    return this._lang;
  }

  /**
   * Switch language and load translations if needed.
   * Does NOT persist to settings — caller handles that.
   *
   * @param {'ru'|'en'} lang
   */
  async setLang(lang) {
    if (lang !== 'ru' && lang !== 'en') {
      console.warn(`i18n: unsupported language "${lang}", falling back to "ru"`);
      lang = 'ru';
    }
    if (lang === this._lang && this._translations[lang]) return;
    this._lang = lang;
    await this._loadTranslations(lang);
  }

  /**
   * Detect browser language. ru/uk/be/kk → 'ru', everything else → 'en'.
   * @returns {'ru'|'en'}
   */
  detectBrowserLang() {
    try {
      const browserLang = (navigator.language || '').split('-')[0].toLowerCase();
      if (['ru', 'uk', 'be', 'kk'].includes(browserLang)) return 'ru';
    } catch (_) { /* sandboxed env */ }
    return 'en';
  }

  /**
   * Extract language from URL path.
   * @param {string} path — e.g. '#/ru/read/john'
   * @returns {'ru'|'en'|null}
   */
  langFromPath(path) {
    const m = path.match(/^#\/(ru|en)\//);
    return m ? m[1] : null;
  }

  /**
   * Generate URL prefix for a language.
   * @param {'ru'|'en'} [lang] — defaults to current
   * @returns {string} e.g. '/ru'
   */
  langPrefix(lang) {
    return `/${lang || this._lang}`;
  }

  /**
   * Get book name in current language.
   * @param {object} book — { short, title, shortEn?, titleEn? }
   * @returns {{ short: string, title: string }}
   */
  bookName(book) {
    if (this._lang === 'en') {
      return {
        short: book.shortEn || book.short,
        title: book.titleEn || book.title,
      };
    }
    return { short: book.short, title: book.title };
  }

  /**
   * Get gloss for a lexeme in current language.
   * @param {object|null} lexeme — core lexicon entry
   * @returns {string|null}
   */
  gloss(lexeme) {
    if (!lexeme) return null;
    if (this._lang === 'ru') return lexeme.ruGloss || null;
    // English: prefer Berean gloss, fallback Cherith, fallback Russian
    return lexeme.glossesBerean?.[0] || lexeme.ruGloss || null;
  }

  /**
   * Get theme display name in current language.
   * @param {string} slug — theme slug, e.g. 'pergament'
   * @returns {string}
   */
  themeLabel(slug) {
    return this.t(`theme.${slug}`);
  }

  /**
   * Get contrast level display name in current language.
   * @param {string} level — 'soft' | 'sharp' | 'maximum'
   * @returns {string}
   */
  contrastLabel(level) {
    return this.t(`contrast.${level}`);
  }

  /** Clean up store subscription. */
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this._store = null;
  }

  /** @param {'ru'|'en'} lang */
  async _loadTranslations(lang) {
    if (this._translations[lang]) return;
    try {
      if (lang === 'ru') {
        this._translations.ru = (await import('./ru.json')).default;
      } else {
        this._translations.en = (await import('./en.json')).default;
      }
    } catch (e) {
      console.warn(`i18n: failed to load translations for "${lang}"`, e);
      this._translations[lang] = {};
    }
  }
}

/** @type {I18n} */
export const i18n = new I18n();
```

- [ ] **Step 2: Create `src/i18n/ru.json`**

Full Russian dictionary:

```json
{
  "nav": {
    "reading": "Чтение",
    "dictionary": "Словарь",
    "progress": "Прогресс",
    "settings": "Настройки",
    "title": "Читалка НЗ",
    "subtitle": "греческий сквозь русский",
    "ariaLabel": "Главная навигация",
    "themeLabel": "Тема",
    "themeLight": "Светлая",
    "themeDark": "Тёмная",
    "themeAuto": "Авто"
  },
  "reading": {
    "chapter": "глава",
    "errorLoad": "Не удалось загрузить книгу.",
    "retry": "Повторить",
    "offlineLoad": "Эта книга ещё не загружалась — нужен интернет.",
    "grcUnavailable": "Греческий текст недоступен — словарные замены отключены",
    "eyePlain": "Простой вид",
    "eyeRestore": "Вернуть греческий слой",
    "heading": "Чтение — {{title}}",
    "grcWord": "греческое слово {{word}}",
    "cardWord": "Карточка слова {{word}}",
    "closeCard": "Закрыть",
    "closePanel": "Закрыть панель",
    "wordCardComing": "Подробная карточка появится в следующем обновлении",
    "noticeTitle": "В версии 1.1 основной текст чтения временно английский (Berean Standard Bible), потому что это источник с чистой лицензией. Русский интерфейс и греческий слой сохраняются. Русский перевод вернётся отдельным этапом после проверки лицензии.",
    "noticeDismiss": "Понятно",
    "inspectorEmpty": "Выберите греческое слово или букву в тексте — карточка появится здесь.",
    "inspectorLabel": "Инспектор слова",
    "bookGroupGospels": "Евангелия",
    "bookGroupActs": "Деяния",
    "bookGroupEpistles": "Послания",
    "bookGroupRevelation": "Откровение",
    "loadingLabel": "Загрузка данных…",
    "greekViewLabel": "Вид чтения: греческий оригинал"
  },
  "dict": {
    "title": "Словарь",
    "searchPlaceholder": "Поиск: λόγος или logos…",
    "searchLabel": "Поиск слов в словаре",
    "statusLabel": "Статус:",
    "posLabel": "Часть речи:",
    "all": "Все",
    "statusNew": "Новые",
    "statusLearning": "Учу",
    "statusKnown": "Знаю",
    "checked": "В тексте",
    "showInText": "Показывать в тексте",
    "removeFromText": "Убрать из тексте",
    "noAlignment": "Нет соответствия в тексте",
    "words": "слов",
    "freqInNT": "в НЗ",
    "rankNT": "ранг {{rank}} в НЗ",
    "topLabel": "Топ {{bucket}}",
    "coverageLabel": "≈{{pct}}% текста НЗ",
    "noMatchWarning": "Нет проверенного соответствия в тексте — слово пока не участвует в подстановках",
    "addToDict": "Добавить в словарь",
    "replacesInText": "Заменяет слово в тексте чтения",
    "noTextMatch": "Нет соответствия в тексте",
    "statusStudy": "Статус изучения",
    "posNoun": "Сущ.",
    "posVerb": "Глаг.",
    "posAdj": "Прил.",
    "posFunc": "Служ.",
    "freqUnavailable": "Частотный список недоступен — показан личный словарь.",
    "freqEmpty": "Частотный список недоступен. Личный словарь пока пуст.",
    "showInTextTitle": "Показывать {{lemma}} в тексте",
    "pillNew": "Новое",
    "pillLearning": "Учу",
    "pillKnown": "Знаю",
    "freqLabel": "Частота: {{count}}"
  },
  "settings": {
    "title": "Настройки",
    "sectionTheme": "Тема",
    "sectionContrast": "Контраст",
    "sectionDisplay": "Показывать",
    "sectionReset": "Сброс",
    "sectionLanguage": "Язык",
    "themeSystem": "Система",
    "themeLight": "Светлая",
    "themeDark": "Тёмная",
    "themeGalleryLabel": "Выбор темы",
    "resetBtn": "Сбросить прогресс и словарь",
    "resetConfirm": "Сбросить весь прогресс и словарь? Это действие нельзя отменить.",
    "showDiacritics": "Показывать диакритику (ударения, придыхания)",
    "showStrongs": "Показывать номера Стронга (G3056)",
    "showRuHint": "Показывать русские подсказки"
  },
  "onboarding": {
    "step1Title": "Что тебе ближе?",
    "step2Title": "С чего начнём чтение?",
    "preset1Title": "Знаю часть букв, хочу видеть больше греческого",
    "preset1Desc": "Смешанный текст — буквы с подсказками. Вводятся первые 8 букв.",
    "preset2Title": "Хочу узнавать греческие слова",
    "preset2Desc": "Смешанный текст — слова из личного словаря заменяются на греческие леммы.",
    "preset3Title": "Хочу читать ближе к оригиналу",
    "preset3Desc": "Смешанный текст — реальные формы слов (падежи, спряжения).",
    "preset2Example": "Пример: «Word» → λόγος (лемма, всегда одна словарная форма)",
    "preset3Example": "Пример: «Word» → λόγῳ (реальная форма, зависит от падежа в оригинале!)",
    "johnDesc": "«In the beginning was the Word» — классический старт",
    "markDesc": "Самое короткое Евангелие",
    "continueReading": "Продолжить с последнего места"
  },
  "progress": {
    "title": "Прогресс",
    "sectionLetters": "Буквы",
    "sectionWords": "Слова",
    "sectionReading": "Чтение",
    "youKnow": "Ты уже узнаёшь:",
    "noBookData": "Нет данных о книгах.",
    "statusRead": "прочитано",
    "statusStarted": "начато ({{read}} из {{total}} глав)",
    "addLetters": "Добавить буквы:",
    "todayAdd": "Сегодня добавим: {{letters}}",
    "wordsKnown": "{{known}} знакомы / {{learning}} в изучении / {{today}} новых сегодня"
  },
  "about": {
    "title": "О приложении",
    "subtitle": "Греческая читалка Нового Завета",
    "description": "Спокойная читалка с регулируемым греческим слоем: от английского текста BSB — к оригиналу.",
    "version": "Версия: {{version}}",
    "licenses": "Лицензии и атрибуция",
    "sblgntTitle": "Греческий текст (SBLGNT + MACULA)",
    "sblgntText": "SBLGNT + MACULA Greek morphology — CC BY 4.0. MACULA Greek Linguistic Datasets, available at",
    "cherithTitle": "Cherith Glosses",
    "cherithText": "Cherith Glosses for the Greek New Testament, © 2023 Cherith Analytics — CC BY 4.0.",
    "bsbTitle": "Berean Standard Bible (BSB)",
    "bsbText": "Berean Standard Bible — public domain.",
    "alignTitle": "Выравнивание греческий ↔ английский",
    "alignText": "Строится алгоритмически по подстрочным глоссам (Berean, Cherith) при сборке данных.",
    "fontTitle": "Шрифт Gentium Plus",
    "fontText": "Шрифт Gentium Plus распространяется под лицензией SIL Open Font License (OFL). Copyright © 2003–2022 SIL International.",
    "contacts": "Контакты",
    "githubLink": "Проект на GitHub"
  },
  "mode": {
    "label": "Настройки чтения",
    "mixedTab": "Смешанный",
    "greekTab": "Греческий",
    "letterReplace": "Замена букв",
    "wordReplace": "Замена слов",
    "off": "Выкл",
    "lemma": "Леммы",
    "forms": "Формы",
    "sliderLabel": "Интенсивность замены букв",
    "sliderMin": "0% — чистый BSB",
    "sliderMax": "100% — все буквы",
    "wordFormLabel": "Форма греческих слов",
    "hintOff": "Выкл — только буквы, без загрузки греческих слов",
    "hintLemma": "Леммы — как в словаре: λέγω  исходная форма, «говорить»",
    "hintForm": "Формы — как в тексте: λέγει  с окончанием, «говорит»",
    "dictBtn": "📖 Словарь — выбрано {{count}} слов →",
    "greekDesc": "Греческий текст Нового Завета как основной. Под каждым стихом — английский текст BSB мелким шрифтом.",
    "showBSB": "Показывать английский текст BSB под стихом",
    "greekHint": "Нажмите на любое греческое слово — увидите перевод и разбор.",
    "grcUnavailable": "Греческий текст недоступен — нет сети или для этой книги нет греческого оригинала",
    "grcLoading": "Греческий текст загружается",
    "chipGreek": "Греч",
    "chipGreekView": "Вид чтения: греческий оригинал",
    "chipLoading": "Загрузка данных…",
    "chipOff": "Рус",
    "chipGreekOff": "Греческий слой: выключен",
    "chipLabelLetters": "буквы {{pct}}%",
    "chipLabelWords": "слова: {{form}}, {{count}} в словаре",
    "chipLabelBoth": "буквы {{pct}}%; слова: {{form}}, {{count}} в словаре",
    "chipLabelOff": "выключен",
    "chipPrefix": "Греческий слой: "
  },
  "wordcard": {
    "title": "Карточка слова {{word}}",
    "pronUnavailable": "Произношение пока недоступно",
    "listenLabel": "Прослушать произношение слова {{word}}",
    "settingsLabel": "Настройки карточки",
    "statusNew": "Не помню",
    "statusLearning": "Учу",
    "statusKnown": "Знаю"
  },
  "lettercard": {
    "equiv": "Ближе всего к русской «{{letter}}»",
    "known": "Освоена ✓",
    "markKnown": "Я знаю эту букву",
    "pronDisclaimer": "Произношение — учебное приближение, не научная реконструкция."
  },
  "theme": {
    "pergament": "Пергамент",
    "sepia": "Сепия",
    "ivory": "Слоновая кость",
    "fog": "Туман",
    "sea": "Море",
    "forest": "Лес",
    "rose": "Роза",
    "lavender": "Лаванда",
    "sunset": "Закат",
    "dark": "Тёмная",
    "night": "Ночь",
    "coal": "Уголь"
  },
  "contrast": {
    "soft": "Мягкий",
    "sharp": "Чёткий",
    "maximum": "Максимальный"
  },
  "card": {
    "grammar": "грамматика и номер Стронга",
    "pron": "произношение",
    "lemma": "словарная форма (текст → лемма)",
    "inline": "перевод в этом стихе",
    "senses": "также означает",
    "definition": "определение",
    "derivation": "происхождение",
    "status": "статус (не помню / учу / знаю)",
    "lemmaLabel": "словарная форма",
    "textLabel": "в тексте",
    "inlineLabel": "в этом стихе"
  },
  "frequency": {
    "tooltipBucket": "Лемма {{lemma}} входит в топ-{{bucket}} наиболее частотных слов Нового Завета и встречается около {{count}} раз.",
    "tooltipSimple": "Лемма {{lemma}} встречается около {{count}} раз в Новом Завете.",
    "topBucket": "Топ-{{bucket}} · {{formatted}}×",
    "timesNT": "{{formatted}}× в НЗ",
    "strongTooltip": "Номер Стронга G{{strong}}"
  }
}
```

- [ ] **Step 3: Verify module loads**

```bash
node -e "import('./src/i18n/index.js').then(m => console.log('OK:', typeof m.i18n.t))"
```

Expected: `OK: function`

- [ ] **Step 4: Commit**

```bash
git add src/i18n/index.js src/i18n/ru.json
git commit -m "feat(i18n): add I18n class + Russian translation dictionary

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: English translation dictionary

**Files:**
- Create: `src/i18n/en.json`

**Interfaces:**
- Consumes: `i18n._loadTranslations('en')` — dynamic import from Task 1

**Produces:** English translations ready for runtime loading.

- [ ] **Step 1: Create `src/i18n/en.json`**

```json
{
  "nav": {
    "reading": "Reading",
    "dictionary": "Dictionary",
    "progress": "Progress",
    "settings": "Settings",
    "title": "NT Reader",
    "subtitle": "Greek through English",
    "ariaLabel": "Main navigation",
    "themeLabel": "Theme",
    "themeLight": "Light",
    "themeDark": "Dark",
    "themeAuto": "Auto"
  },
  "reading": {
    "chapter": "chapter",
    "errorLoad": "Failed to load book.",
    "retry": "Retry",
    "offlineLoad": "This book hasn't been downloaded yet — internet required.",
    "grcUnavailable": "Greek text unavailable — word substitutions disabled",
    "eyePlain": "Plain view",
    "eyeRestore": "Restore Greek layer",
    "heading": "Reading — {{title}}",
    "grcWord": "Greek word {{word}}",
    "cardWord": "Word card: {{word}}",
    "closeCard": "Close",
    "closePanel": "Close panel",
    "wordCardComing": "Detailed card coming in a future update",
    "noticeTitle": "In version 1.1, the main reading text is temporarily English (Berean Standard Bible) because it's a clean-license source. The Russian UI and Greek layer are preserved. A Russian translation will return in a separate stage after license review.",
    "noticeDismiss": "Got it",
    "inspectorEmpty": "Tap a Greek word or letter in the text — its card will appear here.",
    "inspectorLabel": "Word inspector",
    "bookGroupGospels": "Gospels",
    "bookGroupActs": "Acts",
    "bookGroupEpistles": "Epistles",
    "bookGroupRevelation": "Revelation",
    "loadingLabel": "Loading data…",
    "greekViewLabel": "Reading view: Greek original"
  },
  "dict": {
    "title": "Dictionary",
    "searchPlaceholder": "Search: λόγος or logos…",
    "searchLabel": "Search words in dictionary",
    "statusLabel": "Status:",
    "posLabel": "Part of speech:",
    "all": "All",
    "statusNew": "New",
    "statusLearning": "Learning",
    "statusKnown": "Known",
    "checked": "In text",
    "showInText": "Show in text",
    "removeFromText": "Remove from text",
    "noAlignment": "No text match",
    "words": "words",
    "freqInNT": "in NT",
    "rankNT": "rank {{rank}} in NT",
    "topLabel": "Top {{bucket}}",
    "coverageLabel": "≈{{pct}}% of NT text",
    "noMatchWarning": "No verified text match — word not yet used in substitutions",
    "addToDict": "Add to dictionary",
    "replacesInText": "Replaces word in reading text",
    "noTextMatch": "No text match",
    "statusStudy": "Study status",
    "posNoun": "Noun",
    "posVerb": "Verb",
    "posAdj": "Adj.",
    "posFunc": "Func.",
    "freqUnavailable": "Frequency list unavailable — showing personal dictionary.",
    "freqEmpty": "Frequency list unavailable. Personal dictionary is empty.",
    "showInTextTitle": "Show {{lemma}} in text",
    "pillNew": "New",
    "pillLearning": "Learning",
    "pillKnown": "Known",
    "freqLabel": "Frequency: {{count}}"
  },
  "settings": {
    "title": "Settings",
    "sectionTheme": "Theme",
    "sectionContrast": "Contrast",
    "sectionDisplay": "Display",
    "sectionReset": "Reset",
    "sectionLanguage": "Language",
    "themeSystem": "System",
    "themeLight": "Light",
    "themeDark": "Dark",
    "themeGalleryLabel": "Choose theme",
    "resetBtn": "Reset progress and dictionary",
    "resetConfirm": "Reset all progress and dictionary? This cannot be undone.",
    "showDiacritics": "Show diacritics (accents, breathings)",
    "showStrongs": "Show Strong's numbers (G3056)",
    "showRuHint": "Show Russian hints"
  },
  "onboarding": {
    "step1Title": "What's your level?",
    "step2Title": "Where shall we start reading?",
    "preset1Title": "I know some letters, want to see more Greek",
    "preset1Desc": "Mixed text — letters with hints. First 8 letters introduced.",
    "preset2Title": "I want to recognize Greek words",
    "preset2Desc": "Mixed text — words from your personal dictionary replaced with Greek lemmas.",
    "preset3Title": "I want to read closer to the original",
    "preset3Desc": "Mixed text — real word forms (cases, conjugations).",
    "preset2Example": "Example: «Word» → λόγος (lemma, always the dictionary form)",
    "preset3Example": "Example: «Word» → λόγῳ (real form, depends on the case in the original!)",
    "johnDesc": "«In the beginning was the Word» — classic starting point",
    "markDesc": "The shortest Gospel",
    "continueReading": "Continue where I left off"
  },
  "progress": {
    "title": "Progress",
    "sectionLetters": "Letters",
    "sectionWords": "Words",
    "sectionReading": "Reading",
    "youKnow": "You already recognize:",
    "noBookData": "No book data.",
    "statusRead": "read",
    "statusStarted": "started ({{read}} of {{total}} chapters)",
    "addLetters": "Add letters:",
    "todayAdd": "Today we add: {{letters}}",
    "wordsKnown": "{{known}} known / {{learning}} learning / {{today}} new today"
  },
  "about": {
    "title": "About",
    "subtitle": "Greek New Testament Reader",
    "description": "A calm reader with an adjustable Greek layer: from English BSB text — to the original.",
    "version": "Version: {{version}}",
    "licenses": "Licenses & Attribution",
    "sblgntTitle": "Greek Text (SBLGNT + MACULA)",
    "sblgntText": "SBLGNT + MACULA Greek morphology — CC BY 4.0. MACULA Greek Linguistic Datasets, available at",
    "cherithTitle": "Cherith Glosses",
    "cherithText": "Cherith Glosses for the Greek New Testament, © 2023 Cherith Analytics — CC BY 4.0.",
    "bsbTitle": "Berean Standard Bible (BSB)",
    "bsbText": "Berean Standard Bible — public domain.",
    "alignTitle": "Greek–English Alignment",
    "alignText": "Built algorithmically from interlinear glosses (Berean, Cherith) during data build.",
    "fontTitle": "Gentium Plus Font",
    "fontText": "Gentium Plus font is distributed under the SIL Open Font License (OFL). Copyright © 2003–2022 SIL International.",
    "contacts": "Contact",
    "githubLink": "Project on GitHub"
  },
  "mode": {
    "label": "Reading settings",
    "mixedTab": "Mixed",
    "greekTab": "Greek",
    "letterReplace": "Letter substitution",
    "wordReplace": "Word substitution",
    "off": "Off",
    "lemma": "Lemmas",
    "forms": "Forms",
    "sliderLabel": "Letter substitution intensity",
    "sliderMin": "0% — plain BSB",
    "sliderMax": "100% — all letters",
    "wordFormLabel": "Greek word form",
    "hintOff": "Off — letters only, no Greek word loading",
    "hintLemma": "Lemmas — as in dictionary: λέγω  base form, «to say»",
    "hintForm": "Forms — as in text: λέγει  with ending, «says»",
    "dictBtn": "📖 Dictionary — {{count}} words selected →",
    "greekDesc": "Greek New Testament text as primary. Below each verse — English BSB text in small print.",
    "showBSB": "Show English BSB text below verse",
    "greekHint": "Tap any Greek word to see translation and analysis.",
    "grcUnavailable": "Greek text unavailable — no network or no Greek original for this book",
    "grcLoading": "Greek text loading",
    "chipGreek": "Grk",
    "chipGreekView": "Reading view: Greek original",
    "chipLoading": "Loading data…",
    "chipOff": "BSB",
    "chipGreekOff": "Greek layer: off",
    "chipLabelLetters": "letters {{pct}}%",
    "chipLabelWords": "words: {{form}}, {{count}} in dictionary",
    "chipLabelBoth": "letters {{pct}}%; words: {{form}}, {{count}} in dictionary",
    "chipLabelOff": "off",
    "chipPrefix": "Greek layer: "
  },
  "wordcard": {
    "title": "Word card: {{word}}",
    "pronUnavailable": "Pronunciation not yet available",
    "listenLabel": "Listen to pronunciation of {{word}}",
    "settingsLabel": "Card settings",
    "statusNew": "Don't know",
    "statusLearning": "Learning",
    "statusKnown": "Known"
  },
  "lettercard": {
    "equiv": "Closest to English «{{letter}}»",
    "known": "Learned ✓",
    "markKnown": "I know this letter",
    "pronDisclaimer": "Pronunciation is an educational approximation, not a scholarly reconstruction."
  },
  "theme": {
    "pergament": "Parchment",
    "sepia": "Sepia",
    "ivory": "Ivory",
    "fog": "Fog",
    "sea": "Sea",
    "forest": "Forest",
    "rose": "Rose",
    "lavender": "Lavender",
    "sunset": "Sunset",
    "dark": "Dark",
    "night": "Night",
    "coal": "Coal"
  },
  "contrast": {
    "soft": "Soft",
    "sharp": "Sharp",
    "maximum": "Maximum"
  },
  "card": {
    "grammar": "grammar & Strong's number",
    "pron": "pronunciation",
    "lemma": "dictionary form (text → lemma)",
    "inline": "translation in this verse",
    "senses": "also means",
    "definition": "definition",
    "derivation": "derivation",
    "status": "status (don't know / learning / known)",
    "lemmaLabel": "dictionary form",
    "textLabel": "in text",
    "inlineLabel": "in this verse"
  },
  "frequency": {
    "tooltipBucket": "The lemma {{lemma}} is in the top {{bucket}} most frequent New Testament words and occurs about {{count}} times.",
    "tooltipSimple": "The lemma {{lemma}} occurs about {{count}} times in the New Testament.",
    "topBucket": "Top {{bucket}} · {{formatted}}×",
    "timesNT": "{{formatted}}× in NT",
    "strongTooltip": "Strong's number G{{strong}}"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/i18n/en.json
git commit -m "feat(i18n): add English translation dictionary

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Router — language prefix in URL patterns

**Files:**
- Modify: `src/router.js:1-34`

**Interfaces:**
- Consumes: `i18n` singleton from Task 1
- Produces: updated `parse(hash) → { screen, params: { lang, book? } }`, new `navigate(path)` with lang prefix
- Consumers: `app.js` (handleRoute, switchScreen), all screens (via navigate)

- [ ] **Step 1: Rewrite `src/router.js`**

```js
// src/router.js
import { i18n } from '../i18n/index.js';

// New patterns — with language prefix
const NEW_ROUTES = [
  { pattern: /^#\/(ru|en)\/read\/([a-z0-9]+)$/, screen: 'reading', paramNames: ['lang', 'book'] },
  { pattern: /^#\/(ru|en)\/dictionary$/,        screen: 'dictionary', paramNames: ['lang'] },
  { pattern: /^#\/(ru|en)\/progress$/,          screen: 'progress', paramNames: ['lang'] },
  { pattern: /^#\/(ru|en)\/settings$/,          screen: 'settings', paramNames: ['lang'] },
  { pattern: /^#\/(ru|en)\/onboarding$/,        screen: 'onboarding', paramNames: ['lang'] },
  { pattern: /^#\/(ru|en)\/about$/,             screen: 'about', paramNames: ['lang'] },
];

// Old patterns — backward compatible, no lang → lang=undefined triggers redirect in app.js
const OLD_ROUTES = [
  { pattern: /^#\/read\/([a-z0-9]+)$/, screen: 'reading', paramNames: ['book'] },
  { pattern: /^#\/dictionary$/,        screen: 'dictionary', paramNames: [] },
  { pattern: /^#\/progress$/,          screen: 'progress', paramNames: [] },
  { pattern: /^#\/settings$/,          screen: 'settings', paramNames: [] },
  { pattern: /^#\/onboarding$/,        screen: 'onboarding', paramNames: [] },
  { pattern: /^#\/about$/,             screen: 'about', paramNames: [] },
];

const ALL_ROUTES = [...NEW_ROUTES, ...OLD_ROUTES];

/**
 * Parse hash into { screen, params }.
 * New URLs have params.lang = 'ru'|'en'. Old URLs have params.lang = undefined.
 */
export function parse(hash) {
  const h = hash || location.hash || '';
  for (const route of ALL_ROUTES) {
    const match = h.match(route.pattern);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      // new patterns set lang; old patterns leave it undefined
      return { screen: route.screen, params };
    }
  }
  // Default: reading John (lang=undefined → redirected by handleRoute)
  return { screen: 'reading', params: { book: 'john' } };
}

/**
 * Navigate to a path. Prefixes with current language automatically.
 * @param {string} path — e.g. '/read/john', '/dictionary'
 */
export function navigate(path) {
  const lang = i18n.lang;
  location.hash = `#/${lang}${path}`;
}

/**
 * Register hashchange listener.
 * @param {(route: {screen: string, params: object}) => void} cb
 */
export function onChange(cb) {
  window.addEventListener('hashchange', () => {
    cb(parse(location.hash));
  });
}
```

- [ ] **Step 2: Verify router parses new URLs**

```bash
node -e "
const { parse } = require('./src/router.js') || {};
// Manual test: create a mock and check
console.log('Import check: router updated');
"
```

(Ручная проверка — загрузка приложения после Task 4.)

- [ ] **Step 3: Commit**

```bash
git add src/router.js
git commit -m "feat(i18n): add language prefix (ru|en) to URL patterns

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: App.js — i18n initialization + backward-compatible URL redirect

**Files:**
- Modify: `src/app.js:1-178`

**Interfaces:**
- Consumes: `i18n` from Task 1, updated `router.parse` from Task 3
- Produces: i18n initialized before any screen mounts; old URLs redirected

- [ ] **Step 1: Add i18n import and init logic to `src/app.js`**

Replace the imports section (lines 1-11) and the `handleRoute` function (lines 128-166):

```js
// src/app.js — add to existing imports (line 1):
import { i18n } from './i18n/index.js';

// ... (keep all existing imports: Workbox, store, router, nav, settings, screens)

const store = createStore({ screen: 'reading', book: 'john' });
const appEl = document.getElementById('app');

// ... (keep nav creation, screenContainer, currentScreen, onboardingChecked)

// Modify switchScreen to pass lang from route params
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

// Replace the entire handleRoute function:
async function handleRoute(route) {
  // Backward compatibility: old URL without language prefix
  if (!route.params.lang) {
    const detected = i18n.lang; // already initialized below
    const suffix = route.screen === 'reading'
      ? `/read/${route.params.book || 'john'}`
      : `/${route.screen}`;
    location.replace(`#/${detected}${suffix}`);
    return;
  }

  // Sync i18n language from URL if different
  if (route.params.lang !== i18n.lang) {
    await i18n.setLang(route.params.lang);
    // Update settings to match URL
    const settings = store.get().settings;
    if (settings && settings.uiLang !== route.params.lang) {
      const { saveSettings } = await import('./state/settings.js');
      settings.uiLang = route.params.lang;
      await saveSettings(settings);
      store.update(s => ({ ...s, settings }));
    }
  }

  // Onboarding gate (same logic as before, no changes)
  const SKIP_ONBOARDING = (() => {
    try { return localStorage.getItem('dev_skip_onboarding') === '1'; }
    catch (_) { return false; }
  })();

  if (!SKIP_ONBOARDING) {
    if (!onboardingChecked) {
      try {
        const settings = await loadSettings();
        onboardingChecked = true;
        if (!settings.onboarded) {
          location.hash = `#/${route.params.lang}/onboarding`;
          return;
        }
      } catch (_) { onboardingChecked = true; }
    }
    if (route.screen !== 'onboarding') {
      try {
        const settings = await loadSettings();
        if (!settings.onboarded) {
          location.hash = `#/${route.params.lang}/onboarding`;
          return;
        }
      } catch (_) { /* ignore */ }
    }
  }

  switchScreen(route.screen, route.params);
}

// Replace the startup block at the bottom of the file:
(async () => {
  // Initialize i18n BEFORE handling any route
  try {
    const settings = await loadSettings();
    const detectedLang = await i18n.init(store, settings);

    // Persist detected language if this is first visit
    if (!settings.uiLang) {
      settings.uiLang = detectedLang;
      const { saveSettings } = await import('./state/settings.js');
      await saveSettings(settings);
      store.update(s => ({ ...s, settings }));
    }
  } catch (_) { /* i18n fail-soft: app works in Russian */ }

  onChange(handleRoute);
  await handleRoute(parse(location.hash));

  // If no hash, redirect to default
  if (!location.hash) {
    location.hash = `#/${i18n.lang}/read/john`;
  }
})();
```

- [ ] **Step 2: Verify app loads with new URL scheme**

```bash
npm run build && echo "Build OK"
```

Then manually: open `dist/index.html`, verify redirect to `#/ru/read/john` (or `#/en/read/john` for non-Cyrillic browsers).

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat(i18n): integrate i18n init + URL backward compat in app.js

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Settings state — add uiLang, remove THEME_LABELS/CONTRAST_LABELS

**Files:**
- Modify: `src/state/settings.js:55-57,60-76`

**Interfaces:**
- Consumes: none (state module, no i18n import to avoid circular deps)
- Produces: `uiLang: null` in DEFAULTS; `THEME_LABELS` and `CONTRAST_LABELS` removed
- Consumers: `app.js` (reads uiLang), `settings.js` screen (writes uiLang), `i18n.init()` (reads uiLang)

- [ ] **Step 1: Update DEFAULTS and remove label constants**

In `src/state/settings.js`:

Remove lines 55-57 (CONTRAST constants — keep CONTRAST_LEVELS):
```js
// DELETE:
export const CONTRAST_LABELS = { soft: 'Мягкий', sharp: 'Чёткий', maximum: 'Максимальный' };
```

Add `uiLang` to DEFAULTS (around line 61):
```js
const DEFAULTS = {
  intensity: 35,
  wordLayer: 'off',
  readingMode: 'mixed',
  newWordsPerChapter: 3,
  pauseNewToday: false,
  show: {
    diacritics: false,
    strongs: false,
    ruHint: true
  },
  theme: 'auto',
  contrast: DEFAULT_CONTRAST,
  onboarded: false,
  dismissedNotices: [],
  uiLang: null                // + новое: null = авто-детект при первом запуске
};
```

Remove `THEME_LABELS` export (line 266-271):
```js
// DELETE lines 266-271:
export const THEME_LABELS = {
  pergament: 'Пергамент', sepia: 'Сепия', ivory: 'Слоновая кость',
  fog: 'Туман', sea: 'Море', forest: 'Лес', rose: 'Роза',
  lavender: 'Лаванда', sunset: 'Закат',
  dark: 'Тёмная', night: 'Ночь', coal: 'Уголь'
};
```

- [ ] **Step 2: Verify nothing breaks**

```bash
npm test 2>&1 | tail -5
```

If tests reference `THEME_LABELS` or `CONTRAST_LABELS`, note them for later tasks (they'll be fixed when migrating consumers).

- [ ] **Step 3: Commit**

```bash
git add src/state/settings.js
git commit -m "feat(i18n): add uiLang field, remove hardcoded THEME_LABELS/CONTRAST_LABELS

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Data-driven strings — books.json English fields + gloss/theme helpers

**Files:**
- Modify: `docs/source-data/app-config/books.json`
- No code changes — helpers already in `i18n` class (Task 1)

**Interfaces:**
- Consumes: `i18n.bookName()`, `i18n.gloss()`, `i18n.themeLabel()`, `i18n.contrastLabel()` from Task 1
- Produces: English book names available at runtime

- [ ] **Step 1: Add English fields to source books.json**

Edit `docs/source-data/app-config/books.json` — add `shortEn` and `titleEn` to each entry:

```json
[
  {"id":"matthew","title":"От Матфея святое благовествование","short":"Мф","shortEn":"Mt","titleEn":"Matthew","chapters":28,"order":1},
  {"id":"mark","title":"От Марка святое благовествование","short":"Мк","shortEn":"Mk","titleEn":"Mark","chapters":16,"order":2},
  {"id":"luke","title":"От Луки святое благовествование","short":"Лк","shortEn":"Lk","titleEn":"Luke","chapters":24,"order":3},
  {"id":"john","title":"От Иоанна святое благовествование","short":"Ин","shortEn":"Jn","titleEn":"John","chapters":21,"order":4},
  {"id":"acts","title":"Деяния святых апостолов","short":"Деян","shortEn":"Acts","titleEn":"Acts","chapters":28,"order":5},
  {"id":"romans","title":"Послание к Римлянам","short":"Рим","shortEn":"Rom","titleEn":"Romans","chapters":16,"order":6},
  {"id":"1corinthians","title":"Первое послание к Коринфянам","short":"1 Кор","shortEn":"1 Cor","titleEn":"1 Corinthians","chapters":16,"order":7},
  {"id":"2corinthians","title":"Второе послание к Коринфянам","short":"2 Кор","shortEn":"2 Cor","titleEn":"2 Corinthians","chapters":13,"order":8},
  {"id":"galatians","title":"Послание к Галатам","short":"Гал","shortEn":"Gal","titleEn":"Galatians","chapters":6,"order":9},
  {"id":"ephesians","title":"Послание к Ефесянам","short":"Еф","shortEn":"Eph","titleEn":"Ephesians","chapters":6,"order":10},
  {"id":"philippians","title":"Послание к Филиппийцам","short":"Флп","shortEn":"Phil","titleEn":"Philippians","chapters":4,"order":11},
  {"id":"colossians","title":"Послание к Колоссянам","short":"Кол","shortEn":"Col","titleEn":"Colossians","chapters":4,"order":12},
  {"id":"1thessalonians","title":"Первое послание к Фессалоникийцам","short":"1 Фес","shortEn":"1 Thess","titleEn":"1 Thessalonians","chapters":5,"order":13},
  {"id":"2thessalonians","title":"Второе послание к Фессалоникийцам","short":"2 Фес","shortEn":"2 Thess","titleEn":"2 Thessalonians","chapters":3,"order":14},
  {"id":"1timothy","title":"Первое послание к Тимофею","short":"1 Тим","shortEn":"1 Tim","titleEn":"1 Timothy","chapters":6,"order":15},
  {"id":"2timothy","title":"Второе послание к Тимофею","short":"2 Тим","shortEn":"2 Tim","titleEn":"2 Timothy","chapters":4,"order":16},
  {"id":"titus","title":"Послание к Титу","short":"Тит","shortEn":"Titus","titleEn":"Titus","chapters":3,"order":17},
  {"id":"philemon","title":"Послание к Филимону","short":"Флм","shortEn":"Phlm","titleEn":"Philemon","chapters":1,"order":18},
  {"id":"hebrews","title":"Послание к Евреям","short":"Евр","shortEn":"Heb","titleEn":"Hebrews","chapters":13,"order":19},
  {"id":"james","title":"Послание Иакова","short":"Иак","shortEn":"Jas","titleEn":"James","chapters":5,"order":20},
  {"id":"1peter","title":"Первое послание Петра","short":"1 Пет","shortEn":"1 Pet","titleEn":"1 Peter","chapters":5,"order":21},
  {"id":"2peter","title":"Второе послание Петра","short":"2 Пет","shortEn":"2 Pet","titleEn":"2 Peter","chapters":3,"order":22},
  {"id":"1john","title":"Первое послание Иоанна","short":"1 Ин","shortEn":"1 Jn","titleEn":"1 John","chapters":5,"order":23},
  {"id":"2john","title":"Второе послание Иоанна","short":"2 Ин","shortEn":"2 Jn","titleEn":"2 John","chapters":1,"order":24},
  {"id":"3john","title":"Третье послание Иоанна","short":"3 Ин","shortEn":"3 Jn","titleEn":"3 John","chapters":1,"order":25},
  {"id":"jude","title":"Послание Иуды","short":"Иуд","shortEn":"Jude","titleEn":"Jude","chapters":1,"order":26},
  {"id":"revelation","title":"Откровение Иоанна Богослова","short":"Откр","shortEn":"Rev","titleEn":"Revelation","chapters":22,"order":27}
]
```

- [ ] **Step 2: Regenerate app-ready books.json**

```bash
npm run build:data
```

- [ ] **Step 3: Verify English fields in output**

```bash
node -e "const b = require('./assets/data/books.json'); console.log(b[3].shortEn, b[3].titleEn)"
```

Expected: `Jn John`

- [ ] **Step 4: Commit**

```bash
git add docs/source-data/app-config/books.json assets/data/books.json
git commit -m "feat(i18n): add English book names (shortEn, titleEn) to books.json

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Migrate nav.js + inspector.js + top-bar.js + card-settings.js

**Files:**
- Modify: `src/ui/components/nav.js`
- Modify: `src/ui/components/inspector.js`
- Modify: `src/ui/components/top-bar.js`
- Modify: `src/state/card-settings.js`

**Interfaces:**
- Consumes: `i18n` from Task 1
- Produces: all 4 files use `i18n.t()` instead of hardcoded strings

**Strategy:** These are the simplest components — few strings each, low risk of regression. Do them together to minimize review rounds.

- [ ] **Step 1: Migrate `nav.js`**

Add import:
```js
import { i18n } from '../../i18n/index.js';
```

Replace TABS array (line 5-10):
```js
const TABS = [
  { id: 'reading',    label: () => i18n.t('nav.reading'),    icon: iconRead,    hash: '#/read/john' },
  { id: 'dictionary', label: () => i18n.t('nav.dictionary'), icon: iconWords,   hash: '#/dictionary' },
  { id: 'progress',   label: () => i18n.t('nav.progress'),   icon: iconProgress, hash: '#/progress' },
  { id: 'settings',   label: () => i18n.t('nav.settings'),   icon: iconGear,    hash: '#/settings' },
];
```

Replace THEME_MODES (line 18-22):
```js
const THEME_MODES = [
  { id: 'light', label: () => i18n.t('nav.themeLight') },
  { id: 'dark',  label: () => i18n.t('nav.themeDark') },
  { id: 'auto',  label: () => i18n.t('nav.themeAuto') },
];
```

Replace hardcoded strings in template:
```js
// Line 27: nav.setAttribute('aria-label', 'Главная навигация');
nav.setAttribute('aria-label', i18n.t('nav.ariaLabel'));

// Lines 33-34: title/subtitle
titleSection.innerHTML = `
  <div class="nav-title">${i18n.t('nav.title')}</div>
  <div class="nav-subtitle">${i18n.t('nav.subtitle')}</div>
`;

// Line 62: themeSection label
themeSection.innerHTML = `<div class="nav-theme-label">${i18n.t('nav.themeLabel')}</div>`;
```

Replace `btn.textContent = t.label` — since labels are now functions:
```js
// Line 46: btn.innerHTML for tabs
btn.innerHTML = `<span class="nav-tab-icon">${t.icon()}</span><span class="nav-tab-label">${t.label()}</span>`;

// Line 70: btn.textContent for theme modes
btn.textContent = mode.label();
```

- [ ] **Step 2: Migrate `inspector.js`**

Add import:
```js
import { i18n } from '../../i18n/index.js';
```

Replace hardcoded strings:
```js
// Line 21: panelEl.setAttribute('aria-label', 'Инспектор слова');
panelEl.setAttribute('aria-label', i18n.t('reading.inspectorLabel'));

// Line 26: closeBtn.setAttribute('aria-label', 'Закрыть панель');
closeBtn.setAttribute('aria-label', i18n.t('reading.closePanel'));

// Lines 62-63: empty state HTML
content.innerHTML = `
  <div class="inspector-empty">
    <div class="inspector-empty-icon">α</div>
    <p class="inspector-empty-text">${i18n.t('reading.inspectorEmpty')}</p>
  </div>`;
```

- [ ] **Step 3: Migrate `top-bar.js`**

Add import:
```js
import { i18n } from '../../i18n/index.js';
```

Replace book group labels (lines 70-74):
```js
const groups = {
  [i18n.t('reading.bookGroupGospels')]: books.filter(b => ['matthew','mark','luke','john'].includes(b.id)),
  [i18n.t('reading.bookGroupActs')]: books.filter(b => b.id === 'acts'),
  [i18n.t('reading.bookGroupEpistles')]: books.filter(b => !['matthew','mark','luke','john','acts','revelation'].includes(b.id)),
  [i18n.t('reading.bookGroupRevelation')]: books.filter(b => b.id === 'revelation'),
};
```

Replace book names in dropdown (line 85):
```js
btn.textContent = i18n.bookName(book).short + ' — ' + i18n.bookName(book).title;
```

Replace aria-labels (lines 47, 52):
```js
// Line 47
eyeBtn.setAttribute('aria-label', i18n.t('reading.eyePlain'));
// Line 52
eyeBtn.setAttribute('aria-label', plainView ? i18n.t('reading.eyeRestore') : i18n.t('reading.eyePlain'));
```

Replace fallback book name (line 64):
```js
bookBtn.querySelector('.top-header-book-name').textContent = book ? i18n.bookName(book).short + ',' : i18n.bookName({ short: 'Ин', shortEn: 'Jn' }).short + ',';
```

- [ ] **Step 4: Migrate `card-settings.js`**

Remove hardcoded `label` from CARD_SECTIONS (lines 17-26). Labels now come from `i18n.t('card.<key>')`:

```js
export const CARD_SECTIONS = [
  { key: 'grammar' },
  { key: 'pron' },
  { key: 'lemma' },
  { key: 'inline' },
  { key: 'senses' },
  { key: 'definition' },
  { key: 'derivation' },
  { key: 'status' },
];
```

The label lookup moves to `word-card.js` (see Task 12) where `showGearDropdown` builds the settings UI:
```js
const labelMap = Object.fromEntries(CARD_SECTIONS.map(s => [s.key, i18n.t(`card.${s.key}`)]));
```

- [ ] **Step 5: Run tests**

```bash
npm test 2>&1 | tail -5
```

Fix any test failures referencing removed exports.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/nav.js src/ui/components/inspector.js src/ui/components/top-bar.js src/state/card-settings.js
git commit -m "feat(i18n): migrate nav, inspector, top-bar, card-settings to i18n.t()

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Migrate about.js + onboarding.js + progress.js

**Files:**
- Modify: `src/ui/screens/about.js`
- Modify: `src/ui/screens/onboarding.js`
- Modify: `src/ui/screens/progress.js`

**Interfaces:**
- Consumes: `i18n` from Task 1
- Produces: all 3 screens use `i18n.t()` instead of innerHTML with hardcoded strings

**Strategy:** These are content-heavy screens with few interactive elements. Straightforward string replacement.

- [ ] **Step 1: Migrate `about.js`**

Replace entire `mount` function body:

```js
// src/ui/screens/about.js
import { i18n } from '../../i18n/index.js';

export async function mount(container, _ctx) {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  container.innerHTML = `
    <div class="about-page">
      <h2>${i18n.t('about.title')}</h2>

      <section class="progress-section">
        <h3>${i18n.t('about.subtitle')}</h3>
        <p>${i18n.t('about.description')}</p>
        <p>${i18n.t('about.version', { version })}</p>
      </section>

      <section class="progress-section">
        <h3>${i18n.t('about.licenses')}</h3>

        <h4>${i18n.t('about.sblgntTitle')}</h4>
        <p>${i18n.t('about.sblgntText')}
           <a href="https://github.com/Clear-Bible/macula-greek/" target="_blank" rel="noopener">github.com/Clear-Bible/macula-greek/</a></p>

        <h4>${i18n.t('about.cherithTitle')}</h4>
        <p>${i18n.t('about.cherithText')}</p>

        <h4>${i18n.t('about.bsbTitle')}</h4>
        <p>${i18n.t('about.bsbText')}
           <a href="https://berean.bible/" target="_blank" rel="noopener">berean.bible</a></p>

        <h4>${i18n.t('about.alignTitle')}</h4>
        <p>${i18n.t('about.alignText')}</p>

        <h4>${i18n.t('about.fontTitle')}</h4>
        <p>${i18n.t('about.fontText')}</p>
      </section>

      <section class="progress-section">
        <h3>${i18n.t('about.contacts')}</h3>
        <p><a href="https://github.com/stkotok/ru2agr_reading" target="_blank" rel="noopener">${i18n.t('about.githubLink')}</a></p>
      </section>
    </div>
  `;
}

export function unmount() {}
```

- [ ] **Step 2: Migrate `onboarding.js`**

Add import:
```js
import { i18n } from '../../i18n/index.js';
```

Replace PRESETS array (lines 8-32) — make title/desc/example use i18n keys:

```js
const PRESETS = [
  {
    id: 1,
    titleKey: 'onboarding.preset1Title',
    descKey: 'onboarding.preset1Desc',
    readingMode: 'mixed', wordLayer: 'off', intensity: 35,
    introduce: 8, allLettersKnown: false
  },
  {
    id: 2,
    titleKey: 'onboarding.preset2Title',
    descKey: 'onboarding.preset2Desc',
    readingMode: 'mixed', wordLayer: 'lemma', intensity: 35,
    introduce: 0, allLettersKnown: true,
    exampleKey: 'onboarding.preset2Example'
  },
  {
    id: 3,
    titleKey: 'onboarding.preset3Title',
    descKey: 'onboarding.preset3Desc',
    readingMode: 'mixed', wordLayer: 'form', intensity: 35,
    introduce: 0, allLettersKnown: true,
    exampleKey: 'onboarding.preset3Example'
  },
];
```

In `renderStep1()` — replace card content:
```js
// Line 60: h2
h2.textContent = i18n.t('onboarding.step1Title');

// Lines 68-76: card content
card.innerHTML = `<strong>${i18n.t(preset.titleKey)}</strong><p>${i18n.t(preset.descKey)}</p>`;
if (preset.exampleKey) {
  card.innerHTML += `<small class="onboarding-example">${i18n.t(preset.exampleKey)}</small>`;
}
```

In `renderStep2()` — replace hardcoded strings:
```js
// Line 117: h2
h2.textContent = i18n.t('onboarding.step2Title');

// Line 127: john card
johnCard.innerHTML = `<strong>John 1</strong><p>${i18n.t('onboarding.johnDesc')}</p>`;

// Line 135: mark card
markCard.innerHTML = `<strong>Mark 1</strong><p>${i18n.t('onboarding.markDesc')}</p>`;

// Line 143: continue card
continueCard.innerHTML = `<strong>${i18n.t('onboarding.continueReading')}</strong>`;
```

- [ ] **Step 3: Migrate `progress.js`**

Add import:
```js
import { i18n } from '../../i18n/index.js';
```

Replace strings in `render()`:
```js
// Line 35: header title
const { bar: header } = createPageHeader({ title: i18n.t('progress.title') });
```

In `renderWordsSection()`:
```js
// Line 68: section header
h3.textContent = i18n.t('progress.sectionWords');

// Line 78: stats text
p.textContent = i18n.t('progress.wordsKnown', { known, learning, today: todayNew });
```

In `renderLettersSection()`:
```js
// Line 88: section header
h3.textContent = i18n.t('progress.sectionLetters');

// Line 113: motto
p.textContent = i18n.t('progress.youKnow') + ' ' + parts.join(' ');

// Line 155: add label
addLabel.textContent = i18n.t('progress.addLetters');

// Line 173: toast
showToast(i18n.t('progress.todayAdd', { letters: names }));
```

In `renderReadingSection()`:
```js
// Line 191: section header
h3.textContent = i18n.t('progress.sectionReading');

// Line 196: no data
p.textContent = i18n.t('progress.noBookData');

// Line 208: book name — use i18n.bookName()
title.textContent = i18n.bookName(book).short + ' — ' + i18n.bookName(book).title;

// Lines 214, 217: status labels
status.textContent = i18n.t('progress.statusRead');
status.textContent = i18n.t('progress.statusStarted', { read: readingData.chaptersRead.length, total: book.chapters });
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/about.js src/ui/screens/onboarding.js src/ui/screens/progress.js
git commit -m "feat(i18n): migrate about, onboarding, progress screens to i18n.t()

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Migrate settings.js screen — add language selector

**Files:**
- Modify: `src/ui/screens/settings.js`

**Interfaces:**
- Consumes: `i18n` from Task 1, `settings` state (Task 5 has uiLang)
- Produces: settings screen with language selector, all strings via `i18n.t()`

- [ ] **Step 1: Rewrite `settings.js` screen with i18n**

Add import:
```js
import { i18n } from '../../i18n/index.js';
```

Replace all hardcoded strings in render functions. Key changes:

```js
function render() {
  if (!container) return;
  container.innerHTML = '';

  const { bar: header } = createPageHeader({ title: i18n.t('settings.title') });
  container.appendChild(header);

  const content = document.createElement('div');
  content.className = 'settings-content';
  container.appendChild(content);

  const outer = container;
  container = content;

  renderLanguageSection();  // + new — before theme
  renderThemeSection();
  renderContrastSection();
  renderDisplaySection();
  renderResetSection();

  container = outer;
}

// + New section
function renderLanguageSection() {
  const label = sectionLabel(i18n.t('settings.sectionLanguage'));
  container.appendChild(label);

  const bar = document.createElement('div');
  bar.className = 'settings-segmented';

  [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
  ].forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'settings-seg-btn' + (i18n.lang === opt.value ? ' active' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', async () => {
      await i18n.setLang(opt.value);
      settings = { ...settings, uiLang: opt.value };
      saveSettings(settings);
      store.update(s => ({ ...s, settings }));
      render(); // full re-render to update all labels
    });
    bar.appendChild(btn);
  });
  container.appendChild(bar);
}
```

Replace theme section labels:
```js
// Line 60: section label
const label = sectionLabel(i18n.t('settings.sectionTheme'));

// Lines 67-69: mode labels
const modes = [
  { id: 'auto', label: i18n.t('settings.themeSystem') },
  { id: 'light', label: i18n.t('settings.themeLight') },
  { id: 'dark', label: i18n.t('settings.themeDark') },
];
```

Replace contrast section:
```js
// Line 188: section label
const label = sectionLabel(i18n.t('settings.sectionContrast'));

// Line 200: button text (use i18n.contrastLabel)
btn.textContent = i18n.contrastLabel(level);
```

Replace display section:
```js
// Line 214: section label
const label = sectionLabel(i18n.t('settings.sectionDisplay'));

// Lines 218-222: checkbox labels
[
  ['diacritics', i18n.t('settings.showDiacritics')],
  ['strongs', i18n.t('settings.showStrongs')],
  ['ruHint', i18n.t('settings.showRuHint')]
].forEach(([key, text]) => { ... });
```

Replace theme labels:
```js
// Lines 302-304: slot labels — use i18n.themeLabel()
const label = type === 'light' ? i18n.t('settings.themeLight') : i18n.t('settings.themeDark');
// ...
slot.innerHTML = `
  <span class="settings-slot-swatch" style="background:${swatchColor}"></span>
  <span class="settings-slot-name">${i18n.themeLabel(currentTheme)}</span>
  <span class="settings-slot-chevron">▾</span>
`;
```

Replace reset section:
```js
// Line 241: section label
const label = sectionLabel(i18n.t('settings.sectionReset'));

// Line 246: button text
btn.textContent = i18n.t('settings.resetBtn');

// Line 248: confirm
if (confirm(i18n.t('settings.resetConfirm'))) { ... }
```

Replace gallery label:
```js
// Line 118: gallery aria-label
gallery.setAttribute('aria-label', i18n.t('settings.themeGalleryLabel'));

// Line 132: theme name in gallery
const label = i18n.themeLabel(slug);
```

- [ ] **Step 2: Remove `THEME_LABELS` import if it was imported**

Check the import line and remove `THEME_LABELS`:
```js
// Was: import { loadSettings, saveSettings, applyTheme, applyContrast, THEMES, LIGHT_THEMES, DARK_THEMES, CONTRAST_LEVELS, CONTRAST_LABELS } from '../../state/settings.js';
// Now: import { loadSettings, saveSettings, applyTheme, applyContrast, THEMES, LIGHT_THEMES, DARK_THEMES, CONTRAST_LEVELS, DEFAULT_CONTRAST } from '../../state/settings.js';
```

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/settings.js
git commit -m "feat(i18n): migrate settings screen + add language selector

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Migrate reading.js

**Files:**
- Modify: `src/ui/screens/reading.js`

**Interfaces:**
- Consumes: `i18n` from Task 1
- Produces: reading screen with all strings via `i18n.t()`

**Strategy:** Most complex screen (~30 strings). Pattern: find hardcoded Russian → replace with `i18n.t()`.

- [ ] **Step 1: Add i18n import**

```js
import { i18n } from '../../i18n/index.js';
```

- [ ] **Step 2: Replace all hardcoded strings**

Key replacements — follow the pattern below for each occurrence:

```js
// Line 123: toast message
showToast(i18n.t('reading.grcUnavailable'), { timeout: 5000 });

// Lines 271-275: book groups (same pattern as top-bar.js)
const groups = {
  [i18n.t('reading.bookGroupGospels')]: books.filter(b => ['matthew','mark','luke','john'].includes(b.id)),
  [i18n.t('reading.bookGroupActs')]: books.filter(b => b.id === 'acts'),
  [i18n.t('reading.bookGroupEpistles')]: books.filter(b => !['matthew','mark','luke','john','acts','revelation'].includes(b.id)),
  [i18n.t('reading.bookGroupRevelation')]: books.filter(b => b.id === 'revelation'),
};

// Line 287: book name in dropdown
btn.textContent = i18n.bookName(book).short + ' — ' + i18n.bookName(book).title;

// Line 302: fallback book name
if (nameEl) nameEl.textContent = book ? i18n.bookName(book).short + ',' : i18n.bookName({ short: 'Ин', shortEn: 'Jn' }).short + ',';

// Line 313: eye button aria-label
eyeBtn.setAttribute('aria-label', i18n.t('reading.eyePlain'));

// Line 318: eye toggle aria-label
eyeBtn.setAttribute('aria-label', plainView ? i18n.t('reading.eyeRestore') : i18n.t('reading.eyePlain'));

// Line 324: page header title
const { bar, centerSlot } = createPageHeader({
  title: bookData ? (i18n.bookName(bookData).short + ',') : i18n.bookName({ short: 'Ин', shortEn: 'Jn' }).short + ',',
  left: bookBtn,
  right: eyeBtn,
});

// Line 391-396: data notice
notice.innerHTML = `
  <span>${i18n.t('reading.noticeTitle')}</span>
  <button class="data-notice-close" aria-label="${i18n.t('reading.noticeDismiss')}">
    ${iconX(16)}
  </button>
`;

// Line 413: heading
if (heading) heading.textContent = i18n.t('reading.heading', { title: i18n.bookName(bookData).title });

// Line 423: toast (same as line 123)
showToast(i18n.t('reading.grcUnavailable'), { timeout: 5000 });

// Line 592-595: chapter heading
heading.textContent = `${i18n.bookName(bookData).short || i18n.bookName(bookData).title} · ${i18n.t('reading.chapter')} ${ch.n}`;

// Line 671: chapter heading (same pattern, second occurrence)
// Already handled by the composeCtx in renderWindowed — search for "глава" and replace

// Lines 1013, 1024: error/offline states
div.innerHTML = `<p>${i18n.t('reading.errorLoad')}</p><button class="btn btn-primary retry-btn">${i18n.t('reading.retry')}</button>`;
div.innerHTML = `<p>${i18n.t('reading.offlineLoad')}</p><button class="btn btn-primary retry-btn">${i18n.t('reading.retry')}</button>`;

// Line 1054: popover aria-label
popoverEl.setAttribute('aria-label', i18n.t('reading.cardWord'));

// Line 1059: close button
closeBtn.setAttribute('aria-label', i18n.t('reading.closeCard'));

// Line 1228: toast
showToast(i18n.t('reading.wordCardComing'));
```

- [ ] **Step 3: Replace buildGreekTextFragment aria-label**

```js
// Line 595: aria-label for Greek token
span.setAttribute('aria-label', i18n.t('reading.grcWord', { word: surface }));
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/reading.js
git commit -m "feat(i18n): migrate reading screen to i18n.t()

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Migrate dictionary.js

**Files:**
- Modify: `src/ui/screens/dictionary.js`

**Interfaces:**
- Consumes: `i18n` from Task 1
- Produces: dictionary screen with all strings via `i18n.t()`, gloss via `i18n.gloss()`

- [ ] **Step 1: Add i18n import**

```js
import { i18n } from '../../i18n/index.js';
```

- [ ] **Step 2: Replace all hardcoded strings**

Key replacements:

```js
// Line 75: header title
const { bar: header } = createPageHeader({ title: i18n.t('dict.title') });

// Lines 160-168: fallback messages
info.innerHTML = `<p>${i18n.t('dict.freqUnavailable')}</p>`;
empty.innerHTML = `<p>${i18n.t('dict.freqEmpty')}</p>`;

// Line 210: status badge
<span class="dict-badge badge-${entry.status || 'new'}">${i18n.t(`dict.pill${capitalize(entry.status || 'new')}`)}</span>

// Line 211: checkbox title
<label class="dict-check" title="${i18n.t('dict.showInText')}">

// Line 212: checkbox aria-label
<input type="checkbox" ${...} aria-label="${i18n.t('dict.showInTextTitle', { lemma })}">

// Line 261: title count
<span class="dict-title-count">${filtered.length}&nbsp;${i18n.t('dict.words')}</span>

// Line 271: search placeholder
<input type="search" placeholder="${i18n.t('dict.searchPlaceholder')}" value="..." aria-label="${i18n.t('dict.searchLabel')}">

// Lines 290-294: status options
const statusOpts = [
  { value: 'all', label: i18n.t('dict.all') },
  { value: 'new', label: i18n.t('dict.statusNew') },
  { value: 'learning', label: i18n.t('dict.statusLearning') },
  { value: 'known', label: i18n.t('dict.statusKnown') },
];

// Line 303: status dropdown label
statusBtn.innerHTML = `<span class="dict-dropdown-label">${i18n.t('dict.statusLabel')}</span> ...`;

// Lines 348-354: POS options
const posOpts = [
  { value: 'all', label: i18n.t('dict.all') },
  { value: 'noun', label: i18n.t('dict.posNoun') },
  { value: 'verb', label: i18n.t('dict.posVerb') },
  { value: 'adj', label: i18n.t('dict.posAdj') },
  { value: 'func', label: i18n.t('dict.posFunc') },
];

// Line 363: POS dropdown label
posBtn.innerHTML = `<span class="dict-dropdown-label">${i18n.t('dict.posLabel')}</span> ...`;

// Line 422-424: show-in-text toggle
showToggle.innerHTML = `
  <svg ...>...</svg>
  ${i18n.t('dict.checked')}`;

// Line 489: divider coverage
const pctText = pct !== undefined ? i18n.t('dict.coverageLabel', { pct }) : '';

// Line 492: divider label
divider.innerHTML = `
  <span class="dict-divider-label">${i18n.t('dict.topLabel', { bucket })}</span>
  ...`;

// Lines 500-503: status labels + checked logic
const statusLabel = i18n.t(`dict.pill${capitalize(entry?.status || 'new')}`) || '';
const checked = entry && entry.showInText !== false;

// Line 504: gloss — use i18n.gloss() helper
const gloss = i18n.gloss(lex);

// Line 516: freq label
<span class="dict-freq">${item.count}&nbsp;${i18n.t('dict.freqInNT')}</span>

// Lines 520-521: checkbox labels
<button class="dict-cbx${checked ? ' on' : ''}" aria-label="${checked ? i18n.t('dict.removeFromText') : i18n.t('dict.showInText')}" title="${checked ? i18n.t('dict.removeFromText') : i18n.t('dict.showInText')}">

// Line 523: no-alignment title
<span class="dict-cbx-na" title="${i18n.t('dict.noAlignment')}">–</span>

// Lines 577-580: updateRow pill labels
pillEl.textContent = i18n.t(`dict.pill${capitalize(entry.status || 'new')}`);

// Lines 630-665: buildWordCard
// Line 637: card header
card.innerHTML = `
  ...
  ${ruGloss ? `
  <div class="word-card-gloss">
    <div class="word-card-gloss-text">${ruGloss}</div>
    <div class="word-card-meta">
      ${lexeme?.pos ? `<span class="word-card-pos">${lexeme.pos}</span>` : ''}
      <span class="word-card-freq">${i18n.t('dict.freqLabel', { count: item.count })}</span>
      <span class="word-card-rank">${i18n.t('dict.rankNT', { rank: item.rank })}</span>
      ...
  ` : ''}
  ${!hasAlignment ? `<p class="word-card-warning">${i18n.t('dict.noMatchWarning')}</p>` : ''}
  <section>
    <h3>${i18n.t('dict.statusStudy')}</h3>
    <div class="word-card-actions">
      <button ... data-status="new">${i18n.t('dict.pillNew')}</button>
      <button ... data-status="learning">${i18n.t('dict.pillLearning')}</button>
      <button ... data-status="known">${i18n.t('dict.pillKnown')}</button>
    </div>
  </section>
  <div class="word-card-toggle">
    <div>
      <div class="word-card-toggle-label">${inDict ? i18n.t('dict.showInText') : i18n.t('dict.addToDict')}</div>
      <div class="word-card-toggle-hint">${hasAlignment ? i18n.t('dict.replacesInText') : i18n.t('dict.noTextMatch')}</div>
    </div>
    ...
  </div>
`;

// The toggle switch aria-label:
`<button class="word-card-toggle-switch${...}" aria-label="${i18n.t('dict.showInText')}"></button>`
```

- [ ] **Step 3: Helper function for capitalize**

Add at top of file:
```js
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/dictionary.js
git commit -m "feat(i18n): migrate dictionary screen to i18n.t() + i18n.gloss()

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Migrate word-card.js — gloss + labels + card section labels

**Files:**
- Modify: `src/ui/components/word-card.js`

**Interfaces:**
- Consumes: `i18n` from Task 1
- Produces: word/letter cards with i18n labels; gloss via `i18n.gloss()`; card section labels via `i18n.t('card.*')`

- [ ] **Step 1: Add i18n import**

```js
import { i18n } from '../../i18n/index.js';
```

- [ ] **Step 2: Replace renderLetterCard strings**

```js
export function renderLetterCard(letter, progressEntry, onMarkKnown) {
  const card = document.createElement('div');
  card.className = 'card word-card';

  const status = progressEntry?.status || null;

  card.innerHTML = `
    <div class="word-card-form">${letter.upper} ${letter.lower}</div>
    <div class="word-card-name">${letter.name}</div>
    <div class="word-card-sound">${letter.sound}</div>
    <div class="word-card-equiv">${i18n.t('lettercard.equiv', { letter: letter.ruEquivalents[0] })}</div>
    <div class="word-card-actions"></div>
    <div class="word-card-disclaimer">${i18n.t('lettercard.pronDisclaimer')}</div>
  `;

  const actions = card.querySelector('.word-card-actions');
  if (status === 'known') {
    const badge = document.createElement('span');
    badge.className = 'word-card-badge badge-known';
    badge.textContent = i18n.t('lettercard.known');
    actions.appendChild(badge);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = i18n.t('lettercard.markKnown');
    btn.addEventListener('click', () => {
      if (onMarkKnown) onMarkKnown(letter.lower);
      const badge = document.createElement('span');
      badge.className = 'word-card-badge badge-known';
      badge.textContent = i18n.t('lettercard.known');
      btn.replaceWith(badge);
    });
    actions.appendChild(btn);
  }

  return card;
}
```

- [ ] **Step 3: Replace renderWordCard strings**

Key replacements in `renderWordCard()`:

```js
// Line 24-31: formatFrequency
export function formatFrequency(freq) {
  if (!freq || !freq.count) return null;
  const formatted = new Intl.NumberFormat(i18n.lang === 'ru' ? 'ru-RU' : 'en-US').format(freq.count);
  if (freq.rank) {
    const bucket = rankBucket(freq.rank);
    return i18n.t('frequency.topBucket', { bucket, formatted });
  }
  return i18n.t('frequency.timesNT', { formatted });
}

// Line 50-56: freqTooltip
function freqTooltip(freq, lemma) {
  if (!freq || !freq.count) return '';
  const l = lemma || (i18n.lang === 'ru' ? 'слово' : 'word');
  if (freq.rank) {
    return i18n.t('frequency.tooltipBucket', { lemma: l, bucket: rankBucket(freq.rank), count: freq.count });
  }
  return i18n.t('frequency.tooltipSimple', { lemma: l, count: freq.count });
}

// Line 160: card aria-label
card.setAttribute('aria-label', i18n.t('wordcard.title', { word: surfaceForm || lemma }));

// Line 203: Strong's tooltip
strongEl.setAttribute('title', i18n.t('frequency.strongTooltip', { strong }));

// Line 257: audio button
audioBtn.setAttribute('aria-label', i18n.t('wordcard.listenLabel', { word: surfaceForm || lemma }));
audioBtn.title = i18n.t('wordcard.pronUnavailable');

// Line 274: inline label
inlineLabel.textContent = i18n.t('card.inlineLabel');

// Line 294: gloss — use i18n.gloss() instead of core.ruGloss
const gloss = i18n.gloss(core); // was: core?.ruGloss

// Line 324: senses label
label.textContent = i18n.t('card.senses');

// Lines 367, 376: lemma grid labels
labelLeft.textContent = i18n.t('card.textLabel');
labelRight.textContent = i18n.t('card.lemmaLabel');

// Lines 392-395: status buttons
const statuses = [
  { key: 'new', label: i18n.t('wordcard.statusNew'), cls: 'status-new' },
  { key: 'learning', label: i18n.t('wordcard.statusLearning'), cls: 'status-learning' },
  { key: 'known', label: i18n.t('wordcard.statusKnown'), cls: 'status-known' }
];

// Line 431: definition label
label.textContent = i18n.t('card.definition');

// Line 449: derivation label
label.textContent = i18n.t('card.derivation');

// Line 466: gear button aria-label
gearBtn.setAttribute('aria-label', i18n.t('wordcard.settingsLabel'));
```

- [ ] **Step 4: Update showGearDropdown to use i18n card labels**

In `showGearDropdown()`, replace the `labelMap` construction (line 490):

```js
// Was:
const labelMap = Object.fromEntries(CARD_SECTIONS.map(s => [s.key, s.label]));

// Now:
const labelMap = Object.fromEntries(CARD_SECTIONS.map(s => [s.key, i18n.t(`card.${s.key}`)]));
```

- [ ] **Step 5: Run tests**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/word-card.js
git commit -m "feat(i18n): migrate word-card to i18n.t() + i18n.gloss()

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Migrate mode-widget.js

**Files:**
- Modify: `src/ui/components/mode-widget.js`

**Interfaces:**
- Consumes: `i18n` from Task 1
- Produces: mode widget with all strings via `i18n.t()`

- [ ] **Step 1: Add i18n import**

```js
import { i18n } from '../../i18n/index.js';
```

- [ ] **Step 2: Replace all hardcoded strings**

```js
// Line 66: greek tab disabled tooltip
tabElement.title = i18n.t('mode.grcUnavailable');

// Line 69: greek tab loading tooltip
tabElement.title = i18n.t('mode.grcLoading');

// Line 86: popup aria-label
el.setAttribute('aria-label', i18n.t('mode.label'));

// Lines 90-91: tab labels
el.innerHTML = `
  <div class="mode-widget-tabs">
    <button class="mode-widget-tab" data-tab="mixed">${i18n.t('mode.mixedTab')}</button>
    <button class="mode-widget-tab" data-tab="greek">${i18n.t('mode.greekTab')}</button>
  </div>
  ...`;

// Line 128: slider label
sliderLabel.textContent = i18n.t('mode.letterReplace');

// Line 143: slider aria-label
slider.setAttribute('aria-label', i18n.t('mode.sliderLabel'));

// Line 160: slider min/max labels
sliderLabels.innerHTML = `<span>${i18n.t('mode.sliderMin')}</span><span>${i18n.t('mode.sliderMax')}</span>`;

// Line 171: toggle label
toggleLabel.textContent = i18n.t('mode.wordReplace');

// Line 177: toggle aria-label
toggle.setAttribute('aria-label', i18n.t('mode.wordFormLabel'));

// Lines 179-182: toggle options
[
  { value: 'off', label: i18n.t('mode.off') },
  { value: 'lemma', label: i18n.t('mode.lemma') },
  { value: 'form', label: i18n.t('mode.forms') }
].forEach(opt => { ... });

// Lines 213-216: hints
hint.innerHTML =
  '<span class="mw-hint-off">' + i18n.t('mode.hintOff') + '</span><br>' +
  '<span class="mw-hint-lemma">' + i18n.t('mode.hintLemma') + '</span><br>' +
  '<span class="mw-hint-form">' + i18n.t('mode.hintForm') + '</span>';

// Line 223: dictionary button
dictBtn.textContent = i18n.t('mode.dictBtn', { count: Math.max(0, dictWordCount) });

// Line 247: greek panel description
desc.textContent = i18n.t('mode.greekDesc');

// Line 263: BSB checkbox label
label.appendChild(document.createTextNode(i18n.t('mode.showBSB')));

// Line 268: greek hint
hint.textContent = i18n.t('mode.greekHint');
```

- [ ] **Step 3: Replace chipLabel and updateChip strings**

```js
// Replace chipLabel function (lines 441-448):
function chipLabel(showLetters, intensity, showWordLayer, wordLayer, grcUnavailable, hasDictWords, count) {
  const desc = [];
  if (showLetters) desc.push(i18n.t('mode.chipLabelLetters', { pct: intensity + '%' }));
  if (showWordLayer) {
    if (grcUnavailable && hasDictWords) desc.push(i18n.t('mode.grcUnavailable'));
    else {
      const form = wordLayer === 'lemma' ? i18n.t('mode.lemma').toLowerCase() : i18n.t('mode.forms').toLowerCase();
      desc.push(i18n.t('mode.chipLabelWords', { form, count }));
    }
  }
  return i18n.t('mode.chipPrefix') + (desc.join('; ') || i18n.t('mode.chipLabelOff'));
}

// In updateChip — replace chip labels:
// Line 464: Greek chip
_chipSig = 'greek';
chip.innerHTML = '<span class="mw-greek-label">' + i18n.t('mode.chipGreek') + '</span>';
chip.setAttribute('aria-label', i18n.t('mode.chipGreekView'));

// Line 473: Loading chip
chip.innerHTML = '<span class="mw-loading">…</span>';
chip.setAttribute('aria-label', i18n.t('mode.chipLoading'));

// Line 486: Off chip  
chip.innerHTML = '<span class="mw-rus-label">' + i18n.t('mode.chipOff') + '</span>';
chip.setAttribute('aria-label', i18n.t('mode.chipGreekOff'));
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/mode-widget.js
git commit -m "feat(i18n): migrate mode-widget to i18n.t()

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: Final gate — tests + build + manual verification

**Files:** none (verification only)

**Produces:** verified green build with i18n working in both languages.

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: 220+ passed, 0 failed.

- [ ] **Step 2: Run data build + verify**

```bash
npm run build:data && npm run verify:data
```

Expected: 0 errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: Vite + PWA build succeeds, no warnings about missing exports.

- [ ] **Step 4: Manual verification checklist**

Serve the built app (`npx serve dist`) and check:

- [ ] First visit (clear cache/IndexedDB): auto-detects browser language
- [ ] URL redirects to `#/ru/read/john` (Cyrillic browser) or `#/en/read/john`
- [ ] Navigate to Settings → Language: shows current language highlighted
- [ ] Switch to English: all UI labels update (nav, settings, mode widget)
- [ ] Navigate to Reading: chapter labels in English ("John · chapter 1"), book dropdown groups
- [ ] Dictionary: search placeholder, filter labels, status pills in English
- [ ] Word card: labels, gloss selection (English gloss for English UI)
- [ ] Progress: section headers, status labels in English
- [ ] About: all content in English
- [ ] Onboarding: presets, steps in English (reset settings.onboarded to test)
- [ ] Switch back to Russian: all labels return to Russian
- [ ] Direct URL `#/en/read/mark` works, loads in English
- [ ] Old URL `#/read/john` redirects to `#/ru/read/john` (or `#/en/...`)
- [ ] Mobile: bottom sheet, inspector — aria-labels in correct language
- [ ] Theme/contrast labels in settings (gallery, segmented buttons) — correct language
- [ ] Mode widget chip: label text in correct language

- [ ] **Step 5: Fix any issues found**

Re-run `npm test && npm run build` after fixes.

- [ ] **Step 6: Final commit**

```bash
git add -A
git diff --cached --stat
git commit -m "feat(i18n): complete English/Russian UI localization

Full i18n implementation:
- I18n class with t(), pluralization, interpolation
- ru/en translation dictionaries (~120 keys each)
- URL-based language switching (#/ru/..., #/en/...)
- Auto-detection from browser + manual override in settings
- Data-driven strings: book names, glosses, theme/contrast labels
- Migrated all 15+ UI files from hardcoded Russian strings

Co-Authored-By: Claude <noreply@anthropic.com>"
```
