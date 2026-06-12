# Греческая читалка Нового Завета

Спокойная библейская читалка с регулируемым греческим слоем (PWA, offline-first).
Пользователь читает Синодальный перевод, а греческий постепенно «просвечивает»
в тексте — от букв до реальных форм оригинала.

## Установка

```bash
git clone https://github.com/stkotok/ru2agr_reading.git
cd ru2agr_reading
npm install
npm run build:data
```

## Сборка данных

```bash
npm run build:data
```

Единственный исходник — `docs/clear-bible-alignments/SBLGNT.tsv` (греческие
токены с леммами, морфологией и номерами Стронга; происхождение и лицензии —
в [docs/clear-bible-alignments/README.md](docs/clear-bible-alignments/README.md)).
Скрипт генерирует греческие книги (`assets/data/bibles/grc/`) и выравнивание
русский ↔ греческий в syn-файлах: русское слово, совпавшее с
`ruMatches`-регуляркой лексемы из `assets/data/lexicon/core.json`,
сопоставляется очередному греческому токену с тем же номером Стронга.
Выравниваются только слова лексикона — ровно то, что потребляет режим 4;
каждая пара проверяется корпусными инвариантами при сборке (провал — ошибка
сборки). Стихи без выравнивания (в т.ч. 18 стихов Textus Receptus,
отсутствующих в SBLGNT) деградируют в замену леммами — это различие
текстуальных традиций, не баг.

Русский текст Синодального перевода загружается отдельно:
`node scripts/build-syn.mjs` (API bolls.life).

## Запуск

```bash
npm run dev     # dev-сервер на http://localhost:5173
npm run build   # production-сборка в dist/
npm run preview # предпросмотр production-сборки
```

## Тесты

```bash
npm test        # Vitest
```

## Архитектура

Подробная архитектура, план задач и функциональная спецификация —
в [docs/development/DEVELOPMENT_2.md](docs/development/DEVELOPMENT_2.md).

### Стек

- **Vanilla JS** (ES-модули, без фреймворков)
- **Vite** — сборка
- **vite-plugin-pwa** — PWA
- **Vitest** — тесты
- **CSS custom properties** — темизация

### Структура

- `src/engine/` — чистые функции движка (без DOM)
- `src/state/` — состояние (store, settings, progress, dictionary)
- `src/storage/` — IndexedDB-обёртка
- `src/ui/` — экраны и компоненты
- `assets/` — статика приложения: data (bibles, lexicon), fonts, styles, icon
- `scripts/` — пайплайн данных (build-syn, convert-alignments)
- `docs/` — исходные данные и архив (roadmap'ы в `docs/development/`)
- `tests/` — юнит-тесты

### Режимы

| Режим | Название             | Описание                                            |
|-------|----------------------|-----------------------------------------------------|
| 1     | Только буквы         | Русские буквы заменяются греческими                 |
| 2     | Буквы + подсказки    | То же + название буквы при нажатии                  |
| 3     | Слова из словаря     | Слова заменяются греческими леммами                 |
| 4     | Формы оригинала      | Реальные греческие формы из текста                  |
| 5     | Почти оригинал       | Греческий текст с русской подсказкой                |

## Лицензия

MIT — см. [LICENSE](LICENSE).

### Данные

- **SBLGNT** — © SBL и Logos Bible Software, CC-BY 4.0; метаданные токенов —
  © Clear Bible, Inc., CC-BY 4.0
- **Синодальный перевод** — общественное достояние
- **Gentium Plus** — SIL Open Font License 1.1
