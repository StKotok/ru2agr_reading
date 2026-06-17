# ТЗ: B2 — восстановление пайплайна выравнивания на MACULA

**Date:** 2026-06-17
**Status:** к согласованию (дизайн-спека; реализация — после approve и закрытия лиц. гейта §2)
**Решение:** B2 (восстановить *пайплайн*, не данные) — см. §1.
**Источники правды:** методология — `docs/development/ALIGNMENT.md`; модель рантайма —
`docs/development/MACULA_migration_plan_v3.md` (§2 схемы); правила кодинга — `AGENTS.md`.
**Не отменяет** релизные блокеры из ревью MACULA-v3 (UI P0) — они чинятся отдельно;
этот документ про слой *данных выравнивания*.

---

## 1. Контекст и почему B2

Верификация трёх кандидатов на источник истины RU↔GRC (проверено по данным, не по описаниям):

| Кандидат | Что | Вердикт |
|---|---|---|
| **A — Clear-Bible manual** (`SBLGNT-RUSSYN-manual.json`) | Ручное выравнивание SBLGNT↔Синодал, source-ID = MACULA tokenId | **Непригоден.** target-ID ссылаются на *неопубликованную* токенизацию RUSSYN. Доказано: Мф 1:1 χριστοῦ→«Давидова», υἱοῦ→запятая; корпусно target попадает в верное слово 26.5% при oracle 73.5%; то же зафиксировано в удалённом `README.md` команды и в поведении официального ридера BiblioNexus. |
| **B — in-house Zefania + refine** | Базовый Strong-сопоставитель + 3 прохода лингвистического refine | **Выбран.** Заявлено precision 99–100%, recall ~95%, ≤1 ошибка/600, «100% объяснено». Held-out эталон **сохранился** (`test/fixtures/gold-*.json`). |
| **C — Strong/regex** (текущий MACULA-v3) | 182 ручных `ruMatches` → первый кандидат | Под-выпеченный fallback: 49 716 пар, `u=0`, 2 620 неоднозначностей берутся произвольно, аудита нет. Это «база B без refine». |

**B2 vs B1.** B1 = восстановить *данные* B и ре-маппить старые `{ru,gr}`-индексы на MACULA
tokenId/offsets. B2 = восстановить *пайплайн* и перегенерировать нативно на MACULA. Выбран
B2: `ALIGNMENT.md` прямо писался под перенос («постобработка, а не переписывание
генератора»); held-out аудит становится постоянным гейтом-продуктом; нет хрупкого разового
ре-маппинга индексов двух разных токенизаций.

**Что уцелело и переиспользуется (working tree):** `test/fixtures/gold-dev.json` (23 стиха,
320 пар), `test/fixtures/gold-heldout.json` (20 стихов), `assets/data/textual-variants.json`
(synOnly 18, grcOnly 1, merged 1, synOnlyPhrases 7), `scripts/build-variants-registry.mjs`,
`scripts/macula/lib/morphology-decoder.mjs`, `scripts/macula/lib/ru-tokenizer.mjs`,
`src/engine/morphology.js`, `assets/data/schema/alignment-book-v1.json`, оригинальные
MACULA-паки `assets/data/originals/sblgnt-macula/books/*` и syn-паки
`assets/data/translations/syn/books/*`.

**Что восстанавливается из git (`729805b~1`):** `scripts/refine-alignments.mjs` (680 стр.),
`scripts/verify-alignments.mjs` (261), `scripts/apply-zefania-alignments.mjs` (515),
`scripts/parse-zefania-strongs.mjs` (312), `scripts/lib/text-utils.js` (лингв. константы),
`assets/data/rus_nt_strongs.xml` (RusVZh — **см. лиц. гейт §2**).

---

## 2. Лицензионный гейт (Step 0, блокирующий)

Принцип: **рантайм отдаёт только** PD-Синодал + CC-BY MACULA-токены + *производные* пары
`(tokenId ↔ span, q)`. Никакие сторонние словари/тэггинги в `dist/` не попадают.

