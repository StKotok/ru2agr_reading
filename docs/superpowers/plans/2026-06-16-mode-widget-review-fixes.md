# Mode Widget Review Fixes Implementation Plan

> Date: 2026-06-16
> Scope: fixes after review of commits `43238a7` and `3ac5688`.
> Target agent: Claude Code.

## Goal

Bring the mode widget implementation in line with the approved v4 product model:

- mixed reading is controlled by two independent layers: letter substitution
  (`intensity`) and word substitution (`wordLayer`);
- Greek original reading is a separate `readingMode='greek'` view;
- `grcStatus='unavailable'` means a real Greek-data load attempt failed, not
  "Greek was not needed";
- the dictionary screen always displays lemmas;
- per-word `forms` is only an override for replacement behavior in the reading
  text, not a different display mode for the dictionary screen.

## Non-Goals

- Do not add frameworks, UI libraries, CI, linters, telemetry, or new runtime
  dependencies.
- Do not hand-edit generated Bible data under `assets/data/bibles/**`.
- Do not introduce user data migrations. The project owner confirmed that
  migration for users is not needed.
- Do not change the product model back to numeric user-facing modes.

## Required Context For Claude Code

Before making changes, read:

- `AGENTS.md`
- `docs/development/DEVELOPMENT_1.md`, sections 3, 4, and 7
- `docs/superpowers/specs/2026-06-15-mode-widget-design.md`
- `docs/superpowers/plans/2026-06-15-mode-widget.md`
- this file

Run these inspections before editing:

```bash
git status --short
git log --oneline -n 5
rg -n "grcStatus|ensureGreekBookLoaded|wordLayer|forms|__schema|forms: 'all'|lastActiveTab" src tests docs/superpowers
```

## Task 1: Fix Crash In Greek Load State And `store` Scope

- [ ] Do this task first: current `ensureGreekBookLoaded()` can crash at runtime
- [ ] Add a safe module-level store reference for `reading.js`
- [ ] Stop using the local `mount()` variable `store` from module functions
- [ ] Set `grcStatus='loading'` before a real Greek-data load attempt
- [ ] Set `grcStatus='available'` only after Greek data is actually loaded
- [ ] Set `grcStatus='unavailable'` only after a required Greek-data load fails
- [ ] Keep `grcStatus='idle'` when Greek data is not needed
- [ ] Verify the Greek tab is not disabled in normal letter-only mode

### Claude Code Prompt

```text
You are working in /Users/mymac/development/web/ru2agr_reading.

Fix the Greek loading state machine in src/ui/screens/reading.js.

This is the first fix to make. It is a runtime crash bug, not cleanup.

Current risks:
- ensureGreekBookLoaded() is a module-level function but calls store.update(),
  while store is local to mount(container, ctx). This can throw ReferenceError.
- mount() and mode-widget onChange currently set grcStatus='unavailable' when
  grcBookData is null, even if Greek data was never needed and never attempted.
- The mode widget disables the Greek tab when grcStatus is unavailable, so the
  app can disable Greek original reading after a normal letter-only start.

Implement:
1. Add a module-level storeRef or equivalent safe reference:
   - initialize it in mount() after const { store } = ctx;
   - clear it in unmount();
   - use it from ensureGreekBookLoaded() and other module-level helpers.
2. Add a small helper like setGrcStatus(status) to avoid repeated optional
   storeRef checks. The shape can be:
   let storeRef = null;
   function setGrcStatus(status) {
     if (storeRef) storeRef.update(s => ({ ...s, grcStatus: status }));
   }
   Do not reference the local mount() variable store from module-level functions.
3. On each mount/book load, reset grcBookData, grcVerseMap, grcLoadPromise and
   grcStatus to idle before loading. Do this before any render can use stale
   Greek data from the previous book. If existing content is still visible after
   reset, rerender or keep the skeleton visible so stale alignments are not shown.
4. Compute whether Greek is needed with shouldLoadGreek(settings, activeWordCount).
   Use countActiveWords()/getActiveWordCount(), not grcBookData.
5. Initial mount:
   - if Greek is needed, set grcStatus='loading', try to load grc, then set
     available/unavailable based on the result;
   - if Greek is not needed, leave grcStatus='idle'.
6. ensureGreekBookLoaded():
   - return false without changing status when shouldLoadGreek(...) is false;
   - set loading before starting loadBook('grc', bookId);
   - set available on success;
   - set unavailable and show the existing toast only on failure while Greek is
     still required.
7. Remove any code that sets grcStatus='unavailable' merely because
   grcBookData is null.
8. Mode widget handling for grcStatus:
   - 'loading' must not disable the Greek tab;
   - 'loading' must not render the word-layer chip as unavailable;
   - disabled/degraded UI is only for 'unavailable'.

Manual verification target:
- Fresh start / onboarding preset "letters only": chip shows alpha percent,
  Greek tab is enabled, no degraded word-layer toast appears.
- Switching to Greek tab triggers Greek data loading and renders Greek original
  when data exists.
```

