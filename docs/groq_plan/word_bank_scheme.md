# Word Bank — Схема данных (v1)

**Назначение:**  
`word_bank` — это новый **курируемый единый источник правды** о греческих словах Нового Завета, их русском соответствии в Синодальном переводе, глоссах и одобренных выравниваниях. 

Цель — со временем заменить сложную многостадийную генерацию alignment (apply-zefania + convert + refine) на простой emitter, который берёт этот банк + базовые тексты (syn + grc) и выдаёт ровно те лёгкие структуры, которые сейчас лежат в `assets/data/bibles/syn/*.json`, `lexicon/core.json` и `lexicon/frequency.json`.

Банк создаётся один раз (или редко обновляется) высококачественной работой LLM + человека с опорой на авторитетные источники проекта (SBLGNT.tsv, rus_nt_strongs.xml, UBS, ручные проверки, подстрочники). Все последующие изменения — только через правку этого файла.

---

## 1. Общая структура файла

```json
{
  "meta": { ... },
  "lexemes": [ ... ],
  "alignment_overrides": { ... }   // опционально, для особо сложных случаев
}
```

Файл лежит в `assets/data/lexicon/word_bank.json` (или разбит на несколько файлов при необходимости).

---

## 2. meta

```json
{
  "meta": {
    "version": "1.0.0",
    "curated_at": "2026-06-15",
    "curated_by": "LLM (Grok) + human review",
    "sources": [
      "docs/clear-bible-alignments/SBLGNT.tsv (Clear-Bible commit 6473aa4)",
      "assets/data/rus_nt_strongs.xml (Zefania RusVZh, 2009)",
      "assets/data/lexicon/core.json (hand-curated ruMatches)",
      "data-sources/ubs-greek-dictionary.json",
      "manual review of gold-dev + gold-heldout + Ин 1:1, αὐτός cases"
    ],
    "description": "Authoritative curated word bank for ru2agr Greek reading layer. Single source of truth for lexeme identity, Russian surface matching, glosses, and approved substitutions.",
    "statistics": {
      "total_lexemes": 204,
      "approved_for_substitution": 98,
      "total_verse_overrides": 12
    }
  }
}
```

**Правила:**
- `version` семантический.
- `sources` — обязательно перечислять все использованные первичные источники.
- При каждом серьёзном обновлении — новая запись в историю (отдельный файл `word_bank_changelog.md` или раздел в этом документе).

---

## 3. lexemes (основная часть)

Массив объектов. Каждый объект = одна лемма/Strong (аналог расширенного `core.json` + данные из frequency).

```json
{
  "id": "logos",                    // стабильный идентификатор (как в текущем core.json). Никогда не меняем после первого релиза.
  "strong": 3056,
  "lemma": "λόγος",
  "translit": "logos",
  "pos": "сущ., муж. род",
  "gloss": "слово, речь, смысл",
  "gloss_extended": "речь, учение, разум; в богословском употреблении — Логос",
  "ubs_domain": "Communication",    // если есть из UBS (опционально)
  "frequency": {
    "rank": 25,
    "count": 330
  },
  "approved_for_substitution": true,   // главный флаг. true → слово попадает в "Доступные", может быть в личном словаре и участвовать в заменах
  "match": {
    "ru_patterns": [
      "(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])"
    ],
    "ru_excludes": [
      "словно",
      "условие",
      "словарь"
    ]
  },
  "notes": "Одно из самых важных слов НЗ. В Ин 1:1-14 преимущественно богословское значение.",
  "provenance": "Zefania Strong 3056 + SBLGNT lemma + ручная проверка ruMatches по всему Синодальному тексту. Три вхождения в Ин 1:1 выровнены последовательно.",
  "curated_confidence": "high",
  "last_reviewed": "2026-06-15"
}
```

### Важные поля и семантика

| Поле                        | Тип          | Обяз. | Назначение / Правила |
|----------------------------|--------------|-------|----------------------|
| `id`                       | string       | да    | Стабильный ключ. Используется в personal dictionary (IndexedDB). Пример: `logos`, `theos`, `autos`. |
| `strong`                   | number       | да    | Номер Стронга (без G). |
| `lemma`                    | string       | да    | Каноническая греческая форма (с диакритикой). |
| `translit`                 | string       | да    | Чистый ASCII (для поиска). Используем ту же нормализацию, что и в `greek-translit.mjs`. |
| `approved_for_substitution`| boolean      | да    | Определяет, можно ли слово показывать пользователю в режиме 3-4. Аналог нынешнего `hasAlignment` + ограничения на core. |
| `match.ru_patterns`        | string[]     | да    | Регулярки (как текущие `ruMatches`). Используются и для fallback-генерации alignment, и как runtime-guard в form-layer. |
| `match.ru_excludes`        | string[]     | нет   | Стоп-слова (как `ruExclude`). |
| `gloss` / `gloss_extended` | string       | да    | Краткий и расширенный перевод. `gloss` — то, что показывается по умолчанию. |
| `frequency`                | object       | да    | `rank` + `count` (берём из корпуса или обновляем при регенерации). |
| `verse_overrides`          | array        | нет   | Специальные правила выравнивания для конкретных стихов этого слова (см. ниже). |
| `provenance`               | string       | да    | Короткое обоснование, откуда взято соответствие и почему одобрено. |
| `curated_confidence`       | "high" / "medium" / "low" | да | Для будущей фильтрации и аудита. |
| `notes`                    | string       | нет   | Любые важные замечания (многозначность, текстологические особенности и т.д.). |

---

## 4. verse_overrides (внутри lexeme)

Для слов, где простого Strong + ru_pattern недостаточно (местоимения, многозначные слова, TR-плюсы и т.д.).

