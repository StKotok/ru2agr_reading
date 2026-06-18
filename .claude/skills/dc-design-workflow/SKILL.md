---
name: dc-design-workflow
description: Use when editing the DC design prototype at docs/ru2gr_design-example/project/ — navigating between HTML template, JS render functions, and data files; adding data-section markers; tracing UI elements to source code; or documenting design decisions for the ru2gr reader app.
---

# DC Design Workflow

## Overview

The DC prototype is a two-layer system: an HTML template with `{{ }}` placeholders (layer 1)
and React `createElement` render functions (layer 2). `data-section` attributes on template
elements bridge the two — you see them in browser DevTools and they tell you exactly which
template block produced the rendered output.

## File Map

| File | Role | When to edit |
|------|------|-------------|
| `ru2gr.dc.html` | Template + Component class + renderVals | Adding/removing sections, changing which gallery variants appear |
| `ru2gr-render.js` | All React render functions (~1003 lines) | Changing any visual element: colors, sizes, layout, text |
| `ru2gr-tokens.js` | 12 color themes (`window.RU2GR.THEMES`) | Changing theme colors, adding a new theme |
| `ru2gr-data.js` | Static data: verses, dictionary entries (A), mode names, word lists | Changing text content, adding dictionary entries |
| `ru2gr-utils.js` | Palette builders, SVG icons, token parser, chip state helpers | Changing how colors compute, modifying icons |
| `support.js` | DC runtime framework — do NOT edit | Never — it's a compiled framework |

## Two-Layer Architecture

```
ru2gr.dc.html                    ru2gr-render.js
──────────────                   ───────────────
<x-dc>                           R.readerRenderDesktopApp = function() {
  ...                              return h('div',{style:{...}},
  {{ reader.desktop }}  ───────→    titlebar,
  {{ reader.phone }}    ───────→    nav, main, inspector);
  ...                              };
</x-dc>                          R.readerRenderPhone = function() { ... };
```

`renderVals()` (in `ru2gr.dc.html`) calls the render functions and returns their output.
The DC runtime resolves `{{ reader.desktop }}` → `renderVals().reader.desktop`.

**Critical**: `data-section` attributes mark **template-layer boundaries only**.
To find a specific button INSIDE the desktop reader, you need to trace into `ru2gr-render.js`.

## Tracing a Visual Element

Use this 3-step path when the user says "в desktop-reader, кнопка X":

1. **Template → render function**: `data-section="desktop-reader"` wraps `{{ reader.desktop }}`
   → `renderVals().reader.desktop` → `this.readerRenderDesktop()`
   → `this.readerRenderDesktopApp()`

2. **Render function → sub-component**: Open `ru2gr-render.js`, search for the render
   function. The desktop app assembles: titlebar → nav → main content → inspector.
   Read the function to find which sub-component renders the element.

3. **Sub-component → style**: Each sub-component returns `h('div',{style:{...}}, ...)`.
   Find the relevant `style:` object and change the property.

### Common Trace Chains

| What user says | Template token | Render function (line in render.js) |
|---|---|---|
| "в desktop-reader, заголовок книги" | `reader.desktop` | → `readerRenderDesktopApp:532` → `readerRenderDeskRead:479` → `readerRenderDeskTopPanel:464` |
| "в desktop-reader, чип режима (кнопка)" | `reader.desktop` | → `readerRenderDeskTopPanel:464` → `readerChipH1:687` |
| "в desktop-reader, цифры 1-4 в выпадашке" | `reader.desktop` | (клик по чипу) → `readerModeMenuList:437` (кружки с цифрами, borderRadius:9) |
| "в desktop-reader, карточка слова" | `reader.desktop` | → `readerRenderDeskInspector:494` |
| "в desktop-reader, левая навигация" | `reader.desktop` | → `readerRenderDeskNav:445` |
| "в phone-reader, нижняя навигация" | `reader.phone` | → `readerRenderPhone:763` → `readerRenderBottomNav:225` |
| "в phone-reader, карточка слова" | `reader.phone` | → `readerRenderWordSheet:314` |
| "в phone-reader, карточка буквы" | `reader.phone` | → `readerRenderLetterSheet:334` |
| "в phone-reader, цифры 1-4 в выпадашке" | `reader.phone` | → `readerRenderModeMenu:234` (кружки с цифрами, borderRadius:9) |
| "сегментный переключатель [1][2][3][4]" | `reader.galTop1` | → `readerGalTop1:416` → `readerModeBarEl:42` → `readerSegmentEl:36` (borderRadius:8) |
| "чипы статуса" | `reader.chip1` | → `readerChipGallery:737`(fn=`readerChip1:554`) |