| Источник | Лицензия | Действие |
|---|---|---|
| SBLGNT текст | CC BY 4.0 | ✓ атрибуция (есть) |
| MACULA: lemma/Strong/morph/`sourceGlosses.en` (Berean PD + Cherith CC-BY) | свободно | ✓ |
| MACULA: `domains` (MARBLE/UBS) | «used with permission» | ⚠ **убрать из рантайма** (top1000.core: удалить поле `domains`) |
| `data-sources/ubs-greek-dictionary.json`, `ubs-lexical-domains.json` (Louw-Nida) | копирайт UBS | ⛔ **build-only, не шиппить**; в идеале вынести из репо в приватный кэш |
| Strong's dictionary, Синодал, bolls.life | PD / открытый API | ✓ |
| **RusVZh** (`rus_nt_strongs.xml`, ред. В. Журомского) | `<rights>` пуст; статус неясен | ❗ **разрешить ДО реализации** (см. ниже) |

**RusVZh — решение до старта (одно из):**
1. **Подтвердить** право использовать RusVZh как build-time вход (тэггинг — только источник
   для генерации пар; в `dist/` не попадает). Зафиксировать вывод в
   `docs/sources/translations/syn-strongs/LICENSE.md`.
2. **Заменить базу** на `data-sources/strongs-ru-alignment.json` (уже в репо, in-house-производное,
   Strong→top-формы, 5 378 Strong) — позиционная точность ниже (агрегат форм, без точной
   позиции слова в стихе), но лицензионно чище. Refine-слой компенсирует частично.
3. **Свой тэггинг**: сгенерировать Strong-тэги для Синодала из PD-источников (Strong+морфология
   греческого + словарь приложения). Дороже; запасной путь.

**Гейт §2 зелёный, когда:** выбран и задокументирован источник Strong-базы для русского;
подтверждено, что в `dist/` нет UBS/MARBLE-производных. Без этого Шаги 3+ не начинать.

> Открытое решение для пользователя: **RusVZh (вариант 1) или strongs-ru-alignment (вариант 2)?**
> От него зависит §6.1 (вход базового сопоставителя) и потолок recall.

---

## 3. Архитектура пайплайна

```
[Step 0] лиц. гейт §2  +  снапшоты-источники (§4)
   │
   ▼
build:original-packs (есть)         → assets/data/originals/sblgnt-macula/books/*  (tokenId, strongs[], morph, fw)
build:syn-packs (есть)              → assets/data/translations/syn/books/*         (words:[{i,text,start,end}])
build:variants-registry (есть)      → assets/data/textual-variants.json            (synOnly/grcOnly/merged/phrases)
   │
   ▼
build:align-base   (НОВ., §6)       → база пар src='z'|'l' на tokenId+span (Strong-join + lexicon fallback)
   │
   ▼
refine:align       (порт §7)        → проходы A/A2/B/C на MACULA-полях; q∈{e,f,u}; provenance
   │
   ▼
verify:align       (порт §8)        → инварианты + реестр вариантов + held-out gold-эталон (ГЕЙТ)
   │
   ▼
assets/data/align/syn--sblgnt-macula/books/*.json  (alignment-book-v1)
assets/data/align/syn--sblgnt-macula/index.json    (alignment-index-v1)
generated/canonical/alignments/syn--sblgnt-macula/{audit,gold}-report.json  (коммит)
```

`build:align` (макрокоманда) = `align-base → refine → verify`. Встраивается в `build:data` после
`build:runtime`. Всё детерминировано и офлайн (AGENTS.md): повторный прогон → побайтово те же паки.

`scripts/build-alignment.mjs` (текущий, regex-кандидат C) **переписывается**: его верхнеуровневая
обвязка (загрузка паков, verseMap, merged/synOnly, запись alignment-book-v1) сохраняется, а
ядро спаривания (строки ~240–360, ruMatches→первый кандидат) заменяется на §6→§7.

---

## 4. Снапшоты-источники (воспроизводимость)

- [ ] Восстановить из git и положить как **committed source snapshot**:
      `docs/sources/translations/syn-strongs/rus_nt_strongs.xml` (если вариант §2.1)
      + `source-manifest.json` (origin, URL Zefania, SHA-256, license/`LICENSE.md`).
- [ ] Восстановить из git в `scripts/`: `refine-alignments.mjs`, `verify-alignments.mjs`,
      `apply-zefania-alignments.mjs`, `parse-zefania-strongs.mjs`, `lib/text-utils.js`.
      Это **стартовая точка для порта**, не финал — переписываются под MACULA-поля (§5/§6/§7).
