# Migration to Clean Data: Vision & Technical Plan

> **Status:** Предложение. 2026-06-24.
> **Цель:** Перевести приложение на новые данные с чистыми лицензиями, начать с английского языка.

---

## 1. Текущее состояние vs. Целевое

| Измерение | Было (dev2 до чистки) | Стало (цель) |
|---|---|---|
| **Данные** | SBLGNT/MACULA с UBS-полями, Strong's, Синодальный перевод, выравнивание через старый пайплайн | SBLGNT/MACULA (без UBS), Cherith + Berean глоссы, Strong's, BSB + ASV + ULT + OEB + WEB. Всё — public domain, CC0 или CC-BY |
| **Пайплайн** | 23 скрипта на Node.js, частично завязанных на UBS | Новый пайплайн: 3–5 скриптов, чистые источники |
| **Язык** | Русский (Синодальный) как основной | Английский (BSB) как основной; русский — вторым этапом |
| **Выравнивание** | Полуавтоматическое: candidates → certify → manual-certified | Уже встроено в enriched-данные (Cherith/Berean глоссы на каждый греческий токен) |
| **App-ready данные** | `assets/data/` — 37 MB сгенерированных JSON | Новый `assets/data/` — генерируется чистым пайплайном из `docs/source-data/` |
| **Код** | `src/` — engine + UI + state + storage (всё работает) | `src/` — UI сохраняется, engine адаптируется под новый формат данных, загрузчики переписываются |

---

## 2. Почему английский первым

- Все переводы (BSB, ASV, ULT, OEB, WEB) уже скачаны и имеют чистые лицензии
- Cherith (CC-BY 4.0) и Berean (PD) глоссы уже дают пословное греко-английское выравнивание
- Не требуется получать разрешения (в отличие от русских РБО/Десницкий/Кассиан)
- Strong's Dictionary на английском (public domain) — готовая словарная база

Русский язык добавляется вторым этапом, когда:
- Основной пайплайн на английском отлажен
- Получены разрешения на русские переводы (или решено работать только с Синодальным)

---

## 3. Архитектура данных

### 3.1 Источники → App-ready данные

```
docs/source-data/
├── originals/sblgnt-macula/books/*.json  ─┐
│   (23 MB, греческие токены)              │
├── enriched/books/*.json                  ├─→ ПАЙПЛАЙН ─→ assets/data/
│   (152 MB, токены + глоссы + морфология) │              ├── bibles/
├── enriched/lexemes.json                  │              │   ├── grc/ (греческий)
│   (5468 лемм + все формы + частотность)  │              │   └── eng/ (BSB)
├── enriched/frequency.json               ─┘              ├── lexicon/
│   (5468 лемм с рангами)                                 │   ├── core.json
├── translations/bsb-complete.json                        │   ├── frequency.json
│   (7 MB, 66 книг, 31K стихов)                           │   └── dictionary.json
├── translations/asv.json                                ├── align/
│   (4.5 MB, запасной буквальный)                          │   └── grc-eng/
├── translations/ult.json                                ├── alphabet.json
│   (4.6 MB, для технической сверки)                      ├── books.json
├── strongs/strongs-dictionary.json                       └── data-manifest.json
│   (2 MB, PD, английские определения)
├── strongs/strongs-ru-alignment.json
│   (русские соответствия номерам Стронга)
└── lexicon/top1000.core.json
    (проект-курация: 204 леммы с русскими глоссами)
```

### 3.2 App-ready формат (целевой)

