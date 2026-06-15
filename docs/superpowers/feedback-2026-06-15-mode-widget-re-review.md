# Critical Re-review: Spec + Plan (Post-Fix) — 2026-06-15

> Повторный аудит после правок. Только новые находки и незакрытые проблемы.

---

## 1. BUG: `grcAvailable` initial value is `undefined` (truthy) instead of `false`

**Plan Task 4, Step 4.** Initial `store.update`:

```js
store.update(s => ({ ...s, settings, progress, dictionary, coreLexicon, frequencyList }));
```

Нет `grcAvailable: false`. Следовательно `state.grcAvailable === undefined`.  
В `updateChip()` (строка 537):

```js
const grcAvailable = state.grcAvailable !== false; // undefined = ещё не знаем → true
```

И в `buildPopup()` (строка 174):

```js
const grcAvail = state.grcAvailable !== false;
```

`undefined !== false` → `true`. Виджет считает что греческий текст доступен, **хотя он ещё не загружен**.

**Последствия:**
- Чип показывает словарные слова (например `λέγω12`) до загрузки греческого текста
- Греческий таб в попапе **не disabled**
- Когда греческий реально загружается, `grcAvailable` становится `true` — но `updateChip` не вызывается (см. пункт 2)

**Fix:** Добавить `grcAvailable: false` в первый `store.update` в `mount()`:

```js
store.update(s => ({ ...s, settings, progress, dictionary, coreLexicon, frequencyList, grcAvailable: false }));
```

---

## 2. BUG: Виджет не подписан на изменения `grcAvailable`

**Plan Task 2.** Подписки (строки 628–632):

```js
store.subscribe(['settings'], () => { updateChip(); });
store.subscribe(['dictionary'], () => updateDictCount());
store.subscribe(['coreLexicon'], () => updateDictCount());
```

Нет подписки на `grcAvailable`. Когда reading.js выполняет:

```js
store.update(s => ({ ...s, grcAvailable: true }));
```

— `settings` не меняется, подписки не срабатывают. Чип **навсегда застывает** в состоянии с `—` (нет греческого), даже после успешной загрузки.

**Fix:** Добавить подписку:

```js
store.subscribe(['grcAvailable'], () => updateChip());
```

---

## 3. BUG: Состояние «слайдер 0, слова есть, grcBookData=null» — чип показывает `—` вместо `Рус`

**Spec §3, таблица, строка 80:** `Без греческого, без букв | Рус | Слайдер 0% или нет слов, grcBookData === null`

**Spec §2, degraded states, строка 62:** «если и слайдер на 0 — нейтральный индикатор "Рус"»

**Plan `updateChip()` логика:**  
Слайдер 0% → `showLetters = false`  
12 слов → `wordsExist = true`  
`false && true` → не попадаем в `!showLetters && !wordsExist`  
Идём в ветку с `wordsExist` → `!grcAvailable` → `html = '—'`

Результат: чип показывает **`—`** (одинокое тире). Это непонятно пользователю и противоречит spec.

**Fix:** При `!grcAvailable && !showLetters` всегда показывать `Рус`, независимо от `wordsExist`:

```js
if (!showLetters && !grcAvailable) {
  chip.innerHTML = '<span class="mw-rus-label">Рус</span>';
  chip.setAttribute('aria-label', 'Режим: чистый русский текст (греческий текст недоступен)');
  return;
}
```

---

## 4. Memory/reference leak: `popup` не сбрасывается при закрытии bottom-sheet пользователем

**Plan Task 2.** MutationObserver callback (строки 410–418):

```js
bottomSheetObserver = new MutationObserver(() => {
  if (!document.contains(sheet)) {
    isOpen = false;
    bottomSheetObserver.disconnect();
    bottomSheetObserver = null;
    cleanupPopup();
  }
});
```

`cleanupPopup()` чистит обработчики, но **не обнуляет `popup`**. Переменная `popup` продолжает ссылаться на DOM-элемент, который уже удалён из документа (detached). При следующем `openPopup()` создаётся новый элемент, но старая ссылка потеряна → утечка памяти.

**Fix:** Добавить `popup = null;` в `cleanupPopup()` или в observer callback.

---

## 5. Удаление `newWordsPerChapter` и `pauseNewToday` из UI

**Spec §6, строка 314:** «Убираются: radio-кнопки режимов, слайдер интенсивности, "Транслитерация", "Глосса / перевод", "Грамматика".»

**План Task 5:** удаляет `renderWordsSection` и `renderShowSection`.

Но `renderWordsSection` — это **«Новые слова за главу»** (1, 3, 5, 10 + чекбокс «Сегодня не добавлять новое»). Эти настройки не упомянуты в списке «убираются».