### Two Mode Selector Patterns (Don't Confuse)

1. **Chip + dropdown** (actual reader): `readerRenderDeskTopPanel` shows a
   `readerChipH1` status chip. Click → `readerModeMenuList` dropdown with 4
   rows, each having a numbered circle (28×28, `borderRadius:9`).

2. **Segment control** (galleries only): `readerSegmentEl` renders `[1][2][3][4]`
   as horizontal buttons (`borderRadius:8`). NOT in the main reader —
   only in `readerGalTop1`, `readerGalTop2` gallery variants. |

### Chip Gallery Indirect Calls

`{{ reader.chip1 }}` is NOT a direct chip render. It's:
`readerChipGallery(readerChip1)` — a wrapper that iterates through all states
(rus/greek/alpha/lemma/wordForm) and renders each with the chip function.
Same pattern for chip2-5, chipH1-H3.

## data-section Convention

Naming pattern: `{context}-{role}` where context is the visual area and role is
the semantic purpose.

Existing sections:
- `canvas-header` — sticky top bar
- `canvas-title` — page title and description
- `desktop-label` — section label above desktop reader
- `desktop-reader` — desktop reader container
- `phone-label` — section label above phone
- `phone-reader` — phone mockup container

For new gallery sections, follow: `{variant}-label` + `{variant}-gallery`.
Example: `chip1-label` + `chip1-gallery`.

## Adding a New Section

1. **Add template HTML** in `ru2gr.dc.html` between existing sections.
   Copy the style pattern from `desktop-label` + `desktop-reader`.

2. **Add `data-section` attribute** following the convention above.

3. **Use `{{ reader.XXX }}`** where XXX matches a key in `renderVals().reader`.

4. **If the key doesn't exist**, add it to `renderVals()` in the Component class.

5. **Verify with `?dev=1`** — the new section should show an orange dashed outline
   and its name label.

## Dev Mode

Append `?dev=1` to the URL. Every `[data-section]` element gets:
- Orange dashed outline
- Semi-transparent label in the top-left corner showing the section name

Without `?dev=1` — no visual change; the page renders normally.

In Chrome DevTools, look for `data-section="..."` attributes on DOM elements
to identify which template section a rendered element belongs to.


## Common Mistakes

| Mistake | Why it happens | Fix |
|---------|---------------|-----|
| Looking at `readerSegmentEl` for the reader's mode selector | It's the most obvious "1-4 button group" in the code | Check the trace table — `readerSegmentEl` is gallery-only; the actual reader uses chip+dropdown |
| Searching for a string across all JS files | The render file is 1003 lines, grep noise is high | Start from the trace table, go directly to the line number |
| Editing gallery variant expecting it to change the reader | Gallery variants (`galModeA-F`, `galTop1-2`) are NOT in the HTML template | Check if the template actually uses `{{ reader.XXX }}` before editing the render function |
| Thinking `readerSegmentEl` is dead code | It's never called from the main reader path | It IS called from `readerModeBarEl` → `readerGalTop1/2` — gallery variants only |
| Searching support.js for render logic | support.js is the DC runtime framework | Never edit support.js; all render logic is in ru2gr-render.js |

## Red Flags

- "Let me grep for all [1,2,3,4].map patterns" → Use the trace table instead
- "I found a borderRadius in readerSegmentEl" → Check if that function is actually called in the reader path
- "Let me read support.js to understand the rendering" → support.js is framework code, not design code
- "The renderVals has galModeA-F but they're not in the template" → Correct; gallery variants are defined but not displayed. Add them to the template if needed.
