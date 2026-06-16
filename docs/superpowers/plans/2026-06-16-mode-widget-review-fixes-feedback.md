# Review Fixes Plan — Senior Developer Feedback

> Date: 2026-06-16
> Reviewing: `docs/superpowers/plans/2026-06-16-mode-widget-review-fixes.md`
> Against: actual code state at commit `352c802` and subsequent user/linter edits

---

## Critical: Runtime Crash In Production

### `store` Is Undefined In `ensureGreekBookLoaded()`

`src/ui/screens/reading.js:73,76` — `store.update(s => ({ ...s, grcStatus: ... }))` references `store` which is a `const` local inside `mount()` (line 84). `ensureGreekBookLoaded()` is a module-level function (line 57). There is no module-level `store` or `storeRef` variable. JavaScript lexical scoping means `store` in module scope is `undefined`.

**Crash scenario:**
1. User starts with `wordLayer='off'` → Greek data not loaded → `grcBookData` is `null`
2. User switches toggle to `'lemma'` or `'form'` 
3. `onChange` or subscription handler calls `ensureGreekBookLoaded()`
4. `grcBookData` is `null`, `shouldLoadGreek` returns `true`
5. `loadBook('grc', bookId)` succeeds → reaches `store.update(...)` → **ReferenceError**

The function only works today because it hits early-return guards (`grcBookData` check) when Greek was pre-loaded during mount.

**Fix priority:** This is the #1 issue. Task 1 correctly identifies it but the prompt should explicitly say **this is a crash bug, fix it first**.

