# Migration to Clean Data: Robust Technical Plan

> **Status:** проект плана, обновлён после критического разбора 2026-06-24.
> **Цель:** перевести приложение на данные с чистыми лицензиями. Первый язык данных — английский (BSB). UI пока остаётся русским.
>
> **Ключевые решения v2:** runtime/IndexedDB используют `lexemeId` из enriched; app-ready данные коммитятся в `assets/data/`.

---

## 0. Блокирующие решения

### 0.1 Канонический ID лексемы

В source-data сейчас есть два разных класса ключей:

| Источник | Пример | Семантика |
|---|---:|---|
| `enriched.books[].lexemeId` | `grc-biblos-9adfa6` | стабильный enriched/MACULA-derived id |
| `lexicon/top1000.core.json[].lexemeKey` | `biblos` | человекочитаемый slug старого curated-словаря |
| `lexicon/top1000.core.json[].maculaLexemeId` | `grc-biblos-9adfa6` | связь curated-словаря с enriched id |
| старые пользовательские ключи | `logos`, `freq-3056` | IndexedDB `dictionary`, `wordsToday` |

**Решение для v2:** канонический runtime key = `lexemeId` из enriched, например `grc-biblos-9adfa6`.

App-ready данные должны хранить оба поля:

```json
{
  "lexemeId": "grc-biblos-9adfa6",
  "lexemeSlug": "biblos"
}
```

Правила:
- `lexemeId` используется в `dictionary`, `progress.wordsToday`, alignment, `data-lexeme-key`, словарных карточках и `wordEntries`.
- `lexemeSlug` используется только для отображения, поиска, совместимости и диагностики.
- Старый `freq-*` формат не используется как новый ключ; при загрузке словаря он мигрирует в `lexemeId` через Strong's fallback, если соответствие однозначно.
- Если Strong's номер даёт несколько лексем, запись не мигрируется автоматически; она остаётся legacy-записью и получает warning в `dictionary_migration_warnings`.

### 0.2 App-ready данные: commit policy

Текущие правила проекта в `AGENTS.md` говорят: данные генерируются скриптами и коммитятся. Поэтому решение “не коммитить `assets/data/`” нельзя принимать внутри миграционного плана без изменения project policy.

**Решение v2:** коммитить app-ready данные в `assets/data/`.

Причины:
- локальный `npm run dev` работает сразу после clone/install;
- Netlify deploy не зависит от долгой генерации данных;
- diff данных можно ревьюить;
- rollback прост: откат кода и данных одним git revert;
- это соответствует текущим правилам проекта.

Вариант “не коммитить app-ready данные” не входит в этот план. Для него нужен отдельный approved change к `AGENTS.md`, `.gitignore`, Netlify build command, README и dev workflow.

---

## 1. Текущее состояние vs. цель

| Измерение | Сейчас | Цель v2 |
|---|---|---|
| Данные | source-data уже очищены от UBS; `assets/data/` отсутствует | app-ready данные генерируются из `docs/source-data/` |
| Основной перевод | Синодальный в старых форматах/архиве | BSB, только НЗ |
| Греческий оригинал | enriched SBLGNT/MACULA без UBS semantic fields | app-ready Greek book packs |
| Alignment | старый русский `syn--sblgnt-macula` в source-data/obsolete | новый `grc-eng` span-based alignment |
| UI | русская оболочка, старые строки про русский текст | русская оболочка, строки адаптированы под английский BSB |
| Storage | IndexedDB `ru2agr_db` / `app_state` | те же database/store/key names, с миграцией словарных ключей |

---

## 2. Лицензии и атрибуция

Разрешённые источники:

| Данные | Лицензия | Обязательное действие |
|---|---|---|
| SBLGNT/MACULA cleaned | CC BY 4.0 | сохранить attribution в `README.md`, `CATALOG.md` и экране “О приложении” |
| Cherith glosses | CC BY 4.0 | сохранить attribution в `README.md`, `CATALOG.md` и экране “О приложении” |
| BSB | Public domain | сохранить источник `https://berean.bible/` |
| Strong's Dictionary | Public domain | указать источник в `README.md`/`CATALOG.md`/about |
| Project curated RU data | project-owned | указать как данные проекта |

