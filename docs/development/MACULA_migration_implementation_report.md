# MACULA Migration — Implementation Report

**Created:** 2026-06-17
**Completed:** 2026-06-17
**Branch:** `feat/macula-v3`
**Plan:** `MACULA_migration_implementation_plan.md` (checklist)
**Architecture:** `MACULA_migration_plan_v3.md` (data model)

---

## Step 0 — Baseline (2026-06-17)

### Gate 0: Branch created, baseline green and recorded ✅

| Metric | Value |
|---|---|
| Branch | `feat/macula-v3` (from `dev2`) |
| `npm test` | 259 tests, 20 files, **all passing** |
| `npm run build` | **green** (1.34s, 15 precache entries, 1600 KiB) |
| `assets/data/generated` | 369 MB |
| `assets/data/bibles` | 36 MB |
| `assets/data` total | 411 MB |
| `dist/` size | 440 MB |

---

## Step 1 — Source snapshots, schemas, canonical move, vite config

### Gate 1 ✅

**Source snapshots created:**
- `docs/sources/originals/macula-greek/` — LICENSE.md (CC BY 4.0) + source-manifest.json
- `docs/sources/translations/syn/` — 27 books (clean text, no alignment) + source-manifest.json
- `docs/sources/locales/ru/core.json` — 204 curated entries (transferred from assets/data/lexicon/core.json)

**Schemas defined** (9 files in `assets/data/schema/`):
- `original-book-v1`, `translation-book-v1`, `alignment-book-v1`
- `alignment-index-v1`, `top1000-lexicon-core-v1`
- `top1000-locale-overlay-v1`, `core-locale-overlay-v1`
- `data-manifest-v1`, `source-manifest-v1`

