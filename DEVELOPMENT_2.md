# DEVELOPMENT.underline2.md — «Греческая читалка Нового Завета»

> **Для агентов-исполнителей:** задачи выполняются последовательно, сверху вниз.
> Каждая задача — один коммит. Прогресс отмечается чекбоксами (`- [x]`).
> Перед началом задачи прочитай разделы «Архитектура» и «Функциональная спецификация».
> После каждой задачи: `npm test` зелёный, `npm run build` чистый, ручная проверка пройдена.

**Цель:** спокойная библейская читалка Нового Завета (PWA, offline-first) с регулируемым греческим слоем. Пользователь читает Синодальный перевод, а греческий постепенно «просвечивает» в тексте: сначала буквы (режимы 1–2), потом слова из личного словаря (режим 3), потом реальные формы оригинала (режим 4), и наконец — сам греческий текст с русской подсказкой (режим 5).

**Стек:** vanilla JS (ES modules, без фреймворка), Vite + vite-plugin-pwa, CSS custom properties, IndexedDB, Service Worker. Dev-зависимости: Node 20+, Vitest. Деплой — статика из `dist/`.

---

## 1. Видение продукта

Это **не учебник и не словарь, а библейская читалка с обучающим греческим слоем**. Пользователь читает Новый Завет как обычно, а греческий постепенно «просвечивает» внутри текста.

**Педагогический контракт.** Приложение учит *узнавать* буквы, частотные слова и формы НЗ в процессе чтения. Режимы 1–3 — **учебный мостик** (подстановки в русском тексте), режимы 4–5 — **приближение к оригиналу** (реальный греческий текст). Произносительная модель — учебное приближение (эразмово чтение), не научная реконструкция.

**Режимы:**

| Режим | Группа | Название | Суть |
|---|---|---|---|
| 1 | мостик | Только буквы | Русские буквы заменяются на греческие по правилам транслитерации |
| 2 | мостик | Буквы + подсказки | То же + на десктопе hover показывает название буквы |
| 3 | мостик | Слова из словаря | Целые русские слова заменяются на греческие **леммы** (словарные формы) |
| 4 | оригинал | Формы оригинала | Русские слова заменяются на **реальные греческие формы** из этого стиха |
| 5 | оригинал | Почти оригинал | Основной текст — греческий, русский — подстрочной подсказкой |

---

## 2. Источники данных и лицензии

| Данные | Источник | Лицензия | Скрипт |
|--------|---------|----------|--------|
| Синодальный перевод | bolls.life API (SYNOD) | Public domain | `tools/build-syn.mjs` |
| Греческий НЗ (SBLGNT) | `docs/clear-bible-alignments/SBLGNT.tsv` | SBLGNT EULA (атрибуция) | `scripts/convert-alignments.js` |
| Выравнивание рус↔греч | Clear-Bible Alignments + regex-matching | своя генерация | `scripts/convert-alignments.js` |
| Базовый лексикон | Курируется вручную | своя | редактируется руками |
| Алфавит | 24 буквы греческого алфавита | своя | `data/alphabet.json` |

**Лицензионное требование:** добавить страницу «О приложении» с атрибуцией SBLGNT (SBLGNT EULA) и указанием источников.

---

## 3. Архитектура

### 3.1 Принципы

1. **Без фреймворка, но со сборщиком.** Vanilla JS + Vite.
2. **Движок отделён от UI.** Чистые функции без DOM, покрытые тестами.
3. **Детерминированность.** Хеш от позиции, не `Math.random()`.
4. **Данные — статические JSON.** Ленивый fetch, SW-кеш.
5. **Состояние пользователя — IndexedDB.** Настройки, прогресс, словарь.
6. **Слои кумулятивны.** Буквенный слой работает во всех режимах 1–4.
7. **Ручное управление обучением.** Никакой «умной» адаптации.
8. **Alignment внутри syn JSON.** Один fetch для текста + выравнивания.
9. **Sequential consumption для Strong.** При повторе Strong в стихе — потребление по порядку.

### 3.2 Структура проекта

