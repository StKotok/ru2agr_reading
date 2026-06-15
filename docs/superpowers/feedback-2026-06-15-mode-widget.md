# Code Review: Spec + Plan (Senior Developer) — 2026-06-15

> Аудит: `specs/2026-06-15-mode-widget-design.md` и `plans/2026-06-15-mode-widget.md`

---

## А. Spec: `2026-06-15-mode-widget-design.md`

### A1. Номер версии неактуален

Строка 3: `статус: пересмотрен (2026-06-15, v2)`. Сделано три раунда правок (миграция, degraded states, настройки, обсуждение 8 вопросов). Должно быть **v3**.

### A2. `deriveMode` — потеряна связь с `intensity`

В секции 5 код `deriveMode` (стр. 195–199):
```js
function deriveMode(s) {
  if (s.readingMode === 'greek') return 4;
  if (s.wordMode === 'form') return 3;
  return 2; // 'lemma' — дефолт для 'mixed'
}
```

А текст рядом (стр. 202): «`deriveMode` вызывается при каждом изменении `intensity`, `wordMode` или `readingMode`». Но функция **уже не зависит от intensity**. Вызов при изменении `intensity` — холостой. Текст нужно поправить: «при каждом изменении `wordMode` или `readingMode`».

### A3. Режим 1 стал недостижим через виджет

`deriveMode` всегда возвращает 2, 3 или 4. Режим 1 — только через непромигрированные старые данные. Это не баг (режим 1 = «ничего не включено», что в новой модели = «Рус»), но стоит явно отразить: **mode 1 — только для legacy-данных, виджет его не генерирует**.

### A4. Не хватает негативных состояний чипа

Таблица в секции 3 показывает 6 состояний. Нет состояний:
- `—` (дефис) — когда `grcBookData === null` (словарная часть принудительно скрыта, spec обещает `—`)
- `…` (загрузка) — когда данные словаря ещё не пришли

Они описаны текстом ниже, но отсутствуют в таблице — неполнота для дизайнера/разработчика.

### A5. `--font-greek` — нет в tokens.css

Spec (стр. 243) ссылается на `--font-greek`, но в `assets/styles/tokens.css` этой переменной **нет**. Шрифт Gentium Plus подключается в `app.css` через `@font-face` и применяется селекторами (`.gr`, `.gr-text`), а не переменной. В плане (Task 7 CSS) используется `var(--font-greek, 'Gentium Plus', serif)` — это не сломается (fallback сработает), но переменной реально нет.

**Надо:** либо добавить `--font-greek` в tokens.css, либо убрать из spec.

### A6. Секция 3 — слово-индикатор статичный

Строка 88: «Слово-индикатор: `λέγω` (лемма) / `λέγει` (форма) — глагол "говорить"». Это дизайн-решение (статичный placeholder). В порядке.

---

## Б. Plan: `2026-06-15-mode-widget.md`

### Б1. Мобильный попап: утечка обработчиков

Task 2, `openPopup()` (строки 389–403):
```js
if (isMobile) {
  openBottomSheet(popup);
  setTimeout(() => {
    const overlay = document.querySelector('.bottom-sheet-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => { ... }, { once: true });
    }
  }, 50);
}
```

Проблемы:
1. **50ms таймаут** — хрупкий. Если bottom-sheet анимируется дольше (CSS transition), `overlay` ещё нет в DOM → обработчик не вешается → `isOpen` остаётся `true` навсегда → чип не открывается повторно.
2. **Обработчик только на overlay click** — bottom-sheet закрывается также по **свайпу** и **Escape**. При свайпе `isOpen` не сбрасывается.

**Надо:** либо `closeBottomSheet` должен возвращать Promise/принимать callback, либо обернуть `openBottomSheet` в wrapper, который отслеживает закрытие через MutationObserver на самом sheet-элементе.

### Б2. `position: fixed` дублируется в JS и CSS

Task 2, `positionPopup()` (строка 488): `popup.style.position = 'fixed';`
Task 7, CSS (строка 986): `.mode-widget-popup { position: fixed; ... }`

Не баг, но JS-стиль перекрывает CSS. Если кто-то поменяет CSS — не заметит, что JS перезаписывает. Лучше убрать из JS, оставить только top/left.

### Б3. `updateDictCount` вызывается при каждом изменении settings

Task 2, строки 575–578:
```js
store.subscribe(['settings'], () => {
  updateChip();
  updateDictCount();
});
```

Изменение `intensity` (слайдер) → `store.update` → `settings`-подписка → `updateDictCount()` **перестраивает Map'ы и пересчитывает все слова**. Слайдер дёргается часто (даже с debounce 300ms). Счётчик слов от слайдера не зависит. Лишняя работа.