**Последствия:**
- Пользователь теряет возможность настраивать количество новых слов за главу
- Поле `newWordsPerChapter` остаётся в DEFAULTS со значением 3 навсегда
- `pauseNewToday` остаётся в DEFAULTS со значением false навсегда

Это намеренное решение (подтверждено пользователем в Q&A пункт 6), но **spec об этом молчит**. Нужно явно добавить: «Новые слова за главу» — тоже убирается, дефолт 3.»

---

## 6. `updateToggleHint` — мёртвые CSS-классы

**Plan Task 2, `updateToggleHint` (строки 323–336):**

```js
function updateToggleHint(mode) {
    const hint = document.getElementById('mode-widget-word-hint');
    if (!hint) return;
    const lemmaActive = mode === 'lemma';
    hint.innerHTML =
      '<span class="mw-hint-active">Леммы — как в словаре: ...</span><br>' +
      '<span class="mw-hint-dim">Формы — как в тексте: ...</span>';
    if (!lemmaActive) {
      hint.innerHTML =
        '<span class="mw-hint-dim">Леммы — как в словаре: ...</span><br>' +
        '<span class="mw-hint-active">Формы — как в тексте: ...</span>';
    }
}
```

CSS (Task 7, строки 1212–1219):
```css
.mw-hint-active { font-weight: 600; color: var(--text); }
.mw-hint-dim    { color: var(--muted); }
```

Логика рабочая: активная строка получает `mw-hint-active`, неактивная — `mw-hint-dim`. Но реализация через **полную замену innerHTML** — хрупкая (дублирование текста, опечатки). Правильнее было бы иметь **один HTML** и переключать классы на элементах. Не критично для v1, но техдолг.

---

## 7. `removeResize` — мёртвый код в области видимости

**Plan Task 2, строки 391 и 462–464:**

```js
let removeResize = null;     // объявлена снаружи openPopup
...
function cleanupPopup() {
    ...
    if (removeResize) {
      removeResize();        // вызывает () => window.removeEventListener(...)
      removeResize = null;
    }
}
```

Переменная заведена на уровне `createModeWidget`, но используется только внутри `openPopup`/`closePopup`/`cleanupPopup`. Переменная живёт дольше, чем нужно. Если `createModeWidget` вызывается один раз за жизнь приложения — не проблема. Но архитектурно грязно.

---

## 8. Double-Escape handling на мобильных

Когда попап открыт как bottom-sheet на мобильном:
- `bottom-sheet.js` **уже вешает** свой Escape-обработчик (в `openBottomSheet`)
- Plan добавляет **второй** Escape-обработчик (строка 439: `document.addEventListener('keydown', onKeyDown)`)
- При нажатии Escape срабатывают оба — порядок зависит от очерёдности `addEventListener`

Порядок: bottom-sheet добавляет свой обработчик при `openBottomSheet()` (вызывается раньше), plan добавляет свой позже. При Escape:
1. Первый обработчик (bottom-sheet) закрывает sheet → удаляет sheet из DOM
2. Второй обработчик (`onKeyDown`) → `closePopup()` → `popup.closest('.bottom-sheet')` возвращает `null` (sheet уже удалён) → пытается удалить popup сам → `popup.remove()` на уже detached-элементе → no-op

Не падает, но двойная работа. Не критично, но стоит отметить.

---

## Сводка

| # | Серьёзность | Где | Что |
|---|---|---|---|
| 1 | **Критично** | Plan T4:S4 + T2:updateChip | `grcAvailable` не инициализируется как `false` → чип врёт что греческий доступен |
| 2 | **Критично** | Plan T2:subscriptions | Нет подписки на `grcAvailable` → чип не обновляется при загрузке греческого текста |
| 3 | **Критично** | Plan T2:updateChip | Слайдер 0% + слова есть + grcAvailable=false → показывает `—` вместо `Рус` (расхождение со spec) |
| 4 | Существенно | Plan T2:MutationObserver | `popup` не сбрасывается при закрытии bottom-sheet пользователем (утечка ссылки) |
| 5 | Информация | Spec §6 + Plan T5 | `newWordsPerChapter`/`pauseNewToday` удалены из UI молча — spec должен явно это отразить |
| 6 | Косметика | Plan T2:updateToggleHint | innerHTML-переключение вместо переключения классов — дублирование текста |
| 7 | Косметика | Plan T2:scope | `removeResize` в замыкании живёт дольше необходимого |
| 8 | Информация | Plan T2:onKeyDown | Двойной Escape-обработчик на мобильных (bottom-sheet + mode-widget) |
