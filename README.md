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

Для генерации данных нужны исходные файлы в `docs/clear-bible-alignments/`:

- `SBLGNT.tsv` — греческие токены
- `nt_RUSSYN.tsv` — русские токены
- `SBLGNT-RUSSYN-manual.json` — ручное выравнивание

```bash
npm run build:data
```

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
в [DEVELOPMENT_2.md](DEVELOPMENT_2.md).

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
- `data/` — статические данные (bibles, lexicon)
- `scripts/` — скрипты пайплайна данных
- `tools/` — утилиты (build-syn)
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

- **SBLGNT** — Society of Biblical Literature (SBLGNT EULA)
- **Синодальный перевод** — общественное достояние
- **Clear-Bible Alignments** — CC-BY-SA 4.0
- **Gentium Plus** — SIL Open Font License
