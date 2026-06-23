# REFINE-LEDGER — ru2gr-handoff

Date: 2026-06-23
Based on: ui-ux-pro-max guidelines (priority 1: CRITICAL accessibility)

## Changes applied

### 1. Focus-visible indicators (ui-ux-pro-max §1 — accessibility/focus-states)
**File**: All 3 DC files (`ru2gr.dc.html`, `Греческая читалка.dc.html`, `Слова.dc.html`)
**Change**: Added CSS rule for `:focus-visible` on interactive elements
**Before**: No focus indicators — keyboard users cannot see which element is focused
**After**: `outline: 2px solid #2f5d85; outline-offset: 2px;` on all interactive elements
**Impact**: Keyboard navigation becomes usable; WCAG 2.4.7 (Focus Visible)

### 2. aria-labels on icon-only buttons (ui-ux-pro-max §1 — aria-labels)
**File**: `Греческая читалка.dc.html`
- Eye button (simple view toggle): `aria-label="Простой вид"/"Обычный вид"`
- Gear button (intensity settings): `aria-label="Настройки интенсивности"`
- Close buttons (word sheet + letter sheet): `aria-label="Закрыть"`
- Bottom nav items: `aria-label` matches visible text

### 3. aria-labels on icon-only buttons
**File**: `Слова.dc.html`
- Close button (word card): `aria-label="Закрыть"`
- Eye icon (text filter toggle): `aria-label="Показаны только слова в тексте"/"Только слова в тексте"`
- Bottom nav items: `aria-label` matches visible text
- Desk nav items: `aria-label` matches visible text

### 4. aria-labels on canvas bar selects
**File**: `ru2gr.dc.html`
- Theme select: `aria-label="Тема оформления"`
- Contrast select: `aria-label="Контрастность"`
- POS style select: `aria-label="Стиль фильтра частей речи"`

## Verification
- `node --check` — JS syntax OK (all files)
- `npm test` — 240 tests passed (0 failures)
- Visual: default state preserved (no pixel changes from reconcile/tidy/refine CSS)

## Deferred (not applied)
- Touch target size enforcement (44×44pt) — design prototypes use smaller desktop targets intentionally
- `prefers-reduced-motion` — already have `prefers-reduced-motion` not checked but animations use CSS `@keyframes` which can be disabled via `prefers-reduced-motion` media query (deferred: prototypes are not production)
- Color contrast audit — token system was designed with contrast in mind; deferred to production implementation
