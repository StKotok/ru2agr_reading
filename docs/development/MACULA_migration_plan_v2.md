# MACULA Migration Plan v2 — MACULA-first data architecture

**Date:** 2026-06-17
**Status:** Draft for review
**Supersedes:** `docs/development/MACULA_migration_plan_v1.md`
**Related review:** `docs/development/MACULA_migration_plan_v1_feedback1.md`

---

## 0. Executive summary

v2 changes the migration strategy.

The goal is no longer to adapt MACULA into the old `token.w / token.morph /
token.strong` world. The goal is to build a new MACULA-first data architecture:

1. MACULA becomes the source of truth for Greek text, token IDs, lemmas,
   morphology, Strong numbers, frequencies, forms and references.
2. The old Greek/Zefania/Clear-Bible data becomes a temporary legacy baseline
   for audit and migration only. It is not an oracle of correctness.
3. Runtime PWA data is deliberately compact: top-1000 lexicon data and
   per-book packs are generated from the large canonical layer.
4. The architecture must support future translations, starting with
   Berean Standard Bible, without duplicating the Greek corpus.
5. User data remains stable across data-source changes through app-level
   `lexemeKey`, not raw MACULA hashes.

The migration should be implemented as a sequence of data-model and pipeline
changes first, UI changes second, cleanup last.

---

## 1. Why v1 is replaced

v1 had the right intent but kept too much of the old architecture:

- It treated a MACULA-to-legacy adapter as the first operational bridge.
- It assumed old `alignment` indexes could mostly survive source replacement.
- It mixed three independent concerns: Greek source migration, lexicon
  enrichment, and obsolete-data deletion.
- It did not make the offline PWA data model explicit.
- It did not clearly separate source data, generated canonical data, runtime
  data and user state.

The most important correction: old alignment is not a gold standard.

`DEVELOPMENT_7.md` explicitly says current metrics measure stability, not
the truth of every pair. Manual gold verification and LLM verification were
not completed. Therefore the new plan must build `translation -> MACULA`
alignment as a first-class product of the new pipeline, with its own gates.

---

## 2. Goals

### 2.1 Product goals

- Remove dependency on sources with questionable or unwanted licensing risk.
- Make Greek data authoritative, reproducible and auditable.
- Keep the app fully offline-first.
- Make top-1000 word data available offline, including useful per-word data
  for the dictionary screen and word cards.
- Preserve existing user progress and dictionary data.
- Prepare the architecture for additional translations:
  - current: Synodal Russian (`syn`);
  - future: Berean Standard Bible (`bsb`);
  - later: other translations.

### 2.2 Engineering goals

- Use MACULA-first canonical schemas instead of legacy field names.
- Keep large build/audit artifacts out of the production PWA bundle.
- Keep runtime files small, deterministic and independently cacheable.
- Make every runtime file traceable to source hashes and generator versions.
- Fail closed: if alignment is uncertain, do not show a word replacement.
- Do not weaken data invariants to make migration easier.

---

## 3. Non-goals

- Do not add a backend, accounts, telemetry or remote logging.
- Do not add a framework or state manager.
- Do not implement BSB in this migration. The data model must allow it.
- Do not attempt 100% word alignment coverage. Accuracy is more important.
- Do not replace the curated Russian lexical layer with English MACULA glosses.
- Do not add adaptive learning or hidden learning metrics.
- Do not commit new text sources without explicit license review.

---

## 4. Architectural decisions

### 4.1 MACULA is source of truth for Greek, not for Russian UX

MACULA provides Greek linguistic data:

- Greek surface text;
- token IDs and references;
- lemmas;
- morphology;
- Strong numbers;
- English glosses;
- Louw-Nida / semantic domain metadata;
- frequencies and attested forms derived from the token corpus.

MACULA does not provide the Russian product layer:

- Russian glosses;
- Russian explanations;
- `ruMatches` / `ruExclude`;
- curated pedagogical availability;
- verified Synodal-to-Greek alignment.

Therefore `core.json` remains a curated overlay. It should be enriched with
MACULA IDs, but not replaced by MACULA.

### 4.2 Old alignment is a legacy baseline, not an oracle

During migration, old data may be used to answer questions like:

- Did token counts unexpectedly change?
- Which old user dictionary keys need migration?
- Which old alignment pairs disagree with the new generator?
- Which historical bug patterns should be tested?

But a mismatch with old alignment is not automatically a new error.

The new `syn--sblgnt-macula` alignment must be judged by:

- schema invariants;
- boundary checks;
- monotonicity and duplicate checks;
- gold verses manually verified without looking at current alignment;
- held-out evaluation;
- sampled blind review;
- known TR/SBLGNT textual variation registry.

### 4.3 Runtime data is not full MACULA

Full MACULA-derived data is too large for runtime PWA usage. Current generated
artifacts include very large files such as full token JSONL and verbose
per-book token files. Those are useful for generation and audit, but not for
mobile runtime.

The PWA should receive compact generated packs:

- top-1000 lexicon pack;
- translation book files;
- Greek original book files;
- alignment book files;
- small manifests.

### 4.4 Physical separation matters

`assets/` is Vite `publicDir`; everything there is copied to `dist/`.

Therefore:

- runtime data belongs in `assets/data/**`;
- large canonical/audit data should move out of `assets/`;
- source snapshots should stay in `docs/` or another non-runtime path;
- scripts should generate runtime packs as a final build step.

### 4.5 Stable app keys beat external IDs

User state must not be keyed by raw MACULA hash IDs.

Use:

- `lexemeKey`: stable app-level key used by UI, dictionary and progress;
- `maculaLexemeId`: external MACULA-derived ID for provenance and lookup;
- `tokenId`: source token ID used for alignment and exact token references.

Existing curated keys such as `logos`, `theos`, `kurios` should survive.
New frequency-only words can use a deterministic app key, but the format must
be documented and migrated explicitly.

---

## 5. Data layers

The final architecture has four layers.

### 5.1 Source layer

Purpose: preserve legal provenance and reproducibility inputs.

Suggested target structure:

```text
docs/sources/
├── originals/
│   └── macula-greek/
│       ├── SBLGNT/
│       ├── LICENSE.md
│       └── SOURCE_MANIFEST.json
└── translations/
    ├── syn/
    │   ├── source files or fetch manifest
    │   └── LICENSE.md
    └── bsb/
        ├── source files or fetch manifest
        └── LICENSE.md
```

Current repository paths may be migrated gradually from:

- `docs/macula-greek/`;
- `docs/greek-nt-frequency-sources/`;
- `docs/clear-bible-alignments/`.

Requirements:

- Every source snapshot has a source manifest.
- Every source manifest includes URL, commit/tag if available, SHA-256 of used
  files, license name, license text path and attribution requirements.
- Generated runtime data must reference source manifest IDs.
- Before adding BSB or any other translation, perform a fresh license check and
  commit the license note with the source manifest.

### 5.2 Canonical generated layer

Purpose: large, normalized, auditable output from sources.

Suggested target path:

```text
generated/canonical/
├── originals/
│   └── sblgnt-macula/
│       ├── tokens.jsonl
│       ├── lexemes.json
│       ├── verses.json
│       ├── frequency.json
│       ├── books/*.json
│       ├── source-manifest.json
│       └── build-report.json
├── translations/
│   └── syn/
│       ├── books/*.json
│       ├── source-manifest.json
│       └── build-report.json
└── alignments/
    └── syn--sblgnt-macula/
        ├── books/*.json
        ├── audit-report.json
        ├── gold-report.json
        └── source-manifest.json
```

This layer can be verbose. It is for scripts, tests and audit. It must not be
served to the PWA by accident.

Commit policy to decide before implementation:

- runtime packs in `assets/data/**` are committed;
- source manifests and compact audit reports should be committed;
- huge intermediate files may be regenerated locally if size becomes a problem,
  but the source manifest and generator version must be enough to reproduce them.

### 5.3 Runtime offline layer

Purpose: compact production data for the PWA.

Target structure:

```text
assets/data/
├── data-manifest.json
├── translations.json
├── originals.json
├── lexicon/
│   ├── top1000.full.json
│   └── core.ru.json
├── originals/
│   └── sblgnt-macula/
│       └── books/{bookId}.json
├── translations/
│   ├── syn/
│   │   └── books/{bookId}.json
│   └── bsb/
│       └── books/{bookId}.json
└── align/
    ├── syn--sblgnt-macula/
    │   └── books/{bookId}.json
    └── bsb--sblgnt-macula/
        └── books/{bookId}.json
```

For this migration, only these runtime sets are implemented:

- `originals/sblgnt-macula`;
- `translations/syn`;
- `align/syn--sblgnt-macula`;
- `lexicon/top1000.full.json`;
- `lexicon/core.ru.json`.

`bsb` paths are reserved for future expansion.

### 5.4 User state layer

Purpose: user-owned state in IndexedDB.

This remains separate from static runtime data:

- settings;
- progress;
- dictionary;
- offline installation status;
- data schema migration metadata.

Static data updates must not erase user state.

---

## 6. Identifiers

### 6.1 `translationId`

Stable ID for a translation:

- `syn` — Synodal Russian;
- `bsb` — Berean Standard Bible;
- future examples: `kjv`, `rst-modern`, etc.

### 6.2 `originalId`

Stable ID for the original-language corpus:

- `sblgnt-macula` — SBLGNT via MACULA Greek.

If a future TR-based Greek source is added, it must receive a separate
`originalId`, not overwrite `sblgnt-macula`.

### 6.3 `alignmentId`

Computed relationship between one translation and one original:

```text
{translationId}--{originalId}
```

Examples:

- `syn--sblgnt-macula`;
- `bsb--sblgnt-macula`.

### 6.4 `ref`

Canonical verse reference used across all data:

```text
bookId chapter:verse
```

Example:

```text
john 1:1
```

For translations with different versification, runtime records must preserve:

- canonical app `ref`;
- source translation reference if different;
- textual variant notes where applicable.

### 6.5 `tokenId`

Stable token ID from MACULA source, if available.

Used for:

- alignment references;
- debugging;
- exact word cards in Greek mode;
- future cross-translation comparison.

### 6.6 `lexemeKey`

Stable app-level lexeme key.

Rules:

- Existing curated IDs are preserved: `logos`, `theos`, `kurios`, etc.
- Every top-1000 word must have exactly one `lexemeKey`.
- `lexemeKey` is the key for user dictionary state.
- MACULA IDs are stored as external metadata, not used as user-state keys.

### 6.7 `maculaLexemeId`

Generated MACULA-derived lexeme identifier.

Used for:

- provenance;
- joining with canonical MACULA lexeme data;
- script-level validation.

Not used as the primary user state key.

---

## 7. Runtime schemas

Runtime schemas should be compact but readable. Field names can be shorter than
canonical generated data only where the tradeoff is obvious and documented.

### 7.1 `assets/data/data-manifest.json`

```json
{
  "schema": "data-manifest-v1",
  "version": "2026-06-17-macula-v2",
  "generatedAt": "2026-06-17T00:00:00.000Z",
  "sources": {
    "originals": ["sblgnt-macula"],
    "translations": ["syn"],
    "alignments": ["syn--sblgnt-macula"]
  },
  "runtimeFiles": [
    {
      "path": "data/lexicon/top1000.full.json",
      "sha256": "computed-at-build-time",
      "bytes": 606059,
      "precache": true
    }
  ]
}
```

Notes:

- `generatedAt` may be present in reports, but deterministic runtime builds
  should avoid changing file content unless input data changed.
- If timestamps are needed, put them in audit reports rather than runtime packs.

### 7.2 `assets/data/translations.json`

```json
[
  {
    "id": "syn",
    "language": "ru",
    "title": "Синодальный перевод",
    "shortTitle": "Синод.",
    "direction": "ltr",
    "defaultOriginalId": "sblgnt-macula",
    "license": "Public domain",
    "attribution": "Синодальный перевод; see source manifest"
  }
]
```

Future BSB entry:

```json
{
  "id": "bsb",
  "language": "en",
  "title": "Berean Standard Bible",
  "shortTitle": "BSB",
  "direction": "ltr",
  "defaultOriginalId": "sblgnt-macula",
  "license": "Public domain / verify before import",
  "attribution": "Berean Standard Bible"
}
```

Do not add the BSB data until license and source snapshot are committed.

### 7.3 `assets/data/originals.json`

```json
[
  {
    "id": "sblgnt-macula",
    "language": "grc",
    "title": "SBLGNT via MACULA Greek",
    "shortTitle": "SBLGNT",
    "license": "CC BY 4.0",
    "attribution": "MACULA Greek Linguistic Datasets, available at https://github.com/Clear-Bible/macula-greek/",
    "features": ["tokens", "lemmas", "morphology", "strongs", "frequency"]
  }
]
```

### 7.4 Translation book pack

Path:

```text
assets/data/translations/{translationId}/books/{bookId}.json
```

Schema:

```json
{
  "schema": "translation-book-v1",
  "translationId": "syn",
  "bookId": "john",
  "title": "От Иоанна святое благовествование",
  "short": "Ин",
  "chapters": [
    {
      "n": 1,
      "verses": [
        {
          "ref": "john 1:1",
          "n": 1,
          "text": "В начале было Слово...",
          "words": ["В", "начале", "было", "Слово"]
        }
      ]
    }
  ]
}
```

Notes:

- `words` is generated by the same tokenizer used by alignment.
- Runtime rendering may use `text`; alignment uses `words` indexes.
- If file size is too high, `words` may be omitted and regenerated by the same
  deterministic tokenizer at runtime. Prefer storing it first for auditability.

### 7.5 Greek original book pack

Path:

```text
assets/data/originals/{originalId}/books/{bookId}.json
```

Schema:

```json
{
  "schema": "original-book-v1",
  "originalId": "sblgnt-macula",
  "bookId": "john",
  "title": "ΚΑΤΑ ΙΩΑΝΝΗΝ",
  "chapters": [
    {
      "n": 1,
      "verses": [
        {
          "ref": "john 1:1",
          "n": 1,
          "text": "Ἐν ἀρχῇ ἦν ὁ λόγος...",
          "tokens": [
            {
              "id": "n43001001001",
              "i": 1,
              "s": "Ἐν",
              "lemma": "ἐν",
              "lexemeKey": "en",
              "maculaLexemeId": "grc-en-b54dde",
              "morph": "PREP",
              "strongs": ["1722"],
              "pos": "preposition",
              "fw": true
            }
          ]
        }
      ]
    }
  ]
}
```

Field notes:

- `id` is MACULA token ID.
- `i` is token index within verse, 1-based if MACULA source uses 1-based.
- `s` is surface form.
- `fw` means function word.
- `strongs` is always an array.
- Complex Strong expressions such as `5228+1537+4053` must be preserved. A
  script may additionally expose parsed `strongParts`, but must not silently
  coerce to a single number.

### 7.6 Alignment book pack

Path:

```text
assets/data/align/{alignmentId}/books/{bookId}.json
```

Schema:

```json
{
  "schema": "alignment-book-v1",
  "alignmentId": "syn--sblgnt-macula",
  "translationId": "syn",
  "originalId": "sblgnt-macula",
  "bookId": "john",
  "pairsByRef": {
    "john 1:1": [
      {
        "r": 3,
        "g": 4,
        "tokenId": "n43001001005",
        "lexemeKey": "logos",
        "q": "e",
        "src": "strong"
      }
    ]
  }
}
```

Quality levels:

- `e` — exact lexical correspondence, visible in normal modes;
- `f` — functional correspondence, visible but may be styled as lower confidence;
- `u` — uncertain; kept for audit, hidden from user replacements.

Runtime replacement modes use only `e` and, if product decision allows, `f`.
They never use `u`.

### 7.7 Top-1000 lexicon pack

Path:

```text
assets/data/lexicon/top1000.full.json
```

This file must be offline available by default.

Schema:

```json
{
  "schema": "top1000-lexicon-v1",
  "originalId": "sblgnt-macula",
  "items": [
    {
      "lexemeKey": "logos",
      "maculaLexemeId": "grc-logos-04b1f3",
      "lemma": "λόγος",
      "search": "λογος",
      "translit": "logos",
      "strongs": ["3056"],
      "rank": 55,
      "count": 330,
      "verseCount": 318,
      "pos": "noun",
      "isFunctionWord": false,
      "hasAlignment": true,
      "glossRu": "слово, речь, смысл",
      "glossEn": ["word", "speech", "message"],
      "forms": [
        {
          "s": "λόγος",
          "count": 60,
          "morph": ["N-NSM"]
        }
      ],
      "refs": ["john 1:1", "john 1:14", "acts 6:2"],
      "domains": ["033005"]
    }
  ]
}
```

Rules:

- Exactly top 1000 by MACULA token frequency unless a future product decision
  changes the cutoff.
- Every item has `lexemeKey`.
- Curated Russian fields are included where available.
- English MACULA glosses may be included as secondary data, not as Russian UI
  replacements.
- `hasAlignment` means there is at least one visible `e` or `f` alignment pair
  in the currently shipped default translation alignment.
- The dictionary screen can render fully offline from this file.

### 7.8 Curated Russian overlay

Path:

```text
assets/data/lexicon/core.ru.json
```

Schema:

```json
{
  "schema": "core-ru-v1",
  "items": [
    {
      "lexemeKey": "logos",
      "maculaLexemeId": "grc-logos-04b1f3",
      "lemma": "λόγος",
      "translit": "logos",
      "strongs": ["3056"],
      "gloss": "слово, речь, смысл",
      "pos": "сущ., муж. род",
      "ruMatches": ["(?<![а-яё])слов(о|а|у|е|ом|ах|ами)(?![а-яё])"],
      "ruExclude": ["словно", "условие", "словарь"],
      "refs": ["Ин 1:1", "Ин 1:14", "Деян 6:2", "Рим 10:17"]
    }
  ]
}
```

This file is product curation. It is not fully generated from MACULA.

---

## 8. Offline PWA caching model

### 8.1 Always-offline files

These should be precached with the app shell:

- app JS/CSS/fonts/icons;
- `data/data-manifest.json`;
- `data/translations.json`;
- `data/originals.json`;
- `data/books.json` or its replacement;
- `data/lexicon/top1000.full.json`;
- `data/lexicon/core.ru.json`;
- `data/alphabet.json`.

Rationale: the dictionary and basic UI should work offline even before the user
opens a specific book.

### 8.2 Per-book offline groups

For a selected translation/original pair, a book is offline-ready only if all
required files are cached:

```text
translations/{translationId}/books/{bookId}.json
originals/{originalId}/books/{bookId}.json
align/{translationId}--{originalId}/books/{bookId}.json
```

Example:

```text
translations/syn/books/john.json
originals/sblgnt-macula/books/john.json
align/syn--sblgnt-macula/books/john.json
```

### 8.3 Offline install status

IndexedDB may store:

```js
{
  dataVersion: '2026-06-17-macula-v2',
  installedBooks: {
    'syn--sblgnt-macula:john': {
      status: 'ready',
      files: {
        translation: { sha256: 'computed-translation-book-sha256' },
        original: { sha256: 'computed-original-book-sha256' },
        alignment: { sha256: 'computed-alignment-book-sha256' }
      },
      installedAt: '2026-06-17'
    }
  }
}
```

This is cache status only. It can be rebuilt by checking Cache Storage and the
runtime manifest. It is not user progress.

### 8.4 Update behavior

On data manifest version change:

1. Keep user state.
2. Mark installed book packs stale if SHA differs.
3. Revalidate in background when online.
4. If a stale pack is incomplete, degrade gracefully:
   - reading text still works if translation book is present;
   - Greek modes degrade to letters/plain if original/alignment is missing;
   - dictionary still works from top-1000 pack.

---

## 9. Future translations

Adding a translation must not duplicate the Greek original or top-1000 lexicon.

To add BSB later:

1. Add source snapshot and license manifest.
2. Generate `translations/bsb/books/*.json`.
3. Generate `align/bsb--sblgnt-macula/books/*.json`.
4. Add `bsb` entry to `translations.json`.
5. Add UI for translation selection.
6. Add offline group installation for `bsb--sblgnt-macula`.

The same `originals/sblgnt-macula/books/*.json` and
`lexicon/top1000.full.json` are reused.

Translation-specific alignment must be independent:

- `syn--sblgnt-macula` may have TR/SBLGNT gaps;
- `bsb--sblgnt-macula` may align more directly to SBLGNT/Majority traditions
  depending on source text and licensing;
- each alignment has its own verification report.

---

## 10. Pipeline plan

### Phase 0 — Source freeze and branch hygiene

- Create migration branch from `dev*`.
- Run baseline checks:
  - `npm test`;
  - `npm run build`;
  - current `npm run build:data` if needed to confirm legacy state.
- Record current legacy data state.
- Do not delete legacy data yet.

Done when:

- baseline checks are recorded;
- source manifests for current MACULA snapshot exist;
- license/attribution text is committed.

### Phase 1 — Define schemas and generators

- Add schema docs or JSON schemas for:
  - canonical original tokens;
  - runtime original book;
  - runtime translation book;
  - runtime alignment book;
  - top-1000 lexicon;
  - source manifest.
- Move or plan movement of large generated data out of `assets/`.
- Update `build-macula` or create new generator modules:
  - canonical original;
  - runtime original packs;
  - top-1000 lexicon pack.

Done when:

- generated runtime files validate against schemas;
- generated files are deterministic;
- large files no longer enter `dist` accidentally.

### Phase 2 — Generate Synodal translation runtime packs

- Keep existing Synodal source pipeline if license is accepted.
- Generate `translations/syn/books/*.json`.
- Use deterministic word tokenization.
- Preserve verse references and record known versification anomalies.

Done when:

- all 27 Synodal books validate;
- generated `words` indexes match alignment tokenizer;
- textual variant registry is available for alignment verification.

### Phase 3 — Build new `syn--sblgnt-macula` alignment

- Build alignment from Synodal runtime books to MACULA original packs.
- Use MACULA token IDs, lemmas, morphology and Strong arrays.
- Preserve `q` quality levels.
- Preserve uncertain pairs as `u`, but do not expose them to replacement.
- Do not copy old alignment blindly.

Done when:

- all alignment files validate;
- no out-of-bounds references;
- no duplicate visible `r` or `g` pairs per verse unless explicitly allowed;
- every pair references an existing MACULA `tokenId`;
- alignment report classifies all known orphan patterns.

### Phase 4 — Verification gates

Required gates:

1. Invariants:
   - schema;
   - token references;
   - word indexes;
   - duplicate checks;
   - deterministic output.
2. Gold set:
   - manually verified gold-dev and gold-heldout;
   - no confirmation bias from current alignment.