`data-manifest.json` — технический манифест загрузчика. Он не должен содержать attribution/licensing blocks и не должен становиться третьим источником правды о лицензиях.

Читабельность и полнота attribution проверяются через `README.md`, `docs/source-data/CATALOG.md` и экран “О приложении”. Нельзя добавлять новые текстовые источники без обновления `docs/source-data/CATALOG.md` и пользовательской атрибуции в `src/ui/screens/about.js`.

---

## 3. App-ready форматы

### 3.1 Дерево данных

```text
assets/data/
├── bibles/grc/{book}.json
├── bibles/eng/{book}.json
├── align/grc-eng/{book}.json
├── lexicon/core.json
├── lexicon/dictionary.json
├── alphabet.json
├── books.json
└── data-manifest.json
```

### 3.2 Greek book pack

```json
{
  "schema": "original-book-v2",
  "bookId": "matthew",
  "title": "ΚΑΤΑ ΜΑΘΘΑΙΟΝ",
  "chapters": [{
    "n": 1,
    "verses": [{
      "n": 1,
      "ref": "matthew 1:1",
      "tokens": [{
        "i": 1,
        "id": "n40001001001",
        "s": "Βίβλος",
        "lemma": "βίβλος",
        "lexemeId": "grc-biblos-9adfa6",
        "lexemeSlug": "biblos",
        "translit": "Biblos",
        "morph": "N-NSF",
        "morphLabelRu": "сущ., им. падеж, ед. ч., жен. род",
        "strongs": ["976"],
        "glossBerean": "[The] book",
        "glossCherith": "book",
        "pos": "noun",
        "posLabelRu": "существительное",
        "freqRank": 1064,
        "fw": false
      }]
    }]
  }]
}
```

Field mapping:

| enriched field | app-ready field | Notes |
|---|---|---|
| `id` | `id` | token id, unchanged |
| `surface` | `s` | visible Greek form |
| `lemma` | `lemma` | unchanged |
| `lexemeId` | `lexemeId` | canonical key |
| curated slug by `maculaLexemeId` | `lexemeSlug` | optional, for display/backcompat |
| `transliteration` | `translit` | if object, use `.value`; if string, use as-is |
| `morphology.code` | `morph` | Robinson-like code |
| `morphology.labelRu` | `morphLabelRu` | display label |
| `strong` | `strongs` | always array of strings |
| `pos.primary` / `pos.source` | `pos` | normalized POS |
| `pos.labelRu` | `posLabelRu` | display label |
| `glossEn` | `glossBerean` | Berean gloss |
| `english` | `glossCherith` | Cherith gloss |
| `isFunctionWord` | `fw` | boolean |
| `frequency.rank` or join by `lexemeId` | `freqRank` | integer or `null` |

### 3.3 English BSB book pack

The translation pack must preserve frozen word offsets. The current engine depends on them.

```json
{
  "schema": "translation-book-v2",
  "translationId": "bsb",
  "bookId": "matthew",
  "title": "Matthew",
  "short": "Matt",
  "normalizationVersion": "bsb-text-v1",
  "license": "Public domain",
  "attribution": "Berean Standard Bible, https://berean.bible/",
  "chapters": [{
    "n": 1,
    "verses": [{
      "ref": "matthew 1:1",
      "n": 1,
      "text": "This is the record of the genealogy of Jesus Christ, the son of David, the son of Abraham:",
      "words": [
        { "i": 0, "text": "This", "start": 0, "end": 4 }
      ]
    }]
  }]
}
```

BSB conversion rules:
- Keep only the 27 NT books.
- `type: "verse"` becomes one verse object.
- Verse `content` strings are concatenated.
- Inline objects with `noteId` are skipped.
- Inline objects with `lineBreak: true` become one space.
- Top-level `type: "heading"` and `type: "line_break"` are skipped.
- Build the final displayed `text` once with deterministic whitespace normalization.
- Generate `words` from that final displayed `text`.
- Do not mutate `text` after `words` are generated.
- Text normalization is part of the `translation-book-v2` data contract. Changing normalization rules requires:
  - bumping `normalizationVersion`;
  - regenerating all BSB translation packs;
  - regenerating all dependent `grc-eng` alignment packs;
  - rejecting mixed packs generated with different normalization versions.
