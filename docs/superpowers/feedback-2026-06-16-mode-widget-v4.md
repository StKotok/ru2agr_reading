# Review: Spec + Plan v4 — 2026-06-16

> Аудит: `specs/2026-06-15-mode-widget-design.md` и `plans/2026-06-15-mode-widget.md` (v4, после пользовательских правок)

---

## Сильные архитектурные решения

1. **`wordLayer: 'off' | 'lemma' | 'form'`** — явное выключение словарного слоя. Нет путаницы «mode 2 при intensity=0 и пустом словаре». `off` = только буквы, без загрузки Greek.

2. **UI state ≠ compose mode** — `deriveComposeMode(s, activeWordCount)` с параметром счётчика. `composeMode` вычисляется локально в `reading.js`, не хранится в IndexedDB. Правильное разделение слоёв.

3. **`grcStatus: 'idle' | 'loading' | 'available' | 'unavailable'`** — решает проблему «undefined значит доступен». `idle` = ещё не пробовали грузить (и не надо, `wordLayer='off'`). `unavailable` = попробовали, ошибка.

---

## Что нужно исправить перед имплементацией

### 1. BUG: `setTimeout`-listener leak при быстром open→close

**Plan Task 2, `openPopup()` (строки 411-413):**

```js
setTimeout(() => {
  document.addEventListener('click', onOutsideClick);
}, 0);
```

Если между `openPopup()` и срабатыванием `setTimeout` происходит `closePopup()` (например, двойной клик по чипу), `removeEventListener` в `cleanupPopup` вызывается до того, как listener был добавлен. `setTimeout` срабатывает позже → listener остаётся на `document` навсегда.

**Fix:** guard в setTimeout:

```js
setTimeout(() => {
  if (isOpen) document.addEventListener('click', onOutsideClick);
}, 0);
```

---

### 2. Непонятный grep в Task 9 Step 2

```bash
rg "MODES|DEFAULT_MODE|deriveConfiguredMode|deriveRenderMode|settings\\.mode" src
```

- `rg` может не быть в окружении. Заменить на `grep -rE`.
- `deriveConfiguredMode` и `deriveRenderMode` — эти имена **нигде не используются** в плане/spec/коде. Похоже на leftover из промежуточной правки. Убрать.

Правильная команда:

```bash
grep -rE "MODES|DEFAULT_MODE|settings\.mode" src/ --include='*.js' | grep -v node_modules
```

---

### 3. `addWord()` — поле `forms` удалено, тесты могут ожидать его

**Plan Task 4.5 Step 1:** убрать `forms: 'lemma'` из `addWord()`.

Нужно проверить, что существующие тесты `dictionary.test.js` не ожидают `forms: 'lemma'` в результате `addWord()`. Если ожидают — обновить ожидания в тестах.

---

### 4. Spec/Plan mismatch: degraded-состояние «словарная часть заменяется на `—`»

**Spec §2 (строка 91-92):** «Если `wordLayer!='off'` и `activeWordCount > 0`, **словарная часть чипа заменяется на `—`**»

**Spec §3, таблица чипа:** есть строка `Буквы, слова недоступны | α35% —` — но только для случая «слайдер >0%».

**Вопрос:** что показывает чип при `slider=0%`, `wordLayer='lemma'`, `activeWordCount > 0`, `grcStatus='unavailable'`?

По текущей логике плана: `showLetters=false`, `showWordLayer=true`, `grcUnavailable=true`, `activeWordsExist=true` → `html = '—'` (без буквенной части). Чип показывает одинокое тире. Но spec не описывает это состояние явно — самый близкий row: «Буквы, слова недоступны | α35% —», но там слайдер >0%.

**Нужно уточнить:** добавить в таблицу чипа строку «Слова недоступны, букв нет | `—`» с условием `slider=0%`, `wordLayer!='off'`, `activeWordCount>0`, `grcStatus='unavailable'`. Либо решить что в этом случае показываем `Рус`.

---

### 5. Spec §3 таблица: нет строк «Только леммы/формы, слов 0»

Spec (строка 134-135) говорит: «Если `wordLayer !== 'off'` — словарная часть показывается даже при `dictionaryWordCount === 0`». Слайдер 0% + `wordLayer='lemma'` + count=0 → `λέγω0`. Но в таблице чипа этого состояния нет (есть только с буквами: «Буквы + леммы, слов 0»).

Добавить две строки в таблицу:
| Только леммы, слов 0 | `λέγω0` | Слайдер 0%, `wordLayer='lemma'`, активных слов 0 |
| Только формы, слов 0 | `λέγει0` | Слайдер 0%, `wordLayer='form'`, активных слов 0 |

---

### 6. `onOutsideClick` — может сработать на уже закрытом попапе (симптом)

**Plan Task 2, `onOutsideClick`:**

```js
function onOutsideClick(e) {
  if (popup && !popup.contains(e.target) && e.target !== chip) {
    closePopup();
  }
}
```

`popup` обнуляется в `cleanupPopup()`. Если `onOutsideClick` вызывается после `closePopup()` (event bubbling), guard `popup &&` спасает от TypeError. Но сама ситуация — симптом того что listener не был снят вовремя. Фикс из пункта 1 смягчает проблему, но не решает её полностью для случая быстрого open→close→open.

---

### 7. Spec: onboarding-строка не упоминает `intensity`

**Spec §5 таблица (последняя строка):** «В пресетах убрать старое поле `mode`; сохранять `wordLayer`/`readingMode`, `settings.mode` не записывать»

**Plan Task 7:** обновляет пресеты (wordLayer, readingMode, **intensity**). Spec не упоминает `intensity`, хотя оно сохраняется. Добавить `intensity` в spec-строку для полноты.

---

## Итого

| # | Серьёзность | Что |
|---|---|---|
| 1 | Обязательно | `setTimeout`-listener leak — добавить `if (isOpen)` guard |
| 2 | Обязательно | Task 9 grep: заменить `rg` на `grep -rE`, убрать несуществующие имена |
| 3 | Обязательно | Уточнить degraded-состояние «слайдер 0 + слова недоступны» — `—` или `Рус`? |
| 4 | Опционально | `addWord()` тесты — проверить что не ждут `forms: 'lemma'` |
| 5 | Опционально | Таблица чипа: добавить «Только леммы/формы, слов 0» |
| 6 | Опционально | `onOutsideClick` — ok с текущим guard, но симптом остаётся |
| 7 | Опционально | Spec onboarding: упомянуть `intensity` в строке таблицы |