```text
/
├── index.html
├── vite.config.js
├── manifest.json
├── icon.svg
├── styles/
│   ├── tokens.css
│   └── app.css
├── fonts/
│   └── GentiumPlus-*.woff2
├── src/
│   ├── app.js                  # bootstrap + PWA reg
│   ├── router.js               # hash-роутер
│   ├── state/
│   │   ├── store.js            # pub/sub
│   │   ├── settings.js         # настройки обучения
│   │   ├── progress.js         # буквы, слова, чтение
│   │   └── dictionary.js       # личный словарь
│   ├── storage/
│   │   └── db.js               # IndexedDB-обёртка
│   ├── data/
│   │   ├── bible-loader.js     # fetch + кеш (syn / grc)
│   │   └── lexicon-loader.js   # alphabet + core lexicon
│   ├── engine/
│   │   ├── hash.js             # FNV-1a хеш [0,1)
│   │   ├── rules.js            # 37 правил буквенных замен
│   │   ├── letter-layer.js     # applyLetterLayer → Segment[]
│   │   ├── word-layer.js       # applyWordLayer (режим 3)
│   │   ├── form-layer.js       # applyFormLayer (режим 4)
│   │   ├── morphology.js       # CCAT-морфокоды → русские подписи
│   │   └── compose.js          # composeVerse — диспетчер слоёв
│   └── ui/
│       ├── render.js           # segmentsToFragment → DOM
│       ├── screens/
│       │   ├── reading.js
│       │   ├── dictionary.js
│       │   ├── progress.js
│       │   ├── settings.js
│       │   ├── onboarding.js
│       │   └── about.js        # ← НОВЫЙ: лицензии/атрибуция
│       └── components/
│           ├── top-bar.js
│           ├── nav.js
│           ├── bottom-sheet.js
│           ├── inspector.js
│           ├── word-card.js
│           ├── intensity-slider.js
│           └── toast.js
├── data/
│   ├── books.json
│   ├── alphabet.json
│   ├── lexicon/
│   │   └── core.json
│   └── bibles/
│       ├── syn/{bookId}.json    # Русский текст + alignment
│       └── grc/{bookId}.json    # Греческий текст с токенами
├── scripts/
│   └── convert-alignments.js    # SBLGNT.tsv → grc JSON + alignment в syn JSON
├── tools/
│   └── build-syn.mjs            # bolls.life API → syn JSON
├── docs/
│   ├── clear-bible-alignments/  # SBLGNT.tsv, nt_RUSSYN.tsv, alignment JSON
│   └── sblgnt/                  # MorphGNT файлы (резервные данные)
└── tests/
    ├── hash.test.js
    ├── rules.test.js            # ← НОВЫЙ
    ├── letter-layer.test.js
    ├── word-layer.test.js
    ├── form-layer.test.js       # ← НОВЫЙ
    ├── compose.test.js
    ├── morphology.test.js
    ├── store.test.js
    ├── lexicon.test.js
    └── bible-data.test.js
```

### 3.3 Модель данных

**syn/{bookId}.json** — русский текст Синодального перевода + выравнивание:

```json
{
  "id": "john",
  "title": "От Иоанна святое благовествование",
  "short": "Ин",
  "chapters": [
    { "n": 1, "verses": [
      {
        "n": 1,
        "text": "В начале было Слово, и Слово было у Бога, и Слово было Бог.",
        "alignment": [
          { "ru": 3, "gr": 0 },   // Слово → λόγος[0] (первое вхождение)
          { "ru": 5, "gr": 2 },   // Слово → λόγος[2] (второе вхождение)
          { "ru": 9, "gr": 3 }    // Слово → λόγος[3] (третье вхождение)
        ]
      }
    ] }
  ]
}
```

**Важно:** alignment — опциональное поле. Есть только в тех стихах, где core.json покрывает леммы. При повторе Strong в стихе — sequential consumption: первый матч → первое вхождение Strong, второй матч → второе вхождение.

**grc/{bookId}.json** — греческий текст SBLGNT:

```json
{
  "id": "john",
  "title": "ΚΑΤΑ ΙΩΑΝΝΗΝ",
  "short": "Ιν",
  "chapters": [
    { "n": 1, "verses": [
      {
        "n": 1,
        "text": "Ἐν ἀρχῇ ἦν ὁ λόγος...",
        "tokens": [
          { "w": "Ἐν", "lemma": "ἐν", "morph": "prep", "strong": 1722 },
          { "w": "ἀρχῇ", "lemma": "ἀρχή", "morph": "noun", "strong": 746 }
        ]
      }
    ] }
  ]
}
```

**Сегмент (единый выходной формат движка):**

```ts
type Segment =
  | { plain: string }
  | { greek: string, original: string, kind: 'letter'|'word'|'form',
      letter?: string, lexemeId?: string, morph?: string, strong?: number }
```

### 3.4 Движок греческого слоя

`composeVerse(verseText, ctx) → Segment[]` — единственная точка входа:

```js
const ctx = {
  mode: 4,                        // 1..5
  intensity: 35,                  // 0..100
  progressLetters: { 'α': { status: 'known' }, ... },
  seedPrefix: 'john',             // для детерминизма
  wordEntries: [{                 // из core.json + IndexedDB
    lexemeId: 'logos', lemma: 'λόγος', strong: 3056,
    regexps: [...], excludeRegexps: [...],
    intensityPct: 100, status: 'learning', forms: 'all'
  }],
  showDiacritics: true,
  grcTokens: [...],               // (режим 4) греческие токены стиха
  alignment: [{ ru: 0, gr: 2 }]   // (режим 4) выравнивание
};
```

Порядок обработки: если режим ≥ 3 → сначала word/form-layer, затем letter-layer на оставшихся plain-сегментах.

### 3.5 Пайплайн данных

```
docs/clear-bible-alignments/
  ├── SBLGNT.tsv          (137K строк: греческие токены + Strong + леммы + морфология)
  └── nt_RUSSYN.tsv       (162K строк: русские токены — резерв)

                    │
                    ▼
    npm run build:data → node scripts/convert-alignments.js
                    │
                    ├──→ data/bibles/grc/*.json  (27 книг, 7939 стихов)
                    │
                    └──→ data/bibles/syn/*.json  (добавляется alignment)
                         (syn изначально генерируется: node tools/build-syn.mjs)
```

---

## 4. Текущее состояние (инвентаризация)

### ✅ Готово

| Компонент | Статус |
|-----------|--------|
| `data/bibles/syn/*` — 27 книг Синодального перевода + alignment (57% покрытия) | ✅ |
| `data/bibles/grc/*` — 27 книг SBLGNT с токенами | ✅ |
| `data/alphabet.json` — 24 буквы | ✅ |
| `data/lexicon/core.json` — 40 лемм | ⚠️ нужно расширить |
| `engine/hash.js`, `rules.js`, `letter-layer.js`, `word-layer.js`, `form-layer.js`, `morphology.js`, `compose.js` | ✅ |
| `ui/screens/*` — все экраны созданы | ✅ |
| `ui/components/*` — все компоненты созданы | ✅ |
| `ui/render.js` — segmentsToFragment | ✅ |
| `state/*` — store, settings, progress, dictionary | ✅ |
| `storage/db.js` — IndexedDB | ✅ |
| `scripts/convert-alignments.js` — пайплайн данных | ✅ |
| PWA (vite-plugin-pwa) | ✅ |
| Onboarding flow | ✅ |

### ❌ Критические пробелы

1. **Sequential consumption** — alignment использует Map<strong, firstOnly>, теряет точность в 11.6% стихов. Нужно переписать на sequential.
2. **reading.js не грузит grc/alignment** — режимы 4-5 не работают на уровне UI
3. **form-layer.test.js** — нет тестов для ключевого движка
4. **rules.test.js** — нет тестов для stripDiacritics, finalSigma, preserveCase
5. **Режим 5** — греческий как основной текст не реализован в reading.js
6. **Пунктуация в form-layer** — «Христа,» → теряется запятая при замене

### ⚠️ Средние пробелы

7. Settings — нет блока «Дополнительно» (show.diacritics, show.strongs)
8. Dictionary — нет радио «только лемма / все формы»
9. Трекинг прочитанных глав (chaptersRead) не реализован
10. Mode 4/5 disabled в UI (правильно — пока не подключены данные)