- Every verse must have `ref`, `n`, `text`, and `words`.

### 3.4 Alignment book pack

```json
{
  "schema": "alignment-book-v2",
  "alignmentId": "grc-eng",
  "bookId": "matthew",
  "normalizationVersion": "bsb-text-v1",
  "stats": {
    "tokenCount": 18329,
    "alignedTokenCount": 0,
    "unalignedTokenCount": 0,
    "warningCount": 0
  },
  "pairsByRef": {
    "matthew 1:1": [
      {
        "span": [0, 4],
        "tokenId": "n40001001001",
        "lexemeId": "grc-biblos-9adfa6",
        "q": "a",
        "method": "gloss-exact"
      }
    ]
  },
  "warningsByRef": {
    "matthew 1:1": []
  }
}
```

`q` values:
- `a`: accepted deterministic match.
- `f`: fuzzy but accepted; visible in text only if verified by rules.
- `u`: unaligned; must not render as replacement.
- `x`: excluded function-word or punctuation-only mapping; must not render as replacement.

Alignment pairs must be sorted by `span[0]`, then `tokenId`. A single BSB span can map to multiple Greek tokens only when the pair explicitly sets `groupId`. Duplicate spans without `groupId` are a verify error.

---

## 4. Alignment algorithm and quality gates

Direct gloss-to-BSB matching is the v1 baseline. More complex scoring is intentionally deferred until the first alignment report proves it is needed.

### 4.1 V1 algorithm

For each verse:

1. Load final BSB `verse.text` and `verse.words`.
2. Load Greek enriched tokens for the same `ref`.
3. Build normalized candidates from:
   - `glossBerean` with bracket text treated as optional;
   - `glossCherith`;
   - lemma-level `glossesEn` / `englishGlosses`;
   - exact BSB word text.
4. Match in deterministic passes:
   - exact normalized single-word match;
   - bracket-optional single-word match;
   - normalized phrase match across adjacent BSB words;
   - simple fuzzy match: lowercase, strip punctuation, compare ASCII apostrophe variants.
5. Reject ambiguous candidates. Do not guess between repeated BSB words in v1.
6. Emit `q="u"` warning for unaligned meaningful tokens.
7. Emit `q="x"` for excluded function words only when exclusion is intentional and counted.

No `Math.random()` or nondeterministic tie-breaking.

### 4.2 Deferred v2 alignment work

Add scoring only if v1 cannot pass the quality gates. Potential v2 tools:
- one-to-many / many-to-one alignment with explicit `groupId`;
- monotonic order bonus;
- distance penalty from Greek token order;
- score margins for ambiguous candidates.

These are not v1 requirements.

### 4.3 Required reports

`build-align.mjs` must write one machine-readable report:

```text
assets/data/align/grc-eng/build-report.json
```

The build command should also print a concise console summary from the JSON report. A Markdown report may be generated later from the JSON, but it is not a required artifact.

Minimum report fields:
- aligned token percentage;
- aligned non-function token percentage;
- verses with zero accepted pairs;
- duplicate span count;
- ambiguous candidate count;
- top unaligned lexemes;
- worst 50 verses by coverage;
- 20 sample verses across Gospels, Paul, Hebrews, Catholic Epistles, Revelation.

### 4.4 Fail thresholds

Initial hard gates:
- 27 alignment book files exist.
- 0 invalid token ids.
- 0 spans outside `verse.text`.
- 0 spans that include external punctuation unless intentionally grouped.
- 0 duplicate spans without `groupId`.
- 0 pairs pointing to a different verse.
- At least 90% accepted non-function-token coverage.
- Target for v2 alignment quality: 92% accepted non-function-token coverage.
- At least 95% verses have at least one accepted pair.

Coverage thresholds must not be silently lowered. Any threshold change requires updating this document.

---

## 5. Pipeline

### 5.1 Scripts

```text
scripts/
├── build-bibles.mjs
├── build-lexicon.mjs
├── build-align.mjs
├── build-app-config.mjs
├── build-data.mjs
└── verify-data.mjs
```