## Task 2: Complete Dictionary `forms` Override Contract

- [ ] Keep dictionary rows/cards displaying lemmas only
- [ ] Reword the per-word setting as replacement behavior, not dictionary display
- [ ] Replace legacy `Лемма / Все формы` with `По виджету / Лемма / Форма оригинала`
- [ ] Store per-word `forms` only as absent, `'lemma'`, or `'form'`
- [ ] Make `setWordSetting(id, 'forms', undefined, dict)` delete the key
- [ ] Ensure new words do not receive `forms` by default

### Claude Code Prompt

```text
Fix the per-word forms override without changing dictionary display.

Important product requirement:
- The dictionary screen ALWAYS displays lemmas. No exceptions.
- The per-word forms control only affects how that word is replaced in the
  reading text.

Files to inspect and modify:
- src/state/dictionary.js
- src/ui/screens/dictionary.js
- tests/dictionary.test.js (create if missing)
- tests/form-layer.test.js
- tests/compose.test.js

Implement:
1. In src/state/dictionary.js:
   - keep addWord() from setting forms by default;
   - update setWordSetting() so value === undefined deletes the key instead of
     storing forms: undefined;
   - preserve status, showInText, intensity, addedAt and other existing fields.
   Use an explicit delete branch, not object spread with `[key]: undefined`:
   export function setWordSetting(id, key, value, dict) {
     const updated = { ...dict };
     if (updated[id]) {
       const entry = { ...updated[id] };
       if (value === undefined) delete entry[key];
       else entry[key] = value;
       updated[id] = entry;
     }
     return updated;
   }
2. In src/ui/screens/dictionary.js:
   - continue displaying lemma as the main word everywhere;
   - change the label from "Формы:" to something like "В тексте:";
   - replace options with:
       { value: undefined, label: 'По виджету' }
       { value: 'lemma', label: 'Лемма' }
       { value: 'form', label: 'Форма оригинала' }
   - active option for "По виджету" means the forms field is absent;
   - clicking "По виджету" must call setWordSetting(dictId, 'forms', undefined, dict)
     and persist the resulting dictionary.
3. Do not introduce a UI state where the dictionary displays inflected Greek
   forms as the dictionary entry. Rows/cards remain lemma-based.
4. Remove the legacy dictionary UI option `{ value: 'all', label: 'Все формы' }`.
   It belongs to the old contract and must not be saved anymore.
5. Add tests for dictionary.js:
   - addWord() does not create forms;
   - setWordSetting(..., 'forms', undefined, dict) deletes forms;
   - deleting forms preserves other word settings.
```

## Task 3: Remove Legacy `forms: 'all'` Drift

- [ ] Replace test usage of `forms: 'all'` with `forms: 'form'`
- [ ] Update comments that describe the old `all` value
- [ ] Make direct form-layer tests assert the new contract explicitly
- [ ] Ensure no runtime code writes `forms: 'all'`

### Claude Code Prompt