### 🟢 Лёгкие пробелы

11. README отсутствует
12. Страница «О приложении» (лицензии) отсутствует
13. Hover-tooltip режима 2 на десктопе не реализован
14. Навигация: нет оглавления глав текущей книги
15. Динамический import dictionary.js даёт warning при сборке

---

## 5. План работ

Порядок: Этап 0 → 1 → 2 → 3 → 4 → 5. Каждая задача — один коммит.

---

### Этап 0 — Исправление фундамента

#### Задача 0.0 — Sequential consumption в alignment

**Файлы:** изменить `scripts/convert-alignments.js`.

- [ ] Переписать `buildAlignment()`: заменить `Map<strong, firstIndex>` на `Map<strong, usageCount>` с sequential consumption
- [ ] Для каждого русского слова при матчинге Strong: найти usageCount-е вхождение этого Strong в греческих токенах
- [ ] Перегенерировать alignment: `npm run build:data`
- [ ] Верификация: Ин 1:1 — три «Слово» должны указывать на три разных λόγος (grIdx=4, 7, 16)
- [ ] Верификация: Мк 1:1 — «Начало» → Ἀρχὴ[0], «Евангелия» → εὐαγγελίου[2], «Иисуса» → Ἰησοῦ[3], «Христа» → Χριστοῦ[4], «Сына» → υἱοῦ[5], «Божия» → Θεοῦ[6]

**Промпт:**
```text
Прочитай development.underline2.md разделы 3.3 и 3.4. Исправь alignment в
scripts/convert-alignments.js:

1) В функции buildAlignment() замени Map<strong, firstIndex> на sequential
   consumption: для каждого русского слова, совпавшего с лексемой, отслеживай
   usageCount этого Strong в стихе и ищи usageCount-е вхождение в grcTokens.

2) Перегенерируй данные: npm run build:data

3) Проверь Ин 1:1: три «Слово» → три разных grIdx (4, 7, 16).
   Проверь Мк 1:1: «Начало»→0, «Евангелия»→2, «Иисуса»→3, «Христа»→4.

Коммит: "fix: sequential Strong consumption for accurate alignment".
```

---

#### Задача 0.1 — Тесты для rules.js

**Файлы:** создать `tests/rules.test.js`.

- [ ] `stripDiacritics`: λόγος → λογος, ἄνθρωπος → ανθρωπος, финальная σ/ς сохраняется
- [ ] `finalSigma`: σ → ς перед пробелом/пунктуацией/концом
- [ ] `preserveCase`: русский регистр → греческий регистр (Слово → Σλοβο, СЛОВО → ΣΛΟΒΟ)
- [ ] `getRules`: возвращает 37 правил, диграфы раньше одиночных

**Промпт:**
```text
Прочитай src/engine/rules.js. Напиши tests/rules.test.js:
- stripDiacritics: проверь 4-5 примеров с разной диакритикой
- finalSigma: σ → ς перед пробелом, перед концом строки
- preserveCase: «Слово» → «Σλοβο», «слово» → «σλοβο», «СЛОВО» → «ΣΛΟΒΟ»
- getRules: 37 правил, порядок (диграфы раньше), все поля заполнены

Коммит: "test: rules.js unit tests".
```

---

#### Задача 0.2 — Тесты для form-layer.js

**Файлы:** создать `tests/form-layer.test.js`.

- [ ] Использовать реальные данные из `data/bibles/syn/mark.json` и `data/bibles/grc/mark.json` (Мк 1:1)
- [ ] Форма ≠ лемма: «Евангелия» → εὐαγγελίου (род. падеж), а не εὐαγγέλιον (лемма)
- [ ] `forms: 'lemma'` → лемма, `forms: 'all'` → реальная форма
- [ ] Слово не из словаря → plain
- [ ] Невыровненный стих → fallback (возвращает plain или вызывает word-layer)
- [ ] Пунктуация: «Христа,» → заменяется на «Χριστοῦ» + запятая отдельным plain-сегментом