The repository currently has `package.json` commands that refer to `scripts/`, while `scripts/` is absent in the working tree. Phase 1 must restore a coherent scripts baseline before changing runtime code.

### 5.2 Atomic generation

`build-data.mjs` must generate into a temporary directory first:

```text
assets/.data-tmp-{timestamp}/
```

Then:
1. run all builders;
2. run schema validation;
3. run invariant verification;
4. write `data-manifest.json`;
5. replace `assets/data/` atomically enough for local filesystem use:
   - remove old `assets/data`;
   - rename temp dir to `assets/data`.

If any step fails, keep old `assets/data/` intact.

### 5.3 Package scripts

Because v2 commits app-ready data, `build` remains a Vite build. `build:data` is run manually when source-data or data builders change.

```json
{
  "scripts": {
    "build:bibles": "node scripts/build-bibles.mjs",
    "build:lexicon": "node scripts/build-lexicon.mjs",
    "build:align": "node scripts/build-align.mjs",
    "build:app-config": "node scripts/build-app-config.mjs",
    "build:data": "node scripts/build-data.mjs",
    "verify:data": "node scripts/verify-data.mjs",
    "build": "vite build"
  }
}
```

`build-data.mjs` must run `verify-data.mjs` before success.

---

## 6. Verification

`verify-data.mjs` must validate schemas and invariants.

Required checks:
1. All 27 NT books exist in `bibles/grc`, `bibles/eng`, and `align/grc-eng`.
2. Expected chapter and verse counts match `docs/source-data/app-config/books.json`.
3. Every generated translation verse has `ref`, `text`, and frozen `words`.
4. Every `word.start/end` points exactly to `text.slice(start, end) === word.text`.
5. All translation packs have the same `normalizationVersion`.
6. Every alignment pack has the same `normalizationVersion` as its matching translation pack.
7. Greek token count per book equals enriched token count.
8. Every Greek token has `id`, `s`, `lemma`, `lexemeId`, `morph`, `strongs`, `fw`.
9. `lexicon/core.json` contains all 5468 enriched lexemes.
10. Every curated RU entry either maps to exactly one `lexemeId` or is listed in migration warnings.
11. Every alignment pair references an existing Greek token in the same verse.
12. Every alignment span is valid for the matching BSB verse.
13. Alignment quality thresholds from section 4.4 pass.
14. `data-manifest.json` exactly matches generated files, sizes, hashes and schema versions.
15. Smoke-check source and app-ready data for known excluded UBS fields: `semantic`, `louwNida`, `domain`, `domainCode`, `ln`.

Schema validation may use `ajv` only if the dependency is already accepted for the project. If not, use a small local validator first and propose adding `ajv` separately.

---

## 7. Runtime code changes

### 7.1 Keep

Keep these contracts stable:
- `src/storage/db.js`: database `ru2agr_db`, store `app_state`.
- IndexedDB top-level keys: `settings`, `progress`, `dictionary`.
- hash routes.
- deterministic engine behavior and `hash01`.
- no DOM/fetch/storage in `src/engine/**`.

### 7.2 Adapt

`src/data/bible-loader.js`:
- load `./data/bibles/grc/{book}.json`;
- load `./data/bibles/eng/{book}.json`;
- load `./data/align/grc-eng/{book}.json`;
- load `./data/data-manifest.json`;
- append data version query only through one helper, not scattered string concatenation.

`src/data/lexicon-loader.js`:
- load `./data/lexicon/core.json`;
- load `./data/lexicon/dictionary.json`;
- expose data in the shape current UI needs: `id`, `lexemeId`, `lexemeSlug`, `lemma`, `translit`, `gloss`, `shortGloss`, `pos`, `rank`, `count`, `strongs`, `ruMatches`.

`src/state/dictionary.js`:
- add one fail-soft dictionary migration on load;
- preserve unknown old keys in place with `_legacy: true`;
- store migration warnings under the separate IndexedDB key `dictionary_migration_warnings`;
- never delete user data automatically.