- [ ] `test/fixtures/gold-dev.json` / `gold-heldout.json` — уже в дереве; **re-key** под MACULA
      (§8.3). Сохранить `ruHash`/`grHash` как защиту от дрейфа текста.
- [ ] `verify-data.mjs` (есть) — расширить инвариантами выравнивания (§8.1); SHA-manifest
      Синодала довести до 27 книг (закрыть Б3 из прошлого ревью).

---

## 5. Целевой формат и слой адаптации MACULA

### 5.1 Выходная схема (alignment-book-v1, уже определена)

`pairsByRef[ref] = [{ span:[start,end], tokenId, lexemeKey, q:"e"|"f"|"u", src }]`.
Инварианты: `q="u"` **никогда** не показывается; в видимых (`e`/`f`) нет дублей на один
`tokenId` и на один `span` в стихе; `span` режется из `verse.text` только `slice()`.

### 5.2 Таблица соответствия полей (старый пайплайн → MACULA-паки)

Главная работа порта — заменить обращения к старым полям. Внутренняя модель пары на время
обработки: `{ ruIdx, tokenIdx, src, q }`, где `ruIdx`→`words[ruIdx]`, `tokenIdx`→`tokens[tokenIdx]`.
На запись конвертируется в §5.1 (`span = [words[ruIdx].start, words[ruIdx].end]`, `tokenId = tokens[tokenIdx].id`).

| Старое поле | MACULA-поле | Примечание |
|---|---|---|
| `grTok.w` (surface) | `t.s` | |
| `grTok.strong` (Number) | `t.strongs` (string[]) | `=== 846` → `t.strongs.includes('846')`; **составные** Strong не ломать |
| `grTok.morph` (`'prep'`/`'det'`/`'noun'`) | `t.morph` (Robinson `P-GSM`,`N-NSF`,`V-IAI-3S`) + `t.fw` | грубый POS — из первого символа morph и/или `t.fw` |
| `grTok.c` (код падежа `"gsm"`) | парсится из `t.morph` через `morphology-decoder.mjs` | для местоимений `P-CNG` → case/num/gender |
| gr-index (позиция в split) | `t.id` (tokenId) + `t.i` (1-based) | курсор/монотонность — по позиции в массиве `tokens` |
| ru-index (`text.split(/\s+/)`) | `words[i]` с offset'ами | **не сплитить рантайм**; источник — `ru-tokenizer.mjs` |
| пара `{ru,gr,src,q,c}` (inline) | `{span,tokenId,lexemeKey,q,src}` (отдельный pack) | `c` не хранится в паке (берём из `t.morph` при refine) |

### 5.3 Модуль `scripts/macula/lib/align-morph.mjs` (НОВ.)

Тонкая обёртка над `morphology-decoder.mjs`, экспортирует под нужды refine:
- `isGreekFunction(token)` — **воспроизводит старую логику**, не путать с `t.fw`:
  `GR_FUNCTION_POS = {det,conj,prep,adv,intj,part}` (из morph) ∪ `GR_FUNCTION_STRONG` (см.
  `refine-alignments.mjs:61-93`). Важно: αὐτός (pronoun) в этой логике **не** функциональное,
  хотя `t.fw=true` в MACULA — поэтому Pass B (класс-мисматч) использует `isGreekFunction`, а **не** `t.fw`.
- `pronCaseCode(token)` → `"gsm"`-подобный код из `P-CNG` (замена `parseG846Case`/`caseFromCode`).
- `hasStrong(token, n)` → `token.strongs.includes(String(n))`.
- Тесты: маппинг `P-GSM→gsm`, `N-NSF`, `V-IAI-3S→null` (не местоимение), составной Strong.

---

## 6. Базовый сопоставитель — `scripts/build-alignment-base.mjs` (НОВ.)

Порт `apply-zefania-alignments.mjs` + `parse-zefania-strongs.mjs` на MACULA. Выход: `src='z'` (Strong-база),
`src='l'` (lexicon fallback). Качество здесь **черновое**; финальное `q` ставит refine (§7).

