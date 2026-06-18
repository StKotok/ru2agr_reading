/**
 * ru2gr-data.js — статические данные: словарь, стихи, буквы, статусы.
 * Загружается один раз, доступен как window.RU2GR_DATA.
 */
(function () {
  const LV_TABLE = {
    'Мягкий':       { elv: 0.02, lineAlpha: 0.06, line2Alpha: 0.10, shadowAlpha: 0.04 },
    'Чёткий':       { elv: 0.06, lineAlpha: 0.10, line2Alpha: 0.18, shadowAlpha: 0.14 },
    'Максимальный': { elv: 0.12, lineAlpha: 0.16, line2Alpha: 0.28, shadowAlpha: 0.26 },
  };

  const WORD_ELV_TABLE = {
    'Мягкий': 0.03,
    'Чёткий': 0.07,
    'Максимальный': 0.12,
  };

  // Русская буква → греческая
  const r2g = {
    'а':'α','б':'β','в':'β','г':'γ','д':'δ','е':'ε','з':'ζ','и':'ι','к':'κ','л':'λ','м':'μ',
    'н':'ν','о':'ο','п':'π','р':'ρ','с':'σ','т':'τ','у':'υ','ф':'φ','х':'χ',
  };

  // Буквы греческого алфавита
  const LET = {
    'α':{u:'Α',l:'α',name:'альфа',sound:'звучит примерно как «а»',eq:'Ближе всего к русской «а»'},
    'β':{u:'Β',l:'β',name:'бета',sound:'в койне читается как «в»',eq:'Ближе к русской «в»'},
    'γ':{u:'Γ',l:'γ',name:'гамма',sound:'читается как «г»',eq:'Русская «г»'},
    'δ':{u:'Δ',l:'δ',name:'дельта',sound:'читается как «д»',eq:'Русская «д»'},
    'ε':{u:'Ε',l:'ε',name:'эпсилон',sound:'краткое «э / е»',eq:'Русская «е»'},
    'ζ':{u:'Ζ',l:'ζ',name:'дзета',sound:'читается как «з / дз»',eq:'Близко к русской «з»'},
    'ι':{u:'Ι',l:'ι',name:'йота',sound:'читается как «и»',eq:'Русская «и»'},
    'κ':{u:'Κ',l:'κ',name:'каппа',sound:'читается как «к»',eq:'Русская «к»'},
    'λ':{u:'Λ',l:'λ',name:'ламбда',sound:'читается как «л»',eq:'Русская «л»'},
    'μ':{u:'Μ',l:'μ',name:'мю',sound:'читается как «м»',eq:'Русская «м»'},
    'ν':{u:'Ν',l:'ν',name:'ню',sound:'читается примерно как «н»',eq:'Ближе всего к русской «н»'},
    'ο':{u:'Ο',l:'ο',name:'омикрон',sound:'краткое «о»',eq:'Русская «о»'},
    'π':{u:'Π',l:'π',name:'пи',sound:'читается как «п»',eq:'Русская «п»'},
    'ρ':{u:'Ρ',l:'ρ',name:'ро',sound:'читается как «р»',eq:'Русская «р»'},
    'σ':{u:'Σ',l:'σ',name:'сигма',sound:'читается как «с»',eq:'Русская «с» (в конце слова — ς)'},
    'τ':{u:'Τ',l:'τ',name:'тау',sound:'читается как «т»',eq:'Русская «т»'},
    'υ':{u:'Υ',l:'υ',name:'ипсилон',sound:'читается как «ю / и»',eq:'Между русскими «у» и «и»'},
    'φ':{u:'Φ',l:'φ',name:'фи',sound:'читается как «ф»',eq:'Русская «ф»'},
    'χ':{u:'Χ',l:'χ',name:'хи',sound:'читается как «х»',eq:'Русская «х»'},
  };

  // Словарные статьи (детальные карточки)
  const A = {
    eimi:{lemma:'εἰμί',defaultForm:'ἐστί',translit:'estí / es-tee’',pos:'глаг.',strong:'G2076',rank:'Топ-10',freq:'2 458×',morph:['неопр.','неизм.'],inThisVerse:'есть',also:'является, значит, означает (толкование), принадлежит (владение)',defn:'Глагол бытия: «есть, является, существует». Самый частотный глагол НЗ. Употребляется как связка, для выражения существования, принадлежности, тождества. Имеет богатую систему спряжения с супплетивными формами.',deriv:'Первичный глагол бытия; индоевропейский корень *es- (быть).'},
    logos:{lemma:'λόγος',defaultForm:'λόγος',translit:'lógos',pos:'сущ.',strong:'G3056',rank:'Топ-100',freq:'330×',morph:['муж. род','ед. ч.','им. п.'],inThisVerse:'слово',also:'речь, весть, разум, смысл, учение',defn:'Слово, речь, весть; разумное основание, смысл. В прологе Иоанна — Логос, предвечное Слово.',deriv:'От λέγω «говорить, собирать».'},
    theos:{lemma:'θεός',defaultForm:'θεός',translit:'theós',pos:'сущ.',strong:'G2316',rank:'Топ-20',freq:'1 317×',morph:['муж. род','ед. ч.'],inThisVerse:'Бог',also:'Бог, божество',defn:'Бог; верховное Божество. В НЗ — Бог Отец, а также употребляется о Христе.',deriv:'Древнее индоевропейское слово для божества.'},
    phos:{lemma:'φῶς',defaultForm:'φῶς',translit:'phôs',pos:'сущ.',strong:'G5457',rank:'Топ-300',freq:'73×',morph:['ср. род','ед. ч.'],inThisVerse:'свет',also:'свет, сияние, источник света',defn:'Свет — физический и духовный; символ истины, святости и присутствия Божия.',deriv:'От φάος; корень φα- «светить, являть».'},
    anthropos:{lemma:'ἄνθρωπος',defaultForm:'ἄνθρωπος',translit:'ánthrōpos',pos:'сущ.',strong:'G444',rank:'Топ-50',freq:'550×',morph:['муж. род','ед. ч.'],inThisVerse:'человек',also:'человек, люди, мужчина',defn:'Человек как родовое понятие; человеческое существо.',deriv:'Возможно от ἀνήρ «муж» + ὤψ «лицо».'},
    hina:{lemma:'ἵνα',defaultForm:'ἵνα',translit:'hína',pos:'союз',strong:'G2443',rank:'Топ-50',freq:'663×',morph:['неизм.'],inThisVerse:'чтобы',also:'чтобы, дабы, так что',defn:'Союз цели: «чтобы, дабы». Вводит придаточные цели и следствия.',deriv:'Древний союз цели.'},
    ou:{lemma:'οὐ',defaultForm:'οὐ',translit:'ou',pos:'частица',strong:'G3756',rank:'Топ-20',freq:'1 606×',morph:['неизм.'],inThisVerse:'не',also:'не, нет (отрицание факта)',defn:'Отрицательная частица «не». Отрицает реальный факт — в отличие от μή.',deriv:'Древняя отрицательная частица.'},
    alla:{lemma:'ἀλλά',defaultForm:'ἀλλά',translit:'allá',pos:'союз',strong:'G235',rank:'Топ-50',freq:'638×',morph:['неизм.'],inThisVerse:'но',also:'но, а, однако, напротив',defn:'Противительный союз «но, а». Вводит сильное противопоставление.',deriv:'Множ. ср. рода от ἄλλος «другой».'},
    eis:{lemma:'εἰς',defaultForm:'εἰς',translit:'eis',pos:'предлог',strong:'G1519',rank:'Топ-10',freq:'1 767×',morph:['+ вин. п.'],inThisVerse:'в',also:'в, на, для, к (направление, цель)',defn:'Предлог с винительным падежом: движение внутрь, направление, цель.',deriv:'Связан с ἐν «в».'},
    hos:{lemma:'ὅς',defaultForm:'ὅς',translit:'hós',pos:'мест.',strong:'G3739',rank:'Топ-20',freq:'1 365×',morph:['относит.'],inThisVerse:'который',also:'который, кто, что',defn:'Относительное местоимение «который, кто, что».',deriv:'Древнее относительное местоимение.'},
    pas:{lemma:'πᾶς',defaultForm:'πᾶς',translit:'pâs',pos:'прил.',strong:'G3956',rank:'Топ-20',freq:'1 243×',morph:['всякий','каждый'],inThisVerse:'всякий',also:'весь, всякий, каждый, все',defn:'Весь, всякий, каждый. Обозначает полноту или совокупность.',deriv:'Древнее индоевропейское слово.'},
  };

  // Стихи для экрана чтения (Ин 1:1-9)
  const RAW_VERSES = [
    {n:1, ru:"В начале {было|eimi:ἦν} {Слово|logos:λόγος}, и {Слово|logos:λόγος} {было|eimi:ἦν} у {Бога|theos:θεόν}, и {Слово|logos:λόγος} {было|eimi:ἦν} {Бог|theos:θεὸς}.", gr:"Ἐν ἀρχῇ {ἦν|be} ὁ {λόγος|logos}, καὶ ὁ {λόγος|logos} {ἦν|be} πρὸς τὸν {θεόν|theos}, καὶ {θεὸς|theos} {ἦν|be} ὁ {λόγος|logos}."},
    {n:2, ru:"Оно {было|eimi:ἦν} в начале у {Бога|theos:θεόν}.", gr:"οὗτος {ἦν|be} ἐν ἀρχῇ πρὸς τὸν {θεόν|theos}."},
    {n:3, ru:"Все чрез Него начало быть, и без Него ничто не начало быть, что начало быть.", gr:"πάντα δι’ αὐτοῦ ἐγένετο, καὶ χωρὶς αὐτοῦ ἐγένετο οὐδὲ ἕν ὃ γέγονεν."},
    {n:4, ru:"В Нем {была|eimi:ἦν} жизнь, и жизнь {была|eimi:ἦν} {свет|phos:φῶς} {человеков|anthropos:ἀνθρώπων}.", gr:"ἐν αὐτῷ ζωὴ {ἦν|be}, καὶ ἡ ζωὴ {ἦν|be} τὸ {φῶς|phos} τῶν {ἀνθρώπων|anthropos}·"},
    {n:5, ru:"И {свет|phos:φῶς} во тьме светит, и тьма {не|ou:οὐ} объяла его.", gr:"καὶ τὸ {φῶς|phos} ἐν τῇ σκοτίᾳ φαίνει, καὶ ἡ σκοτία αὐτὸ {οὐ|ou} κατέλαβεν."},
    {n:6, ru:"{Был|eimi:ἦν} {человек|anthropos:ἄνθρωπος}, посланный от {Бога|theos:θεοῦ}; имя ему Иоанн.", gr:"ἐγένετο {ἄνθρωπος|anthropos} ἀπεσταλμένος παρὰ {θεοῦ|theos}, ὄνομα αὐτῷ Ἰωάννης·"},
    {n:7, ru:"Он пришел для свидетельства, {чтобы|hina:ἵνα} свидетельствовать о {Свете|phos:φωτός}, {дабы|hina:ἵνα} {все|pas:πάντες} уверовали чрез него.", gr:"οὗτος ἦλθεν {εἰς|eis} μαρτυρίαν, {ἵνα|hina} μαρτυρήσῃ περὶ τοῦ {φωτός|phos}, {ἵνα|hina} {πάντες|pas} πιστεύσωσιν δι’ αὐτοῦ."},
    {n:8, ru:"Он {не|ou:οὐκ} {был|eimi:ἦν} {свет|phos:φῶς}, {но|alla:ἀλλ’} был послан, {чтобы|hina:ἵνα} свидетельствовать о {Свете|phos:φωτός}.", gr:"{οὐκ|ou} {ἦν|be} ἐκεῖνος τὸ {φῶς|phos}, {ἀλλ’|alla} {ἵνα|hina} μαρτυρήσῃ περὶ τοῦ {φωτός|phos}."},
    {n:9, ru:"{Был|eimi:ἦν} {Свет|phos:φῶς} истинный, {Который|hos:ὃ} просвещает {всякого человека|anthropos:ἄνθρωπον}, приходящего {в|eis:εἰς} мир.", gr:"{Ἦν|be} τὸ {φῶς|phos} τὸ ἀληθινόν, {ὃ|hos} φωτίζει {πάντα|pas} {ἄνθρωπον|anthropos}, ἐρχόμενον {εἰς|eis} τὸν κόσμον."},
  ];

  // Стихи-продолжение (затемнение)
  const CONT_VERSES = [
    {n:10, ru:"В мире был, и мир чрез Него начало быть, и мир Его не познал."},
    {n:11, ru:"Пришел к своим, и свои Его не приняли."},
  ];

  // Группы словаря
  const DICT_GROUPS = [
    {grp:'Топ-10', cov:'≈ 38% всех словоупотреблений НЗ', rows:[
      {r:1,g:'ὁ',t:'ho',f:'19 783×',k:'ho',add:false},
      {r:3,g:'αὐτός',t:'autós',f:'5 597×',k:'autos',add:true},
      {r:5,g:'δέ',t:'dé',f:'2 792×',k:'de',add:false},
      {r:7,g:'ἐγώ',t:'egṓ',f:'2 584×',k:'ego',add:true},
      {r:8,g:'εἰμί',t:'eimí',f:'2 462×',k:'eimi',add:true},
      {r:9,g:'λέγω',t:'légō',f:'2 353×',k:'lego',add:true},
      {r:10,g:'εἰς',t:'eis',f:'1 767×',k:'eis',add:true},
    ]},
    {grp:'Топ-50', cov:'≈ 57% покрытия текста', rows:[
      {r:11,g:'οὐ',t:'ou',f:'1 606×',k:'ou',add:true},
      {r:13,g:'ὅς',t:'hós',f:'1 365×',k:'hos',add:true},
      {r:14,g:'θεός',t:'theós',f:'1 317×',k:'theos',add:true},
      {r:16,g:'πᾶς',t:'pâs',f:'1 243×',k:'pas',add:true},
      {r:19,g:'Ἰησοῦς',t:'Iēsoûs',f:'917×',k:'iesous',add:true},
      {r:22,g:'κύριος',t:'kýrios',f:'717×',k:'kyrios',add:true},
      {r:25,g:'γίνομαι',t:'gínomai',f:'669×',k:'ginomai',add:true},
      {r:27,g:'ἵνα',t:'hína',f:'663×',k:'hina',add:true},
      {r:31,g:'ἀλλά',t:'allá',f:'638×',k:'alla',add:true},
    ]},
    {grp:'Топ-100', cov:'≈ 64% покрытия текста', rows:[
      {r:36,g:'ἄνθρωπος',t:'ánthrōpos',f:'550×',k:'anthropos',add:true},
      {r:53,g:'λόγος',t:'lógos',f:'330×',k:'logos',add:true},
      {r:78,g:'δόξα',t:'dóxa',f:'166×',k:'doxa',add:true},
    ]},
    {grp:'Топ-300', cov:'≈ 75% покрытия текста', rows:[
      {r:142,g:'ζωή',t:'zōḗ',f:'135×',k:'zoe',add:true},
      {r:198,g:'φῶς',t:'phôs',f:'73×',k:'phos',add:true},
      {r:265,g:'σκοτία',t:'skotía',f:'17×',k:'skotia',add:true},
    ]},
  ];

  // Названия режимов
  const MODE_NAMES = ['Только греческие буквы','Леммы из словаря','Реальные формы оригинала','Греческий основной'];
  const MODE_SHORT = ['Буквы','Леммы','Формы','Греческий'];
  const MODE_DESC = [
    'Русские буквы постепенно заменяются греческими',
    'Слова из вашего словаря — в словарной форме',
    'Слова из словаря — в реальной форме оригинала',
    'Греческий текст, русский перевод под стихом',
  ];

  // Заголовки секций карточки слова
  const SEC_LABELS = {
    gram:'Грамматика', pron:'Произношение', dict:'Словарная форма',
    trans:'Перевод', status:'Статус', mean:'Значения',
    defn:'Определение', deriv:'Деривация',
  };

  // Полный список слов (1000 самых частотных лемм НЗ, выборочно для прототипа)
  const WORDS = [
    {k:'ho',        r:1,   g:'ὁ',           t:'ho',          ru:'— (артикль)',              pos:'func', posL:'Арт.',     freq:19783, strong:'G3588', add:false},
    {k:'kai',       r:2,   g:'καί',          t:'kaí',         ru:'и, также, даже',           pos:'func', posL:'Союз',     freq:9161,  strong:'G2532', add:false},
    {k:'autos',     r:3,   g:'αὐτός',        t:'autós',       ru:'он, сам, тот же',          pos:'func', posL:'Мест.',    freq:5597,  strong:'G846',  add:true},
    {k:'sy',        r:4,   g:'σύ',           t:'sý',          ru:'ты',                       pos:'func', posL:'Мест.',    freq:2907,  strong:'G4771', add:true},
    {k:'de',        r:5,   g:'δέ',           t:'dé',          ru:'же, но, а',                pos:'func', posL:'Частица',  freq:2792,  strong:'G1161', add:false},
    {k:'en',        r:6,   g:'ἐν',           t:'en',          ru:'в, на, среди',             pos:'func', posL:'Предлог',  freq:2752,  strong:'G1722', add:true},
    {k:'ego',       r:7,   g:'ἐγώ',          t:'egṓ',         ru:'я',                        pos:'func', posL:'Мест.',    freq:2584,  strong:'G1473', add:true},
    {k:'eimi',      r:8,   g:'εἰμί',         t:'eimí',        ru:'быть, есть, являться',     pos:'verb', posL:'Глаг.',    freq:2462,  strong:'G1510', add:true},
    {k:'lego',      r:9,   g:'λέγω',         t:'légō',        ru:'говорить, сказать',        pos:'verb', posL:'Глаг.',    freq:2353,  strong:'G3004', add:true},
    {k:'eis',       r:10,  g:'εἰς',          t:'eis',         ru:'в, на, к (направление)',   pos:'func', posL:'Предлог',  freq:1767,  strong:'G1519', add:true},
    {k:'ou',        r:11,  g:'οὐ',           t:'ou',          ru:'не, нет (факт)',            pos:'func', posL:'Частица',  freq:1606,  strong:'G3756', add:true},
    {k:'houtos',    r:12,  g:'οὗτος',        t:'hoûtos',      ru:'этот, сей',                pos:'func', posL:'Мест.',    freq:1388,  strong:'G3778', add:true},
    {k:'hos',       r:13,  g:'ὅς',           t:'hós',         ru:'который, кто, что',        pos:'func', posL:'Мест.',    freq:1365,  strong:'G3739', add:true},
    {k:'theos',     r:14,  g:'θεός',         t:'theós',       ru:'Бог, бог',                 pos:'noun', posL:'Сущ.',     freq:1317,  strong:'G2316', add:true},
    {k:'hoti',      r:15,  g:'ὅτι',          t:'hóti',        ru:'что, потому что',          pos:'func', posL:'Союз',     freq:1296,  strong:'G3754', add:false},
    {k:'pas',       r:16,  g:'πᾶς',          t:'pâs',         ru:'весь, всякий, каждый',     pos:'adj',  posL:'Прил.',    freq:1243,  strong:'G3956', add:true},
    {k:'me',        r:17,  g:'μή',           t:'mḗ',          ru:'не (запрет, сомнение)',    pos:'func', posL:'Частица',  freq:1042,  strong:'G3361', add:false},
    {k:'gar',       r:18,  g:'γάρ',          t:'gár',         ru:'ибо, ведь, так как',       pos:'func', posL:'Союз',     freq:1041,  strong:'G1063', add:false},
    {k:'iesous',    r:19,  g:'Ἰησοῦς',       t:'Iēsoûs',      ru:'Иисус',                    pos:'noun', posL:'Сущ.',     freq:917,   strong:'G2424', add:true},
    {k:'ek',        r:20,  g:'ἐκ',           t:'ek',          ru:'из, от (исходная точка)',  pos:'func', posL:'Предлог',  freq:914,   strong:'G1537', add:true},
    {k:'kyrios',    r:21,  g:'κύριος',       t:'kýrios',      ru:'Господь, владыка',         pos:'noun', posL:'Сущ.',     freq:717,   strong:'G2962', add:true},
    {k:'echo',      r:22,  g:'ἔχω',          t:'échō',        ru:'иметь, держать',           pos:'verb', posL:'Глаг.',    freq:708,   strong:'G2192', add:true},
    {k:'pros',      r:23,  g:'πρός',         t:'prós',        ru:'к, у, для',                pos:'func', posL:'Предлог',  freq:700,   strong:'G4314', add:false},
    {k:'ginomai',   r:24,  g:'γίνομαι',      t:'gínomai',     ru:'быть, становиться',        pos:'verb', posL:'Глаг.',    freq:669,   strong:'G1096', add:true},
    {k:'hina',      r:25,  g:'ἵνα',          t:'hína',        ru:'чтобы, дабы',              pos:'func', posL:'Союз',     freq:663,   strong:'G2443', add:true},
    {k:'apo',       r:26,  g:'ἀπό',          t:'apó',         ru:'от, из (удаление)',        pos:'func', posL:'Предлог',  freq:646,   strong:'G0575', add:false},
    {k:'alla',      r:27,  g:'ἀλλά',         t:'allá',        ru:'но, а, однако',            pos:'func', posL:'Союз',     freq:638,   strong:'G0235', add:true},
    {k:'dia',       r:28,  g:'διά',          t:'diá',         ru:'через, ради, по причине',  pos:'func', posL:'Предлог',  freq:667,   strong:'G1223', add:false},
    {k:'kata',      r:29,  g:'κατά',         t:'katá',        ru:'по, согласно, против',     pos:'func', posL:'Предлог',  freq:473,   strong:'G2596', add:false},
    {k:'christos',  r:30,  g:'Χριστός',      t:'Christós',    ru:'Христос, Мессия',          pos:'noun', posL:'Сущ.',     freq:529,   strong:'G5547', add:true},
    {k:'anthropos', r:31,  g:'ἄνθρωπος',     t:'ánthrōpos',   ru:'человек, люди',            pos:'noun', posL:'Сущ.',     freq:550,   strong:'G0444', add:true},
    {k:'pneuma',    r:32,  g:'πνεῦμα',       t:'pneûma',      ru:'дух, дыхание, ветер',      pos:'noun', posL:'Сущ.',     freq:379,   strong:'G4151', add:true},
    {k:'huios',     r:33,  g:'υἱός',         t:'hyiós',       ru:'сын',                      pos:'noun', posL:'Сущ.',     freq:377,   strong:'G5207', add:true},
    {k:'erchomai',  r:34,  g:'ἔρχομαι',      t:'érchomai',    ru:'приходить, идти',          pos:'verb', posL:'Глаг.',    freq:636,   strong:'G2064', add:true},
    {k:'poieo',     r:35,  g:'ποιέω',        t:'poiéō',       ru:'делать, творить',          pos:'verb', posL:'Глаг.',    freq:568,   strong:'G4160', add:true},
    {k:'pater',     r:36,  g:'πατήρ',        t:'patḗr',       ru:'отец',                     pos:'noun', posL:'Сущ.',     freq:413,   strong:'G3962', add:true},
    {k:'akouo',     r:37,  g:'ἀκούω',        t:'akoúō',       ru:'слышать, слушать',         pos:'verb', posL:'Глаг.',    freq:428,   strong:'G0191', add:true},
    {k:'pisteuo',   r:38,  g:'πιστεύω',      t:'pisteúō',     ru:'верить, доверять',         pos:'verb', posL:'Глаг.',    freq:241,   strong:'G4100', add:true},
    {k:'adelphos',  r:39,  g:'ἀδελφός',      t:'adelphós',    ru:'брат',                     pos:'noun', posL:'Сущ.',     freq:343,   strong:'G0080', add:true},
    {k:'agapao',    r:40,  g:'ἀγαπάω',       t:'agapáō',      ru:'любить',                   pos:'verb', posL:'Глаг.',    freq:143,   strong:'G0025', add:true},
    {k:'agape',     r:41,  g:'ἀγάπη',        t:'agápē',       ru:'любовь',                   pos:'noun', posL:'Сущ.',     freq:116,   strong:'G0026', add:true},
    {k:'eirene',    r:42,  g:'εἰρήνη',       t:'eirḗnē',      ru:'мир, покой',               pos:'noun', posL:'Сущ.',     freq:92,    strong:'G1515', add:true},
    {k:'charis',    r:43,  g:'χάρις',        t:'cháris',      ru:'благодать, милость',       pos:'noun', posL:'Сущ.',     freq:155,   strong:'G5485', add:true},
    {k:'pistis',    r:44,  g:'πίστις',       t:'pístis',      ru:'вера, верность',           pos:'noun', posL:'Сущ.',     freq:243,   strong:'G4102', add:true},
    {k:'zoe',       r:45,  g:'ζωή',          t:'zōḗ',         ru:'жизнь',                    pos:'noun', posL:'Сущ.',     freq:135,   strong:'G2222', add:true},
    {k:'nomos',     r:46,  g:'νόμος',        t:'nómos',       ru:'закон',                    pos:'noun', posL:'Сущ.',     freq:194,   strong:'G3551', add:true},
    {k:'kosmos',    r:47,  g:'κόσμος',       t:'kósmos',      ru:'мир, вселенная',           pos:'noun', posL:'Сущ.',     freq:186,   strong:'G2889', add:true},
    {k:'hagios',    r:48,  g:'ἅγιος',        t:'hágios',      ru:'святой, посвящённый',      pos:'adj',  posL:'Прил.',    freq:233,   strong:'G0040', add:true},
    {k:'aletheia',  r:49,  g:'ἀλήθεια',      t:'alḗtheia',    ru:'истина, правда',           pos:'noun', posL:'Сущ.',     freq:109,   strong:'G0225', add:true},
    {k:'hamartia',  r:50,  g:'ἁμαρτία',      t:'hamartía',    ru:'грех',                     pos:'noun', posL:'Сущ.',     freq:173,   strong:'G0266', add:true},
    {k:'logos',     r:53,  g:'λόγος',        t:'lógos',       ru:'слово, речь, разум',       pos:'noun', posL:'Сущ.',     freq:330,   strong:'G3056', add:true},
    {k:'ekklesia',  r:58,  g:'ἐκκλησία',     t:'ekklēsía',    ru:'церковь, собрание',        pos:'noun', posL:'Сущ.',     freq:114,   strong:'G1577', add:true},
    {k:'basileia',  r:61,  g:'βασιλεία',     t:'basileía',    ru:'царство, власть царя',     pos:'noun', posL:'Сущ.',     freq:162,   strong:'G0932', add:true},
    {k:'doxa',      r:66,  g:'δόξα',         t:'dóxa',        ru:'слава, честь',             pos:'noun', posL:'Сущ.',     freq:166,   strong:'G1391', add:true},
    {k:'euangelion',r:69,  g:'εὐαγγέλιον',   t:'euangélion',  ru:'евангелие, благая весть',  pos:'noun', posL:'Сущ.',     freq:76,    strong:'G2098', add:true},
    {k:'sarx',      r:72,  g:'σάρξ',         t:'sárx',        ru:'плоть, тело',              pos:'noun', posL:'Сущ.',     freq:147,   strong:'G4561', add:true},
    {k:'kardia',    r:75,  g:'καρδία',       t:'kardía',      ru:'сердце',                   pos:'noun', posL:'Сущ.',     freq:156,   strong:'G2588', add:true},
    {k:'psyche',    r:78,  g:'ψυχή',         t:'psychḗ',      ru:'душа, жизнь',              pos:'noun', posL:'Сущ.',     freq:103,   strong:'G5590', add:true},
    {k:'ge',        r:80,  g:'γῆ',           t:'gē',          ru:'земля, почва',             pos:'noun', posL:'Сущ.',     freq:250,   strong:'G1093', add:true},
    {k:'horao',     r:83,  g:'ὁράω',         t:'horáō',       ru:'видеть, смотреть',         pos:'verb', posL:'Глаг.',    freq:454,   strong:'G3708', add:true},
    {k:'ouranos',   r:86,  g:'οὐρανός',      t:'ouranós',     ru:'небо, небеса',             pos:'noun', posL:'Сущ.',     freq:273,   strong:'G3772', add:true},
    {k:'dynamis',   r:89,  g:'δύναμις',      t:'dýnamis',     ru:'сила, мощь, чудо',         pos:'noun', posL:'Сущ.',     freq:119,   strong:'G1411', add:true},
    {k:'ergon',     r:92,  g:'ἔργον',        t:'érgon',       ru:'дело, труд, работа',       pos:'noun', posL:'Сущ.',     freq:169,   strong:'G2041', add:true},
    {k:'onoma',     r:95,  g:'ὄνομα',        t:'ónoma',       ru:'имя',                      pos:'noun', posL:'Сущ.',     freq:228,   strong:'G3686', add:true},
    {k:'thanatos',  r:98,  g:'θάνατος',      t:'thánatos',    ru:'смерть',                   pos:'noun', posL:'Сущ.',     freq:120,   strong:'G2288', add:true},
    {k:'phone',     r:101, g:'φωνή',         t:'phōnḗ',       ru:'голос, звук',              pos:'noun', posL:'Сущ.',     freq:139,   strong:'G5456', add:true},
    {k:'hodos',     r:104, g:'ὁδός',         t:'hodós',       ru:'путь, дорога',             pos:'noun', posL:'Сущ.',     freq:101,   strong:'G3598', add:true},
    {k:'exousia',   r:107, g:'ἐξουσία',      t:'exousía',     ru:'власть, право',            pos:'noun', posL:'Сущ.',     freq:102,   strong:'G1849', add:true},
    {k:'grapho',    r:112, g:'γράφω',        t:'gráphō',      ru:'писать, записывать',       pos:'verb', posL:'Глаг.',    freq:191,   strong:'G1125', add:true},
    {k:'cheir',     r:116, g:'χείρ',         t:'cheír',       ru:'рука',                     pos:'noun', posL:'Сущ.',     freq:177,   strong:'G5495', add:true},
    {k:'mathetes',  r:120, g:'μαθητής',      t:'mathētḗs',    ru:'ученик, последователь',    pos:'noun', posL:'Сущ.',     freq:261,   strong:'G3101', add:true},
    {k:'apostolos', r:125, g:'ἀπόστολος',    t:'apóstolos',   ru:'апостол, посланник',       pos:'noun', posL:'Сущ.',     freq:80,    strong:'G0652', add:true},
    {k:'phos',      r:198, g:'φῶς',          t:'phôs',        ru:'свет, сияние',             pos:'noun', posL:'Сущ.',     freq:73,    strong:'G5457', add:true},
    {k:'angelos',   r:218, g:'ἄγγελος',      t:'ángelos',     ru:'ангел, вестник',           pos:'noun', posL:'Сущ.',     freq:175,   strong:'G0032', add:true},
    {k:'nekros',    r:230, g:'νεκρός',       t:'nekrós',      ru:'мёртвый, умерший',         pos:'adj',  posL:'Прил.',    freq:128,   strong:'G3498', add:true},
    {k:'skotia',    r:265, g:'σκοτία',       t:'skotía',      ru:'тьма, мрак',               pos:'noun', posL:'Сущ.',     freq:17,    strong:'G4653', add:true},
  ];

  // Группы слов по частотности
  const GROUPS = [
    {key:'g10',  label:'Топ-10',  cov:'≈ 38% всех словоупотреблений НЗ', min:1,   max:10},
    {key:'g50',  label:'Топ-50',  cov:'≈ 57% покрытия текста',           min:11,  max:50},
    {key:'g100', label:'Топ-100', cov:'≈ 64% покрытия текста',           min:51,  max:100},
    {key:'g300', label:'Топ-300', cov:'≈ 75% покрытия текста',           min:101, max:300},
  ];

  // Наборы статусов по умолчанию
  const KNOWN_SET = new Set(['ho','kai','autos','de','en','ego','eimi','lego','eis','ou','theos','iesous','kyrios','christos','logos']);
  const LEARN_SET = new Set(['sy','hoti','pas','ek','echo','ginomai','hina','alla','houtos','hos','pisteuo','pistis','kosmos','pneuma','phos','zoe']);
  const NEW_SET   = new Set(['me','gar','pros','apo','dia','kata','anthropos','huios','erchomai','poieo','pater','akouo','adelphos','agapao','agape','eirene','charis','nomos','hagios','aletheia','hamartia']);

  // Переопределения статусов для конкретных слов
  const STATUS_OVERRIDES = {
    eimi:'learning', anthropos:'learning', hina:'new', alla:'new',
    hos:'new', pas:'new', autos:'learning', ego:'learning',
    lego:'learning', ginomai:'new', zoe:'learning',
  };

  /** Вычислить начальный readerAddedSet: слова с add=true и рангом ≤45 */
  function computeReaderAddedSet(words) {
    return new Set(words.filter(function (w) { return w.add && w.r <= 45; }).map(function (w) { return w.k; }));
  }

  /** Вычислить начальный readerStatusMap из наборов и переопределений */
  function computeReaderStatusMap(words) {
    const map = {};
    words.forEach(function (w) {
      if      (KNOWN_SET.has(w.k)) map[w.k] = 'known';
      else if (LEARN_SET.has(w.k)) map[w.k] = 'learning';
      else if (NEW_SET.has(w.k))   map[w.k] = 'new';
      else                          map[w.k] = null;
    });
    Object.assign(map, STATUS_OVERRIDES);
    return map;
  }

  window.RU2GR_DATA = {
    LV_TABLE: LV_TABLE,
    WORD_ELV_TABLE: WORD_ELV_TABLE,
    r2g: r2g,
    LET: LET,
    A: A,
    RAW_VERSES: RAW_VERSES,
    CONT_VERSES: CONT_VERSES,
    DICT_GROUPS: DICT_GROUPS,
    WORDS: WORDS,
    GROUPS: GROUPS,
    MODE_NAMES: MODE_NAMES,
    MODE_SHORT: MODE_SHORT,
    MODE_DESC: MODE_DESC,
    SEC_LABELS: SEC_LABELS,
    KNOWN_SET: KNOWN_SET,
    LEARN_SET: LEARN_SET,
    NEW_SET: NEW_SET,
    STATUS_OVERRIDES: STATUS_OVERRIDES,
    computeReaderAddedSet: computeReaderAddedSet,
    computeReaderStatusMap: computeReaderStatusMap,
  };
})();