**Промпт:**
```text
Прочитай src/engine/form-layer.js и development.underline2.md раздел 3.4.
Напиши tests/form-layer.test.js используя реальные данные:

1) Загрузи data/bibles/syn/mark.json и data/bibles/grc/mark.json
2) Возьми Мк 1:1: текст "Начало Евангелия Иисуса Христа, Сына Божия,"
3) Протестируй applyFormLayer с реальными alignment и grcTokens:
   - forms='all': «Евангелия» → εὐαγγελίου (род. падеж), не εὐαγγέλιον
   - forms='lemma': «Евангелия» → εὐαγγέλιον (лемма)
   - слово не в словаре → plain
   - «Христа,» → форма + запятая как отдельный plain-сегмент

Коммит: "test: form-layer.js tests with real SBLGNT data".
```

---

#### Задача 0.3 — Исправление пунктуации в form-layer

**Файлы:** изменить `src/engine/form-layer.js`.

- [ ] При замене слова с пунктуацией (напр. «Христа,»): отделить знаки препинания, выдать сегмент `{ greek, original: wordWithoutPunct }` + `{ plain: punct }` после
- [ ] Разделитель между словами `{ plain: ' ' }` — последнее слово стиха не должно иметь пробела после
- [ ] Обновить тесты (из задачи 0.2)

**Промпт:**
```text
Прочитай src/engine/form-layer.js. Исправь обработку пунктуации:

Сейчас «Христа,» при замене теряет запятую (greek сегмент забирает всё слово с
запятой). Нужно:
1) Извлечь trailing punctuation из ruWord перед заменой
2) Если слово было заменено — выдать { greek, original: cleanWord } + { plain: punct }
3) Не добавлять trailing space после последнего слова стиха

Обнови tests/form-layer.test.js — проверь «Христа,» → Χριστοῦ + запятая plain.

Коммит: "fix: punctuation preservation in form-layer".
```

---

### Этап 1 — Подключение режимов 4-5 к чтению

#### Задача 1.0 — Загрузка grc данных в reading.js

**Файлы:** изменить `src/ui/screens/reading.js`.

- [ ] В `mount()`: параллельно с syn книгой загружать grc книгу (`loadBook('grc', bookId)`)
- [ ] В `renderWindowed()`: для каждого стиха находить grcVerse (grcBook.chapters[chN-1].verses[vN-1]) и alignment (verse.alignment)
- [ ] Передавать `grcTokens` и `alignment` в `composeCtx`
- [ ] При ошибке загрузки grc (нет сети) — режим 4 деградирует в режим 3 с тостом «Греческий текст недоступен — показываем словарные формы»
- [ ] При отсутствии alignment у стиха — fallback на word-layer
- [ ] `buildWordEntries()` добавляет `strongNum: lexeme.strong` в каждую запись

**Промпт:**
```text
Прочитай development.underline2.md раздел 3.4. Подключи grc данные в reading.js:

1) В mount(): Promise.all([loadBook('syn', bookId), loadBook('grc', bookId)])
2) buildWordEntries(): добавить strongNum = lexeme.strong в каждую запись
3) В renderWindowed() для renderCtx добавить grcTokens и alignment:
   const chIdx = ch.n - 1;
   const vIdx = verse.n - 1;
   const grcVerse = grcBook?.chapters[chIdx]?.verses[vIdx];
   const alignment = verse.alignment;
   composeCtx = { ...composeCtx, grcTokens: grcVerse?.tokens, alignment };
4) При ошибке загрузки grc — showToast и fallback на word-layer.
5) Не грузить grc для режимов 1-2 (экономия трафика).

Коммит: "feat: load grc data in reading screen for modes 4-5".
```

---

#### Задача 1.1 — Разблокировка режимов 4-5

**Файлы:** изменить `src/ui/components/top-bar.js`, `src/ui/screens/settings.js`, `src/ui/screens/onboarding.js`.

- [ ] Включить mode 4 и 5 в `top-bar.js` (enabled: true, убрать «скоро»)
- [ ] Включить mode 4 и 5 в `settings.js`
- [ ] Onboarding: вариант 4 → mode=4, все буквы known
- [ ] Onboarding: добавить вариант для mode 5? (Нет — пока 4 варианта достаточно)