```json
// assets/data/bibles/grc/matthew.json
{
  "schema": "original-book-v2",
  "bookId": "matthew",
  "title": "ΚΑΤΑ ΜΑΘΘΑΙΟΝ",
  "chapters": [
    {
      "n": 1,
      "verses": [
        {
          "n": 1,
          "ref": "matthew 1:1",
          "tokens": [
            {
              "i": 1,
              "s": "Βίβλος",          // surface form
              "lemma": "βίβλος",
              "translit": "Biblos",
              "morph": "N-NSF",
              "morphLabelRu": "сущ., им. падеж, ед. ч., жен. род",
              "strong": ["976"],
              "glossEn": "book",      // Berean gloss (PD)
              "glossAlt": "[The] book",  // Cherith gloss (CC-BY 4.0)
              "pos": "noun",
              "posLabelRu": "существительное",
              "freqRank": 1064,       // частота в НЗ
              "fw": false
            }
          ]
        }
      ]
    }
  ]
}
```

### 3.3 Что нового в формате

| Поле | Было в старом | Новое |
|---|---|---|
| `glossEn` | ❌ | ✅ Berean PD — основной английский глосс |
| `glossAlt` | ❌ | ✅ Cherith CC-BY — альтернативный глосс |
| `translit` | ❌ | ✅ Транслитерация (SBL-like) |
| `morphLabelRu` | ✅ (было) | ✅ Сохраняем (русские метки морфологии) |
| `posLabelRu` | ✅ (было) | ✅ Сохраняем |
| `freqRank` | ❌ | ✅ Ранг частотности (из enriched/frequency.json) |

---

## 4. Пайплайн: 4 скрипта

### 4.1 Скрипты

```
scripts/
├── build-bibles.mjs      — греческий текст + BSB
├── build-lexicon.mjs     — словарь (частотность, Strong's, русские глоссы)
├── build-align.mjs       — выравнивание греческий↔английский
└── build-data.mjs        — оркестратор (вызывает остальные)
```

### 4.2 `build-bibles.mjs`

**Вход:**
- `docs/source-data/enriched/books/*.json` — токены с глоссами, морфологией
- `docs/source-data/translations/bsb-complete.json` — BSB

**Выход:**
- `assets/data/bibles/grc/{book}.json` — греческий текст с глоссами
- `assets/data/bibles/eng/{book}.json` — BSB (английский)

**Логика:**
1. Для каждой книги читает enriched-токены
2. Группирует по главам и стихам (сейчас они плоские)
3. Добавляет freqRank из frequency.json
4. Добавляет translit (генерация из lemma)
5. Пишет греческие книги
6. Конвертирует BSB из формата API в стандартный формат (главы/стихи)

### 4.3 `build-lexicon.mjs`

**Вход:**
- `docs/source-data/enriched/lexemes.json` — 5468 лемм
- `docs/source-data/enriched/frequency.json` — частотность
- `docs/source-data/strongs/strongs-dictionary.json` — определения Strong's
- `docs/source-data/strongs/strongs-ru-alignment.json` — русские соответствия
- `docs/source-data/lexicon/top1000.core.json` — русские глоссы (проект)

**Выход:**
- `assets/data/lexicon/core.json` — комбинированный словарь: лемма → все переводы + частотность + формы
- `assets/data/lexicon/dictionary.json` — Strong's определения + русские соответствия

### 4.4 `build-align.mjs`

**Вход:**
- `docs/source-data/enriched/books/*.json` — токены

**Выход:**
- `assets/data/align/grc-eng/{book}.json` — маппинг греческий токен → английский глосс

**Логика:**
Выравнивание уже встроено в enriched-данные (поля `english` и `glossEn`). Скрипт просто переупаковывает в app-ready формат. Никакого нового выравнивания не требуется.

### 4.5 `npm run build:data`

```json
{
  "scripts": {
    "build:bibles": "node scripts/build-bibles.mjs",
    "build:lexicon": "node scripts/build-lexicon.mjs", 
    "build:align": "node scripts/build-align.mjs",
    "build:data": "npm run build:bibles && npm run build:lexicon && npm run build:align"
  }
}
```

---

## 5. Что в коде меняется

### 5.1 Оставить без изменений

