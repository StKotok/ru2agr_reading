# Режимы греческого слоя: архитектура и реализация

> Документ для ревью. Описывает полный путь данных и рендеринга для каждого
> из пяти режимов читалки на примере Мк 1:1.

## Общая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        READING SCREEN                            │
│  reading.js                                                     │
│                                                                  │
│  buildWordEntries() → composeVerse(text, ctx) → segmentsToFragment()
│        │                      │                      │
│        ▼                      ▼                      ▼
│  core.json (словарь)    compose.js              render.js
│                         /    |    \              DOM-span'ы
│                    letter  word  form
│                    layer   layer layer
└─────────────────────────────────────────────────────────────────┘

ДАННЫЕ (статический JSON, fetch + SW-кеш):

  data/bibles/syn/{book}.json   — русский текст + alignment
  data/bibles/grc/{book}.json   — греческий текст + токены {w, lemma, morph, strong}
  data/lexicon/core.json        — словарь: леммы с regex-паттернами и Strong-номерами
  data/alphabet.json            — алфавит: греческие буквы + имена + произношение
  data/books.json               — манифест 27 книг
```

### Входной контекст composeVerse

```js
const ctx = {
  mode: 4,                          // 1–5
  intensity: 35,                    // 0–100, доля замен
  progressLetters: {                // какие буквы активны
    'α': { status: 'known' },
    'β': { status: 'learning' },
    ...
  },
  seedPrefix: 'mark',               // для детерминированного хеша
  wordEntries: [...],               // записи словаря (лемма + regex + intensity + status)
  showDiacritics: false,            // показывать ли диакритику
  grcVerse: { tokens: [...] },      // (режим 4) греческие токены этого стиха
  alignment: [{ru:0, gr:2}, ...]    // (режим 4) выравнивание русских слов → греческих токенов
};
```

### Сегмент (выходной формат всех слоёв)

```ts
type Segment =
  | { plain: string }                                          // неучебный текст
  | { greek: string, original: string, kind: 'letter' | 'word' | 'form',
      letter?: string, lexemeId?: string, morph?: string, strong?: number }
```

Сегменты → `segmentsToFragment()` → DOM: plain как текстовые узлы, greek как `<span class="gr" data-*="...">`.

---

## Сквозной пример: Мк 1:1

Русский синодальный текст:
> Начало Евангелия Иисуса Христа, Сына Божия,

Греческий оригинал (SBLGNT):
> Ἀρχὴ τοῦ εὐαγγελίου Ἰησοῦ Χριστοῦ υἱοῦ Θεοῦ.

### Данные стиха в JSON

**data/bibles/syn/mark.json** (фрагмент):
```json
{
  "n": 1,
  "text": "Начало Евангелия Иисуса Христа, Сына Божия,",
  "alignment": [
    { "ru": 0, "gr": 0 },   // Начало    → Ἀρχὴ
    { "ru": 1, "gr": 2 },   // Евангелия → εὐαγγελίου
    { "ru": 2, "gr": 3 },   // Иисуса    → Ἰησοῦ
    { "ru": 3, "gr": 4 },   // Христа    → Χριστοῦ
    { "ru": 4, "gr": 5 },   // Сына      → υἱοῦ
    { "ru": 5, "gr": 6 }    // Божия     → Θεοῦ
  ]
}
```

**data/bibles/grc/mark.json** (фрагмент):
```json
{
  "n": 1,
  "text": "Ἀρχὴ τοῦ εὐαγγελίου Ἰησοῦ Χριστοῦ υἱοῦ Θεοῦ.",
  "tokens": [
    { "w": "Ἀρχὴ",       "lemma": "ἀρχή",        "strong": 746,  "morph": "noun" },
    { "w": "τοῦ",        "lemma": "ὁ",            "strong": 3588, "morph": "det" },
    { "w": "εὐαγγελίου", "lemma": "εὐαγγέλιον",  "strong": 2098, "morph": "noun" },
    { "w": "Ἰησοῦ",      "lemma": "Ἰησοῦς",      "strong": 2424, "morph": "noun" },
    { "w": "Χριστοῦ",    "lemma": "Χριστός",      "strong": 5547, "morph": "noun" },
    { "w": "υἱοῦ",       "lemma": "υἱός",         "strong": 5207, "morph": "noun" },
    { "w": "Θεοῦ",       "lemma": "θεός",         "strong": 2316, "morph": "noun" }
  ]
}
```

**data/lexicon/core.json** (фрагмент — используемые леммы):
```json
[
  { "id": "arche",       "lemma": "ἀρχή",        "strong": 746,
    "ruMatches": ["(?<![а-яё])начал(о|а|у|е|ом|ах|ами)(?![а-яё])"] },
  { "id": "euangelion",  "lemma": "εὐαγγέλιον",  "strong": 2098,
    "ruMatches": ["(?<![а-яё])Евангели(е|я|ю|ем|и|й)(?![а-яё])"] },
  { "id": "iesous",      "lemma": "Ἰησοῦς",      "strong": 2424,
    "ruMatches": ["(?<![а-яё])Иисус(а|у|ом|е)?(?![а-яё])"] },
  { "id": "christos",    "lemma": "Χριστός",      "strong": 5547,
    "ruMatches": ["(?<![а-яё])Христ(ос|а|у|ом|е)?(?![а-яё])"] },
  { "id": "huios",       "lemma": "υἱός",         "strong": 5207,
    "ruMatches": ["(?<![а-яё])Сын(а|у|е|ом|овья|овей)?(?![а-яё])"] },
  { "id": "theos",       "lemma": "θεός",         "strong": 2316,
    "ruMatches": ["(?<![а-яё])Б(о|о)г(а|у|ом|е)?(?![а-яё])",
                  "(?<![а-яё])б(о|о)г(а|у|ом|е)?(?![а-яё])"] }
]
```

---

## Режим 1 — буквенный слой

**Суть:** русские буквы заменяются на греческие по правилам транслитерации.
Интенсивность регулируется слайдером (0–100%): чем выше, тем больше букв
заменено. Замена **детерминирована** (одни и те же настройки → один результат).

### Путь в compose.js

```js
if (mode === 1 || mode === 2) {
  return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
}
```

### Алгоритм (letter-layer.js)

```
applyLetterLayer("Начало Евангелия...", { activeLetters: {α,ε,ν,ο,...}, intensity: 35 })

