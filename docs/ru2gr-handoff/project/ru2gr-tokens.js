/**
 * ru2gr-tokens.js — единый источник дизайн-токенов для всех экранов.
 * Загружается один раз и доступен как window.RU2GR.THEMES.
 * Оба DC обращаются к THEMES через buildThemes() и к общей контраст-палитре
 * через buildPalette(THEMES, theme, contrast).
 */
(function () {
  function a(hex, al) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + al + ')';
  }
  function mk(o) {
    return {
      paper:      o.paper,
      paper2:     o.alt,
      sidebar:    o.alt,
      read:       o.read,
      titlebar:   o.title,
      ink:        o.ink,
      inkSoft:    o.inkSoft,
      muted:      o.muted,
      muted2:     o.muted2,
      line:       a(o.ink, 0.10),
      line2:      a(o.ink, 0.18),
      blue:       o.blue,
      blueHead:   o.blue,
      blueBg:     o.blueBg,
      blueTx:     o.blueTx,
      terra:      o.terra,
      terraSoft:  o.terraSoft,
      green:      o.green,
      greenDk:    o.greenDk,
      greenBg:    o.greenBg,
    };
  }

  var THEMES = {
    'Пергамент':      mk({paper:'#ECE7DD',alt:'#E7E1D3',read:'#F6F3EE',title:'#E2DBCB',ink:'#272320',inkSoft:'#4a463e',muted:'#9a9488',muted2:'#bdb6a7',blue:'#2f5d85',blueBg:'#cdd9e6',blueTx:'#345f82',terra:'#bb763c',terraSoft:'#e7d3bf',green:'#7c9d5b',greenDk:'#5f7d44',greenBg:'#d9e3c9'}),
    'Сепия':          mk({paper:'#E9DFC8',alt:'#E2D6BB',read:'#F4ECD9',title:'#DBCEB0',ink:'#36291a',inkSoft:'#574630',muted:'#998966',muted2:'#c1b08d',blue:'#39627a',blueBg:'#d2dbdb',blueTx:'#39627a',terra:'#b3652b',terraSoft:'#e7cea9',green:'#7c8f46',greenDk:'#5e7033',greenBg:'#dedcb8'}),
    'Слоновая кость': mk({paper:'#FAF8F3',alt:'#F1EEE6',read:'#FFFFFF',title:'#EFEBE1',ink:'#2a2722',inkSoft:'#514c43',muted:'#9b9488',muted2:'#c7c0b2',blue:'#2f5d85',blueBg:'#d8e3ef',blueTx:'#2f5d85',terra:'#c0723a',terraSoft:'#f1dac2',green:'#6f9a4f',greenDk:'#547d35',greenBg:'#e1ead0'}),
    'Туман':          mk({paper:'#E8E8EB',alt:'#DFDFE3',read:'#F4F4F7',title:'#DBDBDF',ink:'#25262b',inkSoft:'#45474e',muted:'#8a8c95',muted2:'#b6b8c0',blue:'#3a5f8a',blueBg:'#d4ddeb',blueTx:'#3a5f8a',terra:'#b06a45',terraSoft:'#e8d2c6',green:'#5f8f6a',greenDk:'#487553',greenBg:'#d4e4d8'}),
    'Море':           mk({paper:'#E2ECF0',alt:'#D7E4EA',read:'#F0F7F9',title:'#D1E0E7',ink:'#1f2a30',inkSoft:'#3c4b53',muted:'#7f939c',muted2:'#aec0c8',blue:'#2c6e8f',blueBg:'#cadfe9',blueTx:'#2c6e8f',terra:'#c07a45',terraSoft:'#edd7c3',green:'#5e9080',greenDk:'#467467',greenBg:'#cee5dd'}),
    'Лес':            mk({paper:'#E6EADD',alt:'#DCE2D0',read:'#F2F5EC',title:'#D7DEC8',ink:'#232a1f',inkSoft:'#424a39',muted:'#899078',muted2:'#b6bda6',blue:'#3a6079',blueBg:'#d2dde1',blueTx:'#3a6079',terra:'#b07239',terraSoft:'#e6d3b9',green:'#5f8240',greenDk:'#496630',greenBg:'#d8e2c2'}),
    'Роза':           mk({paper:'#F1E4E1',alt:'#EBD8D5',read:'#FAF1EF',title:'#E7D1CD',ink:'#2e2422',inkSoft:'#54443f',muted:'#a08c87',muted2:'#cbb4ae',blue:'#5a5f93',blueBg:'#dedaed',blueTx:'#5a5f93',terra:'#bb5e54',terraSoft:'#edccc6',green:'#7e9a5e',greenDk:'#5f7a43',greenBg:'#dee5ca'}),
    'Лаванда':        mk({paper:'#E9E5F0',alt:'#E1DBEC',read:'#F5F2FA',title:'#DDD6EB',ink:'#28242e',inkSoft:'#494456',muted:'#908aa0',muted2:'#bcb4cc',blue:'#5258a0',blueBg:'#dddaf1',blueTx:'#5258a0',terra:'#b06a8a',terraSoft:'#ebd1dc',green:'#6f9266',greenDk:'#547349',greenBg:'#dae7d4'}),
    'Закат':          mk({paper:'#F0E2D4',alt:'#E9D6C3',read:'#FBEFE0',title:'#E5CEB5',ink:'#34261c',inkSoft:'#5a4632',muted:'#a4876c',muted2:'#ccb191',blue:'#44708a',blueBg:'#d5e0e5',blueTx:'#44708a',terra:'#c4622f',terraSoft:'#f0d0b1',green:'#8a934a',greenDk:'#6c7434',greenBg:'#e2e2bc'}),
    'Тёмная':         mk({paper:'#26231d',alt:'#2e2a23',read:'#201d18',title:'#322d25',ink:'#ece6da',inkSoft:'#c4bdae',muted:'#8f897b',muted2:'#6c6659',blue:'#5a93cc',blueBg:'#2a3f50',blueTx:'#9cc3e2',terra:'#d99a5f',terraSoft:'#463524',green:'#84b25f',greenDk:'#a9cf86',greenBg:'#33402a'}),
    'Ночь':           mk({paper:'#1b2230',alt:'#222b3b',read:'#161c28',title:'#25303f',ink:'#e3e9f2',inkSoft:'#b3bdcd',muted:'#7e879a',muted2:'#5b6577',blue:'#5fa0d6',blueBg:'#26384f',blueTx:'#a6cdef',terra:'#d99a5f',terraSoft:'#463524',green:'#84b25f',greenDk:'#a9cf86',greenBg:'#2a3a28'}),
    'Уголь':          mk({paper:'#1f1f21',alt:'#28282b',read:'#19191b',title:'#2c2c2f',ink:'#ededee',inkSoft:'#c2c2c4',muted:'#8d8d90',muted2:'#66666a',blue:'#5aa0d0',blueBg:'#2b3a47',blueTx:'#9fcbe8',terra:'#d8924f',terraSoft:'#443323',green:'#84b25f',greenDk:'#aad187',greenBg:'#2c3a27'}),
  };

  function hexToRgb(hex){var n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];}
  function rgbToHex(arr){function c(v){return ('0'+Math.round(Math.max(0,Math.min(255,v))).toString(16)).slice(-2);}return '#'+c(arr[0])+c(arr[1])+c(arr[2]);}
  function mix(x,y,t){var A=hexToRgb(x),B=hexToRgb(y);return rgbToHex([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t]);}
  function lum(hex){var v=hexToRgb(hex);return (0.299*v[0]+0.587*v[1]+0.114*v[2])/255;}

  // Contrast-aware palette — shared builder (was duplicated only inside «Слова»).
  // base theme + contrast level → resolved palette with elevation/recession surfaces.
  function buildPalette(THEMES, themeName, contrastName) {
    var base = THEMES[themeName] || THEMES['Пергамент'];
    var lvlName = contrastName || 'Чёткий';
    var LV = {'Мягкий':{rec:0.05,elv:0.42},'Чёткий':{rec:0.11,elv:0.72},'Максимальный':{rec:0.185,elv:1.0}}[lvlName] || {rec:0.11,elv:0.72};
    var dark = lum(base.paper) < 0.5;
    var elvAmt = dark ? LV.elv*0.17 : LV.elv;
    var recAmt = dark ? LV.rec*0.75 : LV.rec;
    function elevate(hex,t){return mix(hex,'#ffffff',t);}
    function recess(hex,t){return mix(hex,'#000000',t);}
    var C = Object.assign({}, base);
    C.content  = elevate(base.paper, elvAmt*0.30);
    C.card     = elevate(base.paper, elvAmt);
    C.sidebar  = recess(base.paper, recAmt);
    C.titlebar = recess(base.paper, recAmt*1.45);
    C.read     = elevate(base.paper, elvAmt);
    C.line     = a(base.ink, dark?0.13:0.09);
    C.line2    = a(base.ink, dark?0.22:0.16);
    C.cardLine = a(base.ink, dark?0.18:0.13);
    C.shadow   = dark ? '0 2px 10px -2px rgba(0,0,0,.55)' : '0 1px 3px rgba(40,34,22,.10),0 10px 26px -14px rgba(40,34,22,.24)';
    C.paper2   = C.card;
    return C;
  }

  window.RU2GR = { THEMES: THEMES, a: a, buildPalette: buildPalette, hexToRgb: hexToRgb, rgbToHex: rgbToHex, mix: mix, lum: lum };
})();
