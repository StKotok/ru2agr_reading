# DEVELOPMENT_6 — Завершение выравнивания рус–древнегреч

**Дата:** 2026-06-13
**Предыдущий этап:** [`DEVELOPMENT_5.md`](./DEVELOPMENT_5.md) (regression pass, release-ready)
**Следующий этап:** [`DEVELOPMENT_7.md`](./DEVELOPMENT_7.md) (полная верификация и долги)
**Полный план:** [план v8](../../.claude/plans/lovely-moseying-stroustrup.md)

## Статус: ЗАВЕРШЕНО ✅

Все шаги 0–5 выполнены. Коммит `d74d980` на ветке `dev2`.

### Выполненные шаги

| Шаг | Суть | Результат |
|-----|------|-----------|
| 0 | UI + engine | ✅ `Map<verseN, verse>` вместо `verses[vIdx]`; q-фильтр |
| 1 | Аудит источника | ✅ `docs/development/textual-audit.md` |
| 2 | Реестр + эталон | ✅ `textual-variants.json` (авто); `gold-dev.json` + `gold-heldout.json` |
| 3 | Пайплайн | ✅ `src` в 108 806 парах; `c` в 5 066 токенах G846; `text-utils.js` |
| 4 | refine-alignments.mjs | ✅ Pass A (53 redirects), Pass B (6 925 downgrades), Pass C (q-cascade) |
| 5 | verify-alignments.mjs | ✅ Инварианты 0 ошибок; whitelist 7/7; метрики gold |

### Итоговые метрики

| Метрика | gold-dev | gold-heldout |
|---------|----------|-------------|
| Precision | 99.3% | 100.0% |
| Recall | 94.7% | 95.2% |

| Показатель | Значение |
|-----------|----------|
| Всего пар | 108 806 |
| q=e (exact, полная подсветка) | 101 111 (92.9%) |
| q=f (functional, приглушённая) | 619 (0.6%) |
| q=u (uncertain, скрыто) | 7 076 (6.5%) |
| Видимых пользователю | 101 730 (93.5%) |

### Ключевые исправления

- Ин 3:16: `αὐτὸν` → «Него» (было → «Своего»)
- 1 Ин 5:10: `αὐτόν` → «Его» (было → «Своем»)
- 1 Пет 2:24: `αὐτοῦ` → «Его» (было → «Своим»)
- +50 аналогичных исправлений в других книгах

### Созданные файлы

| Файл | Назначение |
|------|-----------|
| `scripts/lib/text-utils.js` | Общий модуль: cleanRuWord, инвентари, таблицы |
| `scripts/refine-alignments.mjs` | Постобработка alignment: проходы A/B/C |
| `scripts/verify-alignments.mjs` | Верификация: инварианты, whitelist, метрики |
| `scripts/build-variants-registry.mjs` | Генератор textual-variants.json |
| `assets/data/textual-variants.json` | Реестр текстуальных вариантов |
| `test/fixtures/gold-dev.json` | Золотой эталон: 23 стиха |
| `test/fixtures/gold-heldout.json` | Золотой эталон: 20 случайных стихов |
| `docs/development/textual-audit.md` | Результаты аудита источника |
| `docs/development/alignment-error-report.md` | Исходный анализ ошибок |

### Что НЕ сделано (перенесено в DEVELOPMENT_7)

Критерий готовности по метрикам достигнут, но на неполном золотом эталоне
(только 4 стиха из 43 проаннотированы вручную). Оставшаяся работа —
верификация истинности, а не стабильности — описана в [`DEVELOPMENT_7.md`](./DEVELOPMENT_7.md):

1. Ручная разметка всех 43 стихов золотого эталона
2. LLM-верификация (600 случайных пар)
3. Расщепление 2 Кор 11:32–33
4. Фильтрация 213 кандидатов TR-плюсов
5. Корпусные частоты предлогов для PREP_TABLE
6. Проверка Zefania-морфокодов
7. Тест на идемпотентность refine