**Промпт:**
```text
Разблокируй режимы 4-5 в UI:

1) top-bar.js: MODES[3] и MODES[4] → enabled: true, убрать note 'скоро'
2) settings.js: аналогично
3) onboarding.js: вариант 4 → mode: 4 (не 3)

Коммит: "feat: enable modes 4-5 in UI".
```

---

#### Задача 1.2 — Режим 5: греческий как основной

**Файлы:** изменить `src/ui/screens/reading.js`, `src/engine/compose.js`.

- [ ] В `renderWindowed()`: если mode === 5, рендерить греческий текст как основной
- [ ] Каждый греческий токен → `<span>` с data-атрибутами (w, lemma, morph, strong, gr-token)
- [ ] Под каждым стихом — русский текст приглушённым курсивом (settings.show.ruHint toggle)
- [ ] Тап по греческому токену → подробная карточка (лемма, грамматика, перевод)
- [ ] Токены из словаря пользователя (strong совпадает) → класс `.known` (подсветка `--progress`)
- [ ] Кнопка «глаз» в режиме 5 показывает чистый русский текст
- [ ] `compose.js`: режим 5 возвращает null — reading.js сам строит DOM

**Промпт:**
```text
Прочитай development.underline2.md раздел 3.4 (режим 5). Реализуй режим 5:

1) В reading.js renderWindowed(): если mode===5 и grcBook загружен — рендерить
   греческие токены как основной контент.
2) Каждый токен: <span class="gr grc-token" data-w="..." data-lemma="..."
   data-morph="..." data-strong="...">text</span>
3) Под стихом: <p class="ru-hint">русский текст</p> (курсив, opacity .6)
4) Тап по токену → renderWordCard (подробная карточка с morphology).
5) Если токен.strong есть в словаре пользователя → класс .known (подсветка --progress).
6) Toggle «русская подсказка» в меню топбара (settings.show.ruHint).
7) Кнопка «глаз» → показать чистый syn текст.

Коммит: "feat: mode 5 — Greek as primary text with Russian hint".
```

---

### Этап 2 — Словарь и лексикон

#### Задача 2.0 — Расширение core.json до 100+ слов

**Файлы:** изменить `data/lexicon/core.json`, `tests/lexicon.test.js`.

- [ ] Добавить ещё 60+ частотных слов НЗ (существительные, глаголы, прилагательные)
- [ ] Для каждого: ruMatches (выверенные по реальному тексту Синодального), ruExclude, refs, freqNT
- [ ] Приоритет: слова, повышающие покрытие alignment (сейчас 57% → цель 75%+)
- [ ] Перегенерировать alignment: `npm run build:data`
- [ ] Обновить тесты

**Промпт:**
```text
Расширь data/lexicon/core.json до 100+ слов.

Проанализируй текущее покрытие alignment (4517 из 7955 стихов = 57%).
Добавь 60+ частотных слов НЗ, фокусируясь на тех, которые максимально
увеличат покрытие. Для каждого:
- ruMatches: реальные regex-паттерны по Синодальному тексту (смотри data/bibles/syn/)
- ruExclude: ложные срабатывания
- lemma, translit, strong, gloss, pos, freqNT, refs

После расширения: npm run build:data, проверь новое покрытие (цель 75%+).
Обнови tests/lexicon.test.js.

Коммит: "feat: expand core lexicon to 100+ words".
```

---

#### Задача 2.1 — Формы слов (lemma/all) в dictionary

**Файлы:** изменить `src/ui/screens/dictionary.js`, `src/state/dictionary.js`.

- [ ] В настройках слова (showWordSettings): добавить радио «только лемма» / «все формы»
- [ ] При `forms: 'lemma'` — form-layer использует `grToken.lemma`
- [ ] При `forms: 'all'` — form-layer использует `grToken.w` (реальную форму)
- [ ] Сохранять выбор в IndexedDB

**Промпт:**
```text
Добавь выбор форм в настройки словаря:

1) dictionary.js showWordSettings(): радио «Только λόγος (лемма)» / «Все формы (λόγος, λόγον...)»
2) Сохранение через setWordSetting(id, 'forms', 'lemma'|'all')
3) form-layer.js уже поддерживает forms:'lemma'|'all' — проверь, что словарь передаёт это поле

Коммит: "feat: lemma/all forms toggle in dictionary".
```