```text
Normalize forms values across code and tests.

The approved values are:
- undefined: use global settings.wordLayer from the mode widget;
- 'lemma': replace with lemma;
- 'form': replace with the real Greek form from the aligned original.

Tasks:
1. Run:
   rg -n "forms: 'all'|forms: \"all\"|forms=all|forms === 'all'|Все формы" src tests docs/superpowers
2. In tests/form-layer.test.js and tests/compose.test.js:
   - replace forms: 'all' with forms: 'form';
   - update test names/comments from "forms=all" to "forms=form";
   - keep assertions checking real inflected forms.
3. In runtime UI, do not write 'all' anywhere. Cross-check
   src/ui/screens/dictionary.js, because it currently contains the legacy
   "Все формы" option.
4. If src/engine/form-layer.js currently treats every non-'lemma' value as form,
   keep behavior compatible but add clear tests that use 'form'. Do not add
   broad validation unless it is small and does not break existing fallback
   behavior.
5. Re-run:
   rg -n "forms: 'all'|forms: \"all\"|forms=all|forms === 'all'|Все формы" src tests
   Expected: no matches in src/tests.
```

## Task 4: Remove Unneeded Dictionary Schema Metadata

- [ ] Remove `SCHEMA_VERSION` from the dictionary entry object model
- [ ] Stop writing `__schema` into the dictionary store
- [ ] Make dictionary helpers ignore accidental metadata-like entries if present
- [ ] Ensure progress and fallback dictionary views do not treat metadata as a word
- [ ] Keep explicit `forms: 'lemma'` as a valid per-word override

### Claude Code Prompt

```text
Remove the dictionary schema migration that writes __schema into the dictionary
object.

Context:
- The project owner confirmed user migration is not needed.
- Current code writes data.__schema = 1 into the same object that stores word
  entries. This can leak into Object.entries(dict) consumers and appear as a
  pseudo-word in fallback/progress flows.
- Do NOT replace the migration by treating every entry.forms === 'lemma' as
  undefined in buildWordEntries(). After Task 2, 'lemma' is a valid explicit
  per-word override that forces lemma replacement even when the global widget is
  set to forms.

Implement:
1. In src/state/dictionary.js:
   - remove SCHEMA_VERSION and the loadDictionary() migration loop that writes
     __schema;
   - keep load/save fail-soft behavior;
   - optionally add a tiny helper isDictionaryEntry(value) if needed by exported
     helpers.
2. Make getActive() and countActiveWords() robust against non-object values and
   metadata keys such as __schema if they already exist in a local dev IndexedDB.
   Do not persist a migration just to clean them. Use an object guard before
   reading entry fields, for example:
   if (!entry || typeof entry !== 'object' || entry.showInText === false) continue;
3. Review src/ui/screens/dictionary.js and src/ui/screens/progress.js:
   - if they iterate Object.entries(dict), filter to real word entries where
     needed;
   - do not show __schema or other metadata-like keys as dictionary words.
4. Keep buildWordEntries() semantics:
   - absent forms => use global settings.wordLayer;
   - forms: 'lemma' => explicit lemma override;
   - forms: 'form' => explicit original-form override.
5. Add/extend tests so dictionary helpers ignore metadata-like entries and
   explicit forms: 'lemma' still works as an override.
```

## Task 5: Simplify Settings Persistence And Render Flow

- [ ] Pick one persistence owner for mode-widget setting changes
- [ ] Avoid duplicate `saveSettings()` calls from reading subscriptions
- [ ] Avoid duplicate immediate rerenders for the same setting change
- [ ] Preserve immediate visual feedback in the widget
- [ ] Preserve lazy Greek loading when word/Greek mode becomes active
- [ ] After reading-screen dictionary mutations, publish the new dictionary to store

### Claude Code Prompt

```text
Reduce duplicated settings side effects between mode-widget.js and reading.js.

Recommended architecture:
- mode-widget.js owns user writes: saveSettings(ns) + store.update(...settings: ns)
  when the user changes the chip popup controls.
- reading.js reacts to store settings changes: update module settings, rerender,
  and request Greek loading if needed.
- reading.js should not re-save settings merely because it observed settings in
  the store.
- mode-widget.js owns its immediate local UI feedback (mini-chip, active toggle,
  main chip). Parent onChange is not needed for chip responsiveness.

Implement:
1. In src/ui/screens/reading.js:
   - remove saveSettings(settings) from the store.subscribe(['settings']) callback;
   - let the subscription own reRenderWindowed() and ensureGreekBookLoaded() after
     settings changes;
   - remove modeWidget onChange entirely if possible. If keeping it temporarily,
     it must not call reRenderWindowed(), must not write grcStatus, and must not
     duplicate Greek loading already handled by the settings subscription.
2. In src/ui/components/mode-widget.js:
   - keep immediate local UI feedback for slider mini-chip, toggle active state,
     and main chip;
   - ensure every user setting write still persists once.
3. In src/ui/screens/reading.js dictionary mutations:
   - after addWord()/setWordStatus()/saveDictionary(dictionary) in handleWordTap,
     call store.update(s => ({ ...s, dictionary })) through the same safe store
     reference used in Task 1;
   - this keeps mode-widget dictWordCount current after words are added or marked
     from the reading screen.
4. After this task, moving the slider or toggling wordLayer should cause one
   effective reading rerender path, not two independent paths.
5. Keep the code conservative; do not introduce a new state-management pattern.
```