3. Sampled blind review:
   - random sample of visible pairs;
   - compare independent alignment to generated alignment;
   - adjudicate disagreements.
4. Textual variants:
   - known TR/SBLGNT gaps registered;
   - orphan words in variant regions explained.
5. Regression comparison:
   - compare with legacy alignment for investigation only;
   - do not require equality with legacy output.

Done when:

- precision/recall thresholds are explicitly met on held-out;
- sampled blind review has acceptable confirmed-error rate;
- all unexplained high-risk orphan categories are resolved or hidden.

### Phase 5 — User dictionary migration

- Build old-key to `lexemeKey` mapping:
  - curated core IDs remain stable where possible;
  - `freq-*` entries are mapped explicitly through Strong/MACULA lexeme data.
- Add data schema migration for IndexedDB dictionary.
- Keep fail-soft behavior:
  - unknown old key remains in dictionary but is not shown in text until resolved;
  - do not delete user entries silently.

Done when:

- tests cover old core IDs;
- tests cover `freq-*` entries;
- tests cover unknown keys;
- user settings/progress/dictionary survive reload.

### Phase 6 — Runtime loader and engine switch

- Update loaders for:
  - translations;
  - originals;
  - alignments;
  - top-1000 lexicon.
- Update engine to consume native runtime schemas:
  - `surface`;
  - `morph`;
  - `strongs`;
  - `lexemeKey`;
  - `tokenId`.
- Keep `src/engine/**` pure.
- Keep UI storage access through existing storage wrappers.

Done when:

- modes 1-5 work from new runtime files;
- mode 3/4 replacements use only verified alignment;
- mode 5 uses MACULA original book pack;
- missing Greek/alignment data degrades gracefully.

### Phase 7 — Offline PWA behavior

- Update Workbox runtime caching.
- Precache top-1000 lexicon and core Russian overlay.
- Implement per-book dependency caching:
  - translation;
  - original;
  - alignment.
- Add or update offline install UI only if in scope for the implementation
  task. Otherwise ensure existing lazy cache behavior works.

Done when:

- opened book works offline in all supported modes;
- dictionary top-1000 works offline before any book is opened;
- app can detect incomplete book packs and degrade safely.

### Phase 8 — Documentation and attribution

- Update README data-source section.
- Update `DEVELOPMENT_1.md` source/pipeline sections or add a clear note that
  v2 supersedes old sections.
- Update About screen attribution if present.
- Add MACULA attribution text.
- Document BSB future path without shipping BSB data yet.

Done when:

- source and generated runtime provenance are discoverable;
- license notes are committed;
- user-visible attribution is present where required.

### Phase 9 — Legacy cleanup

Only after all gates pass:

- remove obsolete Zefania/Clear-Bible scripts;
- remove obsolete generated Greek data;
- remove obsolete docs/source snapshots with questionable licensing;
- remove old runtime paths;
- update package scripts.

Do not delete legacy data before:

- new runtime data works;
- verification reports pass;
- user migration is tested;
- production build passes.

---

## 11. Test and verification matrix

### Data generation

- `npm run build:macula` or replacement command passes.
- Runtime data generation command passes.
- Data schemas validate.
- Determinism test: same inputs produce same runtime output.
- Source manifest SHA matches actual source file contents.

### Engine and state

- `npm test` passes.
- Form-layer tests cover:
  - `strongs` arrays;
  - complex Strong expressions;
  - missing alignment;
  - `q=u` hidden;
  - morphology code parsing.
- Dictionary migration tests cover old and new keys.

### PWA build

- `npm run build` passes.
- `dist/` does not include canonical huge generated files.
- Runtime files under `assets/data/**` are expected and bounded in size.

### Manual QA

Required widths/themes:

- 375px light;
- 375px dark;
- 1280px light;
- 1280px dark.

Required flows:

- reading mode 1;
- reading mode 2;
- mode 3 dictionary lemma replacement;
- mode 4 real form replacement;
- mode 5 Greek text;
- dictionary top-1000 browsing offline;
- word card from text;
- word card from dictionary;
- app reload offline.

---

## 12. Size budget

Targets for runtime PWA data:

- top-1000 full lexicon: preferably under 1 MB uncompressed;
- per-book original packs: compact enough for mobile parse time;
- per-book translation/alignment packs: loaded lazily;
- full NT offline install: acceptable for explicit user action, not forced on
  first load.

The current verbose generated MACULA files are not acceptable as runtime files.
The generator must produce compact packs from canonical data.

---

## 13. Rollback strategy

Rollback should be data-path based, not a long-term feature flag in product UI.

During migration:

- keep legacy data paths until new runtime paths pass all gates;
- keep the old production behavior available on the branch until the switch
  commit;
- switch loaders in one focused phase after runtime data is generated and
  verified.

After release:

- do not keep a user-visible old/new data selector;
- keep data schema migration fail-soft;
- if new data fails to load, degrade to plain reading/letter layer rather than
  showing unverified replacements.

---

## 14. Risks

### 14.1 Alignment truth risk

Risk: generated alignment looks structurally valid but contains wrong pairs.

Mitigation:

- gold-heldout;
- sampled blind review;
- `q=u` hidden by default;
- fail closed on uncertain matches.

### 14.2 Runtime size risk

Risk: PWA becomes too large or slow on mobile.

Mitigation:

- compact runtime packs;
- keep canonical data out of `assets/`;
- top-1000 precache only, books lazy;
- explicit full-offline install.

### 14.3 User data migration risk

Risk: user dictionary keys no longer resolve.

Mitigation:

- app-level `lexemeKey`;
- old-to-new mapping;
- no silent deletion;
- migration tests.

### 14.4 Future translation coupling

Risk: Synodal assumptions leak into common Greek models.

Mitigation:

- separate `translationId`, `originalId`, `alignmentId`;
- per-translation alignment;
- no translation-specific fields in original book packs.

### 14.5 License/provenance drift

Risk: generated data cannot be traced to exact source/license.

Mitigation:

- source manifests;
- SHA checks;
- attribution text;
- no new text source without license review.

---

## 15. Done criteria

The migration is complete only when:

- MACULA source manifests and attribution are committed.
- Runtime data is generated from MACULA-first canonical data.
- Top-1000 lexicon works offline.
- All 27 Synodal books have runtime translation/original/alignment packs.
- `syn--sblgnt-macula` alignment passes verification gates.
- Modes 1-5 work with new runtime data.
- User dictionary migration is tested.
- `npm test` passes.
- `npm run build` passes.
- `npm run build:data` or its replacement passes.
- Manual QA passes on mobile and desktop, light and dark.
- `dist/` does not contain large canonical/audit-only MACULA files.
- Legacy questionable data/scripts are removed only after successful switch.

---

## 16. Suggested commit breakdown

1. `docs: add MACULA migration plan v2`
2. `build: define MACULA runtime schemas`
3. `build: generate compact MACULA original packs`
4. `build: generate top1000 offline lexicon pack`
5. `build: generate Synodal runtime translation packs`
6. `build: generate syn-macula alignment packs`
7. `test: add MACULA data verification gates`
8. `feat: load runtime translation/original/alignment packs`
9. `feat: migrate dictionary keys to lexemeKey`
10. `feat: cache top1000 and per-book offline packs`
11. `docs: update data-source attribution`
12. `chore: remove legacy data pipeline`

Commit boundaries may change, but cleanup must remain last.

---

## 17. Immediate next step

Review and approve this v2 plan.

After approval, create an implementation plan focused on Phase 1:

- exact target paths;
- exact schemas;
- generator entrypoints;
- tests for generated runtime packs;
- migration strategy for moving large generated data out of `assets/`.
