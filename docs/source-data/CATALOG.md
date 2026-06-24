# Source Data Catalog

Перечень всех данных в `docs/source-data/` с лицензиями, происхождением и ограничениями.

**Политика проекта:** только данные с лицензиями, допускающими:
- свободное использование (public domain, CC0, CC-BY, CC-BY-SA)
- хранение офлайн
- коммерческое использование (кроме CC-BY-SA — требует сохранения лицензии)
- распространение в составе приложения

Атрибуция обязательна для CC-BY данных. Данные «used with permission» без явной открытой лицензии исключены.

---

## 1. Греческий оригинал (Новый Завет)

### `originals/sblgnt-macula/`

| Поле | Значение |
|---|---|
| **Лицензия** | CC BY 4.0 |
| **Атрибуция** | «MACULA Greek Linguistic Datasets, available at https://github.com/Clear-Bible/macula-greek/. SBLGNT: © 2010 Society of Biblical Literature and Logos Bible Software, CC-BY 4.0.» |
| **Источник** | SBLGNT + MACULA Greek морфология (Clear Bible / Biblica) |
| **Формат** | JSON: книги → главы → стихи → токены |
| **Состав полей** | `id, i, s, lemma, lexemeKey, maculaLexemeId, morph, strongs, fw` |
| **Размер** | ~23 MB (27 книг) |
| **Примечание** | Поля `@ln` (Louw-Nida) и `@domain` (UBS MARBLE) исключены при генерации — данные чисты от UBS-компонентов. |

## 2. Переводы

### `translations/syn/` — Синодальный перевод (русский)

| Поле | Значение |
|---|---|
| **Лицензия** | Public domain (общественное достояние) |
| **Источник** | bolls.life API (перевод SYNOD) |
| **Формат** | JSON: книги → главы → стихи |
| **Размер** | ~1.9 MB (27 книг) |
| **Примечание** | Исторический текст Синодального перевода. Важно зафиксировать конкретный источник цифрового текста. |

### `translations/syn-generated/` — Синодальный перевод (сгенерированный формат)

| Поле | Значение |
|---|---|
| **Лицензия** | Public domain (общественное достояние) |
| **Источник** | Тот же текст, другой формат (выход пайплайна) |
| **Формат** | JSON: книги → главы → стихи (альтернативная структура) |
| **Размер** | ~7.7 MB (27 книг) |
| **Примечание** | Сгенерирован старым пайплайном. Можно использовать для сравнения форматов при новом пайплайне. |

## 3. Выравнивание (alignment)

### `alignments/syn--sblgnt-macula/`

| Поле | Значение |
|---|---|
| **Лицензия** | Проект-курация (project-owned) |
| **Источник** | Ручная и полуавтоматическая курация авторов проекта |
| **Формат** | JSON: посегментное выравнивание русских слов ↔ греческих токенов |
| **Размер** | ~2.3 MB (27 книг) |
| **Примечание** | Содержит `manual-certified.json` — ручной allowlist для C3-сертификации. |

## 4. Словари и лексиконы

### `strongs/` — Strong's Dictionary

| Файл | Лицензия | Описание | Размер |
|---|---|---|---|
| `strongs-dictionary.json` | Public domain | Словарь Стронга (английские определения для греческих номеров) | ~2 MB |
| `strongs-greek.json` | Public domain | Греческие слова с номерами Стронга | ~1.6 MB |
| `strongs-ru-alignment.json` | Проект-курация (из PD данных) | Русские соответствия номерам Стронга (5378 записей) | ~900 KB |

**Источник:** Оригинальный Strong's Exhaustive Concordance (1890), общественное достояние.

### `lexicon/` — Рабочий лексикон проекта

| Файл | Лицензия | Описание |
|---|---|---|
| `top1000.core.json` | Проект-курация | Топ-1000 частотных лемм НЗ с морфологией, транслитерацией, русскими глоссами, регулярками для поиска |
| `locales/ru/core.json` | Проект-курация | Русские локализованные данные для core-лексем |
| `locales/ru/top1000.json` | Проект-курация | Полные русские данные для топ-1000 лемм |

**Источник:** Курация авторов проекта на основе Strong's (PD) и SBLGNT/MACULA (CC-BY 4.0).

### `locales/ru/` — Русская языковая поддержка

| Поле | Значение |
|---|---|
| **Лицензия** | Проект-курация (project-owned, proprietary) |
| **Источник** | Ручная курация авторов проекта |
| **Состав** | `core.json` (204 леммы: глоссы, регулярки, ссылки), `source-manifest.json` |
| **Размер** | ~436 KB |