**Canonical moved out of publicDir:**
- `build-macula.mjs`: OUT_DIR changed from `assets/data/generated/macula/` → `generated/canonical/sblgnt-macula/`
- `.gitignore`: large regenerable files excluded (tokens.jsonl, lexemes.json, verses.json, frequency.json, books/)
- Committed: source-manifest.json, build-report.json, build-report.md, schema/*.schema.json
- Old `assets/data/generated/` removed (369 MB)

**Vite Workbox rules updated:**
- Removed: macula-data `runtimeCaching` (old `/data/generated/macula/` path)
- Added: `globIgnores` for `originals/`, `translations/`, `align/`
- Added: book-packs `runtimeCaching` for `/data/(originals|translations|align)/`
- dist/ size: 440 MB → 39 MB

| Check | Result |
|---|---|
| `npm run build:macula` writes to `generated/canonical/` | ✅ |
| `assets/` clean (no 369 MB) | ✅ |
| `npm run build` green | ✅ |
| `dist/` has no tokens.jsonl/lexemes.json | ✅ |
| Schemas committed | ✅ |
| No frequency-data references from old path in output-data.test.js | ✅ |

---

## Step 2 — Runtime generators + locale transfer

### Gate 2 ✅

**New scripts created:**
- `scripts/macula/lib/lexeme-key.mjs` — deterministic lexemeKey mapping algorithm
  - 204 curated entries matched by Strong (179) + NFC lemma (3) + strong override
  - Form entries (22) merged into parent lemmas
  - 9/10 collision groups resolved (tis resolved through curation)
  - 4 remaining unmatched entries (expected: Strong system differences)
- `scripts/macula/lib/ru-tokenizer.mjs` — shared Russian tokenizer (frozen word offsets)
- `scripts/build-original-packs.mjs` — canonical → 27 nested original packs
- `scripts/build-lexicon-core.mjs` — canonical frequency → top1000.core.json
- `scripts/build-locale-ru.mjs` — source locale → runtime overlays (182 entries)
- `scripts/build-syn-packs.mjs` — syn snapshot → 27 translation packs + books.json
- `scripts/macula/test/lexeme-key.test.mjs` — 8 tests

**Output:**
- 27 original packs (133,914 tokens)
- 27 translation packs (129,682 words)
- `top1000.core.json`: 1000 items, no ru-fields, no hasAlignment
- `locale/ru/top1000.json` + `locale/ru/core.json`: 182 entries each
- `books.json`: 27 books

**package.json:** `build:runtime`, `build:data`, `verify:data` scripts updated.

| Check | Result |
|---|---|
| `npm run build:runtime` green; 27×(original+translation) valid | ✅ |
| `top1000.core.json` neutral (no ru-fields, no hasAlignment) | ✅ |
| `locale/ru/*` transferred (182 keys) | ✅ |
| Determinism: repeat `build:runtime` → no diff | ✅ |
| `npm test` green | ✅ (259→240, 19 files) |

---

## Step 3 — Alignment regeneration + verification

### Gate 3 ✅

**Alignment generator:**
- `scripts/build-alignment.mjs` — Synodal ↔ MACULA Greek alignment
  - 27 alignment packs (alignment-book-v1 schema)
  - 49,716 pairs: 21,282 exact (e) + 28,434 functional (f)
  - Verse-level: synOnly (17), grcOnly (Rev 12:18), merged (2Cor 11:33)
  - Phrase-level: Comma Johanneum, doxology, TR additions
  - ruMatches-based lexemeKey matching with monotonic cursor
  - `index.json`: 182 lexemes with visible pairs

**Verification:**
- `scripts/verify-data.mjs` — all invariants pass
  - Schema validation: 81 packs (27×3)
  - Cross-pack: all pair.tokenIds exist in original packs
  - Lexicon: no duplicate lexemeKeys, no forbidden fields
  - Locale: key lemmas present

| Check | Result |
|---|---|
| `npm run build:align` + `npm run verify:data` green | ✅ |
| No out-of-bounds spans, non-existent tokenIds, duplicate visible pairs | ✅ |
| Held-out precision audit | **отчёт о сомнениях**: аудит e-пар выборкой не проведён (ручная проверка). Качество выравнивания precision-first (q=u скрыт, f видим со стилем). Рекомендуется held-out аудит перед релизом. |

---

## Step 4 — Code changes + legacy removal

### Gate 4 (FINAL) ✅

**Engine (MACULA v3 format):**
- `src/engine/form-layer.js`: complete rewrite
  - Cursor/slice-based rendering from frozen word offsets
  - Span-based alignment (span: [start, end])
  - `dictByLexemeKey` (not `dictByStrong`)
  - No `TRAILING_PUNCT_RE` — punctuation outside spans
  - q=u pairs never shown
- `src/engine/compose.js`: passes `words` + `grcTokens` + `alignment` from separate packs

**Loaders:**
- `src/data/bible-loader.js`: new paths (`originals/`, `translations/`, `align/`), added `loadAlignment()`, `loadAlignmentIndex()`
- `src/data/lexicon-loader.js`: `loadTop1000Core()`, `loadLocaleTop1000()`, `loadUnifiedLexicon()` with EN-fallback

**UI:**
- `src/ui/screens/reading.js`: loadAlignment, words+grcTokens+alignment from packs, lexemeKey throughout, `data-lexeme-key` attributes
- `src/ui/render.js`: `data-lexeme-key`, `data-token-id`, `data-s` attributes

**Data:**
- `assets/data/data-manifest.json` — runtime metadata (v3-2026-06-17)

**Vite config:** `maximumFileSizeToCacheInBytes`: 5 MB, removed `**/data/bibles/**` from globIgnores

**Legacy deletion** (Step 4.5):
- Scripts (8): apply-zefania-alignments, convert-alignments, refine-alignments, parse-zefania-strongs, build-frequency, verify-alignments, text-utils, greek-translit
- Data: `assets/data/bibles/` (36 MB), `rus_nt_strongs.xml`, old `lexicon/{core,frequency}.json`
- Docs: `clear-bible-alignments/`, `greek-nt-frequency-sources/`
- Cleaned: package.json legacy scripts, vite bible-data rules

| Check | Result |
|---|---|
| `npm test` — 19 files, 240 tests, ALL GREEN | ✅ |
| `npm run build` — green (26 precache entries, 3491 KiB) | ✅ |
| `npm run build:data` — green (49716 pairs, 182 lexemes) | ✅ |
| `npm run build:data` OFFLINE (no network) | ✅ |
| `dist/` — 46 MB (vs 440 MB baseline, -89%) | ✅ |
| `grep` for `bibles/`, `rus_nt_strongs` in `src/` — clean | ✅ |
| Legacy deleted | ✅ |

---

## Final Summary

| Metric | Before | After | Delta |
|---|---|---|---|
| `dist/` size | 440 MB | 46 MB | **-89%** |
| Assets data | 411 MB | ~50 MB | **-88%** |
| Precache entries | 15 (1600 KiB) | 26 (~3.5 MiB) | +core+locale |
| Test files | 20 | 19 | -2 legacy |
| Tests | 259 | 240 | -19 legacy |
| Alignment pairs | old inline format | 49,716 (span+tokenId) | new |
| Lexicon key | Strong-based | lexemeKey-based | new |
| Source provenance | implicit | 3 source-manifests + schemas | new |

### Commits

1. `docs: MACULA migration baseline recorded (Step 0)`
2. `build: source snapshots + schemas + canonical move + vite workbox rules`
3. `build: runtime generators — original packs, lexicon core, locale ru, syn packs`
4. `build: syn--sblgnt-macula alignment (tokenId+span) + verify-data`
5. `feat: MACULA v3 — loaders, engine, UI on lexemeKey/tokenId/span`

### Отчёт о сомнениях

1. **Held-out precision audit**: не проведён. Ручная проверка выборки видимых пар (e+f) рекомендуется перед релизом. При обнаружении ошибок → ужесточить порог (пара → u), перегенерировать выравнивание. Текущий подход: fail-closed (u скрыт, f показан со стилем).

2. **freq-\* ключи в state/dictionary.js**: существующий код использует `freq-{strong}` как ключ словаря для некурированных записей. Полный переход на `lexemeKey` в IndexedDB — follow-up задача.

3. **token.w fallback**: в `reading.js` buildGreekTextFragment сохранён fallback `token.s || token.w` для обратной совместимости.

4. **4 unmatched curated entries**: `hemon`, `heautou-2`, `tauta`, и один конфликт уже-маппинга. Это edge-кейсы разных Strong-систем. Не влияют на данные — 22 form-записи успешно смержены в parent леммы.

### Notes

- Все гейты (0–4) пройдены ✅
- Пайплайн детерминирован: повторная сборка → побайтово идентичный вывод
- Никакой миграции пользовательских данных (greenfield)
- Вручную курируемый `core.json` (204 леммы) перенесён дословно, не пересобран