---

### Этап 3 — Полнота UI

#### Задача 3.0 — Settings «Дополнительно»

**Файлы:** изменить `src/ui/screens/settings.js`.

- [ ] Добавить свёрнутый блок «Дополнительно» с чекбоксами:
  - `show.diacritics` — показывать диакритику (ударения, придыхания)
  - `show.strongs` — показывать Strong numbers в карточке
- [ ] При `show.diacritics = false` — леммы в тексте показываются без диакритики (через `stripDiacritics` в compose.js)

**Промпт:**
```text
Добавь свёрнутый блок «Дополнительно» в settings.js:

1) <details><summary>Дополнительно</summary>... чебоксы ...</details>
2) show.diacritics: при выкл. composeVerse применяет stripDiacritics к леммам
3) show.strongs: при вкл. в карточке слова показывается Strong G3056

Коммит: "feat: advanced settings (diacritics, strongs)".
```

---

#### Задача 3.1 — Трекинг прочитанных глав

**Файлы:** изменить `src/ui/screens/reading.js`, `src/state/progress.js`.

- [ ] Добавить sentinel в конец каждой главы (элемент с `data-chapter-end="N"`)
- [ ] IntersectionObserver на sentinel'ы: при попадании во вьюпорт → `chaptersRead.add(N)`
- [ ] Сохранять в `progress.reading.books[bookId].chaptersRead`
- [ ] В левой панели навигации: показывать галочки у прочитанных глав
- [ ] В экране прогресса: показывать «прочитано N из M глав»

**Промпт:**
```text
Реализуй трекинг прочитанных глав:

1) В renderWindowed() добавляй <div class="chapter-end-sentinel" data-chapter-end="N">
   в конец каждой главы.
2) IntersectionObserver на sentinel'ы: при попадании → запись в progress.reading.
   books[bookId].chaptersRead (Set → Array при сохранении).
3) В progress.js: показывай «прочитано» / «начато (N из M)».
4) В левой панели: оглавление глав с галочками.

Коммит: "feat: chapter read tracking".
```

---

#### Задача 3.2 — Страница «О приложении» и README

**Файлы:** создать `src/ui/screens/about.js`; изменить `src/router.js`, `src/ui/components/nav.js`, `src/app.js`; создать `README.md`.

- [ ] Экран «О приложении»: описание, версия, ссылка на GitHub
- [ ] Атрибуция: SBLGNT EULA (Society of Biblical Literature), Clear-Bible Alignments (CC-BY-SA), bolls.life API
- [ ] Шрифты: Gentium Plus (SIL OFL)
- [ ] Маршрут `#/about`
- [ ] `README.md`: описание, установка (`npm install && npm run build:data`), запуск (`npm run dev`), тесты (`npm test`), архитектура (ссылка на development.underline2.md)

**Промпт:**
```text
Создай страницу «О приложении» и README:

1) src/ui/screens/about.js — экран с описанием приложения и лицензионной информацией:
   - SBLGNT: "Scripture quotations marked SBLGNT are from the SBL Greek New Testament.
     Copyright © 2010 Society of Biblical Literature. Used by permission."
   - Clear-Bible Alignments: CC-BY-SA
   - Gentium Plus: SIL Open Font License
   - Синодальный перевод: public domain
2) Маршрут #/about, ссылка в навигации
3) README.md с разделами: Описание, Установка, Сборка данных, Запуск, Тесты, Архитектура

Коммит: "docs: about page + README".
```

---

#### Задача 3.3 — Hover-tooltip режима 2 и polish навигации

**Файлы:** изменить `src/ui/render.js`, `src/ui/screens/reading.js`, `src/ui/components/nav.js`.

- [ ] На десктопе (≥900px) в режиме 2: span'ам `.gr[data-letter]` добавить `title` с именем буквы («альфа — читается примерно как „а“»)
- [ ] В левой панели: список глав текущей книги с галочками прочитанных
- [ ] В левой панели: кнопка «Продолжить чтение» (переход к последней позиции скролла)
- [ ] Исправить warning двойного импорта dictionary.js (убрать динамический import, оставить только статический)