Для каждой позиции в тексте:
  1. Проверяем все правила замены (37 шт.) в порядке приоритета:
     сначала диграфы (кс→ξ, пс→ψ, тх→θ, я→ια, ю→ιυ...),
     потом одиночные (ф→φ, τ→τ, π→π...)
  2. Если буква активна (есть в progressLetters):
     seed = "mark:5:н"           // книга:позиция:правило
     hash01(seed) * 100 < 35?    // детерминированное решение
       → ДА: заменяем, выдаём { greek, original, kind:"letter", letter }
       → НЕТ: выдаём { plain: original }
  3. Неактивная буква или нет правила → { plain: char }
  4. Соседние plain-сегменты склеиваются
```

### Детерминированный хеш (hash.js)

```js
function hash01(str) {
  // FNV-1a (32-bit) → нормализация в [0, 1)
  // Один и тот же seed всегда даёт одинаковое число.
  // Никакого Math.random() в engine/ — иначе текст «мерцал» бы при перерендере.
}
```

### Что видит пользователь (intensity = 35, активны α, ε, ν, ο, λ, β, γ, σ)

```
Было:  «Начало Евангелия Иисуса Христа, Сына Божия,»
Стало: «Нαчαлο Еβανгелия Иисυσα Хριστα, Сыνα Бοжия,»
        █ █ █   █ █ █        █ █ █    █ █ █    █ █
        3 из 6   3 из 9       2 из 6    2 из 5    2 из 5 букв заменено
```

Заменённые буквы выделены стилем. Каждая — кликабельна: тап → карточка буквы
(название, произношение, кнопка «Знаю»).

---

## Режим 2 — буквенный слой + подсказки

**Суть:** то же, что режим 1, но на десктопе при наведении показывается
название греческой буквы (эргоним). Движок идентичен режиму 1.

### Отличие в UI

```js
// compose.js — движок тот же:
if (mode === 1 || mode === 2) {
  return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
}

