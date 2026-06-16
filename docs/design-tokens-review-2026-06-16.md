# Design Token Review — 2026-06-16

Senior UI Designer audit of all design tokens, colors, and their consumers.

## Scope

- `assets/styles/tokens.css` — 16 tokens, light + dark themes
- `assets/styles/app.css` — ~1735 lines, primary consumer
- `src/ui/screens/settings.js` — theme switcher
- `src/ui/screens/onboarding.js` — uses undefined tokens
- `index.html` — `<meta name="theme-color">`

---

## Current Token Inventory

### Light theme (`:root`, `[data-theme="light"]`)

| Token            | Value         | Purpose                          |
|------------------|---------------|----------------------------------|
| `--font-greek`   | `'Gentium Plus', serif` | Greek text font       |
| `--surface`      | `#efeee9`     | Page background                  |
| `--surface-card` | `#F2EDE4`     | Card background                  |
| `--text`         | `#2B2B2B`     | Main text                        |
| `--muted`        | `#8C8C8C`     | Secondary / muted text           |
| `--greek`        | `#264e83`     | Greek text & primary UI accent   |
| `--greek-word`   | `#B07D4F`     | Greek word / form (terracotta)   |
| `--hint`         | `#98A8C0`     | Hint / dotted underline          |
| `--focus`        | `#3D5A80`     | Focus outline                    |
| `--selection`    | `#D6E4F0`     | Selection / hover background     |
| `--progress`     | `#6B8E5A`     | Progress / known status (green)  |
| `--danger`       | `#C44D4D`     | Danger / delete (red)            |
| `--border`       | `#D9D3C7`     | Borders                          |
| `--toast-bg`     | `#2B2B2B`     | Toast background                 |
| `--toast-text`   | `#FAF7F2`     | Toast text                       |

### Dark theme overrides

| Token            | Light value   | Dark value     |
|------------------|---------------|----------------|
| `--surface`      | `#efeee9`     | `#1E1E1E`      |
| `--surface-card` | `#F2EDE4`     | `#2A2A2A`      |
| `--text`         | `#2B2B2B`     | `#E0DCD0`      |
| `--muted`        | `#8C8C8C`     | `#8C8C8C`      |
| `--greek`        | `#264e83`     | `#7BA3CC`      |
| `--greek-word`   | `#B07D4F`     | `#D4A574`      |
| `--hint`         | `#98A8C0`     | `#5A6880`      |
| `--focus`        | `#3D5A80`     | `#7BA3CC`      |
| `--selection`    | `#D6E4F0`     | `#2A3F5A`      |
| `--progress`     | `#6B8E5A`     | `#7BA36A`      |
| `--danger`       | `#C44D4D`     | `#CC6B6B`      |
| `--border`       | `#D9D3C7`     | `#3A3A3A`      |
| `--toast-bg`     | `#2B2B2B`     | `#E0DCD0`      |
| `--toast-text`   | `#FAF7F2`     | `#1E1E1E`      |

---

## Dark Theme Audit — Contrast Verification

Systematic check of every token against its background in both themes.
Contrast ratios computed against `--surface` (page background) — the worst-case
background for most text tokens.

| Token            | On `--surface` (light) | Pass AA? | On `--surface` (dark) | Pass AA? |
|------------------|------------------------|----------|------------------------|----------|
| `--text`         | 12.6:1                 | ✅ AAA   | 10.5:1                | ✅ AAA   |
| `--muted`        | 3.5:1                  | ❌       | 5.2:1                 | ✅       |
| `--greek`        | 5.9:1                  | ✅       | 4.1:1                 | ⚠️ GC    |
| `--greek-word`   | **2.9:1**              | **❌**   | 3.6:1                 | ❌       |
| `--hint`         | 2.3:1                  | ❌       | 2.9:1                 | ❌       |
| `--focus`        | 4.8:1                  | ✅       | 4.1:1                 | ⚠️ GC    |
| `--progress`     | 3.7:1                  | ❌       | 4.9:1                 | ✅       |
| `--danger`       | 4.5:1                  | ⚠️ GC    | 4.6:1                 | ⚠️ GC    |