`src/ui/screens/reading.js`:
- `loadBook('eng', bookId)` replaces old `syn` call;
- use `verse.ref` and `verse.words` from BSB pack;
- replace Russian-source wording with English-source wording;
- keep visible UI text in Russian.

`src/ui/screens/dictionary.js`:
- stop assuming Strong's is the primary row key;
- use `lexemeId` as dictionary key and Strong's only as metadata/filter text.

`src/ui/components/word-card.js`:
- rename comments/data labels from “исходное русское слово” to neutral “исходное слово перевода”;
- display BSB original word when a Greek insertion is tapped.

`src/ui/screens/about.js`:
- show visible attribution for SBLGNT/MACULA, Cherith glosses, BSB, Strong's Dictionary and project-curated data;
- do not read attribution from `data-manifest.json`.

`src/engine/compose.js` and `src/engine/form-layer.js`:
- update alignment handling from `lexemeKey` to `lexemeId`;
- keep a temporary compatibility shim for old `pair.lexemeKey` during migration tests;
- do not add loader or lexicon responsibilities to engine.

Cross-cutting `lexemeKey` → `lexemeId` touch points:
- `src/engine/form-layer.js`: pair lookup, segment metadata, dictionary lookup key.
- `src/engine/compose.js`: context comments/tests and pass-through assumptions.
- `src/ui/render.js`: DOM attributes `data-lexeme-key` / compatibility aliases.
- `src/ui/screens/reading.js`: `buildWordEntries()`, `collectWordData()`, span attributes, status updates.
- `src/ui/screens/dictionary.js`: row identity, filters, add/update actions.
- `src/ui/components/word-card.js`: data contract comments and callbacks.
- `src/state/dictionary.js`: persisted key migration.
- `src/state/progress.js`: `wordsToday.added` migration.
- `src/data/lexicon-loader.js`: v2 core shape and legacy key map.
- tests for form layer, dictionary, progress, lexicon and reading data adapters.

### 7.3 UI string audit

Before finishing Phase 2, run:

```bash
rg -n "Синод|русск|ruHint|Synodal|syn|исходное русское|перевод" src
```

Every hit must be classified:
- keep because UI language is Russian;
- change because source text is now English/BSB;
- obsolete because old data path.

---

## 8. IndexedDB migration

### 8.1 What stays stable

| Key | Keep? | Notes |
|---|---|---|
| `settings` | yes | structure mostly unchanged |
| `progress.reading.lastBook` | yes | book ids stay lowercase |
| `progress.reading.books` | yes | chapter numbers stay valid |
| `progress.letters` | yes | Greek alphabet unchanged |
| `dictionary` | migrate entries | lexeme keys may change |
| `progress.wordsToday.added` | migrate entries | same key class as dictionary |

### 8.2 Migration map

Constants:

```js
const DICTIONARY_MIGRATION_WARNINGS_KEY = 'dictionary_migration_warnings';
```

`lexicon/core.json` must include:

```json
{
  "lexemeId": "grc-logos-...",
  "lexemeSlug": "logos",
  "legacyKeys": ["logos", "freq-3056"]
}
```

Migration logic:
1. Build `legacyKey -> lexemeId` map from `core.json`.
2. For every dictionary entry:
   - if key is already a known `lexemeId`, keep it;
   - if key maps to one `lexemeId`, move entry to that key;
   - if both old and new keys exist, merge conservatively:
     - strongest status wins: `known > learning > new`;
     - `showInText: false` wins over true;
     - keep earliest `addedAt`;
   - if no safe mapping exists, preserve the old entry under its old key, add `_legacy: true`, and append a warning to `dictionary_migration_warnings`.
3. Save migrated dictionary only after successful lexicon load.
4. Save warnings to IndexedDB key `dictionary_migration_warnings`; do not store metadata inside `dictionary`.
5. Apply same mapping to `progress.wordsToday.added`.

This migration is idempotent and fail-soft. If anything throws, load the original dictionary unchanged.

---

## 9. PWA and data versioning

### 9.1 Current risk

Current Workbox config excludes old data directories from precache and runtime-caches old paths. New paths under `/data/bibles/` are not covered unless `vite.config.js` is changed.

### 9.2 Required config changes

