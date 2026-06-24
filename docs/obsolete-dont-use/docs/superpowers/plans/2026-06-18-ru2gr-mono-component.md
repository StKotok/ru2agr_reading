# ru2gr Mono-Component Merge — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans to implement task-by-task.

**Goal:** Merge `Греческая читалка.dc.html` and `Слова.dc.html` into `ru2gr.dc.html` as a single DC component, then delete the child files.

**Architecture:** Single `class Component extends DCLogic` with namespaced methods (`reader*` / `word*`) and state keys. Template uses dot-path (`{{ reader.phone }}`) instead of `<dc-import>`. `ru2gr-tokens.js` unchanged.

**Tech Stack:** DesignCompanion DC runtime, vanilla JS, React.createElement

## Global Constraints

- Visual appearance must be identical
- `ru2gr-tokens.js` — no changes, remains single token source
- `support.js` — no changes
- State key namespaces: `reader*` / `word*` for conflicting keys
- Method names: `reader*` / `word*` prefix for all screen-specific methods
- Palette: `this.CR` for reader, `this.CW` for words
- Template references: `{{ reader.xxx }}`, `{{ words.xxx }}`

---

## File Structure

- **Modify:** `docs/ru2gr_design-example/project/ru2gr.dc.html` — complete rewrite
- **Delete:** `docs/ru2gr_design-example/project/Греческая читалка.dc.html`
- **Delete:** `docs/ru2gr_design-example/project/Слова.dc.html`
- **No change:** `docs/ru2gr_design-example/project/ru2gr-tokens.js`, `docs/ru2gr_design-example/project/support.js`

---

### Task 1: Read full child files and extract JS methods

Read the complete JS `<script>` blocks from both child files. Map out every method and state key to prepare the rename.

### Task 2: Build the merged Component class

Create the new `ru2gr.dc.html` with:
- Merged `<x-dc>` template (dot-path references)
- Merged `<script data-dc-script>` (namespaced methods + state)
- All helper methods at root level
- Two palette instances: `this.CR` and `this.CW`

### Task 3: Replace template — dc-import → dot-path

Update all template references from `<dc-import>` to `{{ reader.xxx }}` / `{{ words.xxx }}`.

### Task 4: Verify and delete child files

Visual verification (if possible) and delete the two child files.

### Task 5: Run full build gate

`npm test && npm run build`
