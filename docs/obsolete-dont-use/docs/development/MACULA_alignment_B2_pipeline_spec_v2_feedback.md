# MACULA Alignment B2 Pipeline Spec v2 — Фидбек по оптимизации под Claude Code

**Дата:** 2026-06-18
**Цель:** Оценка пригодности `MACULA_alignment_B2_pipeline_spec_v2.md` для исполнения Claude Code + deepseek-v4-pro[1m] на max effort
**Общая оценка:** 8.0/10 — очень сильный, но есть точки усиления

---

## Сильные стороны (что сделано отлично)

### 1. Секция 2.1 «Claude Code execution contract» — лучшая часть документа

Прямые инструкции модели: «Read first», «Work rules», «Required implementation order». Именно так должен выглядеть machine-targeted spec. Каждый пункт — конкретное действие или запрет.

### 2. Anti-patterns (§18) — критически важны

Модели на max effort склонны к «улучшению» и «оптимизации». Список «Do not do these» прямо блокирует типичные халлюцинации: «temporarily use RusVZh», «show q:"f" because it looks useful», «auto-re-key old gold and call it verified».

### 3. Blocker enum (§9) — отличный паттерн

Стандартизированные строки блокировок создают общий словарь между моделью и верификатором. Это предотвращает импровизацию в сообщениях об ошибках.

### 4. LLM-промпты (§11) вставлены verbatim — правильно

Модель не должна переписывать промпты «своими словами». Жёсткие правила «Return JSON only. No prose outside JSON.» внутри промптов ловят типичную проблему Claude, когда он добавляет markdown-обёртку вокруг JSON.

### 5. Command topology (§6) — хорошо

Жёсткая привязка имён npm-скриптов к файлам не даёт модели изобретать свои команды.

### 6. Default-closed паттерн проведён последовательно

«Любая неоднозначность означает hidden candidate, а не видимую пару» — это правильный инстинкт для модели, которая склонна к избыточной уверенности.

### 7. Разделение детерминированного пайплайна и LLM-аудита — архитектурно верно

`build:align` offline, `audit:align:*` отдельно. Модель не сможет оправдать сетевой вызов внутри build.

---

## Критические проблемы (must fix)

### К1. Смешанный русско-английский технический язык

Весь документ на русском, но технические термины преимущественно на английском: `source/canonical/runtime слоёв`, `runtime-контракты`, `certifier-правил`. deepseek-v4-pro — китайская модель, и хотя она многоязычна, русско-английский code-switching может вызвать:

- Пропуск семантики английского термина в русском контексте
- Неправильное склонение/согласование при генерации имён переменных

**Рекомендация:** Добавить в §2.1 глоссарий из 10–15 ключевых терминов с однозначным написанием: `certifier` → всегда `certifier`, не `сертификатор`/`certifier-правило`.

### К2. Escape hatch в §6 Command topology

```
"Use these command names unless there is a strong local reason not to."
```

На max effort модель склонна находить «strong local reasons». Эта фраза — приглашение переименовать команды. Если имена жёсткие — убери escape hatch. Если нет — специфицируй, что считается «strong reason» (например: конфликт с существующим скриптом, а не «мне так удобнее»).

**Рекомендация:** Заменить на:

> Use these command names exactly. If a name conflicts with an existing script, stop and report the conflict before renaming.

### К3. LLM audit coverage — неоднозначный fallback

§11, строки 737–739:

```
"If this is too much for the first engineering milestone, the milestone can be
marked 'data prototype', but not 'release-ready'."
```

Модель на max effort может прочитать это как разрешение пропустить аудит для «data prototype» и никогда к нему не вернуться. Нет criteria для определения «too much».

**Рекомендация:** Добавить quantifiable trigger:

> If audit preparation takes >N minutes or produces >M prompt files, mark `blocked:audit-scale` and report. Do not silently skip.

### К4. Human adjudication (§12) не имеет инструмента

В отличие от всех остальных шагов, Step 5 чисто ручной. Модель может:

- Попытаться автоматизировать адъюдикацию (нарушение правил)
- Пропустить шаг молча
- Сгенерировать фиктивный adjudication-report.json

**Рекомендация:** Добавить `scripts/check-adjudication-status.mjs`, который проверяет существование и валидность `adjudication-report.json` и возвращает `blocked:pending-human-adjudication` если файла нет или есть unresolved items. Это даст модели конкретный механизм, а не «надеемся, что человек сделает».

---

## Важные проблемы (should fix)

### В1. Proof формат для C3 manual-allowlist не показан

Сертификаторы C1 и C2 имеют понятный proof (gold reference и uniqueness checks соответственно). C3 (manual-allowlist) — нет схемы proof. Модель должна знать, что писать в `proof.checks` для C3.

**Рекомендация:** Добавить пример certified record для C3 или указать:

```json
"proof": {
  "certifier": "manual-allowlist",
  "checks": ["explicitly-listed-in-manual-certified"]
}
```