// render.js — для span'ов с data-letter добавляется aria-label:
if (letter && letterNames && letterNames.has(letter)) {
  span.setAttribute('aria-label', `греческая буква ${letterNames.get(letter)}`);
}
```

### Что видит пользователь

Тот же результат замен, что в режиме 1, но при наведении на `α` появляется
tooltip: «альфа».

---

## Режим 3 — словарный слой

**Суть:** целые русские слова заменяются на греческие **леммы** (словарные
формы, не реальные формы оригинала). Какие слова заменять — определяется
словарём пользователя и regex-паттернами из core.json.

### Путь в compose.js

```js
if (mode === 3) {
  if (wordEntries.length > 0) {
    const wordSegs = applyWordLayer(verseText, wordEntries, { seedPrefix });
    return applyLetterToPlain(wordSegs, activeLetters, intensity, seedPrefix, showDiacritics);
  }
  return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
}
```

Два прохода: сначала **словарный слой** заменяет слова на леммы, потом
**буквенный слой** дорабатывает оставшийся plain-текст.

### Word entries — фильтрация словаря

```js
function buildWordEntries() {
  // Из core.json (400 лемм) + пользовательского словаря (IndexedDB) строим
  // список активных записей. Попадают только слова со статусом:
  //   'new', 'learning', 'known'
  // и с showInText !== false.
  //
  // Интенсивность — из настроек пользователя на каждое слово:
  //   'often' → 100%, 'sometimes' → 50%, 'rare' → 25%
  //   'known' → замена всегда (100%)
}
```

### Алгоритм (word-layer.js)

```
applyWordLayer("Начало Евангелия Иисуса Христа, Сына Божия,", wordEntries)

Для каждой позиции в тексте:
  1. Среди всех wordEntries ищем regex, совпадающий с началом остатка текста.
  2. Побеждает самое длинное совпадение.
  3. Проверяем exclude-паттерны: если слово в списке исключений — пропускаем.
  4. Детерминированное решение:
     seed = "mark:12:arche"     // книга:позиция:lexemeId
     shouldReplace = (status === 'known') || (hash01(seed) * 100 < intensityPct)
       → ДА: { greek: "ἀρχή", original: "Начало", kind: "word", lexemeId: "arche" }
       → НЕТ: { plain: "Начало" }
  5. Если ни один regex не совпал — символ уходит в plain.
```

### Что видит пользователь

Допустим, пользователь знает слова εὐαγγέλιον и θεός (known),
учит ἀρχή и Χριστός (learning, intensity 50%):

```
Было:  «Начало Евангелия Иисуса Христа, Сына Божия,»
Стало: «ἀρχή εὐαγγέλιον Иисуса Χριστός Сына θεός,»
        ████  ████████████         ████████       ████
        лемма  лемма               лемма          лемма
        (50%)  (known)             (50%)          (known)