## Task 6: Fix Widget And Reading Lifecycle Edges

- [ ] Flush pending slider debounce on close/destroy
- [ ] Avoid `requestAnimationFrame` accessing a null popup
- [ ] Update open popup state when `grcStatus` changes
- [ ] Track and unsubscribe reading screen store subscriptions on unmount
- [ ] Keep bottom-sheet cleanup intact

### Claude Code Prompt

```text
Fix lifecycle edge cases introduced or exposed by the mode widget.

Files:
- src/ui/components/mode-widget.js
- src/ui/screens/reading.js

Implement:
1. Slider debounce:
   - if the popup is closed or the screen is destroyed while a slider debounce is
     pending, do not allow a stale timer callback to update an unmounted screen;
   - flush the latest slider value before clearing the timer so a user does not
     lose the last slider movement when closing quickly.
   - do not flush by saving store.get().settings unchanged; the pending slider
     value may still be only in the input closure. Store it in a variable such as
     pendingSliderValue, and commit `{ intensity: pendingSliderValue }` before
     clearing the timer.
2. Focus requestAnimationFrame:
   - capture the current popup in a local const before requestAnimationFrame;
   - inside the callback, check the popup still exists before querySelector().
3. Greek tab availability:
   - when grcStatus changes while the popup is open, update the Greek tab disabled
     state/title without requiring the user to close and reopen the popup.
   - for grcStatus='loading', keep the tab enabled. Optionally show a neutral
     title like "Греческий текст загружается"; do not show degraded unavailable
     state until grcStatus='unavailable'.
4. reading.js store subscriptions:
   - store unsubscribe functions returned by store.subscribe(['progress']) and
     store.subscribe(['settings']);
   - call them in unmount();
   - avoid accumulating duplicate subscriptions after navigating away and back.
5. Keep existing bottom-sheet MutationObserver cleanup behavior working.
```

## Task 7: Synchronize Documentation With The Final Model

- [ ] Remove stale `lastActiveTab` requirements from docs
- [ ] Document that dictionary display is lemma-only
- [ ] Document that per-word `forms` controls reading replacement only
- [ ] Remove stale references to user-facing numeric modes
- [ ] Remove or mark obsolete any references to `forms: 'all'`

### Claude Code Prompt

```text
Synchronize docs with the implemented final model.

Files to inspect:
- docs/superpowers/specs/2026-06-15-mode-widget-design.md
- docs/superpowers/plans/2026-06-15-mode-widget.md
- this plan file if implementation decisions require a small note

Required doc truths:
1. There is no user-facing sequence 1/2/3/4.
2. Mixed mode is intensity + wordLayer.
3. Greek original is readingMode='greek'.
4. The dictionary screen always displays lemmas.
5. Per-word forms is an override for replacement in the reading text only.
6. Approved forms values are absent, 'lemma', 'form'. Not 'all'.
7. No user migration is required.
8. Do not reintroduce settings.lastActiveTab in this fix set. Current code
   derives the active popup tab from readingMode, and that is sufficient for this
   product model. Remove stale documentation that says lastActiveTab must be
   persisted.

Keep doc edits focused. Do not rewrite unrelated roadmap text.
```

## Task 8: Add Focused Tests

- [ ] Add dictionary pure-function tests
- [ ] Add/update settings adapter tests if missing
- [ ] Update compose/form-layer tests for `forms: 'form'`
- [ ] Add a regression test for metadata-like dictionary keys
- [ ] Keep UI behavior covered by manual checks, not a new UI test framework