Update Workbox runtime caching to cover:

```js
/\/data\/(bibles|align|lexicon)\/.*/
```

Use versioned cache names:

```text
book-packs-v{dataManifest.version}
lexicon-data-v{dataManifest.version}
```

If dynamic cache names cannot use manifest version at build time, use stable cache names plus query version:

```js
fetch(`./data/bibles/eng/${bookId}.json?v=${dataVersion}`)
```

All data fetches must go through one loader helper so cache-busting is consistent.

### 9.3 Update protocol

On app start:
1. Load `data-manifest.json` with `cache: "no-store"` where supported.
2. Compare manifest version with the saved version in IndexedDB or localStorage.
3. If version changed:
   - clear only known app data caches, not IndexedDB user data;
   - clear in-memory loader caches;
   - save new data version;
   - reload data packs.
4. If manifest load fails offline:
   - continue with cached data;
   - do not wipe caches;
   - show no blocking error.

Do not rely on “old URL paths become irrelevant” as the only invalidation mechanism.

---

## 10. Deployment and rollback

### 10.1 Gates before deploy

Required:

```bash
npm test
npm run build:data
npm run verify:data
npm run build
```

Migration smoke checks:
- desktop 1280px, light and dark theme;
- mobile 375px, light and dark theme;
- mixed mode, Greek mode, plain view;
- dictionary add/status changes survive reload;
- About screen shows required data attribution;
- offline reload after data has been cached;
- update from old service worker to new service worker.

### 10.2 Rollback

```bash
git revert <migration-commit>
npm run build
netlify deploy --prod --dir=dist
```

Also verify Netlify UI rollback is possible for the previous deploy. Rollback must not clear IndexedDB; migrated dictionary keys should remain usable or safely ignored by old code.

---

## 11. Phases

### Phase 1: Pipeline and data contracts

| Task | Exit criteria |
|---|---|
| Restore `scripts/` baseline | package scripts point to existing files |
| Add schemas v2 | schema files exist and are used by verify |
| Build Greek packs | 27 files, token counts match enriched |
| Build BSB packs | 27 files, verse counts and `words` offsets verified |
| Build lexicon | 5468 lexemes, legacy key map generated |
| Build alignment | JSON report written, thresholds pass |
| Build app config/manifest | hashes, sizes and schema versions included |
| Atomic `build-data.mjs` | old data survives failed generation |

### Phase 2: Runtime adaptation

| Task | Exit criteria |
|---|---|
| `bible-loader.js` | new paths, manifest version helper, fail-soft |
| `lexicon-loader.js` | v2 core/dictionary shape consumed by UI |
| dictionary migration | idempotent tests for old and new keys |
| reading screen | BSB text renders with Greek replacements |
| dictionary screen | uses `lexemeId`, no Strong-primary assumptions |
| word card | neutral source-word wording, BSB original shown |
| about screen | visible attribution for all shipped data sources |
| PWA config | new data paths cached and invalidated correctly |
| tests | engine/state/loader/migration tests pass |

### Phase 3: Release verification

| Task | Exit criteria |
|---|---|
| Data quality review | alignment report reviewed; no hard gate failures |
| Browser migration smoke QA | required project viewports/themes, online/offline |
| Update QA | old SW/cache to new version tested |
| Deploy | Netlify production deploy from `dist/` |
| Rollback drill | documented previous deploy rollback path |

### Phase 4: Russian translations

Separate plan. Do not start without source permissions and license update.

---

## 12. Out of scope

- Full English UI localization.
- New learning adaptation or hidden metrics.
- New analytics, telemetry, remote logging.
- Server state, accounts, backend.
- Russian translations that require permission.
- SSR or mobile native apps.

---

## 13. Final checklist for implementers

Before reporting “готово”:

- `npm test` passed.
- `npm run build:data` passed.
- `npm run verify:data` passed.
- `npm run build` passed.
- Migration smoke checks passed on 375px and 1280px in light/dark themes.
- Data attribution is present in `README.md`, `docs/source-data/CATALOG.md` and About screen.
- No generated data was edited manually.
- UBS-excluded-field smoke check passed.
- Git status and changed files are reported.
