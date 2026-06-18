# ru2gr — моно-компонент (слияние трёх .dc.html в один)

**Дата:** 2026-06-18
**Ветка:** feat/macula-v3
**Цель:** Избавиться от `Греческая читалка.dc.html` и `Слова.dc.html` на диске, сохранив визуальную идентичность. `ru2gr-tokens.js` остаётся единым источником дизайн-токенов.

## Причина

Сейчас дизайн-система ru2gr размазана по трём файлам:
- `ru2gr.dc.html` (оркестратор, 77 строк)
- `Греческая читалка.dc.html` (экран чтения, ~1900 строк)
- `Слова.dc.html` (экран словаря, ~1300 строк)

Каждый дочерний файл содержит полный `<x-dc>` + `<script data-dc-script>` с собственным `class Component extends DCLogic`. Связь через `<dc-import name="...">` — DC-рантайм подгружает соседние файлы по fetch.

## Дизайн

### Стратегия: неймспейсинг через префиксы

Три `class Component` сливаются в один. Конфликтующие имена получают префиксы `reader*` / `word*`. Общие хелперы выносятся на верхний уровень.

### State: имена с префиксами

Конфликтующие ключи (5 шт.) переименовываются:

| Было (читалка) | Стало |
|---|---|
| `state.search` | `state.readerSearch` |
| `state.toast` | `state.readerToast` |
| `state.deskScale` | `state.readerDeskScale` |
| `state.statusMap` | `state.readerStatusMap` |
| `state.addedSet` | `state.readerAddedSet` |

| Было (слова) | Стало |
|---|---|
| `state.search` | `state.wordSearch` |
| `state.toast` | `state.wordToast` |
| `state.deskScale` | `state.wordDeskScale` |
| `state.statusMap` | `state.wordStatusMap` |
| `state.addedSet` | `state.wordAddedSet` |

Неконфликтующие ключи остаются без изменений.

### Методы: префиксы `reader*` / `word*`

Все методы читалки получают префикс `reader` (напр. `readerRenderPhone`, `readerRenderDesktop`). Все методы словаря — префикс `word` (напр. `wordDeskApp`, `wordPhoneApp`).

Общие хелперы (`a()`, `buildThemes()`) на верхнем уровне — без префикса.

### Палитра: два экземпляра

Читалка и словарь используют разные нюансы палитры (контраст влияет на словарь). Поэтому `this.C` заменяется на `this.CR` (читалка) и `this.CW` (слова). Каждый вычисляется в `renderVals()`:

```js
renderVals() {
  const theme = this.props.theme ?? 'Пергамент';
  this.CR = this.palette(theme);
  this.CW = this.palette(theme, this.props.contrast);
  return {
    theme, contrast: this.props.contrast ?? 'Чёткий',
    reader: { phone, desktop, galModeA..F, ... },
    words:  { phone, desktop, posCompare, sCompare }
  };
}
```

### Шаблон: dot-path вместо `<dc-import>`

DC-рантайм поддерживает `{{ reader.phone }}` (resolvePath с dot-нотацией). Поэтому `<dc-import>` заменяется прямым рендерингом:

```html
<!-- Секция 01 · Греческая читалка -->
{{ reader.phone }}
{{ reader.desktop }}
{{ reader.galModeA }} ... {{ reader.galModeF }}
{{ reader.chip1 }} ... {{ reader.chip5 }}

<!-- Секция 02 · Слова -->
{{ words.phone }}
{{ words.desktop }}
{{ words.posCompare }}
{{ words.sCompare }}
```

### ru2gr-tokens.js

Не меняется. Оба компонента уже делегируют `window.RU2GR.THEMES`. В моно-компоненте `buildThemes()` остаётся на верхнем уровне.

## Шаги реализации

1. Бэкап: скопировать `Греческая читалка.dc.html` и `Слова.dc.html` в `docs/ru2gr_design-example/project/.backup/`
2. Создать новый `ru2gr.dc.html` с объединённым шаблоном и скриптом
3. Верифицировать визуальную идентичность
4. Удалить дочерние файлы
5. Прогнать `npm test && npm run build`

## Объём

- Финальный `ru2gr.dc.html`: ~2900 строк
- Изменения в `ru2gr-tokens.js`: не требуются
- Изменения в `support.js`: не требуются
- Риски: механический — внимательность при переименовании state-ключей и методов