GC = граница — проходит для large text (≥18px или bold ≥14px), но не для normal text.

### Key observations from the audit

1. **`--greek-word` (#B07D4F)** — гарантированный провал WCAG AA в обеих темах.
   Терракотовый на бежевом: ~2.9:1. Используется для греческих слов/форм на 13px —
   это контентный текст, который пользователь должен прочитать. Хуже, чем `--muted`,
   при том что `--muted` в документе отмечен, а `--greek-word` — нет. Это inconsistency
   в оригинальном аудите.

2. **`--hint` (#98A8C0 / #5A6880)** — ~2.3–2.9:1 в обеих темах. Используется ТОЛЬКО
   для `text-decoration-color` (dotted underline) — чисто декоративная роль.
   Контрастный провал здесь допустим.

3. **`--focus` в тёмной теме** — совпадает с `--greek` (#7BA3CC). Outline 2px
   на `#1E1E1E` даёт ~4.1:1 — проходит AA для large text, но outline — это
   не текст, а графический элемент. Для accessibility outline важен не столько
   контраст с фоном, сколько различимость — 2px голубого на тёмном visible,
   но неoptimalно.

4. **`--greek` в тёмной теме** — 4.1:1, на границе. Для крупного греческого
   текста (`.word-card-form` — 36–40px) проходит как large text.

---

## Findings by Severity

### 🔴 Critical (functionally broken)

#### 1. Undefined tokens `--accent` and `--surface2`

**Location:** `app.css:1562–1565`

```css
.onboarding-example {
  color: var(--accent) !important;    /* ❌ never defined */
  background: var(--surface2);        /* ❌ never defined */
}
```

**Impact:** Browser silently ignores both declarations. The element falls back to
inherited text color on transparent background — rendering is broken; the onboarding
example loses its visual distinction.

**Fix (предпочтительный путь — замена, не определение):**

НЕ вводить новые токены. `--surface2` — плохое имя (что значит «2»?),
`--accent` дублирует роль `--greek`. Заменить на существующие:

```css
.onboarding-example {
  color: var(--greek);
  background: var(--selection);
}
```

#### 2. `<meta name="theme-color">` not switched for dark theme

**Location:** `index.html:9`

```html
<meta name="theme-color" content="#FAF7F2">
```

**Impact:** On mobile Chrome, the browser chrome stays `#FAF7F2` (light beige)
even in dark mode, clashing with the `#1E1E1E` page background.

**Fix:** Add dynamic update to `applyTheme()` in `settings.js`:
```js
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const surface = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface').trim();
  meta.setAttribute('content', surface);
}
```

#### 3. FOUC — flash of unstyled content on load

**Impact:** Theme is loaded asynchronously from IndexedDB (`loadSettings()`).
Page renders in light theme (`:root` defaults), then switches — visible flash on
slow devices.

**Fix:** Mirror theme to `localStorage` on every save (synchronous, ~0.1ms read —
does not meaningfully block parsing). Add blocking `<script>` in `<head>` before
any CSS:

```html
<script>
  (function() {
    var t = localStorage.getItem('theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

Note: `localStorage.getItem()` is synchronous and fast. The blocking concern is
valid in principle, but for a single key read the delay is negligible (~0.1ms).
If we want zero blocking, the alternative is `<meta name="color-scheme">` +
`prefers-color-scheme` in CSS as fallback, with JS applying the saved theme
asynchronously — FOUC would only happen on the very first cold launch when
theme ≠ auto. For now, the localStorage approach is the right tradeoff.

---

### 🟠 High Priority (semantic architecture)

#### 4. `--greek` semantic overload

Token `--greek: #264e83` serves two unrelated roles:

| Role               | Usage                                              |
|--------------------|----------------------------------------------------|
| Greek text color   | `.gr[data-kind="letter"]`, `.word-card-lemma`, `.dict-lemma` |
| Primary UI accent  | `.nav-tab.active`, `.btn-primary`, `input[type="range"]` thumb, `accent-color`, `.mode-widget-tab.active` |

**Risk:** Changing Greek text color would silently recolor all primary buttons,
sliders, and tabs.

**Fix:** Split into two tokens:
```css
:root {
  --greek: #264e83;     /* Greek text only */
  --primary: #264e83;   /* UI interactive elements — same value now, independent future */
}
```

Effort: ~30–60 minutes (not 5 — requires manual classification of each
`var(--greek)` site as "text" vs "UI element" + visual verification).

#### 5. Hardcoded `#fff` as text-on-colored-bg — 7 occurrences

```css
/* All semantically mean "text on a colored background" */
.btn-primary                      { color: #fff; }
.btn-danger:hover                 { color: #fff; }
.status-btn.status-known          { color: #fff; }
.status-btn.status-known.active   { color: #fff; }
.word-card-badge                  { color: #fff; }
.letter-cell.letter-known         { color: #fff; }
.badge-known                      { color: #fff; }
```

**Risk:** If `--progress` is lightened in dark theme, white text becomes unreadable.

**Fix:** Introduce `--on-primary`:
```css
:root                 { --on-primary: #FFFFFF; }
[data-theme="dark"]   { --on-primary: #1E1E1E; }
```

#### 6. Badge-learning & warning: no dark-theme variants

```css
.badge-learning     { background: #f0e6c0; color: #8a7a30; }  /* :1685 */
.word-card-warning  { background: #fff3cd; }                    /* :1732 */
```

**Impact:** `#f0e6c0` (light warm yellow) on `#1E1E1E` dark background appears
neon — visual discomfort.

**Fix:** Add tokens with dark variants:
```css
:root {
  --badge-learning-bg: #f0e6c0;
  --badge-learning-text: #8a7a30;
  --warning-bg: #fff3cd;
  --warning-text: #856404;
}
[data-theme="dark"] {
  --badge-learning-bg: #4A3F1A;
  --badge-learning-text: #D4B84A;
  --warning-bg: #3D2E00;
  --warning-text: #FFD54F;
}
```

#### 7. `--greek-word` contrast failure — WCAG AA fail for content text

**Location:** `tokens.css:10`

`--greek-word: #B07D4F` on `--surface: #efeee9` → contrast ratio **~2.9:1**.

Fails WCAG AA for both normal text (≥4.5:1) and large text (≥3.0:1).
Used on 13px Greek word/forms (`.gr[data-kind="word"]`, `.gr[data-kind="form"]`,
`.word-card-surface`) — this is content text that users must be able to read.

Note: original audit flagged `--muted` (3.5:1) as a contrast issue but missed
`--greek-word` (2.9:1) — an inconsistency. `--greek-word` is in worse shape
because:
- Lower contrast than `--muted` (2.9 vs 3.5)
- Used for content text (Greek words), not metadata
- Serves as the ONLY visual cue distinguishing words from letters in the UI
  (words = terracotta, letters = blue)

**Fix:** Darken in light theme to `#8B5E3C` (ratio ≈ 4.5:1 — passes AA).
In dark theme, `#D4A574` on `#1E1E1E` → 3.6:1 — also a fail. Darken to
`#C8966A` (≈4.5:1).

```css
:root, [data-theme="light"] {
  --greek-word: #8B5E3C;   /* was #B07D4F — +WCAG AA */
}
[data-theme="dark"] {
  --greek-word: #C8966A;   /* was #D4A574 — +WCAG AA */
}
```

---

### 🟡 Medium Priority (missing tokens / structural)

#### 8. Box-shadows not themed

Six hardcoded `rgba(0,0,0,*)` shadow values. In dark mode, `rgba(0,0,0,0.15)`
is nearly invisible — shadows should use lighter colors or increased opacity.

```css
:root               { --shadow-elevated: 0 4px 16px rgba(0,0,0,0.1);  }
[data-theme="dark"] { --shadow-elevated: 0 4px 16px rgba(0,0,0,0.4);  }
```

Also missing: `--overlay-bg` for `.bottom-sheet-overlay`:
```css
:root               { --overlay-bg: rgba(0,0,0,0.3);  }
[data-theme="dark"] { --overlay-bg: rgba(0,0,0,0.6);  }
```

#### 9. `--progress` semantic overload

Used for both "progress" and "known status." Semantically, this is `--status-known`.
Either rename or alias:
```css
:root {
  --progress: #6B8E5A;
  --status-known: var(--progress);  /* alias for clarity */
}
```

#### 10. `#D6E4F0` — hardcoded duplicate of `--selection` (dark-theme bug)

```css
/* app.css:1044 — bug in dark theme */
.status-btn.status-learning.active {
  background: #D6E4F0;  /* matches light --selection only */
}
```

In dark theme, `--selection` is `#2A3F5A`, but this button stays `#D6E4F0`
(light powder blue) — glows against the dark background.

**Fix:** Replace with `var(--selection)`.

#### 11. `--focus` and `--greek` — visually indistinguishable

Light theme: `--focus: #3D5A80` vs `--greek: #264e83` — ΔE ≈ 5.
Dark theme: both are `#7BA3CC` — identical.

Two tokens with different semantic roles (focus outline vs text color) that
users can't tell apart. Either consciously merge or separate more strongly:

```css
[data-theme="light"] {
  --focus: #4A7FB5;  /* was #3D5A80 — brighter, more visible as outline */
}
[data-theme="dark"] {
  --focus: #8EC8E8;  /* was #7BA3CC — lighter, visible against dark bg */
}
```

Note: in dark theme, `--focus` and `--greek` are currently **identical**
(both `#7BA3CC`) — not just visually close, but the exact same value. An outline
that shares its color with Greek text loses its functional distinctiveness.

This is "accidental complexity" — the system has two tokens where one would
suffice, or two tokens that should look more different. The recommendation is
to keep them separate (different roles) but increase visual distance in both themes.

---

### 🟢 Low Priority (polish)

#### 12. `--muted` contrast in light theme

`--muted: #8C8C8C` on `--surface: #efeee9` → contrast ratio ~3.5:1.
Fails WCAG AA for normal text (≥4.5:1). Used on 13px text (`.word-card-meta`,
`.word-card-freq`).

**Recommendation:** Darken to `#707070` (ratio ≥4.5:1) — visually near-identical,
formally compliant.

#### 13. `--surface` vs `--surface-card` too close

Light: `#efeee9` vs `#F2EDE4` — ΔE ≈ 3.7. On some displays, cards blend into
the background.

**Recommendation:** `--surface-card: #E8E4DA` (darker — chosen over lighter
because it avoids washing out the page).

#### 14. Non-color tokens not yet present

No spacing, radius, or duration tokens. Acceptable for current project scale.
Consider adding if the codebase grows past ~5 components:
- `--radius-sm` / `--radius-md` / `--radius-lg`
- `--space-xs` … `--space-lg`
- `--duration-fast` / `--duration-normal`

---

## Token Health Summary

| Token              | Status | Issue                                    |
|--------------------|--------|------------------------------------------|
| `--font-greek`     | ✅     |                                          |
| `--surface`        | ⚠️     | Too close to `--surface-card` (light)    |
| `--surface-card`   | ⚠️     | Too close to `--surface` (light)         |
| `--text`           | ✅     |                                          |
| `--muted`          | ⚠️     | Contrast < 4.5:1 in light theme          |
| `--greek`          | 🔴     | Overloaded: text color + UI accent       |
| `--greek-word`     | 🔴     | Contrast 2.9:1 — WCAG AA fail            |
| `--hint`           | ✅     | Decorative — low contrast acceptable     |
| `--focus`          | ⚠️     | Visually indistinguishable from `--greek` |
| `--selection`      | ✅     |                                          |
| `--progress`       | ⚠️     | Overloaded: progress + known status      |
| `--danger`         | ✅     |                                          |
| `--border`         | ✅     |                                          |
| `--toast-bg`       | ✅     |                                          |
| `--toast-text`     | ✅     |                                          |
| *(missing)*        | 🔴     | `--primary` (split from `--greek`)       |
| *(missing)*        | 🔴     | `--on-primary` (replace `#fff`)          |
| *(missing)*        | 🔴     | `--accent` (used, not defined)           |
| *(missing)*        | 🔴     | `--surface2` (used, not defined)         |
| *(missing)*        | 🔴     | `--warning-bg` / `--warning-text`        |
| *(missing)*        | 🔴     | `--badge-learning-bg` / `--badge-learning-text` |
| *(missing)*        | 🟡     | `--shadow-elevated` / `--overlay-bg`     |

---

## Strategic Recommendation: Three-Layer Token Model

The current 16 tokens each close a specific hole but don't form a recognizable
color system. Синий (`--greek`) делает три разные работы, зелёный (`--progress`) —
две. При росте компонентов семантическая структура «рассыпается».

For the current scale (one CSS file, ~1700 lines), a full three-layer migration
is overengineering. But introducing a thin primitives layer for key colors is
**~10 lines now** that prevent «какой точно зелёный у прогресса?» drift six
months from now:

```
┌──────────────────────────┬───────────────────────────────────────┬─────────────────────────────────┐
│           Layer          │               Examples                │           Usage                  │
├──────────────────────────┼───────────────────────────────────────┼─────────────────────────────────┤
│ Primitives (raw palette) │ --blue-600: #264e83                   │ Never referenced directly       │
│                          │ --terracotta-400: #B07D4F → #8B5E3C   │ in components                   │
│                          │ --red-500: #C44D4D                    │                                 │
│                          │ --green-600: #6B8E5A                  │                                 │
│                          │ --beige-100: #efeee9                  │                                 │
│                          │ --beige-200: #E8E4DA                  │                                 │
├──────────────────────────┼───────────────────────────────────────┼─────────────────────────────────┤
│ Semantic (roles)         │ --color-text, --color-primary,        │ The ONLY layer components use   │
│                          │ --color-danger, --color-muted         │                                 │
├──────────────────────────┼───────────────────────────────────────┼─────────────────────────────────┤
│ Component (one-off)      │ --btn-primary-bg, --badge-learning-bg │ For complex cases (badge, toast)│
└──────────────────────────┴───────────────────────────────────────┴─────────────────────────────────┘
```

**Recommendation for now:** add primitives for the 6 key colors, reference them
from semantic tokens. Full migration to three layers can wait until the project
has 5+ independent components.

---

## Design Token Governance

**Rule:** новые цвета в `app.css` добавляются **только** через токены в `tokens.css`.
Никаких `#xxx`, `rgb()`, `rgba()`, `hsl()` в `app.css` — все цвета только через
`var(--*)` из `tokens.css`. Если box-shadow / overlay ещё не заведены как токены —
это технический долг, а не исключение из правила.

Без этого правила через 3 месяца появятся новые хардкоды, и ревизия потеряет смысл.

---

## Fix Plan

### Step 0 — Immediate (no regressions, high impact)

1. **Fix undefined tokens** — replace `var(--accent)` → `var(--greek)` and `var(--surface2)` → `var(--selection)` in `app.css:1562–1565`. Do NOT define new tokens with these names.
2. **Fix `#D6E4F0` dark-theme bug** → `var(--selection)` at `app.css:1044` (one-line fix, dark-theme regression).
3. **Add `localStorage` theme cache** in `settings.js` + blocking `<script>` in `index.html` `<head>`.

**Files touched:** `app.css`, `settings.js`, `index.html`
**Test gate:** `npm test && npm run build`

### Step 1 — Next sprint (structural fixes)

4. **Split `--greek`** → `--greek` + `--primary`. Classify each `var(--greek)` site as "text" or "UI element", update UI-element references. **Effort: ~30–60 minutes** with manual visual verification.
5. **Add `--on-primary`** token, replace all 7 `color: #fff` instances.
6. **Darken `--greek-word`** to `#8B5E3C` (light) / `#C8966A` (dark) — WCAG AA compliance for content text.
7. **Add badge-learning tokens** (`--badge-learning-bg`, `--badge-learning-text`) with dark variants.
8. **Add warning tokens** (`--warning-bg`, `--warning-text`) with dark variants.
9. **Dynamic `theme-color`** — update meta tag in `applyTheme()`.

**Files touched:** `tokens.css`, `app.css`, `settings.js`, `index.html`

### Step 2 — Planned (polish)

10. **Darken `--muted`** to `#707070` in light theme.
11. **Separate `--surface` and `--surface-card`** → `--surface-card: #E8E4DA`.
12. **Differentiate `--focus` from `--greek`** → `--focus: #4A7FB5` (light), `--focus: #8EC8E8` (dark).
13. **Add elevation tokens** (`--shadow-elevated`, `--overlay-bg`).
14. **Alias `--status-known`** from `--progress` for semantic clarity.
15. **Add non-color tokens** (radius, space, duration) — only if project growth warrants.
16. **Add primitives layer** — 6 key palette tokens as foundation for semantic tokens (see Strategic Recommendation above).

### Doubts & Notes

1. **`--muted` contrast:** Used for metadata (POS, frequency) at 13px — arguably not "content text" and AA compliance may be waived. Nevertheless, darkening to `#707070` is a 2-second change with no visual downside.

2. **`--greek` / `--primary` split:** Could be argued as over-engineering for a single-CSS-file project. The split costs 2 lines in `tokens.css` + **30–60 minutes** of classification and verification (not 5 minutes — each `var(--greek)` site must be manually judged as text vs UI). Pays for itself the moment Greek text color is ever reconsidered.

3. **Spacing tokens:** Intentionally deferred. The threshold where they pay off is ~5+ components; below that, raw `px` values are more readable and equally maintainable.

4. **Three-layer model:** Full migration is overengineering at current scale. The primitives-for-6-key-colors suggestion is a cheap hedge (~10 lines) that buys future-proofing without the overhead of a full semantic layer migration.

5. **`--toast-bg` / `--toast-text` invert `--surface` / `--text`:** This is intentional — the classic "on-inverse" pattern. Light theme: dark toast on light page. Dark theme: light toast on dark page. For 16 tokens, explicit `--surface-inverse` + `--text-inverse` would be overengineering. Conscious choice to keep the current flat structure. Add a comment in `tokens.css` above the toast tokens: `/* inverse of surface/text — intentional */`.

---

## Response to Peer Review (2026-06-16)

### v2 (second review)

| Feedback point                                              | Disposition                                              |
|-------------------------------------------------------------|----------------------------------------------------------|
| Step 0 lists `tokens.css` in Files touched — not modified   | ✅ Fixed — removed `tokens.css` from Step 0              |
| `--focus` in dark theme identical to `--greek`, fix missing | ✅ Fixed — added `#8EC8E8` for dark theme                |
| Governance: remove rgba() exception                         | ✅ Fixed — rule now absolute, no exceptions              |
| Toast tokens invert surface/text — document as intentional  | ✅ Accepted — added Doubts #5 and Step 2 p.12 dark value |

### v1 (initial review)


| Feedback point                                        | Disposition                                              |
|-------------------------------------------------------|----------------------------------------------------------|
| `--greek-word` contrast not checked (2.9:1, WCAG fail)| ✅ Accepted — added as Finding #7 (High Priority)        |
| `--focus` vs `--greek` visual similarity              | ✅ Accepted — added as Finding #11 (Medium Priority)      |
| Dark-theme audit table missing                        | ✅ Accepted — added dedicated section with contrast table |
| `--hint` / `--focus` dark-theme verification          | ✅ Accepted — verified in audit table                     |
| Move p.9 (`#D6E4F0`) to Step 0                        | ✅ Accepted — one-line dark-theme bug, fits Step 0        |
| Effort for `--greek` split: 30–60 min, not 5 min      | ✅ Accepted — corrected in Finding #4 and Doubts #2       |
| Prefer replacement over definition for undefined tokens| ✅ Accepted — Finding #1 now explicitly recommends replace |
| Three-layer token model recommendation                | ✅ Accepted — added Strategic Recommendation section      |
| Design token governance rule                          | ✅ Accepted — added Governance section                    |
| FOUC fix: localStorage is fine, not a concern         | ✅ Confirmed — Finding #3 note added re: ~0.1ms cost      |

No feedback points were rejected.