```json
"verse_overrides": [
  {
    "ref": "Ин 1:1",
    "ru_word_indices": [3, 5, 9],           // 0-based индексы русских слов в стихе после split(/\s+/)
    "gr_token_indices": [0, 2, 3],          // предпочтительные индексы греческих токенов из grc
    "quality": "e",
    "note": "Последовательное выравнивание трёх вхождений λόγος. Порядок важен.",
    "sources": ["Zefania + sequential consumption rule"]
  },
  {
    "ref": "Ин 3:16",
    "ru_word_indices": [12],
    "gr_token_indices": [13],
    "quality": "e",
    "note": "αὐτόν → Него (не «Своего»)",
    "sources": ["refine Pass A (G846 pronoun fix) + manual review"]
  }
]
```

Эмиттер при генерации alignment для конкретного стиха сначала смотрит эти overrides для слов, у которых `approved_for_substitution === true`.

---

## 5. alignment_overrides (на верхнем уровне)

Глобальный раздел для особо сложных или текстологически спорных мест, которые не хочется привязывать к одной лемме.

```json
"alignment_overrides": {
  "2cor:11:32": [
    { "ru": 5, "gr": 4, "quality": "e", "note": "Расщепление 11:32/33 — особый случай" }
  ]
}
```

Используется редко. В большинстве случаев достаточно `verse_overrides` внутри lexeme.

---

## 6. Как это соотносится с текущими данными

| Текущий артефакт                    | Что будет производиться из Word Bank |
|-------------------------------------|--------------------------------------|
| `lexicon/core.json`                 | Подмножество lexemes с `approved_for_substitution: true` + ru_patterns |
| `lexicon/frequency.json`            | Все lexemes + частотные данные + `approved_for_substitution` как hasAlignment |
| `syn/*.json` → `alignment[]`        | Лёгкие массивы `{ru, gr, q?, src?}` сгенерированные эмиттером с учётом verse_overrides |
| `grc/*.json`                        | Остаётся почти без изменений (генерируется из SBLGNT.tsv) |
| Guard в `form-layer.js`             | Использует `match.ru_patterns` / `ru_excludes` из банка |

---

## 7. Правила курирования (обязательны)

1. **Одна лемма = одна запись** (по Strong + наиболее частой лемме из корпуса). Разные значения одной леммы описываются в `gloss` / `notes`, а не дублированием записей.
2. `approved_for_substitution: true` ставится **только** после того, как:
   - Есть проверенное русско-греческое соответствие (Zefania или ручная ru_pattern + просмотр реальных стихов).
   - Пройдена проверка на ложные срабатывания (ru_excludes).
   - Слово добавлено в хотя бы один gold-стих или случайную выборку.
3. Для каждого `verse_override` обязательно указывать `sources` и `note`.
4. Любое изменение `approved_for_substitution` или добавление override — требует обновления метрик на gold-dev / gold-heldout и rerun верификатора.
5. Банк никогда не содержит сырые индексы из конкретной версии bolls.life без комментария — только стабильные референсы (книга + глава + стих).

---

## 8. Пример полной записи (сокращённый)

```json
{
  "id": "autos",
  "strong": 846,
  "lemma": "αὐτός",
  "translit": "autos",
  "pos": "мест.",
  "gloss": "он, сам, свой",
  "gloss_extended": "личное / возвратное / притяжательное местоимение 3 лица",
  "frequency": { "rank": 3, "count": 5067 },
  "approved_for_substitution": true,
  "match": {
    "ru_patterns": [
      "(?<![а-яё])(он|она|оно|они|его|её|ему|ей|им|ими|них|него|неё|нему|ней|ним|ними)(?![а-яё])"
    ],
    "ru_excludes": []
  },
  "verse_overrides": [
    {
      "ref": "Ин 3:16",
      "ru_word_indices": [12],
      "gr_token_indices": [13],
      "quality": "e",
      "note": "αὐτόν → Него (личное, не возвратное)",
      "sources": ["refine-alignments Pass A + manual review"]
    }
  ],
  "provenance": "Zefania G846 + морфология из SBLGNT + систематическая правка местоимений (Pass A)",
  "curated_confidence": "high",
  "last_reviewed": "2026-06-15"
}
```

---

## 9. Будущий минимальный emitter (концепт)

```js
// pseudo-code
function buildAlignmentFromBank(synVerse, grcTokens, wordBank) {
  const result = [];
  const ruWords = synVerse.text.split(/\s+/);

  for (let i = 0; i < ruWords.length; i++) {
    const lex = findLexemeForWord(ruWords[i], wordBank); // по ru_patterns + approved
    if (!lex) continue;

    // 1. Ищем override
    const override = lex.verse_overrides?.find(o => o.ref === currentRef);
    if (override) { ... push с override.gr_token_indices ... }

    // 2. Иначе — используем Zefania Strong + sequential consumption (как сейчас)
    ...
  }
  return result;
}
```

Это позволит значительно упростить `apply-zefania-alignments.mjs` + `refine-alignments.mjs` после того, как банк будет наполнен.

---

**Следующие шаги (рекомендация):**

1. Создать `assets/data/lexicon/word_bank.json` по этой схеме (начать с пилота 40–60 самых частотных и сложных слов).
2. Написать `scripts/build-from-wordbank.mjs` (минимальный emitter).
3. Обновить `package.json` (`build:data` → emitter + verify).
4. Постепенно переносить данные из текущего `core.json` + результатов refine в банк.

Схема намеренно сделана расширяемой, но не избыточной. Все поля, которые сейчас реально используются в движке и UI, покрыты.