### 6.1 Вход
- MACULA original-pack: `tokens[{id,i,s,lemma,strongs[],morph,fw}]`.
- Русский Strong-источник (по §2): RusVZh per-word Strong **или** `strongs-ru-alignment.json`.
- syn-pack: `words[{i,text,start,end}]` (русские токены с offset'ами; **тот же** `ru-tokenizer.mjs`).
- lexicon `ruMatches`/`ruExclude` из `docs/sources/locales/ru/core.json` (fallback).

### 6.2 Алгоритм (на стих, только `status∈{paired,merged}`)
1. Сопоставить русские токены с RusVZh-токенами того же стиха (по `cleanRuWord`), получить
   Strong каждого русского слова. (Реконсиляция токенизаций RusVZh↔наш снапшот — как уже
   доказано на Ин 1:1: словоформы совпадают, пунктуация отдельными токенами.)
2. Для русского слова со Strong `S`: кандидаты — греческие `tokens` с `hasStrong(t,S)`.
3. **Монотонное потребление повторов:** курсор по `(ref, S)`; первое рус. вхождение → первый
   греч. токен, второе → второй; **никогда** один `tokenId` дважды. (Уже корректно в текущем
   `build-alignment.mjs:260-341` — переиспользовать.)
4. Нет Strong у слова → fallback по lexicon `ruMatches` (с `ruExclude`), `src='l'`.
5. Записать черновую пару `{ruIdx, tokenIdx, src}`. **q пока не ставить.**
6. **Неоднозначность count/order не разрешена** → пара **не создаётся как видимая**: либо
   `src='l'` (потом каскадом → `u` в §7), либо вовсе пропуск. (Прямой запрет «брать первый
   доступный» из бага C.)

### 6.3 Тесты (`scripts/macula/test/align-base.test.mjs`)
- Ин 1:1: λόγος×3 → tokenId 005/008/017 по порядку; θεός×2 → 012/014; нет дублей `tokenId`.
- Составной Strong сохранён; слово без Strong и без `ruMatches` → нет пары.
- Детерминизм (повторный прогон — нет diff).

---

## 7. Refine — `scripts/refine-alignments.mjs` (порт)

Логика 1:1 из восстановленного скрипта, поля — по §5.2. Проходы A→A2→B→C на каждый
`status∈{paired,merged}` стих. Константы — из портированного `scripts/lib/text-utils.js`
(`SVOV_LEMMAS={846,1438,2398,4572,1683}`, `SVOV_REFLEXIVE={1438,2398,4572,1683}`, `SVOV_FORMS`,
`RU_PRONOUNS`, `CASE_COMPAT`, `lookupPrep`, `SUBST_ARTICLE_RU/GR`).

- **Pass A** — перенаправление αὐτός (G846): пары «G846 ↔ форма свой/себя» при наличии
  невыровненного русского личного местоимения-сироты перенаправляются на местоимение по
  согласованию падеж/число/род (из `pronCaseCode`) и предложной таблице `lookupPrep`. `src='a'`.
  (Ref: `refine.mjs:132-287`.)
- **Pass A2** — добавление недостающих пар G846/G848/G1438 ↔ местоимение по **двунаправленной
  морфо-уникальности** (greedy, итеративно). Nom-guard (pro-drop), Locative-guard. `src='a'`.
  (Ref: `refine.mjs:303-453`.)
- **Pass B** — понижение до `q='u'`: артикль G3588 не в субстантивной позиции; «свой» без
  `SVOV_LEMMAS`; μέν(3303) без οὖν(3767); **класс-мисматч** `isRuFunction ≠ isGreekFunction`.
  Белый список (не понижать): ἰδού(2400)→«вот/се»=e; ἄν(302)→«бы»=f; рефлексивы→e;
  αὐτός→«свой»=f; субст. артикль=f; μὲν οὖν=f. (Ref: `refine.mjs:459-519`.)
- **Pass C** — границы (drop OOB), дедуп по приоритету `src` **z>a>l**, q-каскад
  `z→e, a→e, l→u`. (Ref: `refine.mjs:525-579`.)

**Адаптации порта (обязательные):**
- `grTokens[p.gr]` → `tokens[p.tokenIdx]`; `ruWords[p.ru]` → `words[p.ruIdx].text`.
- `grTok.strong === N` → `hasStrong(tok, N)`; `grTok.c` → `pronCaseCode(tok)`;
  `grTok.morph==='prep'` → `isGreekFunction`/morph-парс; `grTok.w` → `tok.s`.
- `verse.text.split(/\s+/)` (старый ru-индекс) → `words[]` с offset'ами (**удалить split**).
- Запись: внутренние `{ruIdx,tokenIdx,q,src}` → `{span,tokenId,lexemeKey,q,src}` (§5.1);
  дефолты не пишем (`src='z'`, `q='e'` опускаем — как `compactPair`).
- `dictByLexemeKey`: `lexemeKey` пары = `tokens[tokenIdx].lexemeKey`.

**Тесты (`scripts/macula/test/refine.test.mjs`):** перенести существующие кейсы + добавить
MACULA-morph: αὐτοῦ `P-GSM` → согласование; класс-мисматч → u; субст. артикль → f;
дедуп z>a>l; составной Strong не падает.

---

## 8. Верификатор + held-out аудит — гейт-продукт

### 8.1 Инварианты (расширить существующий `verify-data.mjs`)
- Схема всех паков (есть).
- Каждый `pair.tokenId` существует в original-pack данного стиха (учёт merged: токены
  греч.-merged-стиха привязаны к syn-стиху — текущая логика 2Кор 11:33 сохраняется).
- `pair.span` в границах `verse.text` и **совпадает** с offset'ами `words[]`.
- Нет дублей видимых (`e`/`f`) пар на один `tokenId` и на один `span` в стихе.
- **«100% объяснено»:** каждое русское слово без видимой пары относится к категории —
  synOnly/merged-verse, либо в `phraseVariantsByRef`, либо служебное (по списку), либо
  `q='u'`. Иначе — **FAIL** (а не warn, как в текущем «exclusion-only»).
- Детерминизм: повторный `build:align` → нет diff.
- SHA из `source-manifest.json` (вкл. 27 книг Синодала) совпадают.

### 8.2 Метрики против gold (порт `verify-alignments.mjs:checkGold`)
- Считать precision/recall видимых пар против `gold-dev` (настройка) и `gold-heldout` (приёмка).
- **ГЕЙТ (из `ALIGNMENT.md` Ч.V):** на `gold-heldout` precision **≥ 98%**, **0 подтверждённых
  ошибок** на выборке; recall — **не гейт** (порог-ориентир ≥ 70%, факт у B ~95%).
  Найденная ошибка → ужесточить порог (пара → `u`), перегенерировать, повторить.
- `ruHash`/`grHash` каждого gold-стиха обязаны совпасть с текущими паками — иначе FAIL
  «эталон устарел» (защита от молчаливого дрейфа текста/токенизации).

### 8.3 Re-key gold-фикстур под MACULA
Текущие `gold-*.json` — `{ref, ruHash, grHash, ruWords[], grTokens[], pairs:[{ru,gr,src}]}`,
индексы против split-массивов. Привести к новой токенизации:
- `ru` индекс → индекс в `words[]` (`ru-tokenizer`); `gr` индекс → позиция в MACULA `tokens[]`.
- Пересчитать `ruHash`/`grHash` от новых последовательностей.
- Сверить вручную ≥ Ин 1:1, Мф 1:1, Деян 8:39, 1Ин 5:7 (Comma — слова explained, не пары).
- Зафиксировать в `docs/development/ALIGNMENT.md` дату ре-кея.

### 8.4 Отчёты-артефакты (коммит)
`generated/canonical/alignments/syn--sblgnt-macula/audit-report.json` (precision/recall,
число `e/f/u`, список понижений) и `gold-report.json` (per-стих результат gold). Это закрывает
P1 «отчёт не сохраняется/не гейт» из ревью.

---

## 9. Загрузчики/движок/UI — минимальные правки (после зелёного §8)

Слой данных B2 самодостаточен; рантайму нужно лишь **корректно потреблять** уже определённый
`alignment-book-v1`. Эти правки — отдельный трек (UI P0 из прошлого ревью), но перечислены для полноты:
- `loadAlignment(bookId)` (есть в плане) → `composeVerse`.
- `q='u'` не рендерить; режимы 3/4 — только `e` (опц. `f`).
- Словарный lookup в движке — по `lexemeKey`/`tokenId`, не Strong.

> **Вне рамок этого ТЗ**, но является предусловием релиза: чинить UI-краши (P0 №1–3 ревью —
> `loadCoreLexicon` shape, `dictionary.js` на `freq-*`, `strong` ReferenceError). Данные B2 без
> рабочего UI пользователю не видны.

---

## 10. Поэтапный план и гейты

- **Шаг 0 — лиц. гейт §2.** Выбрать Strong-базу (RusVZh/aggregate), задокументировать; убрать
  UBS/MARBLE из рантайма. **ГЕЙТ 0:** §2 зелёный.
- **Шаг 1 — снапшоты + восстановление (§4).** Восстановить скрипты/источники из git, оформить
  manifest+SHA. **ГЕЙТ 1:** `verify:data` SHA-блок зелёный на 27 книгах; скрипты импортируются.
- **Шаг 2 — слой адаптации (§5.3).** `align-morph.mjs` + тесты. **ГЕЙТ 2:** `npm test` зелёный.
- **Шаг 3 — базовый сопоставитель (§6).** `build-alignment-base.mjs` + тесты Ин 1:1. **ГЕЙТ 3:**
  база детерминирована; нет дублей `tokenId`; Ин 1:1/Мф 1:1 корректны вручную.
- **Шаг 4 — refine (§7).** Порт A/A2/B/C + тесты. **ГЕЙТ 4:** `q`-распределение осмысленно
  (`u>0`!); нет видимых дублей.
- **Шаг 5 — верификатор + gold (§8).** Re-key фикстур, инварианты, метрики, отчёты. **ГЕЙТ 5
  (приёмочный):** `build:align && verify:align` зелёные; held-out precision ≥98%, 0 ошибок;
  «100% объяснено»; отчёты закоммичены; `build:data` офлайн и детерминирован.

После ГЕЙТ 5 слой данных готов; дальше — трек UI (§9).

## 11. Commit breakdown
1. `chore: license gate — drop UBS/MARBLE from runtime; Strong-base decision`
2. `build: restore alignment pipeline sources from history (RusVZh|aggregate, scripts) + manifest/SHA`
3. `build: align-morph adapter (MACULA morph→case/fn) + tests`
4. `build: Strong-join base aligner on tokenId+span (monotonic, no first-cand) + tests`
5. `build: port refine passes A/A2/B/C to MACULA fields + tests`
6. `build: verify:align — invariants + re-keyed gold held-out gate + reports`
7. `docs: ALIGNMENT.md update (MACULA port, re-key date, metrics)`

---

## 12. Definition of Done
- [ ] `npm run build:data` офлайн, детерминирован (повторный прогон — нет diff).
- [ ] `verify:align` зелёный: инварианты + «100% объяснено» + held-out precision ≥98% / 0 ошибок.
- [ ] `audit-report.json` + `gold-report.json` закоммичены; SHA-manifest Синодала = 27 книг.
- [ ] В рантайме нет UBS/MARBLE-производных (`domains` удалён; `ubs-*.json` не в `dist/`).
- [ ] Видимые пары содержат `e`/`f`; `u` присутствует в данных и **скрыт** в UI; нет дублей.
- [ ] Лицензия Strong-базы задокументирована и подтверждена.

---

## 13. Риски и «отчёт о сомнениях»
- **Заявленные 99–100%/95% — это аудит команды B, я его слепо не перепроверял.** Первый
  реальный замер — на ГЕЙТ 5 (held-out). До этого цифры — ориентир, не факт.
- **RusVZh↔наш снапшот:** совпадение доказано лишь на Ин 1:1; реконсиляция токенизаций на всём
  корпусе не верифицирована (пунктуация, дефисы, «слитные» формы). Риск §6.2 шаг 1.
- **MACULA-токенизация ≠ старая grc:** морфо-коды Robinson, составные Strong, возможное иное
  членение красиса. Порт §5.2/§7 требует тестов именно на этих краях.
- **Лицензия RusVZh не подтверждена** — блокер §2; без решения recall-потолок и чистота под вопросом.
- **gold-фикстуры** строились против старой токенизации — re-key (§8.3) может вскрыть стихи, где
  старый `gr`-индекс не отображается 1:1 на MACULA `tokens` (версификация Деян 8/15/24/28).
- **Кандидат A** закрыт уверенно (4 независимых доказательства) — не возвращаемся.