### В2. hiddenOrphans не специфицированы за пределами gold

Gold-схема (§8) включает `hiddenOrphans`, но candidate generation (§9) и certification (§10) не определяют формат orphan-записей. Модель должна решать, что делать с русскими словами, которым не нашлось пары — это важная часть пайплайна.

**Рекомендация:** Добавить в §9 спецификацию orphan record для `candidates.jsonl` или явно сказать:

> Orphan spans are tracked only in gold. Candidate generation emits nothing for unmatched Russian words.

### В3. Merged handling для 2 Cor 11:33 упомянут, но не расписан

§9: «For `merged` verses, candidates may reference Greek tokens from the merged Greek verse only through the mapped Synodal ref.» — правило, но нет алгоритма маппинга.

**Рекомендация:** Добавить конкретную строку:

> `"2corinthians 11:33"` maps to Greek tokens of the merged SBLGNT verse for 2 Cor 11:33.

Или ссылку на существующий код, который это делает.

### В4. Схема audit-report.json не определена

В дереве артефактов (§6) и списке коммитов (§14) упоминается `audit-report.json`, но нигде не показана его схема. Схемы есть для gold-report, proof-report, adjudication-report, но audit-report отсутствует.

**Рекомендация:** Добавить схему `audit-report.json` с полями:

```json
{
  "schema": "audit-report-v1",
  "releaseStatus": "ready | blocked:llm-audit-missing | blocked:unresolved-conflicts",
  "blockers": [],
  "coverageSummary": {
    "heldoutVersesAudited": 0,
    "c2VersesAudited": 0,
    "topLexemeKeysAudited": [],
    "variantVersesAudited": 0,
    "randomSampleCount": 0
  },
  "llmOutputsValidated": 0,
  "llmOutputsInvalid": 0
}
```

### В5. «Желательное требование» в §4.3 не имеет gate

Единственное место, где используется «желательное» вместо «обязательное». Модель должна знать, блокирует ли это release или нет.

**Рекомендация:** Добавить к «желательному требованию» явный статус:

> This is not a release blocker. The minimal requirement above is sufficient for release.

---

## Оптимизации для deepseek-v4-pro[1m]

### О1. 1M контекст позволяет загрузить ВСЕ referenced документы

Спецификация ссылается на 5 документов в «Read first» (§2.1). Для модели с 1M контекста можно рассмотреть:

- Вставить ключевые фрагменты referenced-документов прямо в спеку (например, relevant section из `MACULA_migration_plan_v3.md`)
- Или добавить краткий «Context summary» блок, который суммирует ключевые факты из referenced docs

Это снизит риск, что модель пропустит referenced документы.

### О2. Схемы можно дополнить `$comment` для модели

JSON Schema поддерживает `$comment`. Добавление machine-readable подсказок в схемах может помочь:

```json
{
  "q": {
    "type": "string",
    "enum": ["e", "f", "u"],
    "$comment": "ONLY 'e' is visible in v2. 'f' and 'u' are hidden."
  }
}
```

### О3. Добавить «Quick Reference Card» в начало

Для модели с 1M контекста полезно иметь сверхбыстрый lookup в начале файла:

```markdown
## Quick Reference Card

| Concept | Value |
|---------|-------|
| Visible q | `"e"` only |
| Hidden q | `"f"`, `"u"` |
| Forbidden data | RusVZh, UBS/MARBLE runtime fields |
| Gold dev file | `test/fixtures/macula-gold-dev.json` |
| Gold heldout file | `test/fixtures/macula-gold-heldout.json` |
| Release criterion | 0 visible FP on heldout, 0 unresolved conflicts |
| Build command | `npm run build:align` |
| Verifier command | `npm run verify:align` |
| Default when uncertain | Hide pair, report blocker |
```

---

## Итоговая таблица

| # | Приоритет | Что |
|---|-----------|-----|
| К1 | **Must fix** | Глоссарий для смешанного русско-английского |
| К2 | **Must fix** | Убрать escape hatch в command naming |
| К3 | **Must fix** | Quantifiable trigger для «too much» аудита |
| К4 | **Must fix** | Инструмент для проверки human adjudication |
| В1 | Should fix | Proof-схема для C3 manual-allowlist |
| В2 | Should fix | hiddenOrphans за пределами gold |
| В3 | Should fix | Алгоритм merged mapping для 2 Cor 11:33 |
| В4 | Should fix | Схема audit-report.json |
| В5 | Should fix | Статус «желательного требования» |
| О1 | Optimization | Context summary referenced docs |
| О2 | Optimization | `$comment` в JSON schema |
| О3 | Optimization | Quick Reference Card |

---

## Вердикт

**Спецификация готова к имплементации после фикса К1–К4.**

Should fix'ы и оптимизации можно закрыть в процессе первого milestone (John 1), но критические — до старта кодинга.