### Claude Code Prompt

```text
Add focused tests for the pure logic touched by these fixes.

Do not add a new test framework. Use existing Vitest patterns.

Recommended tests:
1. tests/dictionary.test.js:
   - addWord() creates status/showInText/intensity/addedAt but no forms;
   - setWordSetting(id, 'forms', undefined, dict) deletes forms;
   - setWordSetting preserves other entry fields;
   - getActive()/countActiveWords() ignore metadata-like keys such as __schema.
2. settings helper tests, either in a new tests/settings.test.js or an existing
   appropriate file:
   - deriveComposeMode(mixed/off, 0) => LETTERS_ONLY;
   - deriveComposeMode(mixed/lemma, 0) => LETTERS_ONLY;
   - deriveComposeMode(mixed/form, 0) => LETTERS_ONLY;
   - deriveComposeMode(mixed/lemma, >0) => WORD_LEMMA;
   - deriveComposeMode(mixed/form, >0) => WORD_FORM;
   - deriveComposeMode(greek, any count) => GREEK_ORIGINAL;
   - shouldLoadGreek() is false for wordLayer off and for wordLayer lemma/form
     with zero active words, true for Greek original and active word layer.
3. Update existing form-layer/compose tests from forms: 'all' to forms: 'form'.
4. Add or keep a test showing explicit forms: 'lemma' still forces lemma output
   when the global word layer would otherwise use forms.

Run:
npm test
```

## Task 9: Manual Browser QA

- [ ] Start dev server
- [ ] Check desktop width around 1280px
- [ ] Check mobile width around 375px
- [ ] Check light theme
- [ ] Check dark theme
- [ ] Verify no console errors except known favicon/dev-server noise

### Claude Code Prompt

```text
Run manual QA because this feature is primarily UI/lifecycle behavior.

Start:
npm run dev

Check at desktop width (~1280px) and mobile width (~375px), in light and dark
theme:

1. Fresh/onboarded letter-only state:
   - chip shows alpha percent, e.g. α35%;
   - Greek tab in the widget is enabled, not disabled;
   - no "Greek unavailable" toast appears.
2. Mixed + wordLayer='lemma' with zero active words:
   - chip shows α35% · λέγω0;
   - Greek data is not required for rendering;
   - text still behaves as letter-only.
3. Mixed + wordLayer='form' with zero active words:
   - chip shows α35% · λέγει0;
   - Greek data is not required for rendering.
4. After adding/selecting at least one word:
   - wordLayer='lemma' triggers Greek data loading;
   - while Greek data is loading, the Greek tab is not disabled and the chip does
     not show unavailable/degraded state;
   - replacements use lemmas;
   - wordLayer='form' uses real aligned forms.
5. Greek original tab:
   - selecting the tab loads/renders Greek original when data exists;
   - Russian hint visibility follows existing setting.
6. Dictionary screen:
   - entries display lemmas;
   - per-word "В тексте" control can choose По виджету, Лемма, Форма оригинала;
   - choosing По виджету removes the per-word forms override.
7. Navigation lifecycle:
   - open widget, move slider, close/navigate away quickly;
   - no stale timer console errors;
   - returning to reading does not duplicate rerenders or subscriptions.
8. Store sync:
   - add or mark a word from the reading screen;
   - the mode-widget word count updates without a full app reload.
```

## Task 10: Final Gates And Report

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Manual browser QA completed
- [ ] `git status --short` reviewed
- [ ] Final report lists checks, changed files, data/license status, notes, git status

### Claude Code Prompt

```text
Before reporting done:

Run:
npm test
npm run build
git status --short

If data files changed, stop and explain why. This plan should not require data
regeneration or license review.

Final response must include:
- Checks: commands/manual checks and pass/fail;
- Changed files;
- Данные/лицензии: "не менялись";
- Notes: remaining risks or skipped checks;
- Git status.

Do not say the task is complete if npm test, npm run build, or required manual
QA fails.
```

## Suggested Commit Message

```bash
git commit -m "fix: align mode widget state and dictionary forms contract"
```
