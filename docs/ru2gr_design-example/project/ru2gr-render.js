/**
 * ru2gr-render.js — методы рендеринга (дизайн / UI).
 * Назначаются на Component.prototype через Object.assign.
 * Каждый метод использует this.* (CR, CRW, state, sans, serif, …).
 * Доступен как window.RU2GR_RENDER.
 */
(function () {
  var U = window.RU2GR_UTILS;
  var R = {};

  /* ================================================================
   * ДИЗАЙН-ТОКЕНЫ (извлечены claude-design-adapter)
   * Константы, не зависящие от темы. Цвета — в ru2gr-tokens.js.
   * ================================================================ */
  var TK = {
    // Типографика
    fsBody: 16, fsLabel: 11, fsSec: 18, fsChip: 13.5, fsDesc: 12, fsMeta: 11.5,
    fwActive: 700, fwInactive: 500, fwEmphasis: 600,
    lhTight: 1, lhProse: 1.55, lhVerse: 1.72,
    lsLabel: '0.12em', lsChip: '0.03em',
    // Пространственные
    radius: 10, radiusSm: 7, radiusLg: 16,
    chipPad: '5px 11px', chipHPad: '6px 11px', chipHeight: 30, chipMinHeight: 30,
    sheetTopRadius: '26px 26px 0 0',
    topBtnSize: 36, sheetBtnSize: 36, inspBtnSize: 32, iconBtnSize: 32,
    deskContentWidth: 700, deskContentPad: '34px 44px 70px',
    segPad: 3, segGap: 2, itemGap: 8, rowGap: 10, panelGap: 12,
    barHeight: 3, dividerWidth: 1,
    navWidth: 236, inspWidth: 364,
  };

  /* ================================================================
   * 2b — статус-бар
   * ================================================================ */

  R.renderStatusBar = function (C) {
    var h = React.createElement;
    var bars = [5,7,9,11].map(function(ht,i){ return h('rect',{key:i,x:i*4,y:11-ht,width:2.6,height:ht,rx:0.8,fill:C.ink}); });
    var signal = h('svg',{width:17,height:11,viewBox:'0 0 17 11'},...bars);
    var wifi = h('svg',{width:16,height:11,viewBox:'0 0 16 11',fill:'none',stroke:C.ink,strokeWidth:1.4,strokeLinecap:'round'},
      h('path',{d:'M2 4.2C4 2.6 6 1.8 8 1.8s4 .8 6 2.4'}),
      h('path',{d:'M4 6.4C5.2 5.4 6.6 5 8 5s2.8.4 4 1.4'}),
      h('circle',{cx:8,cy:9,r:1,fill:C.ink,stroke:'none'}));
    var batt = h('svg',{width:26,height:12,viewBox:'0 0 26 12'},
      h('rect',{x:0.6,y:0.6,width:21,height:10.8,rx:3,fill:'none',stroke:U.alpha(C.ink,0.45),strokeWidth:1.2}),
      h('rect',{x:2.4,y:2.4,width:16,height:7.2,rx:1.6,fill:C.ink}),
      h('rect',{x:23,y:3.6,width:2,height:4.8,rx:1,fill:U.alpha(C.ink,0.5)}));
    return h('div',{'data-section':'phone-status-bar',style:{flex:'0 0 auto',height:46,display:'flex',alignItems:'flex-end',justifyContent:'space-between',padding:'0 26px 7px',fontFamily:this.sans,fontSize:15,fontWeight:600,color:C.ink}},
      h('div',null,'9:41'),
      h('div',{style:{display:'flex',gap:7,alignItems:'center'}},signal,wifi,batt));
  };

  R.readerRenderStatusBar = function () { return this.renderStatusBar(this.CR); };

  /* ---------- top header ---------- */

  R.readerSegmentEl = function (small) {
    var h = React.createElement, C = this.CR, m = this.state.mode;
    return h('div',{style:{display:'flex',gap:2,background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:TK.radius,padding:3}},
      [1,2,3,4].map(function(n){ return h('button',{key:n,onClick:function(e){e.stopPropagation();this.readerSetMode(n);}.bind(this),style:{width:small?26:30,height:small?26:30,border:'none',cursor:'pointer',borderRadius:8,fontFamily:this.sans,fontSize:small?13:14,fontWeight:700,background:n===m?C.ink:'transparent',color:n===m?C.paper:C.muted,transition:'all .15s'}},n); },this));
  };

  R.readerModeBarEl = function (small) {
    var C = this.CR, h = React.createElement, m = this.state.mode;
    var segH = small?3:4, segW = small?22:28;
    var label = h('div',{style:{fontFamily:this.sans,fontSize:small?10.5:12,fontWeight:700,color:C.ink,textAlign:'center',marginBottom:small?4:5,letterSpacing:'0.01em'}},this.modeShort[m-1]);
    var segs = h('div',{style:{display:'flex',gap:3}},
      [1,2,3,4].map(function(n){ return h('button',{key:n,onClick:function(e){e.stopPropagation();this.readerSetMode(n);}.bind(this),title:this.modeNames[n-1],style:{width:segW,height:segH,border:'none',borderRadius:segH,background:n<=m?C.terra:U.alpha(C.ink,0.14),cursor:'pointer',padding:0,transition:'background .2s ease'}}); },this));
    return h('div',{style:{display:'flex',flexDirection:'column',alignItems:'center'}},label,segs);
  };

  R.readerRenderTopHeader = function () {
    var h = React.createElement, C = this.CR, st = this.state, self = this;
    var bookRow = h('div',{style:{display:'flex',alignItems:'center',gap:10,padding:'9px 18px 11px'}},
      h('button',{'data-section':'desk-top--book-btn',onClick:function(){self.readerShowToast('Выбор книги — в полной версии');},style:{display:'flex',alignItems:'baseline',gap:8,background:'none',border:'none',cursor:'pointer',padding:0,color:C.ink,fontFamily:this.serif,whiteSpace:'nowrap',flex:'0 0 auto'}},
        h('span',{style:{fontSize:23,fontWeight:700,letterSpacing:'-0.01em',whiteSpace:'nowrap'}},'Иоанн,'),
        h('span',{style:{fontFamily:this.serif,fontSize:18,color:C.inkSoft,fontWeight:700,whiteSpace:'nowrap'}},'1'),
        h('span',{style:{transform:'translateY(2px)',flex:'0 0 auto'}},U.iconChev(C.muted))),
      h('div',{style:{flex:1,display:'flex',justifyContent:'center'}},h('button',{onClick:function(e){e.stopPropagation();var wl=st.mode===1?'off':st.mode===2?'lemma':'form';self.setState({dropdown:!st.dropdown,readerWordLayer:wl});},style:{background:'none',border:'none',cursor:'pointer',padding:0}},this.readerChipH1(this.readerLiveChipState()))),
      h('div',{style:{display:'flex',gap:6,alignItems:'center',flex:'0 0 auto'}},
        h('button',{'data-section':'desk-top--simple-view-btn',onClick:function(){self.readerToggleSimple();},title:'Простой вид',style:{width:TK.topBtnSize,height:TK.topBtnSize,borderRadius:TK.radius,border:'1px solid '+(st.simpleView?U.alpha(C.terra,0.4):C.line),background:st.simpleView?U.alpha(C.terra,0.12):U.alpha(C.ink,0.03),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},U.iconEye(st.simpleView?C.terra:C.inkSoft,st.simpleView)),
        h('button',{'data-section':'desk-top--intensity-btn',onClick:function(){self.setState({intensityOpen:!st.intensityOpen});},title:'Настройки замены',style:{width:TK.topBtnSize,height:TK.topBtnSize,borderRadius:TK.radius,border:'1px solid '+C.line,background:U.alpha(C.ink,0.03),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:2.5,flexDirection:'row'}},
          [0,1,2].map(function(i){ return h('span',{key:i,style:{width:3.5,height:3.5,borderRadius:'50%',background:C.inkSoft,display:'block'}}); }))));
    return h('div',{'data-section':'phone-top-header',style:{position:'sticky',top:0,zIndex:6,background:C.paper,borderBottom:'1px solid '+C.line,backdropFilter:'blur(6px)'}},bookRow);
  };

  /* ---------- reading text ---------- */

  R.readerRenderRuLetters = function (text, key) {
    var C = this.CR, h = React.createElement, self = this;
    if (this.state.simpleView || this.state.mode !== 1) return text;
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i], low = ch.toLowerCase(), gl = this.r2g[low];
      if (gl && U.hashString(key + '_' + i) < this.state.intensity) {
        var up = ch !== low, glyph = up ? this.LET[gl].u : gl;
        out.push(h('span',{key:i,role:'button',tabIndex:0,onClick:function(e){e.stopPropagation();self.readerOpenLetter(gl);},onKeyDown:function(e){if(e.key==='Enter'){e.stopPropagation();self.readerOpenLetter(gl);}},style:{color:C.blue,cursor:'pointer',borderBottom:'1px dotted '+U.alpha(C.blue,0.45),outline:'none'}},glyph));
      } else out.push(ch);
    }
    return out;
  };

  R.readerRenderToken = function (t, vi, ti, greek) {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    if (greek) {
      if (t.kind === 'align') {
        var added = this.readerIsAdded(t.id);
        return h(React.Fragment,{key:ti},
          h('span',{role:'button',tabIndex:0,onClick:function(){self.readerOpenWordById(t.id,t.form||t.ru);},onKeyDown:function(e){if(e.key==='Enter')self.readerOpenWordById(t.id,t.form||t.ru);},style:{color:added?C.terra:C.ink,cursor:'pointer',borderBottom:'1px dotted '+U.alpha(added?C.terra:C.ink,0.4),outline:'none'}},t.ru),
          t.trail ? h('span',null,t.trail) : null);
      }
      return h(React.Fragment,{key:ti},t.text);
    }
    if (t.kind === 'align') {
      var added2 = this.readerIsAdded(t.id), a = this.A[t.id] || {};
      if (!st.simpleView && st.mode >= 2 && added2) {
        var disp = st.mode === 2 ? a.lemma : (t.form || a.defaultForm || a.lemma);
        return h(React.Fragment,{key:ti},
          h('span',{role:'button',tabIndex:0,onClick:function(){self.readerOpenWordById(t.id,disp);},onKeyDown:function(e){if(e.key==='Enter')self.readerOpenWordById(t.id,disp);},style:{color:C.terra,cursor:'pointer',borderBottom:'1px dotted '+U.alpha(C.terra,0.45),outline:'none'}},disp),
          t.trail ? h('span',null,t.trail) : null);
      }
      return h(React.Fragment,{key:ti},
        h('span',{style:st.simpleView?null:{borderBottom:'1px dotted '+U.alpha(C.ink,0.18)}},this.readerRenderRuLetters(t.ru,vi+'-'+ti)),
        t.trail ? h('span',null,t.trail) : null);
    }
    return h(React.Fragment,{key:ti},this.readerRenderRuLetters(t.text,vi+'-'+ti));
  };

  R.readerRenderVerse = function (v, vi) {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    var greek = st.mode === 4 && !st.simpleView;
    var toks = greek ? v.g : v.tokens;
    var num = h('sup',{style:{color:C.muted2,fontSize:'0.6em',fontWeight:700,marginRight:5,fontFamily:this.sans,verticalAlign:'0.55em'}},v.n);
    var nodes = [num];
    toks.forEach(function(t,ti){ nodes.push(self.readerRenderToken(t,vi,ti,greek)); nodes.push(' '); });
    var main = h('div',{style:{fontFamily:this.serif,fontSize:greek?20:18.5,lineHeight:greek?1.55:1.72,color:C.ink,letterSpacing:greek?'0':'0'}},nodes);
    if (greek) {
      return h('div',{key:vi,style:{marginBottom:17}},main,
        h('div',{style:{fontFamily:this.serif,fontSize:14.5,color:C.muted,marginTop:3,lineHeight:1.5}},
          h('sup',{style:{fontSize:'0.7em',fontFamily:this.sans,marginRight:3}},v.n),v.plain));
    }
    return h('div',{key:vi,style:{marginBottom:'0.5em',display:'inline'}},main);
  };

  R.readerRenderRead = function () {
    var C = this.CR, h = React.createElement, self = this;
    var verses = this.verses.map(function(v,i){ return self.readerRenderVerse(v,i); });
    var contNodes = this.cont.map(function(v,i){ return h('span',{key:i,style:{fontFamily:self.serif,fontSize:18.5,lineHeight:1.72,color:C.ink}},h('sup',{style:{color:C.muted2,fontSize:'0.6em',fontWeight:700,marginRight:5,fontFamily:self.sans,verticalAlign:'0.55em'}},v.n),v.ru+' '); });
    var cont = h('div',{style:{marginTop:8,maskImage:'linear-gradient(180deg,#000 0%,transparent 88%)',WebkitMaskImage:'linear-gradient(180deg,#000 0%,transparent 88%)'}},contNodes);
    return h('div',{'data-section':'phone-reading',className:'scScroll',style:{flex:1,minHeight:0,overflowY:'auto',position:'relative',background:C.read}},
      this.readerRenderTopHeader(),
      h('div',{style:{padding:'18px 22px 60px'}},
        h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:C.muted2,marginBottom:14}},'Евангелие от Иоанна · глава 1'),
        verses,cont));
  };

  /* ---------- dictionary ---------- */

  R.readerRenderDict = function () { return this.readerRenderWordPhoneContent(); };

  R.readerRenderWordPhoneContent = function () {
    var C = this.CRW, h = React.createElement, self = this, st = this.state;
    return h('div',{'data-section':'phone-dict',style:{flex:1,display:'flex',flexDirection:'column',minHeight:0,background:C.content}},
      h('div',{style:{flex:'0 0 auto',padding:'2px 18px 11px',background:C.card,borderBottom:'1px solid '+C.cardLine,boxShadow:'0 6px 18px -14px rgba(40,34,22,.45)',position:'relative',zIndex:5}},
        h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',height:44}},
          h('div',{style:{fontFamily:this.serif,fontSize:24,fontWeight:700,color:C.ink}},'Словарь'),
          h('div',{style:{fontFamily:this.sans,fontSize:12,color:C.muted}},this.readerWordGetFiltered().length+' слов')),
        h('div',{style:{marginBottom:9}},this.readerWordSearchBar(true)),
        h('div',{style:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}},
          this.readerWordSV3(),
          this.readerWordPosDropdown(true),
          this.readerWordShowInTextCbx())),
      h('div',{id:'readerPhoneWordList',className:'scScroll',style:{flex:1,overflowY:'auto',padding:'0 18px'}},
        this.readerWordWListBody(80)));
  };

  R.readerRenderWordPhoneSheet = function () {
    var C = this.CRW, h = React.createElement, st = this.state, self = this;
    if (!st.readerWordSheetOpen || !st.readerWordActiveKey) return null;
    return h('div',{'data-section':'phone-word-phone-sheet',key:'rwsheet',style:{position:'absolute',inset:0,zIndex:30}},
      h('div',{onClick:function(){self.readerWordCloseCard();},style:{position:'absolute',inset:0,background:U.alpha('#15140f',.28),animation:'scFade .2s ease'}}),
      h('div',{onClick:function(e){e.stopPropagation();},style:{position:'absolute',left:0,right:0,bottom:0,maxHeight:'84%',background:C.card,borderRadius:'24px 24px 0 0',boxShadow:'0 -14px 50px -10px rgba(40,34,22,.38)',display:'flex',flexDirection:'column',animation:'scSheetUp .3s cubic-bezier(.22,1,.36,1)'}},
        h('div',{style:{flex:'0 0 auto',display:'flex',justifyContent:'center',paddingTop:10}},h('div',{style:{width:36,height:4,borderRadius:3,background:C.line2}})),
        h('div',{className:'scScroll',style:{overflowY:'auto'}},this.readerWordWCard(st.readerWordActiveKey))));
  };

  /* ---------- about ---------- */

  R.readerRenderAbout = function () {
    var C = this.CR, h = React.createElement, self = this;
    var lic = function(t,s){ return h('div',{'data-section':'phone-about',style:{padding:'13px 0',borderBottom:'1px solid '+C.line}},h('div',{style:{fontFamily:self.serif,fontSize:16,color:C.ink,fontWeight:700}},t),h('div',{style:{fontFamily:self.sans,fontSize:13,color:C.muted,marginTop:2}},s)); };
    return h('div',{className:'scScroll',style:{flex:1,minHeight:0,overflowY:'auto'}},
      h('div',{style:{padding:'26px 22px 60px'}},
        h('div',{style:{fontFamily:this.serif,fontSize:26,fontWeight:700,color:C.ink}},'О приложении'),
        h('div',{style:{fontFamily:this.sans,fontSize:13.5,color:C.muted,marginTop:4,marginBottom:6}},'Версия 1.0.0 · работает офлайн (PWA)'),
        h('p',{style:{fontFamily:this.serif,fontSize:16,lineHeight:1.6,color:C.inkSoft,marginBottom:18}},'Спокойная читалка Нового Завета, в которой греческий постепенно проступает сквозь русский Синодальный перевод — в темпе, который вы задаёте сами.'),
        h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:C.muted,marginBottom:2}},'Данные и лицензии'),
        lic('SBLGNT','Греческий текст · CC-BY 4.0'),
        lic('Синодальный перевод','Русский текст · public domain'),
        lic('Gentium Plus','Шрифт · SIL Open Font License'),
        lic('bolls.life','Источник данных API'),
        h('div',{onClick:function(){self.readerShowToast('Ссылка откроется в браузере');},style:{marginTop:20,display:'inline-flex',alignItems:'center',gap:8,fontFamily:this.sans,fontSize:14,fontWeight:600,color:C.blue,cursor:'pointer'}},'Открыть на GitHub',U.iconChev(C.blue))));
  };

  /* ---------- settings ---------- */

  R.readerThemeList = function () { return U.THEME_LIST; };
  R.readerContrastList = function () { return U.CONTRAST_LIST; };

  R.readerRenderSettings = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    var themes = this.readerThemeList();
    var contrasts = this.readerContrastList();
    var themeChip = function(key){ var t = self.THEMES[key]; var on = st.readerTheme === key; return h('button',{key:key,onClick:function(){self.setState({readerTheme:key});},style:{display:'flex',flexDirection:'column',alignItems:'center',gap:5,padding:'10px 6px 12px',borderRadius:12,border:'2px solid '+(on?C.terra:C.line),background:on?U.alpha(C.terra,0.06):'transparent',cursor:'pointer',transition:'all .15s',flex:'1 1 calc(33.333% - 8px)',minWidth:0}},
      h('div',{style:{width:'100%',height:32,borderRadius:7,background:t.paper,border:'1px solid '+U.alpha(C.ink,0.12),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}, h('span',{style:{fontFamily:self.serif,fontSize:18,color:t.ink,lineHeight:1}},'αβ')),
      h('span',{style:{fontFamily:self.sans,fontSize:11,fontWeight:on?700:500,color:on?C.ink:C.muted,whiteSpace:'nowrap',textOverflow:'ellipsis',overflow:'hidden',maxWidth:'100%'}},key)); };
    return h('div',{'data-section':'phone-settings',className:'scScroll',style:{flex:1,minHeight:0,overflowY:'auto',background:C.read}},
      h('div',{style:{padding:'18px 20px 60px'}},
        h('div',{style:{fontFamily:this.serif,fontSize:24,fontWeight:700,color:C.ink,marginBottom:18}},'Настройки'),
        h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.13em',textTransform:'uppercase',color:C.muted,marginBottom:10}},'Тема'),
        h('div',{style:{display:'flex',flexWrap:'wrap',gap:8,marginBottom:22}}, themes.map(themeChip)),
        h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.13em',textTransform:'uppercase',color:C.muted,marginBottom:10}},'Контраст'),
        h('div',{style:{display:'inline-flex',background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:10,padding:3}},
          contrasts.map(function(ct){ var on = st.readerContrast === ct; return h('button',{key:ct,onClick:function(){self.setState({readerContrast:ct});},style:{padding:'8px 16px',borderRadius:7,border:'none',background:on?C.paper:'transparent',color:on?C.ink:C.muted,boxShadow:on?C.shadow:'none',fontFamily:self.sans,fontSize:13,fontWeight:on?700:600,cursor:'pointer',whiteSpace:'nowrap',transition:'background .12s,color .12s'}},ct); }))));
  };

  R.readerRenderDeskSettings = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    var themes = this.readerThemeList();
    var contrasts = this.readerContrastList();
    var themeChip = function(key){ var t = self.THEMES[key]; var on = st.readerTheme === key; return h('button',{key:key,onClick:function(){self.setState({readerTheme:key});},style:{display:'flex',flexDirection:'column',alignItems:'center',gap:5,padding:'12px 8px 14px',borderRadius:12,border:'2px solid '+(on?C.terra:C.line),background:on?U.alpha(C.terra,0.06):'transparent',cursor:'pointer',transition:'all .15s',flex:'1 1 calc(25% - 9px)',minWidth:0}},
      h('div',{style:{width:'100%',height:TK.topBtnSize,borderRadius:8,background:t.paper,border:'1px solid '+U.alpha(C.ink,0.12),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}, h('span',{style:{fontFamily:self.serif,fontSize:20,color:t.ink,lineHeight:1}},'αβ')),
      h('span',{style:{fontFamily:self.sans,fontSize:12,fontWeight:on?700:500,color:on?C.ink:C.muted,whiteSpace:'nowrap',textOverflow:'ellipsis',overflow:'hidden',maxWidth:'100%'}},key)); };
    return h('div',{'data-section':'desk-settings',style:{flex:1,minWidth:0,display:'flex',flexDirection:'column'}},
      h('div',{className:'scScroll',style:{flex:1,overflowY:'auto',background:C.read}},
        h('div',{style:{maxWidth:TK.deskContentWidth,margin:'0 auto',padding:TK.deskContentPad}},
          h('div',{style:{fontFamily:this.serif,fontSize:26,fontWeight:700,color:C.ink,marginBottom:22}},'Настройки'),
          h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:C.muted,marginBottom:12}},'Тема'),
          h('div',{style:{display:'flex',flexWrap:'wrap',gap:10,marginBottom:28}}, themes.map(themeChip)),
          h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:C.muted,marginBottom:12}},'Контраст'),
          h('div',{style:{display:'inline-flex',background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:TK.radius,padding:4}},
            contrasts.map(function(ct){ var on = st.readerContrast === ct; return h('button',{key:ct,onClick:function(){self.setState({readerContrast:ct});},style:{padding:'9px 20px',borderRadius:8,border:'none',background:on?C.paper:'transparent',color:on?C.ink:C.muted,boxShadow:on?C.shadow:'none',fontFamily:self.sans,fontSize:14,fontWeight:on?700:600,cursor:'pointer',whiteSpace:'nowrap',transition:'background .12s,color .12s'}},ct); })))));
  };

  /* ---------- bottom nav ---------- */

  R.readerRenderBottomNav = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    var items = [['read','Читать',U.iconRead.bind(null)],['dict','Слова',U.iconWords.bind(null)],['settings','Настр',U.iconGear.bind(null)],['about','О',U.iconInfo.bind(null)]];
    return h('div',{'data-section':'phone-bottom-nav',style:{flex:'0 0 auto',display:'flex',borderTop:'1px solid '+C.line,background:U.alpha(C.paper,0.96),paddingBottom:18,backdropFilter:'blur(8px)'}},
      items.map(function(it){ var on = st.tab === it[0]; var col = on ? C.ink : C.muted2; return h('button',{key:it[0],onClick:function(){self.setState({tab:it[0],dropdown:false,intensityOpen:false});},style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'11px 0 4px',background:'none',border:'none',cursor:'pointer'}},it[2](col),h('span',{style:{fontFamily:self.sans,fontSize:11,fontWeight:on?700:500,color:col}},it[1])); }));
  };

  /* ---------- overlays ---------- */

  R.readerRenderModeMenu = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    if (!st.dropdown) return null;
    return h('div',{'data-section':'phone-mode-menu',key:'dd',style:{position:'absolute',inset:0,zIndex:20}},
      h('div',{onClick:function(){self.setState({dropdown:false});},style:{position:'absolute',inset:0,background:U.alpha('#15140f',0.18)}}),
      h('div',{style:{position:'absolute',top:150,left:14,right:14,animation:'scPop .16s ease'}},this.readerModeMenuList()));
  };

  R.readerRenderIntensity = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    if (!st.intensityOpen) return null;
    return h('div',{'data-section':'phone-intensity',key:'int',style:{position:'absolute',inset:0,zIndex:20}},
      h('div',{onClick:function(){self.setState({intensityOpen:false});},style:{position:'absolute',inset:0}}),
      h('div',{style:{position:'absolute',top:92,right:14,width:262,background:C.paper,border:'1px solid '+C.line2,borderRadius:TK.radiusLg,boxShadow:'0 22px 46px -16px rgba(40,34,22,0.5)',padding:'15px 16px',animation:'scPop .16s ease'}},
        h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}},
          h('span',{style:{fontFamily:this.sans,fontSize:13,fontWeight:700,color:C.ink}},'Интенсивность букв'),
          h('span',{style:{fontFamily:this.sans,fontSize:13,fontWeight:700,color:C.terra}},Math.round(st.intensity*100)+'%')),
        h('div',{style:{fontFamily:this.sans,fontSize:11.5,color:C.muted,marginBottom:10}},'Сколько русских букв заменяется греческими · влияет на Режим 1'),
        h('input',{type:'range',min:0,max:100,value:Math.round(st.intensity*100),onChange:function(e){self.setState({intensity:(+e.target.value)/100,mode:self.state.mode===1?1:self.state.mode});},style:{width:'100%',accentColor:C.terra,cursor:'pointer'}}),
        st.mode !== 1 ? h('div',{style:{marginTop:9,fontFamily:this.sans,fontSize:11.5,color:C.muted2,display:'flex',gap:6,alignItems:'center'}},'Активно в Режиме 1 ·',h('button',{onClick:function(){self.readerSetMode(1);},style:{background:'none',border:'none',color:C.blue,fontWeight:600,cursor:'pointer',fontSize:11.5,padding:0,fontFamily:this.sans}},'перейти')) : null));
  };

  R.readerRenderToast = function () {
    var C = this.CR, h = React.createElement;
    if (!this.state.readerToast) return null;
    return h('div',{'data-section':'toast',key:'toast',style:{position:'absolute',left:'50%',bottom:96,transform:'translateX(-50%)',zIndex:40,background:U.alpha('#26221c',0.96),color:'#f3eee2',fontFamily:this.sans,fontSize:13.5,fontWeight:500,padding:'11px 18px',borderRadius:13,maxWidth:320,textAlign:'center',boxShadow:'0 14px 34px -10px rgba(0,0,0,0.5)',animation:'scToast .25s ease'}},this.state.readerToast);
  };

  /* ---------- word sheet ---------- */

  R.readerSecLabel = function (t) {
    return React.createElement('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.13em',textTransform:'uppercase',color:this.CR.muted,marginBottom:6,marginTop:18}},t);
  };

  R.readerRenderSection = function (key, cd) {
    var C = this.CR, h = React.createElement;
    if (key === 'gram') { if (!cd.pos) return null; return h('div',{key:key},
      h('div',{style:{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap',marginTop:6}},
        h('span',{style:{fontFamily:this.serif,fontSize:16,color:C.inkSoft}},cd.pos),
        cd.strong ? h('span',{style:{fontFamily:this.sans,fontSize:13,color:C.muted}},'· '+cd.strong) : null,
        (cd.morph||[]).map(function(m,i){ return h('span',{key:i,style:{fontFamily:this.sans,fontSize:12.5,fontWeight:600,color:C.blueTx,background:C.blueBg,padding:'3px 10px',borderRadius:7}},m); }))); }
    if (key === 'pron') { if (!cd.translit) return null; return h('div',{key:key},this.readerSecLabel('Произношение'),
      h('div',{style:{display:'flex',alignItems:'center',gap:11}},
        h('span',{style:{fontFamily:this.serif,fontSize:19,color:C.ink}},cd.translit),
        h('button',{onClick:function(){this.readerShowToast('Аудио-произношение — в следующей версии');}.bind(this),style:{width:30,height:30,borderRadius:'50%',border:'1px solid '+C.line2,background:'none',cursor:'pointer',opacity:0.5,display:'flex',alignItems:'center',justifyContent:'center'}},h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:C.inkSoft},h('path',{d:'M8 5v14l11-7z'})))),
      h('div',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:13.5,color:C.muted2,marginTop:6}},'Произношение — учебное приближение, не научная реконструкция.')); }
    if (key === 'dict') { if (!cd.lemma || !cd.form || cd.form === cd.lemma) return null; return h('div',{key:key},this.readerSecLabel('Словарная форма'),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'end',gap:'0 14px'}},
        h('span',{style:{fontFamily:this.serif,fontSize:26,color:C.terra,textAlign:'right'}},cd.form),
        h('span',{style:{fontFamily:this.sans,fontSize:18,color:C.muted2,lineHeight:'26px'}},'→'),
        h('span',{style:{fontFamily:this.serif,fontSize:26,color:C.blue}},cd.lemma),
        h('span',{style:{fontFamily:this.sans,fontSize:11,color:C.muted2,textAlign:'right'}},'в тексте'),
        h('span'),
        h('span',{style:{fontFamily:this.sans,fontSize:11,color:C.muted2}},'словарная форма'))); }
    if (key === 'trans') { if (!cd.inThisVerse) return null; return h('div',{key:key},this.readerSecLabel('В этом стихе'),
      h('div',{style:{fontFamily:this.serif,fontSize:24,fontWeight:700,color:C.ink}},cd.inThisVerse)); }
    if (key === 'status') { var cur = this.state.readerStatusMap[cd.key] || 'new'; var opt = [['new','Новое'],['learning','Учу'],['known','Знаю']]; var self = this;
      return h('div',{key:key},this.readerSecLabel('Статус изучения'),
        h('div',{style:{display:'flex',gap:8}},opt.map(function(o){ var on = cur === o[0]; return h('button',{key:o[0],onClick:function(){self.readerSetStatus(cd.key,o[0]);},style:{flex:1,padding:'9px 0',borderRadius:10,border:'1.5px solid '+(on?(o[0]==='known'?C.green:o[0]==='learning'?C.blue:C.line2):C.line),background:on?(o[0]==='known'?C.green:o[0]==='learning'?C.blue:U.alpha(C.ink,0.05)):'transparent',color:on?(o[0]==='new'?C.inkSoft:'#fff'):C.muted,fontFamily:self.sans,fontSize:13.5,fontWeight:600,cursor:'pointer'}},o[1]); }))); }
    if (key === 'mean') { if (!cd.also) return null; return h('div',{key:key},this.readerSecLabel('Также означает'),h('div',{style:{fontFamily:this.serif,fontSize:16.5,lineHeight:1.5,color:C.ink}},cd.also)); }
    if (key === 'defn') { if (!cd.defn) return null; return h('div',{key:key},this.readerSecLabel('Определение'),h('div',{style:{fontFamily:this.serif,fontSize:16.5,lineHeight:1.55,color:C.inkSoft}},cd.defn)); }
    if (key === 'deriv') { if (!cd.deriv) return null; return h('div',{key:key},this.readerSecLabel('Происхождение'),h('div',{style:{fontFamily:this.serif,fontSize:16.5,lineHeight:1.55,color:C.inkSoft}},cd.deriv)); }
    return null;
  };

  R.readerRenderGearMenu = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    if (!st.gearOpen) return null;
    return h('div',{'data-section':'gear-menu',style:{position:'absolute',top:54,right:14,width:250,background:C.paper,border:'1px solid '+C.line2,borderRadius:14,boxShadow:'0 20px 44px -14px rgba(40,34,22,0.5)',padding:'10px 8px',zIndex:30,animation:'scPop .15s ease'}},
      h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.muted,padding:'4px 8px 8px'}},'Разделы карточки'),
      st.cardOrder.map(function(k,i){ var hidden = st.cardHidden.indexOf(k) >= 0; return h('div',{key:k,style:{display:'flex',alignItems:'center',gap:6,padding:'6px 8px'}},
        h('button',{onClick:function(){self.readerToggleSection(k);},style:{flex:1,display:'flex',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}},
          h('span',{style:{width:16,height:16,borderRadius:5,border:'1.5px solid '+(hidden?C.line2:C.terra),background:hidden?'transparent':C.terra,display:'flex',alignItems:'center',justifyContent:'center',flex:'0 0 auto'}},hidden?null:h('svg',{width:11,height:11,viewBox:'0 0 24 24',fill:'none',stroke:'#fff',strokeWidth:3.5,strokeLinecap:'round',strokeLinejoin:'round'},h('path',{d:'M5 12l5 5L20 6'}))),
          h('span',{style:{fontFamily:self.sans,fontSize:13.5,color:hidden?C.muted2:C.ink}},self.secLabels[k])),
        h('button',{onClick:function(){self.readerMoveSection(k,-1);},disabled:i===0,style:{background:'none',border:'none',cursor:i===0?'default':'pointer',opacity:i===0?0.25:0.8,padding:2}},U.iconChev(C.inkSoft,'up')),
        h('button',{onClick:function(){self.readerMoveSection(k,1);},disabled:i===st.cardOrder.length-1,style:{background:'none',border:'none',cursor:'pointer',opacity:i===st.cardOrder.length-1?0.25:0.8,padding:2}},U.iconChev(C.inkSoft,'down'))); }));
  };

  R.readerRenderWordSheet = function () {
    var C = this.CR, h = React.createElement, st = this.state, cd = st.card, self = this;
    if (st.sheet !== 'word' || !cd) return null;
    var visible = st.cardOrder.filter(function(k){ return st.cardHidden.indexOf(k) < 0; });
    return h('div',{'data-section':'phone-word-sheet',key:'wsheet',style:{position:'absolute',inset:0,zIndex:35}},
      h('div',{onClick:function(){self.readerCloseSheet();},style:{position:'absolute',inset:0,background:U.alpha('#15140f',0.34),animation:'scFade .2s ease'}}),
      h('div',{onClick:function(e){e.stopPropagation();},style:{position:'absolute',left:0,right:0,bottom:0,maxHeight:'88%',background:C.paper,borderRadius:TK.sheetTopRadius,boxShadow:'0 -16px 50px -10px rgba(40,34,22,0.4)',display:'flex',flexDirection:'column',animation:'scSheetUp .3s cubic-bezier(.22,1,.36,1)'}},
        h('div',{style:{flex:'0 0 auto',display:'flex',justifyContent:'center',paddingTop:10}},h('div',{style:{width:TK.topBtnSize,height:4.5,borderRadius:3,background:C.line2}})),
        h('div',{className:'scScroll',style:{overflowY:'auto',padding:'8px 24px 30px',position:'relative'}},
          h('div',{style:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginTop:6}},
            h('div',null,
              h('div',{style:{display:'flex',alignItems:'baseline',gap:10}},
                h('span',{style:{fontFamily:this.serif,fontSize:46,fontWeight:400,color:C.blue,lineHeight:1}},cd.form||cd.lemma),
                (cd.rank||cd.freq) ? h('span',{style:{fontFamily:this.sans,fontSize:14,fontWeight:600,color:C.muted,whiteSpace:'nowrap'}},(cd.rank||'')+(cd.rank&&cd.freq?' · ':'')+(cd.freq?cd.freq+'×':'')+(cd.rank?'':' в НЗ')) : null),
            h('div',{style:{display:'flex',gap:6,flex:'0 0 auto'}},
              h('button',{onClick:function(){self.setState({gearOpen:!st.gearOpen});},style:{width:36,height:36,borderRadius:10,border:'1px solid '+C.line,background:st.gearOpen?U.alpha(C.ink,0.06):'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},U.iconGear(C.inkSoft)),
              h('button',{onClick:function(){self.readerCloseSheet();},style:{width:36,height:36,borderRadius:10,border:'1px solid '+C.line,background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},h('svg',{width:17,height:17,viewBox:'0 0 24 24',fill:'none',stroke:C.inkSoft,strokeWidth:2,strokeLinecap:'round'},h('path',{d:'M6 6l12 12M18 6L6 18'}))))),
          this.readerRenderGearMenu(),
          visible.map(function(k){ return self.readerRenderSection(k, cd); })))));
  };

  R.readerRenderLetterSheet = function () {
    var C = this.CR, h = React.createElement, st = this.state, cd = st.card, self = this;
    if (st.sheet !== 'letter' || !cd) return null;
    var known = st.knownLetters.indexOf(cd.letter) >= 0, L = cd.L;
    return h('div',{'data-section':'phone-letter-sheet',key:'lsheet',style:{position:'absolute',inset:0,zIndex:35}},
      h('div',{onClick:function(){self.readerCloseSheet();},style:{position:'absolute',inset:0,background:U.alpha('#15140f',0.34),animation:'scFade .2s ease'}}),
      h('div',{onClick:function(e){e.stopPropagation();},style:{position:'absolute',left:0,right:0,bottom:0,background:C.paper,borderRadius:TK.sheetTopRadius,boxShadow:'0 -16px 50px -10px rgba(40,34,22,0.4)',animation:'scSheetUp .3s cubic-bezier(.22,1,.36,1)'}},
        h('div',{style:{display:'flex',justifyContent:'center',paddingTop:10}},h('div',{style:{width:TK.topBtnSize,height:4.5,borderRadius:3,background:C.line2}})),
        h('div',{style:{padding:'14px 26px 32px',position:'relative'}},
          h('button',{onClick:function(){self.readerCloseSheet();},style:{position:'absolute',top:8,right:20,width:36,height:36,borderRadius:10,border:'1px solid '+C.line,background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},h('svg',{width:17,height:17,viewBox:'0 0 24 24',fill:'none',stroke:C.inkSoft,strokeWidth:2,strokeLinecap:'round'},h('path',{d:'M6 6l12 12M18 6L6 18'}))),
          h('div',{style:{fontFamily:this.serif,fontSize:62,color:C.blue,lineHeight:1.05,fontWeight:400}},L.u+' '+L.l),
          h('div',{style:{fontFamily:this.serif,fontSize:24,fontWeight:700,color:C.ink,marginTop:8}},L.name),
          h('div',{style:{fontFamily:this.serif,fontSize:18,color:C.muted,marginTop:6}},L.sound),
          h('div',{style:{fontFamily:this.serif,fontSize:18,color:C.ink,marginTop:4}},L.eq),
          h('button',{onClick:function(){self.readerToggleLetterKnown(cd.letter);},style:{marginTop:18,padding:'13px 22px',borderRadius:13,border:'none',cursor:'pointer',fontFamily:this.sans,fontSize:15,fontWeight:600,background:known?C.green:U.alpha(C.ink,0.06),color:known?'#fff':C.ink,display:'inline-flex',alignItems:'center',gap:8}},known?'Освоена ✓':'Я знаю эту букву'),
          h('div',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:14,color:C.muted2,marginTop:18,lineHeight:1.5}},'Произношение — учебное приближение, не научная реконструкция.'))));
  };

  /* ---------- gallery previews ---------- */

  R.readerGalModeD = function () {
    var C = this.CR, h = React.createElement, cur = this.state.mode, self = this;
    return h('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:11}},
      h('div',{style:{display:'flex',alignItems:'center'}},[1,2,3,4].map(function(n,i){ var on = n <= cur; return h(React.Fragment,{key:n},i>0?h('span',{style:{width:18,height:2,background:on?C.terra:U.alpha(C.ink,0.12)}}):null,h('button',{onClick:function(){self.readerSetMode(n);},title:self.modeNames[n-1],style:{width:n===cur?15:11,height:n===cur?15:11,borderRadius:'50%',border:'none',background:on?C.terra:U.alpha(C.ink,0.18),cursor:'pointer',padding:0,transition:'all .2s'}})); })),
      h('div',{style:{fontFamily:this.sans,fontSize:12,color:C.muted}},'Шаг '+cur+' · '+this.modeShort[cur-1]));
  };

  R.readerGalModeE = function () {
    var C = this.CR, h = React.createElement, cur = this.state.mode, self = this;
    var arrow = function(dir,to,dis){ return h('button',{onClick:function(){if(!dis)self.readerSetMode(to);},disabled:dis,style:{width:26,height:26,borderRadius:'50%',border:'none',background:C.paper,boxShadow:'0 1px 2px rgba(40,34,22,0.12)',cursor:dis?'default':'pointer',opacity:dis?0.35:1,display:'flex',alignItems:'center',justifyContent:'center',padding:0}},U.iconChevH(C.inkSoft,dir)); };
    return h('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:10}},
      h('div',{style:{display:'inline-flex',alignItems:'center',gap:8,background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:22,padding:'5px 7px'}},
        arrow('left',Math.max(1,cur-1),cur===1),
        h('span',{style:{fontFamily:this.sans,fontSize:13.5,fontWeight:700,color:C.ink,minWidth:46,textAlign:'center'}},'Шаг '+cur+'/4'),
        arrow('right',Math.min(4,cur+1),cur===4)),
      h('div',{style:{fontFamily:this.sans,fontSize:12,color:C.muted}},this.modeNames[cur-1]));
  };

  R.readerGalModeF = function () {
    var C = this.CR, h = React.createElement, cur = this.state.mode, self = this;
    var inits = ['Бкв','Лем','Фрм','Грч'];
    return h('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:10}},
      h('div',{style:{display:'inline-flex',gap:2,background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:TK.radius,padding:2}},
        inits.map(function(s,i){ var on = cur === i+1; return h('button',{key:i,onClick:function(){self.readerSetMode(i+1);},title:self.modeNames[i],style:{padding:'4px 9px',height:26,borderRadius:7,border:'none',background:on?C.ink:'transparent',color:on?C.paper:C.muted,fontFamily:self.sans,fontSize:12,fontWeight:700,cursor:'pointer'}},s); })),
      h('div',{style:{fontFamily:this.sans,fontSize:12,color:C.muted}},'Шаг '+cur+' · '+this.modeNames[cur-1]));
  };

  R.readerGalModeA = function () {
    var C = this.CR, h = React.createElement;
    var seg = h('div',{style:{display:'flex',gap:2,background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:TK.radius,padding:3,width:'max-content'}},
      [1,2,3,4].map(function(n){ return h('div',{key:n,style:{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:this.sans,fontWeight:700,fontSize:13,background:n===2?C.ink:'transparent',color:n===2?C.paper:C.muted}},n); },this));
    var menu = h('div',{style:{marginTop:12,border:'1px solid '+C.line2,borderRadius:12,overflow:'hidden'}},
      this.modeNames.map(function(nm,i){ return h('div',{key:i,style:{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',background:i===1?U.alpha(C.terra,0.08):'transparent',borderBottom:i<3?'1px solid '+C.line:'none'}},
        h('span',{style:{width:22,height:22,borderRadius:7,background:i===1?C.ink:U.alpha(C.ink,0.07),color:i===1?C.paper:C.muted,fontFamily:this.sans,fontWeight:700,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}},i+1),
        h('span',{style:{fontFamily:this.sans,fontSize:12.5,color:C.ink,fontWeight:i===1?600:400}},nm)); },this));
    return h('div',null,h('div',{style:{display:'flex',alignItems:'center',gap:10}},seg,h('span',{style:{fontFamily:this.sans,fontSize:12,color:C.muted}},'Шаг 2 ▾')),menu);
  };

  R.readerGalModeB = function () {
    var C = this.CR, h = React.createElement, cur = this.state.mode, self = this;
    var labels = this.modeShort;
    return h('div',null,
      h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:TK.lsLabel,textTransform:'uppercase',color:C.muted,marginBottom:14}},'Погружение'),
      h('div',{style:{position:'relative',height:8,background:U.alpha(C.ink,0.07),borderRadius:8,margin:'0 6px'}},
        h('div',{style:{position:'absolute',left:0,top:0,bottom:0,width:((cur-1)/3*100)+'%',background:C.terra,borderRadius:8,transition:'width .25s'}}),
        [0,1,2,3].map(function(i){ return h('button',{key:i,onClick:function(){self.readerSetMode(i+1);},style:{position:'absolute',left:'calc('+(i/3*100)+'% - 9px)',top:-5,width:18,height:18,borderRadius:'50%',border:'2px solid '+(i+1<=cur?C.terra:C.muted2),background:i+1<=cur?C.terra:C.paper,cursor:'pointer',padding:0}}); })),
      h('div',{style:{display:'flex',justifyContent:'space-between',marginTop:10}},labels.map(function(l,i){ return h('button',{key:i,onClick:function(){self.readerSetMode(i+1);},style:{background:'none',border:'none',cursor:'pointer',fontFamily:self.sans,fontSize:11.5,fontWeight:cur===i+1?700:500,color:cur===i+1?C.terra:C.muted,padding:0}},l); })));
  };

  R.readerGalModeC = function () {
    var C = this.CR, h = React.createElement, cur = this.state.mode;
    return h('div',null,
      h('div',{style:{display:'flex',gap:7,flexWrap:'wrap'}},this.modeShort.map(function(l,i){ var on = cur === i+1; return h('button',{key:i,onClick:function(){this.readerSetMode(i+1);}.bind(this),style:{padding:'8px 14px',borderRadius:20,border:'1px solid '+(on?'transparent':C.line2),background:on?C.ink:'transparent',color:on?C.paper:C.inkSoft,fontFamily:this.sans,fontSize:13,fontWeight:600,cursor:'pointer'}},l); },this)),
      h('div',{style:{fontFamily:this.sans,fontSize:12,color:C.muted,marginTop:14,lineHeight:1.4}},this.modeDesc[cur-1]));
  };

  R.readerGalTop1 = function () {
    var C = this.CR, h = React.createElement;
    return h('div',null,
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px 6px'}},
        h('div',{style:{display:'flex',alignItems:'baseline',gap:7}},h('span',{style:{fontFamily:this.serif,fontSize:20,fontWeight:700,color:C.ink}},'Иоанн'),h('span',{style:{fontFamily:this.sans,fontSize:12,color:C.muted}},'глава 1 ▾')),
        h('div',{style:{display:'flex',gap:6}},h('div',{style:{width:32,height:32,borderRadius:TK.radius,border:'1px solid '+C.line,display:'flex',alignItems:'center',justifyContent:'center'}},U.iconEye(C.inkSoft)),h('div',{style:{width:32,height:32,borderRadius:TK.radius,border:'1px solid '+C.line,display:'flex',alignItems:'center',justifyContent:'center',gap:2.5}},[0,1,2].map(function(i){ return h('span',{key:i,style:{width:3,height:3,borderRadius:'50%',background:C.inkSoft}}); })))),
      h('div',{style:{display:'flex',alignItems:'center',gap:9,padding:'6px 16px 14px',borderTop:'1px solid '+C.line,marginTop:4}},
        h('div',{style:{display:'flex',gap:2,background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:10,padding:3}},[1,2,3,4].map(function(n){ return h('span',{key:n,style:{width:26,height:26,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:this.sans,fontWeight:700,fontSize:12.5,background:n===1?C.ink:'transparent',color:n===1?C.paper:C.muted}},n); },this)),
        h('div',{style:{flex:1}},h('div',{style:{fontFamily:this.sans,fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:C.muted2,textTransform:'uppercase'}},'Шаг 1'),h('div',{style:{fontFamily:this.sans,fontSize:13.5,fontWeight:600,color:C.ink}},'Только греческие буквы')),
        U.iconChev(C.muted)));
  };

  R.readerGalTop2 = function () {
    var C = this.CR, h = React.createElement;
    return h('div',{style:{display:'flex',alignItems:'center',gap:10,padding:'16px 16px'}},
      h('div',{style:{display:'flex',alignItems:'baseline',gap:5}},h('span',{style:{fontFamily:this.serif,fontSize:18,fontWeight:700,color:C.ink}},'Иоанн'),U.iconChev(C.muted)),
      h('div',{style:{flex:1,display:'flex',justifyContent:'center'}},h('div',{style:{display:'flex',gap:2,background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:10,padding:3}},[1,2,3,4].map(function(n){ return h('span',{key:n,style:{width:26,height:26,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:this.sans,fontWeight:700,fontSize:12.5,background:n===2?C.ink:'transparent',color:n===2?C.paper:C.muted}},n); },this))),
      h('div',{style:{width:32,height:32,borderRadius:TK.radius,border:'1px solid '+C.line,display:'flex',alignItems:'center',justifyContent:'center'}},U.iconEye(C.inkSoft)));
  };

  R.readerCardSections = function (cd) {
    var self = this;
    return this.state.cardOrder.filter(function(k){ return self.state.cardHidden.indexOf(k) < 0; }).map(function(k){ return self.readerRenderSection(k, cd); });
  };

  /* ---------- DESKTOP ---------- */

  R.readerModeMenuList = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    var dictCount = st.readerAddedSet ? st.readerAddedSet.size : 0;
    var intensityPct = Math.round(st.intensity * 100);
    var wordLayer = st.readerWordLayer || 'off';
    var activeTab = st.readerPopupTab || 'mixed';
    // Tab buttons
    var tabBtn = function(label, key){ var on = activeTab === key; return h('button',{key:key,onClick:function(){self.setState({readerPopupTab:key});},style:{flex:1,padding:'10px 0',border:'none',borderBottom:'2px solid '+(on?C.terra:'transparent'),background:'transparent',fontFamily:self.sans,fontSize:14,fontWeight:500,color:on?C.ink:C.muted,cursor:'pointer',transition:'color .15s,border-color .15s'}},label); };
    // Mixed panel
    var mixedPanel = h('div',{style:{padding:16}},
      // Slider header
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}},
        h('span',{style:{fontFamily:self.sans,fontSize:14,color:C.ink}},'Замена букв'),
        h('span',{style:{fontFamily:self.serif,fontSize:18,color:C.blue}},'α'+intensityPct+'%')),
      // Slider
      h('input',{type:'range',min:0,max:100,step:5,value:intensityPct,onChange:function(e){self.readerSetIntensity(e.target.value);},style:{width:'100%',accentColor:C.terra,margin:'0 0 4px 0',cursor:'pointer'}}),
      // Slider labels
      h('div',{style:{display:'flex',justifyContent:'space-between',fontFamily:self.sans,fontSize:12,color:C.muted,marginBottom:4}},h('span',null,'0% — чистый русский'),h('span',null,'100% — все буквы')),
      // Divider
      h('div',{style:{borderTop:'1px solid '+C.line,margin:'16px 0'}}),
      // Toggle label
      h('div',{style:{fontFamily:self.sans,fontSize:14,color:C.ink,marginBottom:8}},'Замена слов'),
      // Toggle buttons
      h('div',{style:{display:'flex',background:U.alpha(C.ink,0.05),border:'1px solid '+C.line,borderRadius:8,padding:2}},
        [{v:'off',l:'Выкл'},{v:'lemma',l:'Леммы'},{v:'form',l:'Формы'}].map(function(o){ var on = wordLayer === o.v; return h('button',{key:o.v,onClick:function(){self.readerSetWordLayer(o.v);},style:{flex:1,padding:'8px 0',border:'none',borderRadius:6,background:on?C.read:'transparent',color:on?C.ink:C.muted,fontFamily:self.sans,fontSize:13,fontWeight:on?600:400,cursor:'pointer',boxShadow:on?'0 1px 2px rgba(40,34,22,0.1)':'none',transition:'background .15s,color .15s,box-shadow .15s'}},o.l); })),
      // Hint
      h('div',{style:{fontFamily:self.sans,fontSize:12,color:C.muted,margin:'8px 0 0 0',lineHeight:1.5}},
        wordLayer==='off' ? h('span',{style:{fontWeight:600,color:C.ink}},'Выкл — только буквы, без загрузки греческих слов')
        : wordLayer==='lemma' ? h('span',{style:{fontWeight:600,color:C.ink}},'Леммы — как в словаре: λέγω  исходная форма, «говорить»')
        : h('span',{style:{fontWeight:600,color:C.ink}},'Формы — как в тексте: λέγει  с окончанием, «говорит»')),
      // Dict button
      h('button',{onClick:function(){self.setState({tab:'dict',dropdown:false});},style:{width:'100%',marginTop:16,padding:'10px',fontFamily:self.sans,fontSize:14,textAlign:'left',background:U.alpha(C.ink,0.04),border:'1px solid '+C.line,borderRadius:8,color:C.ink,cursor:'pointer'}},h('span',null,'📖 Словарь — выбрано '+dictCount+' слов →')));
    // Greek panel — disabled in demo
    var greekPanel = h('div',{style:{padding:16}},
      h('div',{style:{fontFamily:self.sans,fontSize:13,color:C.ink,marginBottom:12}},'Греческий текст Нового Завета как основной. Под каждым стихом — русский перевод мелким шрифтом.'),
      h('label',{style:{display:'flex',alignItems:'center',gap:8,fontFamily:self.sans,fontSize:14,color:C.ink,cursor:'pointer',opacity:0.5}},
        h('input',{type:'checkbox',disabled:true,style:{accentColor:C.terra}}),
        h('span',null,'Показывать русский перевод под стихом')),
      h('div',{style:{fontFamily:self.sans,fontSize:12,color:C.muted,marginTop:8,lineHeight:1.5}},'Нажмите на любое греческое слово — увидите перевод и разбор.'));
    return h('div',{'data-section':'mode-popup',style:{width:320,background:C.paper,border:'1px solid '+C.line2,borderRadius:TK.radiusLg,boxShadow:'0 24px 50px -16px rgba(40,34,22,0.45)',overflow:'hidden',animation:'scPop .16s ease'}},
      h('div',{style:{display:'flex',borderBottom:'1px solid '+C.line}}, tabBtn('Смешанный','mixed'), tabBtn('Греческий','greek')),
      activeTab === 'mixed' ? mixedPanel : greekPanel);
  };

  R.readerRenderDeskNav = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    var items = [['read','Читать',U.iconRead.bind(null)],['dict','Слова',U.iconWords.bind(null)],['settings','Настройки',U.iconGear.bind(null)],['about','О приложении',U.iconInfo.bind(null)]];
    var themes = [['Светлая','Пергамент'],['Тёмная','Тёмная'],['Авто','Пергамент']];
    var activeTheme = st.readerTheme;
    return h('div',{'data-section':'desk-nav',style:{width:TK.navWidth,flex:'0 0 auto',background:C.paper2,borderRight:'1px solid '+C.line,display:'flex',flexDirection:'column',padding:'26px 16px 20px'}},
      h('div',{style:{padding:'0 8px 26px'}},
        h('div',{style:{fontFamily:this.serif,fontSize:20,fontWeight:700,color:C.ink,lineHeight:1.15}},'Читалка НЗ'),
        h('div',{style:{fontFamily:this.sans,fontSize:12,color:C.muted,marginTop:2}},'греческий сквозь русский')),
      h('div',{style:{display:'flex',flexDirection:'column',gap:4}},
        items.map(function(it){ var on = st.tab === it[0]; var col = on ? C.ink : C.inkSoft; return h('button',{key:it[0],onClick:function(){self.setState({tab:it[0],dropdown:false});},style:{display:'flex',alignItems:'center',gap:12,padding:'11px 12px',borderRadius:TK.radius,border:'none',cursor:'pointer',background:on?C.paper:'transparent',boxShadow:on?'0 1px 3px rgba(40,34,22,0.08)':'none',textAlign:'left'}},
          it[2](col),h('span',{style:{fontFamily:self.sans,fontSize:14.5,fontWeight:on?700:500,color:col}},it[1])); })),
      h('div',{style:{flex:1}}),
      h('div',{style:{padding:'0 6px'}},
        h('div',{style:{fontFamily:this.sans,fontSize:10.5,fontWeight:700,letterSpacing:'0.13em',textTransform:'uppercase',color:C.muted2,marginBottom:8}},'Тема'),
        h('div',{style:{display:'flex',gap:3,background:U.alpha(C.ink,0.05),borderRadius:10,padding:3}},
          themes.map(function(pair){ var label = pair[0], key = pair[1]; var on = activeTheme === key; return h('button',{key:label,onClick:function(){self.setState({readerTheme:key});},style:{flex:1,padding:'7px 0',borderRadius:7,border:'none',cursor:'pointer',background:on?C.paper:'transparent',boxShadow:on?'0 1px 2px rgba(40,34,22,0.1)':'none',fontFamily:self.sans,fontSize:12,fontWeight:on?700:500,color:on?C.ink:C.muted}},label); }))));
  };

  R.readerRenderDeskTopPanel = function () {
    var C = this.CR, h = React.createElement, st = this.state, self = this;
    return h('div',{'data-section':'desk-top-panel',style:{position:'relative',display:'flex',alignItems:'center',gap:18,padding:'15px 32px',borderBottom:'1px solid '+C.line,flex:'0 0 auto',zIndex:5}},
      h('button',{onClick:function(){self.readerShowToast('Выбор книги — в полной версии');},style:{display:'flex',alignItems:'baseline',gap:8,background:'none',border:'none',cursor:'pointer',padding:0,whiteSpace:'nowrap'}},
        h('span',{style:{fontFamily:this.serif,fontSize:22,fontWeight:700,color:C.ink}},'Иоанн,'),
        h('span',{style:{fontFamily:this.sans,fontSize:18,fontWeight:700,color:C.inkSoft}},'1'),
        h('span',{style:{flex:'0 0 auto'}},U.iconChev(C.muted))),
      h('div',{style:{width:1,height:26,background:C.line}}),
      h('button',{onClick:function(){var wl=st.mode===1?'off':st.mode===2?'lemma':'form';self.setState({dropdown:!st.dropdown,readerWordLayer:wl});},style:{background:'none',border:'none',cursor:'pointer',padding:0}},this.readerChipH1(this.readerLiveChipState())),
      h('div',{style:{flex:1}}),
      h('button',{onClick:function(){self.readerToggleSimple();},title:'Простой вид',style:{width:40,height:40,borderRadius:TK.radius,border:'1px solid '+(st.simpleView?U.alpha(C.terra,0.4):C.line),background:st.simpleView?U.alpha(C.terra,0.12):U.alpha(C.ink,0.03),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flex:'0 0 auto'}},U.iconEye(st.simpleView?C.terra:C.inkSoft,st.simpleView)),
      st.dropdown ? h('div',{style:{position:'absolute',top:64,left:258,zIndex:30,animation:'scPop .16s ease'}},this.readerModeMenuList()) : null,
      st.dropdown ? h('div',{onClick:function(){self.setState({dropdown:false});},style:{position:'fixed',inset:0,zIndex:20}}) : null);
  };

  R.readerRenderDeskRead = function () {
    var C = this.CR, h = React.createElement, self = this;
    var verses = this.verses.map(function(v,i){ return self.readerRenderVerse(v,i); });
    var contNodes = this.cont.map(function(v,i){ return h('span',{key:i,style:{fontFamily:self.serif,fontSize:19,lineHeight:1.75,color:C.ink}},h('sup',{style:{color:C.muted2,fontSize:'0.6em',fontWeight:700,marginRight:5,fontFamily:self.sans,verticalAlign:'0.55em'}},v.n),v.ru+' '); });
    var cont = h('div',{style:{marginTop:8,maskImage:'linear-gradient(180deg,#000 0%,transparent 88%)',WebkitMaskImage:'linear-gradient(180deg,#000 0%,transparent 88%)'}},contNodes);
    return h('div',{'data-section':'desk-reading-area',style:{flex:1,minWidth:0,display:'flex',flexDirection:'column'}},
      this.readerRenderDeskTopPanel(),
      h('div',{className:'scScroll',style:{flex:1,overflowY:'auto',background:C.read}},
        h('div',{style:{maxWidth:TK.deskContentWidth,margin:'0 auto',padding:TK.deskContentPad}},
          h('div',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:C.muted2,marginBottom:18}},'Евангелие от Иоанна · глава 1'),
          h('div',{style:{fontSize:19,lineHeight:1.78}},verses),cont)));
  };

  R.readerRenderDeskDict = function () { return this.readerWordDeskContent(); };

  R.readerRenderDeskInspector = function () {
    var C = this.CR, h = React.createElement, st = this.state, cd = st.card, self = this;
    var body;
    if (st.sheet === 'word' && cd) {
      body = h('div',{className:'scScroll',style:{overflowY:'auto',padding:'22px 24px 32px',position:'relative'}},
        h('div',{style:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}},
          h('div',null,
            h('div',{style:{display:'flex',alignItems:'baseline',gap:10}},
              h('span',{style:{fontFamily:this.serif,fontSize:44,color:C.blue,lineHeight:1}},cd.form||cd.lemma),
              (cd.rank||cd.freq) ? h('span',{style:{fontFamily:this.sans,fontSize:13,fontWeight:600,color:C.muted,whiteSpace:'nowrap'}},(cd.rank||'')+(cd.rank&&cd.freq?' · ':'')+(cd.freq?cd.freq+'×':'')+(cd.rank?'':' в НЗ')) : null)),
          h('div',{style:{display:'flex',gap:6,flex:'0 0 auto'}},
            h('button',{onClick:function(){self.setState({gearOpen:!st.gearOpen});},style:{width:TK.inspBtnSize,height:TK.inspBtnSize,borderRadius:10,border:'1px solid '+C.line,background:st.gearOpen?U.alpha(C.ink,0.06):'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},U.iconGear(C.inkSoft)),
            h('button',{onClick:function(){self.readerCloseSheet();},style:{width:TK.inspBtnSize,height:TK.inspBtnSize,borderRadius:10,border:'1px solid '+C.line,background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:C.inkSoft,strokeWidth:2,strokeLinecap:'round'},h('path',{d:'M6 6l12 12M18 6L6 18'}))))),
        this.readerRenderGearMenu(),
        this.readerCardSections(cd));
    } else if (st.sheet === 'letter' && cd) {
      var known = st.knownLetters.indexOf(cd.letter) >= 0, L = cd.L;
      body = h('div',{style:{padding:'22px 24px 32px',position:'relative'}},
        h('button',{onClick:function(){self.readerCloseSheet();},style:{position:'absolute',top:18,right:20,width:TK.inspBtnSize,height:TK.inspBtnSize,borderRadius:10,border:'1px solid '+C.line,background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:C.inkSoft,strokeWidth:2,strokeLinecap:'round'},h('path',{d:'M6 6l12 12M18 6L6 18'}))),
        h('div',{style:{fontFamily:this.serif,fontSize:60,color:C.blue,lineHeight:1.05}},L.u+' '+L.l),
        h('div',{style:{fontFamily:this.serif,fontSize:24,fontWeight:700,color:C.ink,marginTop:8}},L.name),
        h('div',{style:{fontFamily:this.serif,fontSize:18,color:C.muted,marginTop:6}},L.sound),
        h('div',{style:{fontFamily:this.serif,fontSize:18,color:C.ink,marginTop:4}},L.eq),
        h('button',{onClick:function(){self.readerToggleLetterKnown(cd.letter);},style:{marginTop:18,padding:'12px 22px',borderRadius:13,border:'none',cursor:'pointer',fontFamily:this.sans,fontSize:15,fontWeight:600,background:known?C.green:U.alpha(C.ink,0.06),color:known?'#fff':C.ink}},known?'Освоена ✓':'Я знаю эту букву'),
        h('div',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:14,color:C.muted2,marginTop:18,lineHeight:1.5}},'Произношение — учебное приближение, не научная реконструкция.'));
    } else {
      body = h('div',{style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'0 30px',gap:14}},
        h('div',{style:{width:54,height:54,borderRadius:14,border:'1.5px dashed '+C.line2,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:this.serif,fontSize:26,color:C.muted2}},'α'),
        h('div',{style:{fontFamily:this.serif,fontSize:17,color:C.muted,lineHeight:1.5,maxWidth:230}},'Выберите греческое слово или букву в тексте — карточка появится здесь.'));
    }
    return h('div',{'data-section':'desk-inspector',style:{width:TK.inspWidth,flex:'0 0 auto',borderLeft:'1px solid '+C.line,background:C.paper,position:'relative',display:'flex',flexDirection:'column'}},body);
  };

  R.readerRenderDesktop = function () {
    var h = React.createElement, s = this.state.readerDeskScale || 1;
    return h('div',{style:{width:'100%',height:Math.round(768*s),overflow:'hidden'}},
      h('div',{style:{width:1180,height:768,transformOrigin:'top left',transform:'scale('+s+')'}},this.readerRenderDesktopApp()));
  };

  R.readerRenderDesktopApp = function () {
    var C = this.CR, h = React.createElement, st = this.state;
    var main = st.tab === 'read' ? this.readerRenderDeskRead()
      : st.tab === 'dict' ? this.readerRenderDeskDict()
      : st.tab === 'settings' ? this.readerRenderDeskSettings()
      : h('div',{style:{flex:1,minWidth:0,display:'flex',justifyContent:'center',overflow:'hidden'}},
          h('div',{style:{width:TK.deskContentWidth,display:'flex',flexDirection:'column'}},this.readerRenderAbout()));
    return h('div',{'data-section':'desk-app',style:{position:'relative',display:'flex',flexDirection:'column',height:768,background:C.paper,color:C.ink,fontFamily:this.serif}},
      h('div',{style:{flex:'0 0 auto',height:TK.topBtnSize,background:C.titlebar,borderBottom:'1px solid '+C.line,display:'flex',alignItems:'center',gap:8,padding:'0 16px'}},
        ['#d98b6e','#dcc06a','#9bbf73'].map(function(c,i){ return h('span',{key:i,style:{width:11,height:11,borderRadius:'50%',background:c}}); })),
      h('div',{style:{flex:1,display:'flex',minHeight:0}},
        this.readerRenderDeskNav(),
        main,
        st.tab === 'read' ? this.readerRenderDeskInspector() : null),
      st.tab === 'dict' ? this.readerWordToastEl(false) : this.readerRenderToast());
  };

  /* ---------- status chip variants ---------- */

  R.readerChipStates = function () { return U.getChipStates(); };
  R.readerLiveChipState = function () { return U.getLiveChipState(this.state); };

  R.readerChip1 = function (s) {
    var C = this.CR, h = React.createElement;
    var wrap = function(filled,kids){ return h('div',{style:{display:'inline-flex',alignItems:'center',background:filled?C.ink:U.alpha(C.ink,0.045),border:'1px solid '+(filled?C.ink:C.line2),borderRadius:TK.radius,padding:TK.chipPad,height:30,fontFamily:this.sans,fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',lineHeight:1}},kids); }.bind(this);
    if (s.id === 'rus') return wrap(false,[h('span',{key:1,style:{color:C.muted,letterSpacing:TK.lsChip}},'Рус')]);
    if (s.id === 'greek') return wrap(true,[h('span',{key:1,style:{color:C.paper,fontFamily:this.serif,fontSize:15,fontWeight:700}},'Греч')]);
    var alpha = h('span',{key:'a',style:{display:'inline-flex',alignItems:'baseline'}},
      h('span',{style:{fontFamily:this.serif,fontSize:16,color:C.blue}},'α'),
      h('span',{style:{color:C.ink,marginLeft:1}},s.pct+'%'));
    if (s.id === 'alpha') return wrap(false,[alpha]);
    var sep = h('span',{key:'s',style:{color:C.muted2,margin:'0 8px'}},'·');
    var words;
    if (s.words === 'offline') {
      words = h('span',{key:'w',style:{fontFamily:this.serif,fontSize:16,color:U.alpha(C.terra,0.55)}},'—');
    } else {
      words = h('span',{key:'w',style:{display:'inline-flex',alignItems:'baseline'}},
        h('span',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:15,color:C.terra}},s.words==='forms'?'λέγει':'λέγω'),
        h('span',{style:{color:C.muted,fontSize:12.5,marginLeft:5}},s.count));
    }
    return wrap(false,[alpha,sep,words]);
  };

  R.readerChip2 = function (s) {
    var C = this.CR, h = React.createElement;
    var shell = function(kids){ return h('div',{style:{display:'inline-flex',alignItems:'center',gap:4,fontFamily:this.sans,fontWeight:600,fontSize:13}},kids); };
    var zone = function(bg,bd,col,kids,key){ return h('div',{key:key,style:{display:'inline-flex',alignItems:'center',gap:5,background:bg,border:'1px solid '+bd,borderRadius:8,padding:'4px 10px',height:28,color:col,whiteSpace:'nowrap',lineHeight:1}},kids); };
    if (s.id === 'rus') return shell([zone(U.alpha(C.ink,0.045),C.line2,C.muted,[h('span',{key:1,style:{letterSpacing:TK.lsChip}},'Рус')],'z')]);
    if (s.id === 'greek') return shell([zone(C.blue,C.blue,C.paper,[h('span',{key:1,style:{fontFamily:this.serif,fontWeight:700,fontSize:14}},'Греческий')],'z')]);
    var lz = zone(C.blueBg,U.alpha(C.blue,0.28),C.blueTx,[
      h('span',{key:1,style:{fontFamily:this.serif,fontSize:15,color:C.blue}},'α'),
      h('span',{key:2},s.pct+'%')],'l');
    if (s.id === 'alpha') return shell([lz]);
    var wz;
    if (s.words === 'offline') {
      wz = h('div',{key:'w',style:{display:'inline-flex',alignItems:'center',gap:5,background:'transparent',border:'1px dashed '+U.alpha(C.terra,0.45),borderRadius:8,padding:'4px 10px',height:28,color:U.alpha(C.terra,0.85),whiteSpace:'nowrap',fontSize:12.5,lineHeight:1}},
        h('span',{style:{fontFamily:this.serif,fontSize:15}},'—'),h('span',null,'нет данных'));
    } else {
      wz = zone(C.terraSoft,U.alpha(C.terra,0.32),C.terra,[
        h('span',{key:1,style:{fontFamily:this.serif,fontStyle:'italic',fontSize:14}},s.words==='forms'?'λέγει':'λέγω'),
        h('span',{key:2,style:{opacity:0.65}},s.count)],'w');
    }
    return shell([lz,wz]);
  };

  R.readerChip3 = function (s) {
    var C = this.CR, h = React.createElement;
    var ring = function(pct){ var r = 7.5, c = 2*Math.PI*r; return h('svg',{width:19,height:19,viewBox:'0 0 19 19'},
      h('circle',{cx:9.5,cy:9.5,r:r,fill:'none',stroke:U.alpha(C.blue,0.16),strokeWidth:2.6}),
      h('circle',{cx:9.5,cy:9.5,r:r,fill:'none',stroke:C.blue,strokeWidth:2.6,strokeLinecap:'round',strokeDasharray:c,strokeDashoffset:c*(1-pct/100),transform:'rotate(-90 9.5 9.5)'})); };
    var wrap = function(kids){ return h('div',{style:{display:'inline-flex',alignItems:'center',gap:7,background:U.alpha(C.ink,0.045),border:'1px solid '+C.line2,borderRadius:20,padding:'4px 13px 4px 6px',height:30,fontFamily:this.sans,fontSize:13,fontWeight:600,whiteSpace:'nowrap'}},kids); }.bind(this);
    if (s.id === 'rus') return wrap([
      h('span',{key:1,style:{width:17,height:17,marginLeft:1,borderRadius:'50%',border:'2px solid '+C.muted2,display:'inline-block'}}),
      h('span',{key:2,style:{color:C.muted}},'Рус')]);
    if (s.id === 'greek') return wrap([
      h('span',{key:1,style:{width:18,height:18,marginLeft:1,borderRadius:'50%',background:C.blue,display:'inline-flex',alignItems:'center',justifyContent:'center',color:C.paper,fontFamily:this.serif,fontSize:12,fontWeight:700}},'Γ'),
      h('span',{key:2,style:{color:C.ink}},'Греческий')]);
    var ringEl = h('span',{key:'r',style:{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center',marginLeft:1}},ring(s.pct),
      h('span',{style:{position:'absolute',fontFamily:this.serif,fontSize:9,color:C.blue,lineHeight:1}},'α'));
    var pctEl = h('span',{key:'p',style:{color:C.ink}},s.pct+'%');
    if (s.id === 'alpha') return wrap([ringEl,pctEl]);
    var div = h('span',{key:'d',style:{width:1,height:14,background:C.line2,margin:'0 1px'}});
    var badge;
    if (s.words === 'offline') {
      badge = h('span',{key:'b',style:{display:'inline-flex',alignItems:'center',gap:5,color:U.alpha(C.terra,0.8)}},
        h('span',{style:{width:7,height:7,borderRadius:'50%',border:'1.5px dashed '+C.terra,display:'inline-block'}}),
        h('span',{style:{fontFamily:this.serif,fontSize:15}},'—'));
    } else {
      badge = h('span',{key:'b',style:{display:'inline-flex',alignItems:'center',gap:5}},
        h('span',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:14,color:C.terra}},s.words==='forms'?'λέγει':'λέγω'),
        h('span',{style:{color:C.muted,fontSize:12}},s.count));
    }
    return wrap([ringEl,pctEl,div,badge]);
  };

  R.readerChip4 = function (s) {
    var C = this.CR, h = React.createElement;
    var wrap = function(filled,kids){ return h('div',{style:{display:'inline-flex',alignItems:'center',background:filled?C.ink:U.alpha(C.ink,0.045),border:'1px solid '+(filled?C.ink:C.line2),borderRadius:TK.radius,padding:TK.chipPad,height:30,fontFamily:this.sans,fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',lineHeight:1}},kids); }.bind(this);
    if (s.id === 'rus') return wrap(false,[h('span',{key:1,style:{color:C.muted,letterSpacing:TK.lsChip}},'Рус')]);
    if (s.id === 'greek') return wrap(true,[h('span',{key:1,style:{color:C.paper,fontFamily:this.serif,fontSize:15,fontWeight:700}},'Греч')]);
    var fillGlyph = h('span',{key:'g',style:{position:'relative',display:'inline-block',width:14,height:18,marginRight:6}},
      h('span',{style:{position:'absolute',inset:0,fontFamily:this.serif,fontSize:18,color:U.alpha(C.blue,0.2),lineHeight:'18px',textAlign:'center'}},'α'),
      h('span',{style:{position:'absolute',inset:0,fontFamily:this.serif,fontSize:18,color:C.blue,lineHeight:'18px',textAlign:'center',clipPath:'inset('+(100-s.pct)+'% 0 0 0)',WebkitClipPath:'inset('+(100-s.pct)+'% 0 0 0)'}},'α'));
    var alpha = h('span',{key:'a',style:{display:'inline-flex',alignItems:'center'}},fillGlyph,h('span',{style:{color:C.ink}},s.pct+'%'));
    if (s.id === 'alpha') return wrap(false,[alpha]);
    var sep = h('span',{key:'s',style:{color:C.muted2,margin:'0 8px'}},'·');
    var words;
    if (s.words === 'offline') {
      words = h('span',{key:'w',style:{fontFamily:this.serif,fontSize:16,color:U.alpha(C.terra,0.55)}},'—');
    } else {
      words = h('span',{key:'w',style:{display:'inline-flex',alignItems:'baseline'}},
        h('span',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:15,color:C.terra}},s.words==='forms'?'λέγει':'λέγω'),
        h('span',{style:{color:C.muted,fontSize:12.5,marginLeft:5}},s.count));
    }
    return wrap(false,[alpha,sep,words]);
  };

  R.readerChip5 = function (s) {
    var C = this.CR, h = React.createElement;
    var wrap = function(filled,kids){ return h('div',{style:{display:'inline-flex',alignItems:'center',background:filled?C.ink:U.alpha(C.ink,0.045),border:'1px solid '+(filled?C.ink:C.line2),borderRadius:TK.radius,padding:TK.chipPad,height:30,fontFamily:this.sans,fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',lineHeight:1}},kids); }.bind(this);
    if (s.id === 'rus') return wrap(false,[h('span',{key:1,style:{color:C.muted,letterSpacing:TK.lsChip}},'Рус')]);
    if (s.id === 'greek') return wrap(true,[h('span',{key:1,style:{color:C.paper,fontFamily:this.serif,fontSize:15,fontWeight:700}},'Греч')]);
    var n = 5, active = Math.max(1,Math.round(s.pct/100*n));
    var bars = h('span',{key:'b',style:{display:'inline-flex',alignItems:'flex-end',gap:2,height:13,marginRight:7}},
      [0,1,2,3,4].map(function(i){ return h('span',{key:i,style:{width:2.5,height:5+i*2,borderRadius:1.2,background:i<active?C.blue:U.alpha(C.ink,0.14)}}); }));
    var alpha = h('span',{key:'a',style:{display:'inline-flex',alignItems:'center'}},
      h('span',{style:{fontFamily:this.serif,fontSize:16,color:C.blue,marginRight:6}},'α'),
      bars, h('span',{style:{color:C.ink}},s.pct+'%'));
    if (s.id === 'alpha') return wrap(false,[alpha]);
    var sep = h('span',{key:'s',style:{color:C.muted2,margin:'0 8px'}},'·');
    var words;
    if (s.words === 'offline') {
      words = h('span',{key:'w',style:{fontFamily:this.serif,fontSize:16,color:U.alpha(C.terra,0.55)}},'—');
    } else {
      words = h('span',{key:'w',style:{display:'inline-flex',alignItems:'baseline'}},
        h('span',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:15,color:C.terra}},s.words==='forms'?'λέγει':'λέγω'),
        h('span',{style:{color:C.muted,fontSize:12.5,marginLeft:5}},s.count));
    }
    return wrap(false,[alpha,sep,words]);
  };

  /* ---- horizontal-bar indicator variants ---- */

  R.reader_hbarWord = function (s) {
    var C = this.CR, h = React.createElement;
    if (s.words === 'offline') return h('span',{key:'w',style:{fontFamily:this.serif,fontSize:16,color:U.alpha(C.terra,0.55)}},'—');
    var pct = Math.min(100,(s.count/1000)*100);
    var textRow = h('span',{style:{display:'inline-flex',alignItems:'baseline'}},
      h('span',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:15,color:C.terra}},s.words==='forms'?'λέγει':'λέγω'),
      h('span',{style:{color:C.muted,fontSize:12.5,marginLeft:5}},s.count));
    var bar = h('span',{style:{display:'block',height:3,borderRadius:3,background:U.alpha(C.terra,0.16),marginTop:4,position:'relative',overflow:'hidden'}},
      h('span',{style:{position:'absolute',left:0,top:0,bottom:0,width:pct+'%',background:C.terra,borderRadius:3}}));
    return h('span',{key:'w',style:{display:'inline-flex',flexDirection:'column',alignItems:'stretch'}},textRow,bar);
  };

  R.readerChipH1 = function (s) {
    var C = this.CR, h = React.createElement;
    var wrap = function(filled,kids){ return h('div',{style:{display:'inline-flex',alignItems:'center',background:filled?C.ink:U.alpha(C.ink,0.045),border:'1px solid '+(filled?C.ink:C.line2),borderRadius:TK.radius,padding:TK.chipHPad,minHeight:TK.chipMinHeight,fontFamily:this.sans,fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',lineHeight:1}},kids); }.bind(this);
    if (s.id === 'rus') return wrap(false,[h('span',{key:1,style:{color:C.muted,letterSpacing:TK.lsChip}},'Рус')]);
    if (s.id === 'greek') return wrap(true,[h('span',{key:1,style:{color:C.paper,fontFamily:this.serif,fontSize:15,fontWeight:700}},'Греч')]);
    var row = h('span',{key:'ar',style:{display:'inline-flex',alignItems:'baseline'}},
      h('span',{style:{fontFamily:this.serif,fontSize:16,color:C.blue}},'α'),
      h('span',{style:{color:C.ink,marginLeft:1}},s.pct+'%'));
    var bar = h('span',{key:'bar',style:{display:'block',height:3,borderRadius:3,background:U.alpha(C.blue,0.16),marginTop:4,position:'relative',overflow:'hidden'}},
      h('span',{style:{position:'absolute',left:0,top:0,bottom:0,width:s.pct+'%',background:C.blue,borderRadius:3}}));
    var left = h('span',{key:'l',style:{display:'inline-flex',flexDirection:'column',alignItems:'stretch'}},row,bar);
    if (s.id === 'alpha') return wrap(false,[left]);
    var sep = h('span',{key:'s',style:{color:C.muted2,margin:'0 9px'}},'·');
    return wrap(false,[left,sep,this.reader_hbarWord(s)]);
  };

  R.readerChipH2 = function (s) {
    var C = this.CR, h = React.createElement;
    var wrap = function(filled,kids){ return h('div',{style:{display:'inline-flex',alignItems:'center',background:filled?C.ink:U.alpha(C.ink,0.045),border:'1px solid '+(filled?C.ink:C.line2),borderRadius:TK.radius,padding:TK.chipHPad,minHeight:TK.chipMinHeight,fontFamily:this.sans,fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',lineHeight:1}},kids); }.bind(this);
    if (s.id === 'rus') return wrap(false,[h('span',{key:1,style:{color:C.muted,letterSpacing:TK.lsChip}},'Рус')]);
    if (s.id === 'greek') return wrap(true,[h('span',{key:1,style:{color:C.paper,fontFamily:this.serif,fontSize:15,fontWeight:700}},'Греч')]);
    var row = h('span',{key:'ar',style:{display:'inline-flex',alignItems:'baseline'}},
      h('span',{style:{fontFamily:this.serif,fontSize:16,color:C.blue}},'α'),
      h('span',{style:{color:C.ink,marginLeft:1}},s.pct+'%'));
    var n = 8, active = Math.max(1,Math.round(s.pct/100*n));
    var bar = h('span',{key:'bar',style:{display:'flex',gap:2,marginTop:4}},
      [0,1,2,3,4,5,6,7].map(function(i){ return h('span',{key:i,style:{flex:1,height:3.5,borderRadius:1.5,background:i<active?C.blue:U.alpha(C.ink,0.13)}}); }));
    var left = h('span',{key:'l',style:{display:'inline-flex',flexDirection:'column',alignItems:'stretch'}},row,bar);
    if (s.id === 'alpha') return wrap(false,[left]);
    var sep = h('span',{key:'s',style:{color:C.muted2,margin:'0 9px'}},'·');
    return wrap(false,[left,sep,this.reader_hbarWord(s)]);
  };

  R.readerChipH3 = function (s) {
    var C = this.CR, h = React.createElement;
    var wrap = function(filled,kids){ return h('div',{style:{display:'inline-flex',alignItems:'center',background:filled?C.ink:U.alpha(C.ink,0.045),border:'1px solid '+(filled?C.ink:C.line2),borderRadius:TK.radius,padding:TK.chipHPad,minHeight:TK.chipMinHeight,fontFamily:this.sans,fontSize:13.5,fontWeight:600,whiteSpace:'nowrap',lineHeight:1}},kids); }.bind(this);
    if (s.id === 'rus') return wrap(false,[h('span',{key:1,style:{color:C.muted,letterSpacing:TK.lsChip}},'Рус')]);
    if (s.id === 'greek') return wrap(true,[h('span',{key:1,style:{color:C.paper,fontFamily:this.serif,fontSize:15,fontWeight:700}},'Греч')]);
    var row = h('span',{key:'ar',style:{display:'inline-flex',alignItems:'baseline'}},
      h('span',{style:{fontFamily:this.serif,fontSize:16,color:C.blue}},'α'),
      h('span',{style:{color:C.ink,marginLeft:1}},s.pct+'%'));
    var bar = h('span',{key:'bar',style:{display:'block',height:5,borderRadius:5,background:U.alpha(C.blue,0.14),marginTop:4,position:'relative'}},
      h('span',{style:{position:'absolute',left:0,top:0,bottom:0,width:s.pct+'%',background:C.blue,borderRadius:5}}),
      h('span',{style:{position:'absolute',left:'calc('+s.pct+'% - 3px)',top:'50%',transform:'translateY(-50%)',width:7,height:7,borderRadius:'50%',background:C.paper,border:'1.5px solid '+C.blue}}));
    var left = h('span',{key:'l',style:{display:'inline-flex',flexDirection:'column',alignItems:'stretch'}},row,bar);
    if (s.id === 'alpha') return wrap(false,[left]);
    var sep = h('span',{key:'s',style:{color:C.muted2,margin:'0 9px'}},'·');
    return wrap(false,[left,sep,this.reader_hbarWord(s)]);
  };

  R.readerChipGallery = function (fn) {
    var C = this.CR, h = React.createElement, self = this;
    var states = this.readerChipStates();
    var lemma = states[2];
    var bar = h('div',{style:{display:'flex',alignItems:'center',gap:9,padding:'9px 13px',background:C.read,border:'1px solid '+C.line,borderRadius:12,marginBottom:16}},
      h('span',{style:{fontFamily:this.serif,fontSize:16,fontWeight:700,color:C.ink}},'Иоанн 1'),
      h('span',{style:{transform:'translateY(1px)',flex:'0 0 auto'}},U.iconChev(C.muted2)),
      h('span',{style:{flex:1}}),
      fn.call(self,lemma));
    var rows = states.map(function(s,i){ return h('div',{key:i,style:{padding:'13px 0',borderBottom:i<states.length-1?'1px solid '+C.line:'none'}},
      h('div',{style:{marginBottom:8}},fn.call(self,s)),
      h('div',{style:{fontFamily:this.sans,fontSize:12,color:C.muted,lineHeight:1.45}},
        h('b',{style:{color:C.inkSoft,fontWeight:700}},s.label),h('br'),s.desc)); },self);
    return h('div',null,bar,h('div',null,rows));
  };

  /* ---------- compose ---------- */

  R.readerRenderContent = function () {
    var t = this.state.tab;
    if (t === 'read') return this.readerRenderRead();
    if (t === 'dict') return this.readerRenderDict();
    if (t === 'settings') return this.readerRenderSettings();
    return this.readerRenderAbout();
  };

  R.readerRenderPhone = function () {
    var C = this.CR, h = React.createElement, st = this.state, isDict = st.tab === 'dict';
    return h('div',{'data-section':'phone-app',style:{position:'absolute',inset:0,display:'flex',flexDirection:'column',background:C.paper,color:C.ink}},
      this.readerRenderStatusBar(),
      this.readerRenderContent(),
      this.readerRenderBottomNav(),
      isDict ? null : this.readerRenderModeMenu(),
      isDict ? null : this.readerRenderIntensity(),
      isDict ? this.readerWordToastEl(true) : this.readerRenderToast(),
      isDict ? this.readerRenderWordPhoneSheet() : this.readerRenderWordSheet(),
      isDict ? null : this.readerRenderLetterSheet());
  };

  /* ================================================================
   * 2h — встроенный экран «Слова»
   * ================================================================ */

  R.readerWordGetFiltered = function () {
    var st = this.state, q = st.readerWordSearch.trim().toLowerCase();
    return this.WORDS.filter(function(w){
      if (st.readerWordStatusFilter !== 'all' && st.readerStatusMap[w.k] !== st.readerWordStatusFilter) return false;
      if (st.readerWordPosFilter !== 'all' && w.pos !== st.readerWordPosFilter) return false;
      if (st.readerWordShowInText && !st.readerAddedSet.has(w.k)) return false;
      if (q && !w.g.toLowerCase().includes(q) && !w.t.toLowerCase().includes(q)) return false;
      return true;
    });
  };

  R.readerWordGetGroups = function (filtered) {
    return this.GROUPS.map(function(g){ return {key:g.key, label:g.label, cov:g.cov, min:g.min, max:g.max, words:filtered.filter(function(w){ return w.r>=g.min && w.r<=g.max; })}; }).filter(function(g){ return g.words.length > 0; });
  };

  R.readerWordToggleAdded = function (k, e) { e.stopPropagation(); var s = new Set(this.state.readerAddedSet); if (s.has(k)) { s.delete(k); } else { s.add(k); this.readerWordShowToast('Слово будет показываться в тексте чтения'); } this.setState({readerAddedSet:s}); };

  R.readerWordSetStatus = function (k, s) { this.readerSetStatus(k, s); };

  R.readerWordClickRow = function (k, e) {
    var same = this.state.readerWordActiveKey === k;
    this.setState({readerWordActiveKey:same?null:k, readerWordSheetOpen:!same});
  };

  R.readerWordCloseCard = function () { this.setState({readerWordActiveKey:null, readerWordSheetOpen:false}); };

  R.readerWordShowToast = function (msg) { var id = Date.now(); this._rtid = id; var self = this; this.setState({readerWordToast:msg}); setTimeout(function(){ if(self._mounted && self._rtid === id) self.setState({readerWordToast:null}); },2600); };

  R.readerWordSPill = function (k, sm) {
    var C = this.CRW, h = React.createElement, s = this.state.readerStatusMap[k];
    if (!s) return null;
    var cfg = {new:['Новое',C.muted,U.alpha(C.ink,.06)], learning:['Учу',C.blueTx,C.blueBg], known:['Знаю',C.greenDk,C.greenBg]}[s];
    if (!cfg) return null;
    return h('span',{style:{fontFamily:this.sans,fontSize:sm?10.5:11,fontWeight:600,color:cfg[1],background:cfg[2],padding:sm?'2px 7px':'3px 9px',borderRadius:20,whiteSpace:'nowrap',flexShrink:0}},cfg[0]);
  };

  R.readerWordCbx = function (w) {
    var C = this.CRW, h = React.createElement, self = this;
    if (!w.add) return h('div',{title:'Нет соответствия в русском тексте',style:{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',color:C.muted2,fontSize:16,flexShrink:0}},'–');
    var on = this.state.readerAddedSet.has(w.k);
    return h('button',{onClick:function(e){self.readerWordToggleAdded(w.k,e);},title:on?'Убрать из текста':'Показывать в тексте',style:{width:28,height:28,borderRadius:TK.radius,border:'1.5px solid '+(on?C.terra:C.line2),background:on?C.terra:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0,transition:'background .14s,border-color .14s'}}, on ? h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'#fff',strokeWidth:3,strokeLinecap:'round',strokeLinejoin:'round'},h('path',{d:'M5 12l5 5L20 6'})) : null);
  };

  R.readerWordWRow = function (w, isActive) {
    var C = this.CRW, h = React.createElement, self = this;
    return h('div',{key:w.k,id:'rw_row_'+w.k,onClick:function(e){self.readerWordClickRow(w.k,e);},style:{display:'flex',alignItems:'center',gap:10,padding:'9px 10px 9px 0',borderBottom:'1px solid '+C.line,cursor:'pointer',background:isActive?U.alpha(C.terra,.055):'transparent',borderLeft:'3px solid '+(isActive?C.terra:'transparent'),paddingLeft:isActive?9:0,opacity:!w.add?0.5:1,transition:'background .1s'}},
      h('span',{style:{fontFamily:this.sans,fontSize:11.5,color:C.muted2,width:32,textAlign:'right',flexShrink:0,lineHeight:1}},w.r),
      h('div',{style:{flex:1,minWidth:0}},
        h('div',{style:{display:'flex',alignItems:'baseline',gap:8}}, h('span',{style:{fontFamily:this.serif,fontSize:21,color:isActive?C.terra:C.blue,lineHeight:1.1,whiteSpace:'nowrap'}},w.g), h('span',{style:{fontFamily:this.sans,fontSize:12.5,color:C.muted,lineHeight:1,whiteSpace:'nowrap'}},w.t), h('span',{style:{fontFamily:this.sans,fontSize:11.5,color:C.muted2,lineHeight:1,whiteSpace:'nowrap'}},U.formatNum(w.freq)+' в НЗ')),
        h('div',{style:{fontFamily:this.serif,fontSize:15,color:C.ink,marginTop:2}},w.ru)),
      this.readerWordSPill(w.k,true),
      this.readerWordCbx(w));
  };

  R.readerWordGDiv = function (g) {
    var C = this.CRW, h = React.createElement;
    return h('div',{key:'rw_gd_'+g.key,style:{display:'flex',alignItems:'center',gap:9,padding:'14px 10px 6px 0'}},
      h('span',{style:{fontFamily:this.sans,fontSize:11,fontWeight:700,letterSpacing:TK.lsLabel,textTransform:'uppercase',color:C.terra,flexShrink:0}},g.label),
      h('span',{style:{flex:1,height:1,background:C.line2}}),
      h('span',{style:{fontFamily:this.sans,fontSize:11,color:C.muted2,flexShrink:0}},g.cov));
  };

  R.readerWordWListBody = function (pb) {
    var C = this.CRW, h = React.createElement, st = this.state, vc = st.readerWordVisibleCount, self = this;
    var filtered = this.readerWordGetFiltered(), groups = this.readerWordGetGroups(filtered), total = filtered.length;
    var items = []; var shown = 0;
    for (var gi = 0; gi < groups.length; gi++) {
      if (shown >= vc) break;
      var g = groups[gi];
      items.push(this.readerWordGDiv(g));
      for (var wi = 0; wi < g.words.length; wi++) {
        if (shown >= vc) break;
        items.push(this.readerWordWRow(g.words[wi], st.readerWordActiveKey === g.words[wi].k));
        shown++;
      }
    }
    if (total === 0) items.push(h('div',{key:'empty',style:{textAlign:'center',color:C.muted,fontFamily:this.sans,fontSize:14,padding:'48px 0'}},'Ничего не найдено'));
    else if (shown < total) items.push(h('div',{key:'more',style:{padding:'18px 0',textAlign:'center',fontFamily:this.sans,fontSize:12.5,color:C.muted2}},'Ещё '+(total-shown)+' слов — прокрутите вниз…'));
    return h('div',{style:{paddingBottom:pb||16}},items);
  };

  R.readerWordWCard = function (k) {
    if (!k) return null;
    var C = this.CRW, h = React.createElement, w = this.WORDS.find(function(x){ return x.k === k; }), self = this;
    if (!w) return null;
    var st = this.state, status = st.readerStatusMap[k], added = st.readerAddedSet.has(k);
    var sCfg = {new:{label:'Новое',col:C.muted,bg:U.alpha(C.ink,.05),bd:C.line2}, learning:{label:'Учу',col:C.blueTx,bg:C.blueBg,bd:U.alpha(C.blue,.5)}, known:{label:'Знаю',col:C.greenDk,bg:C.greenBg,bd:U.alpha(C.green,.6)}};
    return h('div',{style:{padding:'20px 20px 26px'}},
      h('div',{style:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}},
        h('div',null, h('div',{style:{fontFamily:this.serif,fontSize:46,color:C.blue,lineHeight:1}},w.g), h('div',{style:{fontFamily:this.serif,fontStyle:'italic',fontSize:17,color:C.muted,marginTop:3}},w.t)),
        h('button',{onClick:function(){self.readerWordCloseCard();},style:{width:32,height:32,borderRadius:TK.radius,border:'1px solid '+C.line,background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:4}}, U.iconX(C.inkSoft))),
      h('div',{style:{background:U.alpha(C.ink,.03),border:'1px solid '+C.line,borderRadius:13,padding:'13px 15px',marginBottom:14}},
        h('div',{style:{fontFamily:this.serif,fontSize:17,fontWeight:700,color:C.ink,lineHeight:1.4,marginBottom:7}},w.ru),
        h('div',{style:{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}},
          h('span',{style:{fontFamily:this.sans,fontSize:12,fontWeight:600,color:C.blueTx,background:C.blueBg,padding:'3px 9px',borderRadius:6,whiteSpace:'nowrap'}},w.posL),
          h('span',{style:{fontFamily:this.sans,fontSize:12,color:C.muted,whiteSpace:'nowrap'}},'Частота: '+U.formatNum(w.freq)),
          h('span',{style:{fontFamily:this.sans,fontSize:12,color:C.muted,whiteSpace:'nowrap'}},'ранг '+w.r+' в НЗ'),
          h('span',{style:{fontFamily:this.sans,fontSize:12,color:C.muted2,whiteSpace:'nowrap'}},'Strong '+w.strong))),
      h('div',{style:{marginBottom:14}},
        h('div',{style:{fontFamily:this.sans,fontSize:10.5,fontWeight:700,letterSpacing:'0.13em',textTransform:'uppercase',color:C.muted,marginBottom:8}},'Статус изучения'),
        h('div',{style:{display:'flex',gap:6}}, ['new','learning','known'].map(function(s){ var cfg = sCfg[s], on = status === s; return h('button',{key:s,onClick:function(){self.readerWordSetStatus(k,s);},style:{flex:1,padding:'8px 0',borderRadius:10,border:'1.5px solid '+(on?cfg.bd:C.line),background:on?cfg.bg:'transparent',color:on?cfg.col:C.muted,fontFamily:self.sans,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all .14s'}},cfg.label); }))),
      h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'12px 0',borderTop:'1px solid '+C.line}},
        h('div',{style:{minWidth:0}}, h('div',{style:{fontFamily:this.sans,fontSize:13.5,fontWeight:600,color:w.add?C.ink:C.muted2}},'Показывать в тексте'), h('div',{style:{fontFamily:this.sans,fontSize:11.5,color:C.muted,marginTop:2,lineHeight:1.3}}, w.add?'Заменяет слово в тексте чтения':'Нет соответствия в русском тексте')),
        w.add ? h('button',{onClick:function(e){self.readerWordToggleAdded(k,e);},style:{width:46,height:27,borderRadius:14,border:'none',cursor:'pointer',background:added?C.terra:U.alpha(C.ink,.1),position:'relative',transition:'background .2s',flexShrink:0}}, h('span',{style:{position:'absolute',top:3.5,left:added?22:3.5,width:20,height:20,borderRadius:10,background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,0.18)'}})) : h('span',{style:{fontFamily:this.sans,fontSize:18,color:C.muted2,flexShrink:0}},'–')));
  };

  R.readerWordSearchBar = function (mobile) {
    var C = this.CRW, h = React.createElement, st = this.state, self = this;
    return h('div',{style:{display:'flex',alignItems:'center',gap:8,background:C.read,border:'1px solid '+C.line2,borderRadius:TK.radius,padding:mobile?'8px 11px':'9px 13px',boxShadow:'0 1px 2px rgba(40,34,22,.05)'}},
      U.iconSearch(C.muted),
      h('input',{value:st.readerWordSearch,onChange:function(e){self.setState({readerWordSearch:e.target.value});},placeholder:'Поиск: λόγος или logos…',style:{flex:1,border:'none',background:'none',outline:'none',fontFamily:this.sans,fontSize:mobile?14:14.5,color:C.ink}}),
      st.readerWordSearch ? h('button',{onClick:function(){self.setState({readerWordSearch:''});},style:{background:'none',border:'none',cursor:'pointer',padding:2,display:'flex',alignItems:'center',color:C.muted2}},U.iconX(C.muted2,14)) : null);
  };

  R.readerWordEyePill = function () {
    var C = this.CRW, h = React.createElement, st = this.state;
    return h('button',{onClick:function(){this.setState({readerWordShowInText:!st.readerWordShowInText});}.bind(this),style:{display:'flex',alignItems:'center',gap:6,padding:'8px 13px',borderRadius:10,border:'1px solid '+(st.readerWordShowInText?U.alpha(C.terra,.45):C.line),background:st.readerWordShowInText?C.terraSoft:'transparent',color:st.readerWordShowInText?C.terra:C.muted,fontFamily:this.sans,fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}, U.iconEyeSmall(st.readerWordShowInText?C.terra:C.muted),'В тексте');
  };

  R.readerWordShowInTextCbx = function () {
    var C = this.CRW, h = React.createElement, st = this.state, self = this;
    var wordTotal = this.WORDS.filter(function(w){ return w.add; }).length;
    var wordChecked = st.readerAddedSet ? st.readerAddedSet.size : 0;
    var partial = !st.readerWordShowInText && wordChecked > 0 && wordChecked < wordTotal;
    var on = st.readerWordShowInText;
    var bg = on ? C.terra : partial ? U.alpha(C.terra, 0.15) : 'transparent';
    var bd = on ? C.terra : partial ? U.alpha(C.terra, 0.45) : C.line2;
    var icon = on ? h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'#fff',strokeWidth:3,strokeLinecap:'round',strokeLinejoin:'round'},h('path',{d:'M5 12l5 5L20 6'}))
      : partial ? h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:C.terra,strokeWidth:3,strokeLinecap:'round'},h('path',{d:'M6 12h12'})) : null;
    var title = on ? 'Показывать все слова' : partial ? 'Часть слов отмечена — показать только слова в тексте' : 'Только слова в тексте';
    return h('button',{onClick:function(){self.setState({readerWordShowInText:!st.readerWordShowInText});},title:title,style:{width:28,height:28,borderRadius:TK.radius,border:'1.5px solid '+bd,background:bg,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0,transition:'background .14s,border-color .14s'}}, icon);
  };

  R.readerWordPosOpts = function () { return [['all','Все'],['noun','Сущ.'],['verb','Глаг.'],['adj','Прил.'],['func','Служ.']]; };

  R.readerWordPosCount = function (v) {
    var st = this.state, q = st.readerWordSearch.trim().toLowerCase();
    return this.WORDS.filter(function(w){
      if (st.readerWordStatusFilter !== 'all' && st.readerStatusMap[w.k] !== st.readerWordStatusFilter) return false;
      if (st.readerWordShowInText && !st.readerAddedSet.has(w.k)) return false;
      if (q && !w.g.toLowerCase().includes(q) && !w.t.toLowerCase().includes(q)) return false;
      if (v !== 'all' && w.pos !== v) return false;
      return true;
    }).length;
  };

  R.readerWordPosDropdown = function (mobile) {
    var C = this.CRW, h = React.createElement, st = this.state, opts = this.readerWordPosOpts(), self = this;
    var cur = opts.find(function(o){ return o[0] === st.readerWordPosFilter; }) || opts[0];
    var open = st.readerWordPosMenuOpen;
    var menu = open ? h('div',{style:{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:50,minWidth:184,background:C.card,border:'1px solid '+C.cardLine,borderRadius:12,boxShadow:'0 16px 38px -12px rgba(40,34,22,.42)',padding:6,animation:'scPop .14s ease'}},
      opts.map(function(pair){ var v = pair[0], l = pair[1]; var on = st.readerWordPosFilter === v; return h('button',{key:v,onClick:function(){self.setState({readerWordPosFilter:v,readerWordPosMenuOpen:false});},style:{display:'flex',width:'100%',alignItems:'center',justifyContent:'space-between',gap:12,padding:'9px 11px',borderRadius:8,border:'none',background:on?U.alpha(C.blue,.1):'transparent',color:on?C.blueTx:C.inkSoft,fontFamily:this.sans,fontSize:13.5,fontWeight:on?700:500,cursor:'pointer',textAlign:'left'}},
        h('span',null,l), h('span',{style:{fontFamily:this.sans,fontSize:11.5,fontWeight:600,color:on?C.blueTx:C.muted2}},self.readerWordPosCount(v))); })) : null;
    return h('div',{'data-rwposmenu':'1',style:{position:'relative',flexShrink:0}},
      h('button',{onClick:function(){self.setState({readerWordPosMenuOpen:!open});},style:{display:'flex',alignItems:'center',gap:8,padding:mobile?'7px 11px':'8px 13px',borderRadius:10,border:'1px solid '+(open?U.alpha(C.blue,.4):C.line2),background:open?C.blueBg:C.read,color:C.ink,fontFamily:this.sans,fontSize:mobile?12.5:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}},
        h('span',{style:{color:C.muted,fontWeight:600}},'Часть речи:'), h('span',{style:{color:st.readerWordPosFilter==='all'?C.inkSoft:C.blueTx,fontWeight:700}},cur[1]), U.iconCaret(C.muted,open)), menu);
  };

  R.readerWordSOpts = function () { return [['all','Все'],['new','Новые'],['learning','Учу'],['known','Знаю']]; };

  R.readerWordStatusCount = function (v) {
    var st = this.state, q = st.readerWordSearch.trim().toLowerCase();
    return this.WORDS.filter(function(w){
      if (st.readerWordPosFilter !== 'all' && w.pos !== st.readerWordPosFilter) return false;
      if (st.readerWordShowInText && !st.readerAddedSet.has(w.k)) return false;
      if (q && !w.g.toLowerCase().includes(q) && !w.t.toLowerCase().includes(q)) return false;
      if (v !== 'all' && st.readerStatusMap[w.k] !== v) return false;
      return true;
    }).length;
  };

  R.readerWordSV3 = function () {
    var C = this.CRW, h = React.createElement, st = this.state, opts = this.readerWordSOpts(), self = this;
    var cur = opts.find(function(o){ return o[0] === st.readerWordStatusFilter; }) || opts[0];
    var open = st.readerWordSMenuOpen;
    var menu = open ? h('div',{style:{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:50,minWidth:182,background:C.card,border:'1px solid '+C.cardLine,borderRadius:12,boxShadow:'0 16px 38px -12px rgba(40,34,22,.42)',padding:6,animation:'scPop .14s ease'}},
      opts.map(function(pair){ var v = pair[0], l = pair[1]; var on = st.readerWordStatusFilter === v; return h('button',{key:v,onClick:function(){self.setState({readerWordStatusFilter:v,readerWordSMenuOpen:false});},style:{display:'flex',width:'100%',alignItems:'center',justifyContent:'space-between',gap:12,padding:'9px 11px',borderRadius:8,border:'none',background:on?U.alpha(C.ink,.07):'transparent',color:on?C.ink:C.inkSoft,fontFamily:this.sans,fontSize:13.5,fontWeight:on?700:500,cursor:'pointer',textAlign:'left'}},
        h('span',null,l), h('span',{style:{fontFamily:this.sans,fontSize:11.5,fontWeight:600,color:C.muted2}},self.readerWordStatusCount(v))); })) : null;
    var dd = h('div',{'data-rwsmenu':'1',style:{position:'relative',flexShrink:0}},
      h('button',{onClick:function(){self.setState({readerWordSMenuOpen:!open});},style:{display:'flex',alignItems:'center',gap:8,padding:'8px 13px',borderRadius:10,border:'1px solid '+(open?C.line2:C.line2),background:C.read,color:C.ink,fontFamily:this.sans,fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}},
        h('span',{style:{color:C.muted}},'Статус:'), h('span',{style:{fontWeight:700}},cur[1]),
        h('span',{style:{fontFamily:this.sans,fontSize:11.5,fontWeight:600,color:C.muted2}},self.readerWordStatusCount(st.readerWordStatusFilter)), U.iconCaret(C.muted,open)), menu);
    return h('div',{style:{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}, dd);
  };

  R.readerWordStatusBar = function () { return this.renderStatusBar(this.CRW); };

  R.readerWordToastEl = function (mobile) {
    var C = this.CRW, h = React.createElement;
    if (!this.state.readerWordToast) return null;
    return h('div',{'data-section':'word-toast',key:'rwtoast',style:{position:'absolute',left:'50%',bottom:mobile?88:22,transform:'translateX(-50%)',zIndex:60,background:U.alpha('#26221c',.96),color:'#f3eee2',fontFamily:this.sans,fontSize:13,fontWeight:500,padding:'10px 18px',borderRadius:12,maxWidth:290,textAlign:'center',boxShadow:'0 12px 32px -8px rgba(0,0,0,.42)',animation:'scToast .22s ease',whiteSpace:'nowrap'}},this.state.readerWordToast);
  };

  R.readerWordDeskContent = function () {
    var C = this.CRW, h = React.createElement, st = this.state, self = this, hasActive = !!st.readerWordActiveKey;
    var listPanel = h('div',{style:{flex:1,minWidth:0,display:'flex',flexDirection:'column',overflow:'hidden'}},
      h('div',{style:{flex:'0 0 auto',padding:'20px 28px 14px',borderBottom:'1px solid '+C.line}},
        h('div',{style:{display:'flex',alignItems:'baseline',gap:12,marginBottom:12}},
          h('span',{style:{fontFamily:this.serif,fontSize:25,fontWeight:700,color:C.ink}},'Словарь'),
          h('span',{style:{fontFamily:this.sans,fontSize:13,color:C.muted}},this.readerWordGetFiltered().length+' слов · 1000 самых частотных лемм НЗ')),
        h('div',{style:{marginBottom:11}},this.readerWordSearchBar(false)),
        h('div',{style:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}},
          this.readerWordSV3(), h('div',{style:{width:1,height:18,background:C.line2}}), this.readerWordPosDropdown(false),
          this.readerWordShowInTextCbx())),
      h('div',{id:'readerDeskWordList',className:'scScroll',style:{flex:1,overflowY:'auto',background:C.read}},
        h('div',{style:{maxWidth:640,padding:'0 28px 60px'}}, this.readerWordWListBody(24))));
    var inspector = h('div',{style:{width:hasActive?316:0,flex:'0 0 auto',borderLeft:hasActive?'1px solid '+C.cardLine:'none',overflow:'hidden',background:C.card,boxShadow:hasActive?'-14px 0 30px -24px rgba(40,34,22,.5)':'none',transition:'width .18s'}},
      hasActive ? h('div',{className:'scScroll',style:{width:316,height:'100%',overflowY:'auto'}},this.readerWordWCard(st.readerWordActiveKey)) : null);
    return h('div',{'data-section':'desk-word-content',id:'readerDeskMain',style:{flex:1,minWidth:0,display:'flex',position:'relative',overflow:'hidden'}}, listPanel, inspector);
  };

  R.readerWordSetupScroll = function (id) {
    var el = document.getElementById(id);
    if (!el || el._rwlOk) return;
    el._rwlOk = true;
    var self = this;
    var cb = function(){ if (el.scrollTop + el.clientHeight > el.scrollHeight - 180) { self.setState(function(s){ return {readerWordVisibleCount:Math.min(s.readerWordVisibleCount+15, self.WORDS.length+5)}; }); } };
    el.addEventListener('scroll', cb);
    if (!this._scrollCbs) this._scrollCbs = [];
    this._scrollCbs.push({el:el, cb:cb});
  };

  R._cleanupScrollListeners = function () {
    if (this._scrollCbs) { for (var i = 0; i < this._scrollCbs.length; i++) { var item = this._scrollCbs[i]; item.el.removeEventListener('scroll', item.cb); } this._scrollCbs = null; }
  };

  /* ---- shared utility aliases (used by readerWord* methods) ---- */

  R._hexToRgb = function (hex) { return U.hexToRgb(hex); };
  R._rgbToHex = function (a) { return U.rgbToHex(a); };
  R.wordMix = function (x, y, t) { return U.mixColor(x, y, t); };
  R.wordLum = function (hex) { return U.colorLuminance(hex); };
  R.wordFmt = function (n) { return U.formatNum(n); };
  R.wordIconSearch = function (c) { return U.iconSearch(c); };
  R.wordIconEye = function (c) { return U.iconEyeSmall(c); };

  window.RU2GR_RENDER = R;
})();