```
src/ui/          — все компоненты и экраны
src/state/       — store, settings, progress, dictionary
src/storage/     — IndexedDB
src/router.js    — хэш-роутер
src/app.js       — точка входа
index.html       — оболочка PWA
vite.config.js   — сборка
assets/styles/   — CSS
assets/fonts/    — шрифты
```

UI-компоненты не зависят от формата данных — они получают данные через state/store. Пока интерфейс store не меняется, UI работает.

### 5.2 Адаптировать

```
src/engine/      — движок режимов (compose, letter-layer, form-layer, morphology, rules, hash)
src/data/        — загрузчики данных (bible-loader, lexicon-loader)
```

**Что именно меняется:**
- `bible-loader.js` — новый формат JSON (другие имена полей, плоский→иерархический)
- `lexicon-loader.js` — новый формат словаря
- `engine/compose.js` — может использовать поля `glossEn`, `translit`, `freqRank`
- `engine/morphology.js` — поле `morph` уже есть, метки совместимы
- `engine/letter-layer.js` — без изменений (работает с surface-формами)
- `engine/form-layer.js` — без изменений (работает с morphology)
- `engine/rules.js`, `engine/hash.js` — без изменений

### 5.3 Удалить/заменить

- `assets/data/` → генерируется заново пайплайном
- Старые `scripts/` → уже в obsolete, новые 4 скрипта

---

## 6. Формат BSB (app-ready)

```json
// assets/data/bibles/eng/matthew.json
{
  "schema": "translation-book-v2",
  "translationId": "BSB",
  "bookId": "matthew",
  "title": "Matthew",
  "license": "Public domain",
  "attribution": "Berean Standard Bible, https://berean.bible/",
  "chapters": [
    {
      "n": 1,
      "verses": [
        {
          "n": 1,
          "text": "This is the record of the genealogy of Jesus Christ, the son of David, the son of Abraham:"
        }
      ]
    }
  ]
}
```

---

## 7. План фаз

### Фаза 1: Пайплайн (1–2 дня)

- Написать `scripts/build-bibles.mjs`
- Написать `scripts/build-lexicon.mjs`
- Написать `scripts/build-align.mjs`
- Написать `scripts/build-data.mjs` (оркестратор)
- Запустить, проверить сгенерированные данные
- `npm run build:data` должен проходить без ошибок

### Фаза 2: Адаптация кода (1 день)

- Обновить `src/data/bible-loader.js` под новый формат
- Обновить `src/data/lexicon-loader.js`
- Адаптировать engine где нужно
- Проверить, что UI рендерит стихи
- Проверить все 5 режимов чтения

### Фаза 3: Верификация (0.5 дня)

- Пройти по всем экранам: чтение, словарь, прогресс, настройки
- Проверить офлайн-работу (PWA)
- `npm run build` проходит
- `npm test` проходит

### Фаза 4: Русский язык (отдельный план)

- Добавить Синодальный перевод в пайплайн
- Адаптировать выравнивание
- Локализовать UI (уже частично сделано)

---

## 8. Что НЕ входит в этот план

- Изменение UI/UX (только адаптация под новые данные)
- Добавление новой функциональности (конкорданс, семантический поиск и т.д.)
- Русские переводы с ограниченными лицензиями (РБО, Десницкий, Кассиан)
- Серверная часть (остаёмся static PWA)

---

## 9. Ключевые решения (приняты)

| Решение | Выбор |
|---|---|
| Первый язык | Английский |
| Основной перевод | BSB (public domain) |
| Источник выравнивания | Cherith + Berean глоссы (уже пословное) |
| Новое выравнивание | НЕ требуется |
| Формат app-ready данных | Иерархический: книга→глава→стих→токены |
| UI | Сохраняется без изменений |
| Engine | Адаптируется под новые имена полей |
| Пайплайн | 4 Node.js скрипта |
| Что удаляется | Старый `assets/data/`, старые скрипты (уже в obsolete) |
