/**
 * ru2gr-utils.js — утилиты без состояния: цветовая математика, палитры,
 * парсинг текста, иконки, состояния чипов.
 * Доступен как window.RU2GR_UTILS.
 */
(function () {
  /* ================================================================
   * 1. ЦВЕТОВАЯ МАТЕМАТИКА
   * ================================================================ */

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(a) {
    const c = function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); };
    return '#' + c(a[0]) + c(a[1]) + c(a[2]);
  }

  function mixColor(x, y, t) {
    const A = hexToRgb(x), B = hexToRgb(y);
    return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  }

  function colorLuminance(hex) {
    const a = hexToRgb(hex);
    return (0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]) / 255;
  }

  /** Альфа-хелпер: hex → rgba. Использует window.RU2GR.a если доступен, иначе считает сам. */
  function alpha(hex, al) {
    if (window.RU2GR && window.RU2GR.a) return window.RU2GR.a(hex, al);
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + al + ')';
  }

  /* ================================================================
   * 2. ПАЛИТРЫ
   * ================================================================ */

  /** Построить основную палитру (аналог readerPalette) */
  function buildReaderPalette(THEMES, theme, contrast, LV_TABLE) {
    const base = THEMES[theme] || THEMES['Пергамент'];
    const ct = contrast || 'Чёткий';
    const LV = LV_TABLE[ct] || LV_TABLE['Чёткий'];
    const dark = colorLuminance(base.paper) < 0.5;
    const C = Object.assign({}, base);

    C.read    = dark ? mixColor(base.read, '#ffffff', LV.elv * 0.4) : mixColor(base.read, '#ffffff', LV.elv);
    C.paper   = dark ? mixColor(base.paper, '#ffffff', LV.elv * 0.15) : mixColor(base.paper, '#000000', LV.elv * 0.15);
    C.paper2  = dark ? mixColor(base.paper2, '#000000', LV.elv * 0.5) : mixColor(base.paper2, '#000000', LV.elv * 0.7);
    C.sidebar = dark ? mixColor(base.sidebar, '#000000', LV.elv * 0.5) : mixColor(base.sidebar, '#000000', LV.elv * 0.7);
    C.line    = alpha(base.ink, dark ? LV.lineAlpha * 0.8 : LV.lineAlpha);
    C.line2   = alpha(base.ink, dark ? LV.line2Alpha * 0.8 : LV.line2Alpha);
    C.shadow  = dark
      ? '0 2px ' + (6 + LV.shadowAlpha * 22) + 'px -2px rgba(0,0,0,' + (0.25 + LV.shadowAlpha * 0.8) + ')'
      : '0 1px ' + (2 + LV.shadowAlpha * 8) + 'px rgba(40,34,22,' + (0.04 + LV.shadowAlpha * 0.35) + '),0 ' + (6 + LV.shadowAlpha * 24) + 'px ' + (14 + LV.shadowAlpha * 34) + 'px -12px rgba(40,34,22,' + (0.10 + LV.shadowAlpha * 0.5) + ')';
    return C;
  }

  /** Построить палитру слов (аналог readerWordPalette) */
  function buildReaderWordPalette(CR, contrast, WORD_ELV_TABLE) {
    const C = Object.assign({}, CR);
    const dark = colorLuminance(C.paper) < 0.5;
    const ct = contrast || 'Чёткий';
    const elv = WORD_ELV_TABLE[ct] || 0.07;

    C.content  = dark ? mixColor(C.read, '#ffffff', elv * 0.25) : mixColor(C.read, '#ffffff', elv * 0.3);
    C.card     = dark ? mixColor(C.paper, '#000000', elv) : mixColor(C.paper, '#ffffff', elv);
    C.sidebar  = dark ? mixColor(C.sidebar || C.paper2, '#000000', elv * 0.4) : mixColor(C.sidebar || C.paper2, '#000000', elv * 0.6);
    C.titlebar = dark ? mixColor(C.titlebar, '#000000', elv * 0.6) : mixColor(C.titlebar, '#000000', elv * 0.8);
    C.cardLine = C.line;
    return C;
  }

  /* ================================================================
   * 3. ТЕКСТ: ХЕШ, ПАРСИНГ ТОКЕНОВ
   * ================================================================ */

  /** FNV-1a хеш → число [0,1) для псевдослучайной замены букв */
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }

  /** Разобрать строку с разметкой {ru|id:form} на токены */
  function buildTokens(str) {
    const out = [];
    const re = /\{([^}]*)\}([^\s{]*)|([^\s{]+)/g;
    let m;
    while ((m = re.exec(str))) {
      if (m[1] !== undefined) {
        const inner = m[1], trail = m[2] || '';
        const bar = inner.indexOf('|');
        const ru = inner.slice(0, bar);
        let rest = inner.slice(bar + 1), id = rest, form = null;
        const ci = rest.indexOf(':');
        if (ci >= 0) { id = rest.slice(0, ci); form = rest.slice(ci + 1); }
        out.push({ kind: 'align', ru: ru, id: id, form: form, trail: trail });
      } else if (m[3] !== undefined) {
        out.push({ kind: 'word', text: m[3] });
      }
    }
    return out;
  }

  /** Извлечь плоский русский текст из токенов */
  function plainFromTokens(toks) {
    return toks.map(function (t) { return t.kind === 'align' ? (t.ru + (t.trail || '')) : t.text; }).join(' ');
  }

  /* ================================================================
   * 4. ФОРМАТИРОВАНИЕ
   * ================================================================ */

  function formatNum(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "×";
  }

  /* ================================================================
   * 5. ИКОНКИ (React.createElement)
   * ================================================================ */

  function iconPath(d, c, sw) {
    const h = React.createElement;
    return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: sw || 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      ...(Array.isArray(d) ? d : [d]).map(function (p, i) { return h('path', { key: i, d: p }); }));
  }

  function iconRead(c, sz) {
    const s = sz || 23, h = React.createElement;
    return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M12 6.5C10 5.2 7.6 5.2 5 6.2v12c2.6-1 5-1 7 .3' }),
      h('path', { d: 'M12 6.5c2-1.3 4.4-1.3 7-.3v12c-2.6-1-5-1-7 .3' }),
      h('path', { d: 'M12 6.5v12.3' }));
  }

  function iconWords(c, sz) {
    const s = sz || 23, h = React.createElement;
    return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M9 7h11M9 12h11M9 17h11' }),
      h('circle', { cx: 4.5, cy: 7, r: 1, fill: c, stroke: 'none' }),
      h('circle', { cx: 4.5, cy: 12, r: 1, fill: c, stroke: 'none' }),
      h('circle', { cx: 4.5, cy: 17, r: 1, fill: c, stroke: 'none' }));
  }

  function iconInfo(c, sz) {
    const s = sz || 23, h = React.createElement;
    return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('circle', { cx: 12, cy: 12, r: 9 }),
      h('path', { d: 'M12 11v5' }),
      h('circle', { cx: 12, cy: 7.7, r: 0.6, fill: c, stroke: 'none' }));
  }

  function iconEye(c, off) {
    const h = React.createElement;
    if (off) {
      return h('svg', { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M3 3l18 18' }),
        h('path', { d: 'M10.6 6.2A9.7 9.7 0 0112 6c5 0 9 4.5 10 6-0.5 0.9-1.5 2.2-3 3.3M6.2 7.3C4.2 8.6 2.7 10.4 2 12c1 1.5 5 6 10 6 1.4 0 2.7-.3 3.9-.9' }),
        h('path', { d: 'M9.8 9.9a3 3 0 004.2 4.2' }));
    }
    return h('svg', { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z' }),
      h('circle', { cx: 12, cy: 12, r: 3 }));
  }

  function iconGear(c) {
    const h = React.createElement;
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', { d: 'M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z' }));
  }

  function iconChev(c, dir) {
    const h = React.createElement;
    const d = dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6';
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: d }));
  }

  function iconChevH(c, dir) {
    const h = React.createElement;
    const d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6';
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: d }));
  }

  function iconSearch(c) {
    const h = React.createElement;
    return h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('circle', { cx: 11, cy: 11, r: 7 }),
      h('path', { d: 'M21 21l-4.3-4.3' }));
  }

  function iconEyeSmall(c) {
    const h = React.createElement;
    return h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z' }),
      h('circle', { cx: 12, cy: 12, r: 3 }));
  }

  function iconX(c, sz) {
    const h = React.createElement, s = sz || 15;
    return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M6 6l12 12M18 6L6 18' }));
  }

  function iconCaret(c, open) {
    const h = React.createElement;
    return h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round',
      style: { transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 } },
      h('path', { d: 'M6 9l6 6 6-6' }));
  }

  /* ================================================================
   * 6. СОСТОЯНИЯ ЧИПОВ РЕЖИМА
   * ================================================================ */

  function getChipStates() {
    return [
      { id: 'rus',     label: '«Рус» — всё выключено',        desc: 'интенсивность букв 0%, слой слов выкл. Греческого слоя нет.' },
      { id: 'alpha',   label: '«α35%» — только буквы',        desc: 'включена замена букв с указанной интенсивностью.', pct: 35 },
      { id: 'lemma',   label: '«α35% · λέγω 137» — оба слоя', desc: 'буквы 35% + словарь; λέγω = словарная форма (леммы). 137 слов в словаре.', pct: 35, words: 'lemma', count: 137 },
      { id: 'forms',   label: '«α35% · λέγει 137» — оба слоя, формы', desc: 'то же, но слой слов в режиме реальных форм оригинала (λέγει вместо λέγω).', pct: 35, words: 'forms', count: 137 },
      { id: 'offline', label: '«α35% · —» — словарь без данных', desc: 'слой слов включён, но греческий текст недоступен (нет сети/данных). Словарные замены не работают.', pct: 35, words: 'offline' },
      { id: 'greek',   label: '«Греч» — вкладка «Греческий»', desc: 'греческий текст как основной.' },
    ];
  }

  function getLiveChipState(state) {
    const pct = Math.round(state.intensity * 100);
    if (pct === 0 && state.mode < 4) return { id: 'rus' };
    if (state.mode === 4) return { id: 'greek' };
    if (state.mode === 1) return { id: 'alpha', pct: pct };
    const words = state.mode === 2 ? 'lemma' : 'forms';
    return { id: words, pct: pct, words: words, count: state.readerAddedSet.size };
  }

  /** Списки для настроек */
  const THEME_LIST    = ['Пергамент','Сепия','Слоновая кость','Туман','Море','Лес','Роза','Лаванда','Закат','Тёмная','Ночь','Уголь'];
  const CONTRAST_LIST = ['Мягкий','Чёткий','Максимальный'];

  window.RU2GR_UTILS = {
    // Цвет
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    mixColor: mixColor,
    colorLuminance: colorLuminance,
    alpha: alpha,
    // Палитры
    buildReaderPalette: buildReaderPalette,
    buildReaderWordPalette: buildReaderWordPalette,
    // Текст
    hashString: hashString,
    buildTokens: buildTokens,
    plainFromTokens: plainFromTokens,
    // Формат
    formatNum: formatNum,
    // Иконки
    iconPath: iconPath,
    iconRead: iconRead,
    iconWords: iconWords,
    iconInfo: iconInfo,
    iconEye: iconEye,
    iconGear: iconGear,
    iconChev: iconChev,
    iconChevH: iconChevH,
    iconSearch: iconSearch,
    iconEyeSmall: iconEyeSmall,
    iconX: iconX,
    iconCaret: iconCaret,
    // Чипы
    getChipStates: getChipStates,
    getLiveChipState: getLiveChipState,
    // Константы
    THEME_LIST: THEME_LIST,
    CONTRAST_LIST: CONTRAST_LIST,
  };
})();
