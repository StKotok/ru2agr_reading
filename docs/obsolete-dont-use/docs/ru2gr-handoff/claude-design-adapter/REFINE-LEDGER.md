# REFINE-LEDGER: ru2gr-handoff

Каждое изменение задокументировано: токен, старое→новое значение, причина.

## Изменения

### 1. RECONCILE — удаление дублирования
| Файл | Что удалено | Причина |
|------|------------|---------|
| `Греческая читалка.dc.html` | `<style>` (base CSS + keyframes) | Дубликат — каноничный в `ru2gr.dc.html` |
| `Греческая читалка.dc.html` | `<link>` Google Fonts + preconnect | Дубликат — DC runtime дедуплицирует |
| `Греческая читалка.dc.html` | `<script src="./support.js">` | DC runtime уже загружен entry point |
| `Слова.dc.html` | `<style>` (base CSS + keyframes) | Дубликат — каноничный в `ru2gr.dc.html` |
| `Слова.dc.html` | `<link>` Google Fonts + preconnect | Дубликат — DC runtime дедуплицирует |
| `Слова.dc.html` | `<script src="./support.js">` | DC runtime уже загружен entry point |

### 2. TIDY — токенизация хардкод-цветов
| Токен | Старое значение (хардкод) | Новое значение | Причина |
|-------|--------------------------|----------------|---------|
| `--canvas-bg` | `#cfcabf` | CSS variable | Централизация, переиспользование |
| `--canvas-bar-bg` | `rgba(207,202,191,0.92)` | CSS variable | Централизация |
| `--canvas-bar-border` | `rgba(40,34,22,0.10)` | CSS variable | Централизация |
| `--canvas-ink` | `#2b2620` | CSS variable | Централизация |
| `--canvas-ink-soft` | `#5a5246` | CSS variable | Централизация |
| `--canvas-muted` | `#9a9488` | CSS variable | Централизация |
| `--canvas-muted2` | `#7a7468` | CSS variable | Централизация |
| `--canvas-line` | `rgba(40,34,22,0.14)` | CSS variable | Централизация |
| `--canvas-select-bg` | `rgba(255,255,255,0.55)` | CSS variable | Централизация |
| `--canvas-select-border` | `rgba(40,34,22,0.15)` | CSS variable | Централизация |

### 3. REFINE — accessibility (ui-ux-pro-max)
| Изменение | До | После | Стандарт |
|-----------|-----|-------|----------|
| `prefers-reduced-motion` | Отсутствовал | `@media (prefers-reduced-motion: reduce)` отключает анимации | WCAG 2.2 |
| `focus-visible` | Нет видимого фокуса | `outline: 2px solid var(--canvas-ink-soft)` | WCAG 2.4.7 |
| `::selection` | Браузерный дефолт | `rgba(47,93,133,0.18)` — брендовый цвет выделения | Эстетика |
| Select touch target | ~22px высота | `min-height:30px`, `font-size:12px`, `padding:5px 9px` | WCAG 2.5.5 (24×24px min) |
| Select font size | 11px | 12px | Читаемость (меньше 12px — iOS auto-zoom) |

### 4. UI/UX findings (без изменений — уже хорошо)
| Аспект | Оценка | Комментарий |
|--------|--------|-------------|
| Font pairing | ✅ | Gentium Plus (serif) + Source Sans 3 (sans) — отличное сочетание |
| Color system | ✅ | 12 тем × 3 контраста — comprehensive |
| Icon system | ✅ | SVG иконки, не emoji |
| Animation | ✅ | 150-300ms easing, sheetUp/Fade/Toast/Pop |
| Dark mode | ✅ | 3 тёмные темы (Тёмная, Ночь, Уголь) |
| Typography scale | ⚠️ | Несистемная шкала (10-62px), но оправдана контекстом (заголовки букв) |
| Contrast (muted текст) | ⚠️ | `#9a9488` на `#ECE7DD` ≈ 2.5:1 — ниже 4.5:1 AA. Приемлемо для decorative/secondary текста, но borderline |

## Отчёт о сомнениях

1. **Muted contrast**: `muted` (#9a9488) и `muted2` (#bdb6a7) на светлых темах не проходят AA (4.5:1). Это дизайнерское решение («спокойный» стиль), но для accessibility-critical текста (labels, placeholder) может быть проблемой. Рекомендация: проверить с реальными пользователями.

2. **Select touch-targets**: Увеличены до 30px, но всё ещё ниже идеальных 44px для mobile. Однако эти контролы — часть desktop canvas bar (design-system showcase), не production mobile UI. Для продакшн-читалки нужны другие контролы.

3. **Отсутствие skip-link**: На странице нет skip-to-content для клавиатурной навигации — но это дизайн-прототип, не production страница.