**Надо:** `updateDictCount` вызывать только при изменении `dictionary`, `coreLexicon`, `frequencyList`. Из `settings`-подписки — только `updateChip()`.

### Б4. Греческая вкладка не проверяет `grcAvailable`

Task 2, `buildPopup()`: обе вкладки создаются всегда, таб «Греческий» не disabled. Spec требует: «disabled-состояние таба с сообщением».

В плане этого нет. Надо добавить в `buildPopup()` проверку:
```js
const grcAvail = state.grcAvailable !== false;
const greekTab = el.querySelector('[data-tab="greek"]');
if (!grcAvail) {
  greekTab.disabled = true;
  greekTab.title = 'Греческий текст недоступен';
}
```

### Б5. Нет реакции на resize

Пользователь открыл попап как bottom-sheet на мобильном (800px), повернул планшет (1024px) — попап остался в bottom-sheet. И наоборот.

План не обрабатывает `resize`. Минимально: при переходе через 900px закрывать попап (пользователь откроет заново в новом режиме).

### Б6. Сброс настроек не чистит новые поля

Task 5, `renderResetSection()` (существующий код, не меняется планом): сбрасывает `progress` и `dictionary` из IndexedDB. Но **не сбрасывает `settings`**. Если `settings` повреждаются — сброс не помогает. Не specifically баг плана, но смежный дефект, который стоит упомянуть.

### Б7. Task 8, Step 2: grep-команда сломается

```bash
grep -r "from '../../state/settings.js'" src/ --include='*.js' -l | xargs grep "MODES\|DEFAULT_MODE"
```

Первый grep с `--include='*.js'` работает (одинарные кавычки внутри двойных — shell не интерпретирует). Но если первый grep ничего не найдёт, `xargs grep` запустится без аргументов и будет читать stdin → зависнет.

**Надо:** `grep ... | xargs -r grep ...` (флаг `-r` у xargs чтобы не запускать при пустом вводе).

---

## В. Согласованность Spec ↔ Plan

| Требование spec | Есть в плане? |
|---|---|
| Миграция `_schemaVersion` | ✅ Task 1 |
| `deriveMode` | ✅ Task 1 |
| Чип с 6 состояниями | ✅ Task 2 (`updateChip`) |
| Загрузка `…` | ❌ `dictWordCount === -1` → `Math.max(0,-1) === 0` → чип показывает `Рус`, а не `…` |
| Индикатор `—` при grcBookData=null | ❌ Нет в плане. `updateChip` скрывает словарную часть, но `—` не показывается |
| Глобальный wordMode vs per-word forms | ✅ Task 4 (`entry.forms \|\| settings.wordMode`) |
| Слайдер 300ms debounce | ✅ Task 2 (`DB_SLIDER`) |
| Focus trap | ✅ Task 2 (`trapFocus`) |
| Настройки: оставить тему, диакритику, Стронг, сброс | ✅ Task 5 |
| `lastActiveTab` сохранение | ✅ Task 1 (DEFAULTS), Task 2 (silent switchTab) |
| `ruHint` чекбокс | ✅ Task 2 (`buildGreekPanel`) |
| plainView — без изменений | ✅ (код не трогаем) |

---

## Г. Сводка: что исправить

### Критичные (блокируют реализацию)

| # | Где | Что |
|---|---|---|
| 1 | Plan Task 2 | `updateChip`: `dictWordCount === -1` → показать `…`, а не `Рус` |
| 2 | Plan Task 2 | Греческий таб disabled при `!grcAvailable` |
| 3 | Plan Task 2 | Мобильный попап: сброс `isOpen` при закрытии bottom-sheet (все способы: свайп, Escape, overlay) |

### Существенные (затрудняют реализацию)

| # | Где | Что |
|---|---|---|
| 4 | Spec §5 | Текст про `deriveMode` — убрать упоминание `intensity` из списка триггеров |
| 5 | Spec §2 | Добавить примечание: «mode 1 — только legacy, виджет генерирует 2, 3 или 4» |
| 6 | Plan Task 2 | `updateDictCount` не вызывать из `settings`-подписки |
| 7 | Plan Task 2 | Добавить `resize`-обработчик (закрытие попапа при переходе 900px) |

### Косметические

| # | Где | Что |
|---|---|---|
| 8 | Spec §1 | `v2` → `v3` в заголовке |
| 9 | Spec §3 | Добавить состояния `—` и `…` в таблицу чипа |
| 10 | Spec §5 | `--font-greek` — добавить в tokens.css или убрать из spec |
| 11 | Plan Task 2 | Убрать `position: fixed` из JS (`positionPopup`) |
| 12 | Plan Task 8 | `xargs -r` в grep-команде |