```

Важно: это **леммы** (словарные формы), а не реальные формы из текста.
`ἀρχή` вместо `Ἀρχὴ`, `θεός` вместо `Θεοῦ`. Для новичка это приемлемо,
но режим 4 даёт более точную замену.

---

## Режим 4 — формовый слой

**Cуть:** русские слова заменяются на **реальные греческие формы** из
оригинала, используя выравнивание (alignment) между русским и греческим
текстом. Это самый сложный и точный режим.

### Путь в compose.js

```js
if (mode === 4) {
  if (grcVerse && alignment && grcVerse.tokens) {
    const dictEntries = wordEntries.map(e => ({ ...e, strong: e.strongNum || null }));
    const formSegs = applyFormLayer(verseText, grcVerse.tokens, alignment, dictEntries, { seedPrefix });
    return applyLetterToPlain(formSegs, activeLetters, intensity, seedPrefix, showDiacritics);
  }
  // fallback: word-layer если нет grc+align
  if (wordEntries.length > 0) {
    const wordSegs = applyWordLayer(verseText, wordEntries, { seedPrefix });
    return applyLetterToPlain(wordSegs, activeLetters, intensity, seedPrefix, showDiacritics);
  }
  return applyLetterLayer(verseText, { activeLetters, intensity, seedPrefix });
}
```

### Данные, необходимые для режима 4

| Данные | Источник | Формат |
|--------|---------|--------|
| Русский текст стиха | `data/bibles/syn/{book}.json` | `verse.text` |
| Alignment | `data/bibles/syn/{book}.json` | `verse.alignment: [{ru, gr}]` |
| Греческие токены | `data/bibles/grc/{book}.json` | `verse.tokens: [{w, lemma, morph, strong}]` |
| Словарь пользователя | IndexedDB + `core.json` | `wordEntries` с `strongNum` |

### Как строится alignment

Конвертер `scripts/convert-alignments.js` при `npm run build:data`:

```
SBLGNT.tsv                           nt_RUSSYN.tsv
  │                                     │
  ├─ n40001001001: Ἀρχὴ (G746)         ├─ 41001001001: Начало
  ├─ n40001001002: τοῦ (G3588)         ├─ 41001001003: Евангелия
  ├─ n40001001003: εὐαγγελίου (G2098) ├─ 41001001005: Иисуса
  ├─ n40001001004: Ἰησοῦ (G2424)      ├─ 41001001007: Христа
  ├─ n40001001005: Χριστοῦ (G5547)    ├─ 41001001009: Сына
  ├─ n40001001006: υἱοῦ (G5207)       ├─ 41001001011: Божия
  ├─ n40001001007: Θεοῦ (G2316)       │
  │                                     │
  └──────────┬──────────────────────────┘
             │
    core.json (regex-паттерны + Strong's номера)
             │
             ▼
    Для каждого русского слова в стихе:
      слово "Евангелия" → regex match → lexeme "euangelion" → Strong G2098
      → в греческих токенах стиха G2098 = εὐαγγελίου (индекс 2)
      → alignment: { ru: 1, gr: 2 }
```

### Алгоритм (form-layer.js)

```
applyFormLayer("Начало Евангелия Иисуса Христа, Сына Божия,",
               grcTokens, alignment, dictEntries)

ruWords = verseText.split(/\s+/)   // → ["Начало", "Евангелия", ...]

Строим alignMap: Map<ruIndex, grIndex>
  alignMap.set(0, 0)   // Начало → Ἀρχὴ
  alignMap.set(1, 2)   // Евангелия → εὐαγγελίου
  alignMap.set(2, 3)   // Иисуса → Ἰησοῦ
  alignMap.set(3, 4)   // Христа → Χριστοῦ
  alignMap.set(4, 5)   // Сына → υἱοῦ
  alignMap.set(5, 6)   // Божия → Θεοῦ

Строим dictByStrong: Map<strong, dictEntry>
  dictByStrong.set("746",  { lexemeId:"arche",      status:"learning", intensity:"often" })
  dictByStrong.set("2098", { lexemeId:"euangelion", status:"known",    intensity:"often" })
  dictByStrong.set("2424", { lexemeId:"iesous",     status:"learning", intensity:"rare" })
  ...

Для каждого русского слова (wi = 0..5):
  grIdx = alignMap.get(wi)
  grToken = grcTokens[grIdx]
  dictEntry = dictByStrong.get(String(grToken.strong))

  if (dictEntry):
    seed = "mark:1:746"
    shouldReplace = (status === 'known') || (hash01(seed) * 100 < intensityPct)
    if (shouldReplace):
      display = (forms === 'lemma') ? grToken.lemma : grToken.w
      → { greek: display, original: ruWord, kind: "form", lexemeId, morph, strong }
    else:
      → { plain: ruWord }
  else:
    → { plain: ruWord }    // слова нет в словаре — оставляем русский текст

Результат → applyLetterToPlain (буквенный слой на оставшихся plain-сегментах)
```

### Что видит пользователь

Настройки: εὐαγγέλιον=known, ἀρχή=learning(often 100%), Ἰησοῦς=learning(rare 25%),
Χριστός=learning(sometimes 50%), θεός=known:

```
Было:  «Начало Евангелия Иисуса Христа, Сына Божия,»
Стало: «Ἀρχὴ εὐαγγελίου Иисуса Хριστός Сына Θεοῦ,»
        ████  ████████████         ████████       ████
        форма форма                форма          форма
        (100%)(known)              (50%)          (known)
```

**Отличие от режима 3:** здесь `Ἀρχὴ` (реальная форма, именительный падеж), а не
`ἀρχή` (лемма). `εὐαγγελίου` (родительный падеж) вместо `εὐαγγέλιον` (лемма).
`Θεοῦ` (родительный падеж) вместо `θεός` (лемма).

### Где alignment берётся на стороне клиента

На данный момент (`reading.js`) загрузка греческого слоя в режиме 4
**не реализована** — `composeCtx` не содержит `grcVerse` и `alignment`.
Это следующий шаг разработки. План:

```js
// reading.js — нужно добавить:
import { loadBook } from '../../data/bible-loader.js';

// В mount():
const grcBook = await loadBook('grc', bookId);

// В renderWindowed() для каждого стиха:
const grcVerse = grcBook.chapters[ch.n - 1].verses[verse.n - 1];
const composeCtx = {
  ...
  grcVerse,
  alignment: verse.alignment
};
```

---

## Режим 5 — греческий как основной

**Суть:** основной текст — греческий, русский синодальный — как подсказка.
Обработка на уровне `reading.js`: переключение источника текста, а не
движка замен.

### План реализации

```js
// reading.js — для режима 5:
if (settings.mode === 5) {
  // Загружаем греческую книгу как основной текст
  const grcBook = await loadBook('grc', bookId);
  // Рендерим греческие стихи как основной текст
  // Русский синодальный — в bottom-sheet по тапу
  // Буквенный слой не применяется (текст уже греческий)
}
```

---

## Сводка: данные, используемые каждым режимом

| Компонент | Р1 | Р2 | Р3 | Р4 | Р5 |
|-----------|---|---|---|---|---|
| `syn/{book}.json` (текст) | ✓ | ✓ | ✓ | ✓ | — |
| `syn/{book}.json` (alignment) | — | — | — | ✓ | — |
| `grc/{book}.json` (токены) | — | — | — | ✓ | ✓ |
| `core.json` (словарь) | — | — | ✓ | ✓ | — |
| `alphabet.json` (буквы) | ✓ | ✓ | через букв. слой | через букв. слой | — |
| IndexedDB (прогресс) | ✓ | ✓ | ✓ | ✓ | — |
| IndexedDB (словарь пользователя) | — | — | ✓ | ✓ | — |

## Сводка: файлы движка

| Файл | Назначение |
|------|-----------|
| `src/engine/compose.js` | Диспетчер: выбирает слой по режиму, собирает контекст |
| `src/engine/letter-layer.js` | Буквенный слой: замена русских букв на греческие |
| `src/engine/word-layer.js` | Словарный слой: замена русских слов на греческие леммы |
| `src/engine/form-layer.js` | Формовый слой: замена русских слов на реальные греческие формы |
| `src/engine/rules.js` | 37 правил транслитерации (диграфы + одиночные) |
| `src/engine/hash.js` | FNV-1a хеш для детерминированной псевдослучайности |
| `src/ui/render.js` | `segmentsToFragment()`: сегменты → DOM |
| `src/ui/screens/reading.js` | Экран чтения: загрузка книг, виртуальный скролл, обработка тапов |

## Сводка: данные и их генерация

| Файл | Источник | Генератор |
|------|---------|-----------|
| `data/bibles/syn/*.json` | Синодальный перевод (изначально) + alignment (конвертер) | `scripts/convert-alignments.js` |
| `data/bibles/grc/*.json` | SBLGNT (Society of Biblical Literature Greek New Testament) | `scripts/convert-alignments.js` |
| `data/lexicon/core.json` | Clear-Bible Alignments (SBLGNT.tsv + nt_RUSSYN.tsv) | ручная выверка + соoccurrence-майнинг |
| `data/alphabet.json` | 24 буквы греческого алфавита | ручной |
| `data/books.json` | 27 книг НЗ с названиями и числом глав | ручной |
| `docs/clear-bible-alignments/` | Исходные данные Clear-Bible (SBLGNT.tsv, nt_RUSSYN.tsv, alignment JSON) | скачаны с github.com/Clear-Bible/Alignments |

---

## Пайплайн сборки данных

```
docs/clear-bible-alignments/
  ├── SBLGNT.tsv          (137K строк: греческие токены + Strong's + леммы + морфология)
  └── nt_RUSSYN.tsv       (162K строк: русские токены)

                    │
                    ▼
    scripts/convert-alignments.js   (npm run build:data)
                    │
                    ├──→ data/bibles/grc/*.json   (27 книг, 7939 стихов)
                    │      { tokens: [{w, lemma, morph, strong}] }
                    │
                    └──→ data/bibles/syn/*.json   (обновление: +alignment)
                           { alignment: [{ru, gr}] }
```

При добавлении новых лемм в `core.json` — `npm run build:data` перегенерирует
alignment для всех книг автоматически. Код приложения менять не нужно.