## 5. Конфигурация приложения

### `app-config/`

| Файл | Лицензия | Описание |
|---|---|---|
| `alphabet.json` | Проект | Греческий алфавит: буквы, имена, произношение, порядок введения |
| `books.json` | Проект | Метаданные книг Библии (названия, сокращения, главы) |
| `textual-variants.json` | Проект | База текстуальных вариантов (с ссылками) |
| `data-manifest.json` | Проект | Манифест загружаемых данных |
| `schema/` | Проект | JSON-схемы для валидации всех форматов данных |

---

## 6. Обогащённые данные (enriched)

### `enriched/` — по-токеновые данные с глоссами

Извлечено из `canonical/sblgnt-macula/` с удалением UBS-поля `semantic`.

| Файл | Лицензия | Описание | Размер |
|---|---|---|---|
| `books/*.json` (27 книг) | CC-BY 4.0 + PD | Токены с Cherith (`english`) и Berean (`glossEn`) глоссами, морфологией, транслитерацией | ~152 MB |
| `frequency.json` | CC-BY 4.0 | 5468 лемм с рангами, покрытием, частотностью | ~500 KB |
| `lexemes.json` | CC-BY 4.0 + PD | 5468 лемм: все формы, все ссылки, частотность, глоссы (Cherith + Berean), транслитерация | ~6 MB |

**Поля каждого токена:** `surface`, `lemma`, `transliteration`, `morphology` (с русскими метками), `pos` (с русскими метками), `strong`, `english` (Cherith, CC-BY 4.0), `glossEn` (Berean, Public domain), `accent`, `isFunctionWord`.

**Поля каждой леммы:** `allRefs` (все места в НЗ), `attestedForms` (все словоформы с частотностью), `englishGlosses` (Cherith), `glossesEn` (Berean), `frequency`, `transliteration`.

## 7. Английские переводы

### `translations/`

| Файл | Перевод | Лицензия | Книг | Стихов | Размер |
|---|---|---|---|---|---|
| `bsb-complete.json` | Berean Standard Bible | Public domain | 66 | 31,086 | 7.0 MB |
| `asv.json` | American Standard Version (1901) | Public domain | 66 | 31,102 | 4.5 MB |
| `oeb.json` | Open English Bible | CC0 | 42 (NT) | 23,444 | 0.5 MB |
| `web.json` | World English Bible | Public domain | 84 (с апокрифами) | 37,654 | 1.8 MB |
| `ult.json` | unfoldingWord Literal Text | CC BY-SA 4.0 | 66 | 31,103 | 4.6 MB |
| `oeb.osis.xml` | Open English Bible (исходник) | CC0 | — | — | 2.6 MB |
| `web.usfx.xml` | World English Bible (исходник) | Public domain | — | — | 5.9 MB |

**Источники:**
- BSB — Free Use Bible API (bible.helloao.org)
- ASV — wldeh/bible-api (GitHub, jsDelivr)
- OEB — Freely-Given-org/seven1m--open-bibles (GitHub)
- WEB — Freely-Given-org/seven1m--open-bibles (GitHub)
- ULT — git.door43.org/unfoldingWord/en_ult (USFM → JSON)

---

## Чего ещё недостаёт

| Данные | Лицензия | Статус |
|---|---|---|
| **Доп. русские переводы** (РБО, Десницкий, Кассиан) | Требуют разрешений | ❌ нужны разрешения |

### Дополнительные русские переводы (требуют разрешений)

| Перевод | Лицензия | Статус |
|---|---|---|
| **СРП РБО** — Современный русский перевод | Нужно разрешение РБО | ❌ |
| **Перевод Десницкого** | Некоммерческое цитирование | ❌ |
| **Перевод Кассиана** | Нужно согласование | ❌ |

---

## Данные, исключённые из проекта (→ `docs/obsolete-dont-use/`)

| Данные | Причина исключения |
|---|---|
| UBS Greek Dictionary (SDBG) | «Used with permission» только для MACULA — нет открытой лицензии |
| UBS Lexical Domains | Та же проблема |
| MACULA Greek (исходный `docs/macula-greek/`) | Содержит UBS поля `@ln`/`@domain` «used with permission» |
| `generated/canonical/` | Содержит UBS-данные в поле `semantic` (louwNida, domainCode etc.) |
| Groq plan | Устаревший план |
| Proverbs1 handoff | Устаревший handoff |
| Cambio handoff | Устаревший handoff |