**Correct fix** (matching Task 1's intent but more explicit):

```js
// Module-level
let _store = null;
function setGrcStatus(status) {
  if (_store) _store.update(s => ({ ...s, grcStatus: status }));
}

export async function mount(container, ctx) {
  const { store } = ctx;
  _store = store;  // <-- before any module function uses it
  ...
}

export function unmount() {
  _store = null;  // <-- prevent stale references
  ...
}
```

Then replace `store.update(...)` → `setGrcStatus(...)` in `ensureGreekBookLoaded()` and anywhere else.

---

## `__schema` / SCHEMA_VERSION: Add-then-Remove Contradiction

Current code (`352c802`) added `SCHEMA_VERSION = 1` and `data.__schema` to `loadDictionary()` to migrate old `forms: 'lemma'` entries. Task 4 of the review-fixes plan says to **remove** this.

**Problem:** If we remove `SCHEMA_VERSION` and `__schema` without an alternative, old dictionary entries with `forms: 'lemma'` will NOT be cleaned up, and the toggle will not work for existing dictionary words. The per-word `forms: 'lemma'` will continue to override the global `wordLayer`.

**Two consistent paths:**
- **A:** Keep `SCHEMA_VERSION` + `__schema` as implemented. Migration runs once, cleans old `forms`, marks done. Task 4 is WRONG — don't remove it.
- **B:** Remove `SCHEMA_VERSION` entirely. Instead, make `buildWordEntries()` in `reading.js` treat `forms: 'lemma'` as equivalent to `forms: undefined` (since 'lemma' was the old default, not a user choice). This removes the need for migration.

**Recommendation:** Path B is cleaner for zero users. Change `buildWordEntries()`:

```js
// 'lemma' is the old default, not an explicit user choice
const explicitForms = (entry.forms != null && entry.forms !== 'lemma') ? entry.forms : undefined;
forms: explicitForms ?? (settings.wordLayer === 'form' ? 'form' : 'lemma'),
```

This needs to be in the plan explicitly. Right now neither path is clear.

---

## Substantial Issues

### 3. Task 1: Resetting `grcBookData` On Mount/Book Load Causes Flicker

Task 1, point 3: "reset grcBookData, grcVerseMap, grcLoadPromise and grcStatus to idle before loading."

If the user changes books, this will cause a visible flash: old Greek data is destroyed → text reverts to letter-only → new Greek data loads → words reappear. This is correct behavior (clean state), but the plan should mention that `reRenderWindowed()` should be called AFTER the reset to avoid showing stale word replacements with wrong alignment data.

### 4. Task 2: `setWordSetting` Undefined Handling — Missing Implementation Detail

Task 2 says: "update `setWordSetting()` so `value === undefined` deletes the key". The current code:

```js
export function setWordSetting(id, key, value, dict) {
  const updated = { ...dict };
  if (updated[id]) {
    updated[id] = { ...updated[id], [key]: value };
  }
  return updated;
}
```

`{ ...updated[id], forms: undefined }` creates a property with value `undefined` — it does NOT delete the key. Need explicit:

```js
if (value === undefined) {
  delete updated[id][key];
} else {
  updated[id] = { ...updated[id], [key]: value };
}
```

The prompt should show this code explicitly, not just describe it.

### 5. Task 3: `forms: 'all'` In Dictionary UI Not Addressed

The grep shows `src/ui/screens/dictionary.js:553`:
```js
{ value: 'all', label: 'Все формы' }
```

This is a UI option in the dictionary screen for per-word forms. It needs to be replaced per Task 2's spec (По виджету / Лемма / Форма оригинала). This is covered by Task 2's scope but the prompt for Task 3 should cross-reference it.

### 6. Task 5: Duplicate `reRenderWindowed()` Still Present

In the current code, changing wordLayer triggers:
1. mode-widget `onChange(ns)` → `reRenderWindowed()` (line 143)
2. store subscription `['settings']` → `reRenderWindowed()` (line 214)

Task 5 correctly identifies this and says to simplify. But it says "remove or simplify modeWidget onChange" — this is too vague. The specific fix should be:

**Option A:** Keep onChange for immediate chip update + async Greek loading, but DON'T call `reRenderWindowed()` — let the subscription do it.
**Option B:** Remove onChange entirely, let the subscription handle everything. But then we lose the immediate chip feedback.

**Recommendation:** Option A. Mode-widget onChange calls `updateChip()` + `ensureGreekBookLoaded()` if needed. Subscription handles `reRenderWindowed()`. Removes one of the two render paths.

### 7. Task 2: `countActiveWords()` Doesn't Filter `__schema`

If `__schema` stays in the dictionary object (per current code), `countActiveWords()` iterates `Object.entries(dict)` which includes `['__schema', 1]`. The function checks `if (!entry || entry.showInText === false) continue` — `1` is truthy but `1.showInText` is `undefined`, so `1.showInText === false` is `false`. The loop continues to `entry.status` → `1.status` is `undefined` → the status check fails silently. The entry is NOT counted. But it's fragile — a number doesn't have these properties.

Task 4, point 2 says "make countActiveWords() robust against metadata-like keys". The fix should be in `countActiveWords()`:

```js
if (!entry || typeof entry !== 'object' || entry.showInText === false) continue;
```

### 8. Task 6: Slider Debounce — "Flush Latest Value" Is Underspecified

"preferably flush the latest slider value before clearing the timer so a user does not lose the last slider movement when closing quickly." This needs a concrete implementation. The current debounce stores the latest value in a closure (`val` in the `input` event handler). When `destroy()` is called, the pending timer should be cleared but the latest value should be saved:

```js
function destroy() {
  if (sliderDebounce) {
    clearTimeout(sliderDebounce);
    // Flush: save the latest value that was pending
    const st = store.get();
    if (st.settings) saveSettings(st.settings);
    sliderDebounce = null;
  }
  ...
}
```

Not critical but the prompt should provide this pattern.

---

## Missing From The Plan

### 9. No Test For `deriveComposeMode` With `wordLayer='form'` + Zero Words

Task 8 lists test scenarios. Missing:
- `deriveComposeMode({ readingMode: 'mixed', wordLayer: 'form' }, 0)` → should return `LETTERS_ONLY`
- This is the key differentiator from `wordMode` (old v3 model) — even when wordLayer is 'form', zero active words = letter-only mode, no Greek loading

### 10. Mode-Widget Uses `state.dictionary`/`state.coreLexicon` From Store, But reading.js Also Publishes Them

`reading.js` publishes `dictionary`, `coreLexicon`, `frequencyList` to store at mount. `mode-widget.js` reads them from store. But if the dictionary screen modifies the dictionary (add/remove words), it must update the store. Currently, reading.js handles dictionary changes via `handleWordTap` → `addWord`/`setWordStatus` → `saveDictionary` → does NOT update store with new dictionary.

This means mode-widget's `dictWordCount` will NOT update after adding/removing words.

**Fix needed:** After any dictionary mutation in reading.js, call `store.update(s => ({ ...s, dictionary: updatedDict }))`.

### 11. `getActiveWordCount()` Called Before `buildWordEntries()` — Stale Data

In `reRenderWindowed()`:
```js
buildWordEntries();  // rebuilds wordEntries
const composeCtx = {
  mode: deriveComposeMode(settings, wordEntries.length),  // uses new wordEntries
  ...
};
```

But in `ensureGreekBookLoaded` (called from onChange):
```js
if (shouldLoadGreek(settings, getActiveWordCount()) && !grcBookData) {
```

`getActiveWordCount()` uses `countActiveWords(dictionary, coreLexicon, frequencyList)` — module-level data. This is pre-computed, not affected by `buildWordEntries()`. Different data source: `getActiveWordCount()` counts directly from dictionary, while `wordEntries.length` is the result of `buildWordEntries()` filtering. They should match, but they're computed separately.

If the dictionary was just modified (word added), `getActiveWordCount()` returns the new count, but `buildWordEntries()` hasn't been called yet in the onChange path. The fix: call `buildWordEntries()` before `getActiveWordCount()` in onChange. Currently, in the reading.js code I read, onChange does NOT call `buildWordEntries()` — it was removed. This means `wordEntries.length` may be stale.

Actually, looking at the current onChange (from the system reminder diff):
```js
onChange: (newSettings) => {
  if (newSettings) settings = newSettings;
  store.update(s => ({ ...s, grcStatus: grcBookData ? 'available' : 'unavailable' }));
  reRenderWindowed();
  if (shouldLoadGreek(settings, wordEntries.length) && !grcBookData) {
```

`reRenderWindowed()` calls `buildWordEntries()` internally, so `wordEntries` is rebuilt. But `shouldLoadGreek(settings, wordEntries.length)` is called AFTER `reRenderWindowed()`. This is correct — `wordEntries` has been rebuilt at this point.

But the subscription handler does:
```js
reRenderWindowed();
if (shouldLoadGreek(settings, getActiveWordCount()) && !grcBookData) {
```

Here `getActiveWordCount()` is separate from `wordEntries.length`. They should match, but it's computed twice. Not a bug, but a redundancy.

---

## Minor / Documentation Issues

### 12. Task 7: `lastActiveTab` Ambiguity

"remove stale requirements that settings.lastActiveTab must be persisted. If you choose to reintroduce lastActiveTab, implement it consistently in code and tests instead."

Current code DOES persist `lastActiveTab` in settings and uses it in mode-widget. This is a product decision, not a code defect. Task 7 should either:
- Confirm `lastActiveTab` is part of the model and keep it, OR
- Explicitly decide to remove it

Don't leave it as "decide for yourself".

### 13. Task 8 Test Descriptions Use `deriveComposeMode` But It's An Internal Adapter

The recommended tests reference `deriveComposeMode` and `shouldLoadGreek` directly. These are currently exported from `settings.js` so they're testable. Good.

### 14. `grcStatus='loading'` — No UI Handling

Task 1 adds `grcStatus='loading'` state. But the mode-widget only handles `unavailable` (disables Greek tab, shows `—` in chip) and treats everything else as "available". There's no visual feedback for `loading` state. Should the chip show a spinner or `…`? Should the Greek tab show a loading indicator?

This is missing from the plan — adding a state without UI handling.

---

## Summary

| # | Severity | What | Task |
|---|---|---|---|
| 1 | **Crash** | `store` undefined in `ensureGreekBookLoaded` | Task 1 |
| 2 | **Crash** | `__schema` add-then-remove inconsistency | Task 4 vs current code |
| 3 | Substantial | Mount reset flicker (missing reRender) | Task 1 |
| 4 | Substantial | `setWordSetting` undefined → delete not shown in code | Task 2 |
| 5 | Substantial | Duplicate render path not resolved with specific fix | Task 5 |
| 6 | Substantial | Dictionary mutations not synced to store → mode-widget stale | Missing |
| 7 | Substantial | `grcStatus='loading'` has no UI | Task 1 |
| 8 | Minor | `countActiveWords` fragile with `__schema` number entry | Task 4 |
| 9 | Minor | Slider debounce "flush" underspecified | Task 6 |
| 10 | Minor | `lastActiveTab` decision left ambiguous | Task 7 |
| 11 | Minor | `forms: 'all'` in dictionary UI not cross-referenced | Task 3 |
| 12 | Info | Tests should include `deriveComposeMode(form, 0)` scenario | Task 8 |

**Verdict:** Tasks 1 and 4 have crasher-level issues that must be resolved before implementation. The remaining tasks are directionally correct but need more specific implementation guidance on 3-4 points. The plan covers the right surface area — no major gaps in scope.