**Промпт:**
```text
Polish интерфейса:

1) render.js: в segmentsToFragment() для режима 2 на десктопе добавлять title
   атрибут на span'ы .gr[data-letter]: «альфа — читается примерно как „а“»
2) nav.js: на десктопе показывать оглавление глав текущей книги с галочками
   и кнопку «Продолжить чтение»
3) reading.js: заменить динамический import('../../state/dictionary.js') на
   статический (импортировать addWord, setWordStatus, saveDictionary вверху файла)

Коммит: "feat: mode 2 tooltip + navigation polish".
```

---

### Этап 4 — Данные и покрытие

#### Задача 4.0 — Анализ и улучшение покрытия alignment

**Файлы:** создать `scripts/analyze-coverage.mjs`.

- [ ] Скрипт анализирует покрытие alignment по книгам и главам
- [ ] Выводит топ-50 отсутствующих лемм (слов, которые часто встречаются но не покрыты)
- [ ] Выводит список «ложных срабатываний» (alignment где ru_idx и gr_idx расходятся по смыслу)
- [ ] Результат: рекомендации по расширению core.json

**Промпт:**
```text
Создай scripts/analyze-coverage.mjs:

Анализирует все syn книги и выводит:
1) Покрытие alignment по книгам (%)
2) Топ-50 русских слов, которые НЕ покрыты alignment (с подсчётом вхождений)
3) Топ-50 лемм, которые увеличили бы покрытие больше всего
4) Стихи с alignment но без покрытия (возможные проблемы)

Запусти и сохрани отчёт в docs/coverage-report.md.

Коммит: "feat: alignment coverage analyzer".
```

---

### Этап 5 — Финальный polish

#### Задача 5.0 — Полный аудит и полировка

- [ ] Пройти все 5 режимов на десктопе (1280px) и мобильном (375px)
- [ ] Пройти онбординг с чистой IndexedDB
- [ ] Проверить все экраны в светлой и тёмной теме
- [ ] Проверить оффлайн: `npm run build && npm run preview`, открыть книгу, выключить сеть
- [ ] `npm test` — все тесты зелёные
- [ ] `npm run build` — без ошибок и warnings
- [ ] Починить найденные баги

**Промпт:**
```text
Финальный аудит перед релизом:

1) Пройди все сценарии по чеклисту:
   - Онбординг → выбор варианта → чтение
   - Режимы 1→2→3→4→5, переключение между ними
   - Слайдер интенсивности: 0% → 50% → 100%
   - Тап по букве → карточка → «Я знаю»
   - Тап по слову → карточка → «Добавить в словарь» → «Я знаю»
   - Экран словаря: фильтры, добавление слов, настройки per-word
   - Экран прогресса: буквы, слова, чтение
   - Экран настроек: все переключатели
   - Долгий тап → показать оригинал
   - Кнопка «глаз» → plain view
   - Тёмная/светлая тема
   - Оффлайн: открытая книга доступна без сети
2) Исправь найденные баги.
3) npm test && npm run build — всё зелёное.

Коммит: "fix: final polish and bug fixes".
```

---

## 6. Глобальный Definition of Done

- [ ] `npm test` зелёный; engine покрыт тестами
- [ ] `npm run build` без ошибок и warnings
- [ ] Детерминизм: перерендер не меняет картину замен
- [ ] Производительность: ленивый DOM-рендер, книга Луки скроллится без лагов
- [ ] Оффлайн: оболочка + прочитанные книги работают без сети
- [ ] Доступность: aria-атрибуты, touch targets ≥ 44px, `:focus-visible`, контраст ≥ 4.5:1
- [ ] Alignment: sequential consumption, точность >95%
- [ ] Все 5 режимов работают
- [ ] Страница «О приложении» с лицензиями
- [ ] README.md с инструкциями

---

## 7. Бэклог (не делать без отдельного решения)

- Поиск по тексту
- Второй перевод / селектор перевода
- SRS-повторение слов
- Озвучка произношения
- Синхронизация между устройствами
- Ветхий Завет / Септуагинта
- Экспорт/импорт прогресса
- Параллельный показ русского и греческого (interlinear view)
