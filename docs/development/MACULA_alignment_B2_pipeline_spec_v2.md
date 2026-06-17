# MACULA Alignment B2 Pipeline Spec v2

**Date:** 2026-06-18  
**Status:** к утверждению перед имплементацией  
**Scope:** только слой данных выравнивания `syn--sblgnt-macula`; UI P0 и словарь
чинятся отдельным треком, но runtime-контракты ниже обязательны.

---

## 0. Решение v2 в одном абзаце

Мы больше не восстанавливаем старый B-пайплайн как был. RusVZh не используется.
Новый B2-v2 строится как **certified-only** пайплайн:

1. генератор создаёт широкий слой кандидатов;
2. все кандидаты по умолчанию скрыты (`q:"u"`);
3. видимой может стать только пара с `q:"e"` и проверяемым proof;
4. `q:"f"` пока тоже скрыт и не считается видимым;
5. LLM-аудит используется для поиска ошибок и конфликтов, но не является
   самостоятельным источником истины для повышения пары в `q:"e"`;
6. цель релиза: **0 подтверждённых ошибок среди видимых пар**, даже если recall
   на первом этапе заметно ниже старого.

Если пункт выше конфликтует с любым старым документом, этот документ главнее для
выравнивания.

---

## 1. Что v2 supersede-ит

Этот документ заменяет для слоя alignment:

- `MACULA_alignment_B2_pipeline_spec.md` v1 целиком, если он есть в рабочем
  дереве или в истории;
- `MACULA_migration_implementation_plan.md` §3.2-3.4 в части генерации,
  качества и аудита выравнивания.

Не заменяет:

- `MACULA_migration_plan_v3.md` как модель source/canonical/runtime слоёв;
- `alignment-book-v1` как runtime-формат;
- `AGENTS.md` как правила работы;
- необходимость исправить UI P0 до релиза.

---

## 2. Непереговорные решения

- **RusVZh запрещён.** Не восстанавливать `rus_nt_strongs.xml`; не коммитить его
  в `docs/sources`; не использовать как build-time вход.
- `data-sources/strongs-ru-alignment.json` не является заменой RusVZh. Это
  агрегат форм без стиха и позиции; его можно использовать только как слабый
  candidate source.
- Видимые пары в runtime: только `q:"e"`.
- `q:"f"` и `q:"u"` скрыты в UI до отдельного решения.
- Candidate generation не имеет права создавать видимые пары.
- Любая видимая пара обязана иметь proof в отчётах пайплайна.
- LLM не повышает пару в `q:"e"` сама. LLM может:
  - предложить кандидата;
  - найти ошибку;
  - потребовать понижения в `q:"u"`;
  - отправить конфликт на ручную адъюдикацию.
- Старые `gold-*.json` нельзя auto-re-key и считать эталоном. Они являются
  списком стихов и историческим контекстом, пока человек заново не подтвердит
  каждую пару.
- Runtime не должен содержать UBS/MARBLE-derived поля (`domains`, Louw-Nida
  domain labels, UBS dictionary senses). Для приватного репозитория хранение
  build-only исходников возможно только после provenance-документации; лучше
  получить письменное подтверждение прав.
- `build:data` и `build:align` должны быть полностью offline и
  детерминированными. Они не вызывают LLM, сеть или живые API.
- LLM-аудит запускается отдельным prepare/import workflow. Отсутствие LLM API
  не должно ломать deterministic build, но release нельзя считать готовым без
  импортированных audit/adjudication reports.

---

## 2.1 Claude Code execution contract

Этот раздел написан как прямое ТЗ для Claude Code. Во время имплементации
исполнитель обязан следовать ему буквально.

### Read first

Перед любым изменением Claude Code должен прочитать:

1. `AGENTS.md`;
2. этот документ целиком;
3. `docs/development/MACULA_migration_plan_v3.md`;
4. `docs/development/MACULA_migration_implementation_plan.md`;
5. текущие `scripts/build-alignment.mjs`, `scripts/verify-data.mjs`,
   `src/engine/form-layer.js`, `src/engine/compose.js`.

### Work rules

- Не начинать с "улучшения recall". Сначала закрыть proof/verifier/gates.
- Не удалять старый alignment-код до появления нового verifier и зелёного
  deterministic build.
- Не создавать новый источник истины в UI. Истина о видимости только в
  `pair.q`, где видимое в v2 только `q:"e"`.
- Не использовать heldout при разработке certifier-правил.
- Не править generated runtime JSON руками.
- Любая неоднозначность означает hidden candidate, а не видимую пару.
- Если требование кажется слишком строгим, не ослаблять его молча. Зафиксировать
  blocker в отчёте и остановить соответствующий gate.

### Required implementation order

1. Сначала добавить schemas/reports/verifier gates.
2. Затем удалить runtime `domains` и закрыть license/provenance gate.
3. Затем gold re-attestation scaffolding.
4. Затем candidate generator.
5. Затем certification.
6. Затем runtime writer.
7. Затем LLM audit prepare/import.
8. В конце только QA/build/test.

Запрещено начинать с runtime writer или UI-подключения: это создаёт риск
показать непроверенные пары.

---

## 3. Термины

**Candidate pair**  
Потенциальное соответствие русского span и греческого tokenId. Кандидат не
видим пользователю.

**Certified pair**  
Кандидат, прошедший один из явно описанных certifier-правил и не оспоренный
верификатором, gold-аудитом, LLM-аудитом или ручной адъюдикацией.

**Visible pair**  
Runtime-пара с `q:"e"`. Только такие пары участвуют в режимах 3-4 и подсветке.

**Hidden pair**  
Runtime-пара с `q:"f"` или `q:"u"`, либо кандидат, не попавший в runtime. На
этом этапе `q:"f"` считается hidden.

**Proof**  
Машиночитаемая запись, объясняющая, почему конкретная пара получила `q:"e"`.
Proof хранится в `generated/canonical/alignments/.../proof-report.json`, а не
обязательно в runtime pack.

**Release blocker**  
Любой unresolved conflict, missing proof, license gap, invalid manifest,
runtime UBS/MARBLE leakage, failed build, failed test, failed verifier, or
manual-review item. Release blocker нельзя закрывать "заметкой"; он должен быть
исправлен или явно снят отдельным решением владельца проекта.

---

## 4. Источники данных

### 4.1 Разрешённые runtime/build источники

- Синодальный перевод из committed snapshot `docs/sources/translations/syn`.
- MACULA/SBLGNT original packs, но без runtime-полей MARBLE/UBS.
- Ручная русская курация `docs/sources/locales/ru/core.json`.
- `assets/data/textual-variants.json`.
- Старые `test/fixtures/gold-dev.json` и `gold-heldout.json` только как список
  стихов, черновой исторический материал и источник для ручной переаттестации.
- `data-sources/strongs-ru-alignment.json` только как weak candidate source,
  если его provenance задокументирован.

### 4.2 Запрещённые источники

- RusVZh / `rus_nt_strongs.xml`.
- Любые данные с неясной лицензией.
- UBS/MARBLE-derived runtime fields.
- Автоматически сгенерированный русский Strong-per-word слой без ручного аудита
  и provenance.

### 4.3 UBS/MARBLE provenance policy

Минимальное требование перед релизом:

- runtime `assets/data/**` и `dist/**` не содержат `domains`, LN-коды, UBS
  senses, MARBLE labels;
- source manifest фиксирует, что MACULA содержит MARBLE `@ln/@domain` как
  "used with permission";
- если build-only UBS/MARBLE файлы остаются в приватном репозитории, добавить
  `docs/sources/licenses/ubs-marble-storage-note.md`:
  - источник файла;
  - дата проверки;
  - ссылка на upstream license/provenance;
  - область использования: private build cache only, not runtime.

Желательное требование:

- получить письменное разрешение/подтверждение от Clear Bible/Biblica или UBS
  на хранение и build-time использование MARBLE-derived полей в приватном
  репозитории.

---

## 5. Runtime contract

Runtime alignment остаётся `alignment-book-v1`:

```json
{
  "schema": "alignment-book-v1",
  "alignmentId": "syn--sblgnt-macula",
  "translationId": "syn",
  "originalId": "sblgnt-macula",
  "bookId": "john",
  "verses": {
    "john 1:1": { "syn": "1:1", "grc": "1:1", "status": "paired" }
  },
  "pairsByRef": {
    "john 1:1": [
      {
        "span": [11, 16],
        "tokenId": "n43001001005",
        "lexemeKey": "logos",
        "q": "e",
        "src": "certified:manual-dev-gold"
      }
    ]
  },
  "phraseVariantsByRef": {}
}
```

Rules:

- `span` всегда режется из `translation.verse.text` через `slice(start,end)`.
- Runtime никогда не делает `split(/\s+/)` для выравнивания.
- `pairsByRef[ref]` отсортирован по `span[0]`, затем `span[1]`, затем
  `token.i`.
- Runtime UI показывает только `q:"e"`.
- `q:"f"` и `q:"u"` должны быть сохранены только если это полезно для будущего
  аудита; UI обязан их скрывать.
- `index.json.lexemesWithVisiblePair` содержит только lexemeKey с минимум одной
  парой `q:"e"`.
- `token.fw` не используется UI для решения видимости. Видимость задаётся только
  `pair.q`.

---

## 6. Pipeline overview

```text
Step 0: provenance/license gate
  |
  v
Step 1: gold re-attestation
  |
  v
Step 2: candidate generation (all hidden)
  |
  v
Step 3: deterministic certification (u -> e only with proof)
  |
  v
Step 4: multi-agent LLM audit (find errors, conflicts, missing proof)
  |
  v
Step 5: human adjudication of conflicts
  |
  v
Step 6: runtime pack writer
  |
  v
Step 7: verifier and reports gate
```

`build:align` must run all deterministic steps offline. LLM audit can be a
separate command because it may require external models. Release status cannot
be "ready" until LLM audit reports exist and all conflicts are resolved.

### Command topology

Use these command names unless there is a strong local reason not to. If names
change, update this section in the same commit.

```json
{
  "build:align:candidates": "node scripts/build-alignment-candidates.mjs",
  "build:align:certify": "node scripts/certify-alignments.mjs",
  "build:align:write": "node scripts/write-alignment-packs.mjs",
  "build:align": "npm run build:align:candidates && npm run build:align:certify && npm run build:align:write && npm run verify:align",
  "verify:align": "node scripts/verify-alignment-v2.mjs",
  "audit:align:prepare": "node scripts/prepare-alignment-llm-audit.mjs",
  "audit:align:import": "node scripts/import-alignment-llm-audit.mjs",
  "build:data": "npm run build:runtime && npm run build:align && npm run verify:data"
}
```

Rules:

- `build:align:*`, `verify:align`, `verify:data`, and `build:data` are offline.
- `audit:align:prepare` is offline and writes prompt input JSON files.
- `audit:align:import` is offline and validates JSON outputs produced by
  external LLM runs.
- No npm script may call an LLM API or a live Bible/API endpoint.
- If LLM outputs are absent, deterministic commands still pass, but
  `audit-report.json` must mark release status as `blocked:llm-audit-missing`.

### Canonical alignment artifact tree

Use this tree exactly unless changed in this document:

```text
generated/canonical/alignments/syn--sblgnt-macula/
  candidates.jsonl                  # may be gitignored if large
  candidates-manifest.json           # committed if candidates.jsonl omitted
  certified.jsonl                    # may be gitignored if large
  certified-manifest.json            # committed if certified.jsonl omitted
  proof-report.json                  # committed
  gold-report.json                   # committed
  audit-report.json                  # committed
  adjudication-report.json           # committed
  llm-audit/
    inputs/*.json                    # prompt payloads
    outputs/*/*.json                 # model outputs, grouped by role/model
    import-report.json               # committed summary
```

The verifier must use manifest hashes when full JSONL artifacts are not
committed.

---

## 7. Step 0: provenance/license gate

### Inputs

- `docs/sources/originals/macula-greek/source-manifest.json`
- `docs/sources/translations/syn/source-manifest.json`
- `docs/sources/locales/ru/source-manifest.json`
- optional `data-sources/strongs-ru-alignment.json`

### Required checks

- Synodal manifest covers all 27 book snapshots, not only one book.
- Every file listed in manifests has a matching SHA-256.
- Every snapshot file in a source directory is listed in its manifest.
- `top1000.core.json` schema and generator do not contain `domains`.
- `assets/data/**` and `dist/**` do not contain UBS/MARBLE-derived fields.
- No `rus_nt_strongs.xml` path exists in build scripts or committed docs,
  except in historical notes that explicitly say "do not use".

### Gate

Fail if any source has unclear license, missing manifest coverage, or runtime
UBS/MARBLE leakage.

---

## 8. Step 1: gold re-attestation

### Why this step exists

Existing `gold-heldout.json` entries are not reliable acceptance gold. They are
historical fixtures and include notes like `heldout — not annotated yet`.
Therefore v2 requires manual re-attestation.

### New gold format

Create:

- `test/fixtures/macula-gold-dev.json`
- `test/fixtures/macula-gold-heldout.json`

Schema:

```json
{
  "schema": "macula-gold-v1",
  "createdFor": "syn--sblgnt-macula",
  "rules": {
    "visibleQ": ["e"],
    "fIsVisible": false,
    "rusVzhAllowed": false
  },
  "items": [
    {
      "ref": "john 1:1",
      "ruHash": "sha256:...",
      "grHash": "sha256:...",
      "ruWords": [
        { "i": 0, "text": "В", "span": [0, 1] }
      ],
      "grTokens": [
        {
          "tokenId": "n43001001001",
          "i": 1,
          "s": "Ἐν",
          "lemma": "ἐν",
          "lexemeKey": "en",
          "strongs": ["1722"],
          "morph": "PREP"
        }
      ],
      "visiblePairs": [
        {
          "span": [11, 16],
          "tokenId": "n43001001005",
          "lexemeKey": "logos",
          "q": "e",
          "reason": "manual-dev-gold"
        }
      ],
      "hiddenOrphans": [
        {
          "span": [0, 1],
          "text": "В",
          "reason": "function-word-hidden"
        }
      ],
      "notes": "Manual re-attestation, not auto-rekeyed."
    }
  ]
}
```

Rules:

- Re-attest all heldout verses manually.
- Do not copy old `pairs[]` blindly.
- Do not use pipeline output while annotating heldout.
- `ruHash` is hash of `translation.text` plus `words[]`.
- `grHash` is hash of Greek token sequence including `tokenId`, `s`,
  `lexemeKey`, `strongs`, `morph`.
- If a verse contains textual variant content, annotate visible pairs only for
  shared text and mark orphan spans with a variant reason.

### Gate

Fail if:

- any heldout item has `not annotated yet`;
- any gold pair references a missing `span` or `tokenId`;
- any gold pair is not `q:"e"`;
- hashes do not match current packs.

---

## 9. Step 2: candidate generation

Candidate generation is allowed to be broad. It is not allowed to make visible
pairs.

### Candidate sources

Use source IDs exactly:

- `cand:ru-core-regex` — curated `ruMatches`/`ruExclude` from
  `docs/sources/locales/ru/core.json`.
- `cand:ru-strong-aggregate` — weak candidates from
  `data-sources/strongs-ru-alignment.json`.
- `cand:manual-dev-gold` — pairs from re-attested dev gold only. Heldout gold
  is never an input to candidate generation.
- `cand:llm-blind` — candidates proposed by LLM blind aligners.
- `cand:rule-pronoun` — deterministic pronoun/morph candidates, hidden unless
  certified.

### Normalization rules

All candidate sources must use the same normalization helpers:

- Russian candidate matching uses the frozen `words[]` from translation packs,
  never `verse.text.split(/\s+/)`.
- Russian matching normalizes case and `ё/е`; it must not remove internal
  letters or guess lemmas.
- Greek matching uses `token.lexemeKey`, `token.strongs[]`, `token.morph`,
  `token.id`, and `token.i`.
- Strong values stay strings. Composite Strong values such as
  `5228+1537+4053` are not split unless a named candidate source explicitly
  documents that split as hidden-only.

### `cand:ru-strong-aggregate` exact behavior

`data-sources/strongs-ru-alignment.json` has no verse or position data. It can
only create hidden candidates:

- for each Russian word, normalize it;
- find aggregate entries where normalized word is in `ru_top_words` or equals
  `ru_primary`;
- for each matching aggregate Strong, find Greek tokens in the same ref whose
  `strongs[]` contains the same string;
- emit `q:"u"` candidate records with blocker
  `weak-source:no-position-data`;
- never promote these candidates directly to `q:"e"`.

If this source produces many candidates for a common word, that is expected and
must not be "fixed" by taking the first token.

### Candidate blockers enum

Use these exact blocker strings where applicable:

- `weak-source:no-position-data`
- `ambiguous:multiple-russian-spans`
- `ambiguous:multiple-greek-tokens`
- `ambiguous:competing-candidate-for-span`
- `ambiguous:competing-candidate-for-token`
- `variant:phrase-span`
- `variant:unknown-span-status`
- `variant:syn-only-verse`
- `variant:grc-only-verse`
- `function-word:hidden-in-v2`
- `morph:incompatible`
- `source:license-not-cleared`
- `proof:missing`

### Candidate record

Write candidates to:

`generated/canonical/alignments/syn--sblgnt-macula/candidates.jsonl`

Each line:

```json
{
  "schema": "alignment-candidate-v1",
  "ref": "john 1:1",
  "span": [11, 16],
  "ruText": "Слово",
  "tokenId": "n43001001005",
  "tokenIndex": 5,
  "grText": "λόγος",
  "lexemeKey": "logos",
  "q": "u",
  "src": "cand:ru-core-regex",
  "candidateReasons": [
    "ruMatches: /^слов/"
  ],
  "blockers": [],
  "createdBy": "scripts/build-alignment-candidates.mjs"
}
```

Rules:

- `q` in candidate records is always `"u"`.
- If source suggests functional/loose match, record it as candidate only.
- Multiple candidates for one span or one token are allowed in candidates.
- Candidate order must be deterministic.
- Candidate generation must skip `synOnly`, `grcOnly`, and phrase-variant
  spans, except to record explained hidden orphan facts.
- For `merged` verses, candidates may reference Greek tokens from the merged
  Greek verse only through the mapped Synodal ref.
- If candidate generation cannot determine whether a span belongs to a textual
  variant, it must emit no candidate for that span and report
  `variant:unknown-span-status`.

### Gate

Fail if candidate generation creates runtime files or any `q:"e"`.

---

## 10. Step 3: deterministic certification

Certification converts a candidate into a runtime visible pair only when a
named certifier produces proof and no blocker fires.

### Output

Write:

- `generated/canonical/alignments/syn--sblgnt-macula/certified.jsonl`
- `generated/canonical/alignments/syn--sblgnt-macula/proof-report.json`

Certified record:

```json
{
  "schema": "alignment-certified-v1",
  "ref": "john 1:1",
  "span": [11, 16],
  "tokenId": "n43001001005",
  "lexemeKey": "logos",
  "q": "e",
  "src": "certified:unique-curated-lexeme",
  "proofId": "john 1:1|11-16|n43001001005|logos",
  "proof": {
    "certifier": "unique-curated-lexeme",
    "inputs": [
      "cand:ru-core-regex"
    ],
    "checks": [
      "exactly-one-russian-span-for-lexeme-in-ref",
      "exactly-one-greek-token-for-lexeme-in-ref",
      "no-competing-candidate-for-span",
      "no-competing-candidate-for-token",
      "not-function-word",
      "not-in-variant-span"
    ]
  }
}
```

### Certifier C1: manual-dev-gold

Promote if and only if:

- pair is present in `macula-gold-dev`;
- current hashes match;
- span and tokenId exist;
- gold says `q:"e"`.

`src = "certified:manual-dev-gold"`.

`macula-gold-heldout` is acceptance-only. It must never certify runtime pairs,
generate candidates, or tune certifier thresholds.

### Certifier C2: unique-curated-lexeme

Promote if and only if all conditions are true:

- candidate source includes `cand:ru-core-regex`;
- candidate lexemeKey exists in curated RU core;
- in this ref, exactly one Russian word span matches this lexemeKey after
  `ruExclude`;
- in this ref, exactly one Greek token has this lexemeKey;
- no other candidate points to this span;
- no other candidate points to this tokenId;
- Greek token is certifiable under the function-word policy below;
- pair is not inside `phraseVariantsByRef`;
- verse status is `paired` or correctly mapped `merged`;
- certifier has passed audit with zero confirmed errors on its sampled cases.

If any condition is unknown, do not promote.

`src = "certified:unique-curated-lexeme"`.

### Function-word policy for v2

This policy is deliberately conservative.

A Greek token is **not certifiable by C2** if any of these are true:

- `token.fw === true`;
- `token.morph` starts with or equals one of: `T`, `R`, `C`, `D`, `I`, `X`,
  `PREP`, `CONJ`, `PRT`, `ADV`, `COND`, `INJ`;
- `token.morph` starts with `P`, `F`, `K`, `Q`, or `S` (pronouns and related
  forms);
- the certifier cannot parse `token.morph`;
- the pair would normally be classified as functional in old refine logic.

These cases may still be emitted as candidates or future `q:"f"` hidden pairs.
They must not become runtime-visible in v2 initial implementation.

### Certifier C3: manual-allowlist

Promote only if a human-maintained file explicitly lists the pair:

`docs/sources/alignments/syn--sblgnt-macula/manual-certified.json`

Use this for important high-frequency words where deterministic uniqueness is
too conservative.

`src = "certified:manual-allowlist"`.

### Certifier C4: future function/pronoun rules

Do not promote to visible in v2 initial implementation. Pronoun/function rules
may emit candidates and `q:"f"` hidden records, but UI must not show them until
a separate spec decides how `q:"f"` behaves.

### Global blockers

Any blocker prevents certification:

- span missing or offset mismatch;
- tokenId missing;
- pair overlaps a phrase variant;
- ref status is `synOnly` or `grcOnly`;
- duplicate visible span in ref;
- duplicate visible tokenId in ref;
- duplicate runtime span in ref, even if hidden pairs are included;
- duplicate runtime tokenId in ref, even if hidden pairs are included;
- pair order would be non-monotonic after sort;
- LLM skeptic or adjudication marks it `reject`;
- no proof record;
- proof references a source that no longer hashes to the same data.

---

## 11. Step 4: multi-agent LLM audit

LLM audit is adversarial. Its job is to find mistakes, not to maximise recall.

### Roles

- `gold-curator`: creates or reviews manual gold. Must not see pipeline output.
- `blind-aligner-a`: independently proposes alignments from text/tokens only.
- `blind-aligner-b`: same task, different model or prompt wording.
- `skeptic`: receives certified pairs and tries to disprove them.
- `adjudicator`: compares pipeline, blind outputs, skeptic findings and gold.

### Non-negotiable LLM rules

- LLM output never directly changes runtime packs.
- If LLM disagrees with a certified pair, the pair is downgraded to conflict
  until human/adjudicator resolution.
- If blind aligners agree on a new pair, it may become a candidate, not visible.
- If skeptic flags a plausible issue, fail closed: mark hidden until resolved.
- All LLM inputs and outputs are archived under
  `generated/canonical/alignments/syn--sblgnt-macula/llm-audit/`.

### LLM import validation

`scripts/import-alignment-llm-audit.mjs` must validate every LLM output before
it can influence reports.

Fail the import if:

- JSON is invalid;
- required `schema` or `ref` is missing;
- output references a `span` that is not in frozen `words[]`;
- output references a `tokenId` that is not in original pack;
- output contains duplicate `q:"e"` tokenId/span in one ref;
- output uses `finalQ:"f"`;
- output tries to mark a pair visible without `decision:"accept"`;
- output includes prose outside JSON when the role required JSON only.

Invalid LLM output does not get silently ignored. It creates a release blocker
`blocked:invalid-llm-output` until the output is corrected or explicitly
excluded by human decision.

### LLM audit coverage

For the first production-ready v2 release, audit at minimum:

- all re-attested heldout verses;
- all verses containing `q:"e"` pairs from C2 unique-curated-lexeme;
- top 50 lexemeKeys by visible pair count;
- every verse containing textual variants or merged mapping;
- a random sample of at least 300 visible pairs, selected deterministically from
  `proofId` hash.

If this is too much for the first engineering milestone, the milestone can be
marked "data prototype", but not "release-ready".

### Prompt 1: Gold Curator

Use this prompt verbatim except for replacing the JSON input.

```text
You are Gold Curator for a Russian-Greek New Testament alignment project.

Goal:
Create a conservative gold annotation for one verse. Precision is more
important than recall. If you are not certain, leave the Russian word hidden
and explain why.

You MUST NOT look at existing pipeline alignment output.
You MUST NOT infer from old gold pairs.
You MUST use only the provided Russian verse text, frozen Russian word spans,
Greek MACULA tokens, and textual-variant notes.

Visibility policy:
- Only q="e" is visible.
- q="f" is hidden.
- q="u" is hidden.

Return JSON only. No prose outside JSON.

Input JSON:
{
  "ref": "...",
  "translation": {
    "text": "...",
    "words": [
      {"i": 0, "text": "...", "span": [0, 1]}
    ]
  },
  "original": {
    "tokens": [
      {
        "tokenId": "...",
        "i": 1,
        "s": "...",
        "lemma": "...",
        "lexemeKey": "...",
        "strongs": ["..."],
        "morph": "...",
        "fw": false
      }
    ]
  },
  "textualVariants": []
}

Required output schema:
{
  "schema": "gold-curation-v1",
  "ref": "...",
  "visiblePairs": [
    {
      "span": [start, end],
      "tokenId": "...",
      "lexemeKey": "...",
      "q": "e",
      "confidence": "certain",
      "reason": "brief reason"
    }
  ],
  "hiddenOrphans": [
    {
      "span": [start, end],
      "text": "...",
      "reason": "function-word | textual-variant | translation-addition | uncertain | no-greek-equivalent"
    }
  ],
  "warnings": [
    "Any uncertainty or textual problem."
  ]
}

Hard rules:
- Do not output q="f".
- Do not output q="u" in visiblePairs.
- Do not align a Russian function word unless it is a direct, certain lexical
  equivalent and the project policy would still allow q="e".
- Do not align words from textual-variant additions.
- Do not align one Greek token to more than one Russian span.
- Do not align one Russian span to more than one Greek token.
- If two Greek tokens have the same lexeme and order is uncertain, leave hidden.
```

### Prompt 2: Blind Aligner

Use for two independent agents/models.

```text
You are Blind Aligner for a Russian-Greek New Testament alignment project.

You receive one verse. You do NOT receive pipeline output. Your task is to
propose possible Russian span -> Greek token alignments.

Precision policy:
- Prefer missing a pair over proposing a wrong pair.
- Mark uncertain pairs as q="u".
- Only mark q="e" if the lexical correspondence is direct and you are certain.
- q="f" is allowed only as hidden functional suggestion; it is NOT visible.

Return JSON only.

Input JSON:
{
  "ref": "...",
  "translation": {"text": "...", "words": [...]},
  "original": {"tokens": [...]},
  "textualVariants": [...]
}

Required output schema:
{
  "schema": "blind-alignment-v1",
  "ref": "...",
  "proposedPairs": [
    {
      "span": [start, end],
      "tokenId": "...",
      "lexemeKey": "...",
      "q": "e | f | u",
      "reason": "brief reason",
      "risk": "none | ambiguity | function-word | textual-variant | free-translation | word-order"
    }
  ],
  "doNotAlign": [
    {
      "span": [start, end],
      "text": "...",
      "reason": "brief reason"
    }
  ],
  "questions": [
    "Only include if human adjudication is needed."
  ]
}

Hard rules:
- Do not use external Bible text.
- Do not assume Textus Receptus words exist in SBLGNT.
- Do not invent tokenIds.
- Do not output duplicate tokenId or duplicate span as q="e".
- If uncertain between two same-lexeme tokens, output q="u".
```

### Prompt 3: Skeptic

```text
You are Skeptic Auditor for a Russian-Greek alignment project.

Your job is to find reasons why certified visible pairs may be wrong. You are
not rewarded for recall. You are rewarded for catching possible false positives.

Visibility policy:
- Runtime will show only q="e".
- Any plausible doubt should be reported.

Return JSON only.

Input JSON:
{
  "ref": "...",
  "translation": {"text": "...", "words": [...]},
  "original": {"tokens": [...]},
  "certifiedPairs": [
    {
      "span": [start, end],
      "ruText": "...",
      "tokenId": "...",
      "grText": "...",
      "lexemeKey": "...",
      "q": "e",
      "src": "...",
      "proof": {...}
    }
  ],
  "textualVariants": []
}

Required output schema:
{
  "schema": "skeptic-audit-v1",
  "ref": "...",
  "verdicts": [
    {
      "span": [start, end],
      "tokenId": "...",
      "verdict": "accept | reject | uncertain",
      "severity": "none | minor | major",
      "reason": "specific reason"
    }
  ],
  "globalWarnings": []
}

Hard rules:
- If a pair maps a Russian word from a textual variant to a Greek token, reject.
- If a pair competes with another plausible same-lexeme token, mark uncertain.
- If q="e" looks merely functional or interpretive, mark uncertain.
- If the proof does not establish uniqueness, mark uncertain.
```

### Prompt 4: Adjudicator

```text
You are Adjudicator for a Russian-Greek alignment project.

You compare deterministic certified pairs, gold annotations, two blind aligner
outputs, and skeptic findings. Your goal is a release-safe decision.

Decision policy:
- accept: keep q="e" only if there is no unresolved serious conflict.
- downgrade: set q="u" if there is plausible uncertainty.
- manual-review: human must decide before release.
- add-candidate: add hidden candidate only; never directly visible.

Return JSON only.

Input JSON:
{
  "ref": "...",
  "certifiedPairs": [],
  "gold": null,
  "blindA": {},
  "blindB": {},
  "skeptic": {}
}

Required output schema:
{
  "schema": "adjudication-v1",
  "ref": "...",
  "decisions": [
    {
      "span": [start, end],
      "tokenId": "...",
      "decision": "accept | downgrade | manual-review | add-candidate",
      "finalQ": "e | u",
      "reason": "brief concrete reason"
    }
  ],
  "releaseBlockers": [
    "Any issue that must be resolved before release."
  ]
}

Hard rules:
- Never output finalQ="f" in v2.
- Any reject/uncertain from Skeptic means downgrade or manual-review.
- Agreement between blind aligners may create a candidate, not automatic q="e".
- Gold conflict blocks release until manually resolved.
```

### Prompt 5: Implementation Agent

Use this when asking a coding agent to implement v2.

```text
Implement MACULA Alignment B2 Pipeline Spec v2 exactly.

Non-negotiable constraints:
- Do not use RusVZh or rus_nt_strongs.xml.
- Do not create visible pairs during candidate generation.
- Runtime-visible pairs are only q="e".
- q="f" and q="u" are hidden.
- Every q="e" pair must have a proof record.
- Do not auto-rekey old gold as truth.
- Do not weaken verifier gates to make tests pass.
- Do not add dependencies, CI, hooks, linters, frameworks, or network build
  steps.
- Do not put UBS/MARBLE-derived fields in runtime assets or dist.

Implementation order:
1. Add/adjust schemas for candidate, certified, proof, audit reports.
2. Add license/provenance verifier.
3. Add gold re-attestation fixtures/schema checks.
4. Add candidate generation; all candidates q="u".
5. Add deterministic certification; only proven candidates become q="e".
6. Add runtime writer sorted by span and token order.
7. Add verifier gates.
8. Add reports.
9. Run npm run build:data, npm test, npm run build.

When uncertain, fail closed: keep the pair hidden and report the reason.
```

---

## 12. Step 5: human adjudication

Human adjudication is required when:

- gold conflicts with deterministic certification;
- skeptic returns `reject` or `uncertain`;
- blind aligners disagree on a high-frequency pair that certification wants to
  show;
- a certifier rule has not yet passed sampled audit with zero confirmed errors.

Adjudication output:

`generated/canonical/alignments/syn--sblgnt-macula/adjudication-report.json`

Rules:

- `accept` keeps or allows `q:"e"`;
- `downgrade` forces `q:"u"`;
- `manual-review` blocks release;
- no unresolved manual-review items are allowed in release.

---

## 13. Step 6: runtime pack writer

Input:

- certified records after adjudication;
- hidden records if we choose to keep `q:"u"`/`q:"f"` in runtime;
- textual variants.

Output:

- `assets/data/align/syn--sblgnt-macula/books/{bookId}.json`
- `assets/data/align/syn--sblgnt-macula/index.json`

Rules:

- Sort all pairs by `span[0]`, `span[1]`, token order.
- Runtime pack may omit hidden candidates initially to keep data small.
- If hidden pairs are omitted, keep them in canonical reports.
- If hidden pairs are included, UI still hides `q:"f"` and `q:"u"`.
- `index.json.lexemesWithVisiblePair` includes only `q:"e"`.
- Preserve `merged` handling for `2corinthians 11:33`.

---

## 14. Step 7: verifier and reports

Extend `scripts/verify-data.mjs` or add `scripts/verify-alignment-v2.mjs`.
The release gate may call both, but one command must fail on every invariant.

### Invariants

Fail if:

- runtime schema invalid;
- any `q:"e"` pair has no proof;
- any `q:"e"` pair was rejected or unresolved in LLM/human audit;
- any visible pair has duplicate span or duplicate tokenId in the same ref;
- any included runtime pair has duplicate span or duplicate tokenId in the same
  ref, even if `q:"f"`/`q:"u"` is hidden;
- any pair list is not sorted by span/token order;
- any span does not match frozen `words[]`;
- any tokenId does not exist in original pack;
- any visible pair overlaps phrase variant span;
- any `synOnly` or `grcOnly` verse has visible pairs;
- merged verse token refs are not explicitly accounted for;
- `index.json` contains lexemes without `q:"e"` pairs;
- source manifests do not cover all snapshot files;
- runtime or dist contains UBS/MARBLE-derived fields;
- old forbidden paths are referenced by build scripts.

### Gold metrics

Report:

- precision on `macula-gold-dev`;
- recall on `macula-gold-dev`;
- precision on `macula-gold-heldout`;
- recall on `macula-gold-heldout`;
- count of visible false positives;
- count of visible false negatives;
- count of hidden but gold-visible pairs.

Gate:

- visible false positives on heldout = 0;
- unresolved gold conflicts = 0;
- recall is reported, not a release blocker.

### Reports

Commit these:

- `generated/canonical/alignments/syn--sblgnt-macula/audit-report.json`
- `generated/canonical/alignments/syn--sblgnt-macula/gold-report.json`
- `generated/canonical/alignments/syn--sblgnt-macula/proof-report.json`
- `generated/canonical/alignments/syn--sblgnt-macula/adjudication-report.json`

Do not commit huge candidate dumps if they are too large; if omitted, commit a
manifest with hashes and counts.

---

## 15. Expected quality posture

Initial recall may be low. That is accepted.

Expected first implementation shape:

- many candidates;
- fewer certified visible pairs than old B pipeline;
- `q:"f"` either absent from runtime or hidden;
- `q:"u"` possibly present in canonical reports;
- all visible pairs explainable by proof.

Do not "improve" recall by relaxing certification. Improve recall by adding a
new certifier rule, auditing it, and documenting its proof.

---

## 16. Implementation checklist

### Phase 0: align docs before coding

- [ ] Add note to `MACULA_migration_implementation_plan.md` §3.2-3.4:
      "Superseded by `MACULA_alignment_B2_pipeline_spec_v2.md`."
- [ ] Ensure no implementation agent follows v1 alignment generation.

### Phase 1: licenses and schemas

- [ ] Remove `domains` from runtime schema/generator.
- [ ] Add verifier for UBS/MARBLE leakage.
- [ ] Add schemas for gold, candidate, certified, proof, adjudication reports.

### Phase 2: gold

- [ ] Create `macula-gold-dev.json`.
- [ ] Create `macula-gold-heldout.json`.
- [ ] Re-attest every heldout verse manually/blind.
- [ ] Add hash validation.

### Phase 3: candidates

- [ ] Implement `scripts/build-alignment-candidates.mjs`.
- [ ] All candidates are `q:"u"`.
- [ ] Include candidate reasons and blockers.
- [ ] Deterministic output.

### Phase 4: certification

- [ ] Implement C1 manual-dev-gold.
- [ ] Implement C2 unique-curated-lexeme.
- [ ] Implement C3 manual-allowlist.
- [ ] Keep C4 pronoun/function hidden.
- [ ] Generate proof report.

### Phase 5: audit

- [ ] Add input builder for LLM audit prompts.
- [ ] Archive LLM outputs.
- [ ] Add adjudication report format.
- [ ] Make unresolved conflicts release-blocking.

### Phase 6: runtime writer and verifier

- [ ] Write sorted runtime packs.
- [ ] `index.json` only from `q:"e"`.
- [ ] Extend verifier with v2 invariants.
- [ ] `npm run build:data` deterministic.

### Phase 7: final checks

- [ ] `npm run build:data`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] manual QA after UI P0 is fixed.

---

## 17. Definition of Done

Data layer is done only when:

- no RusVZh usage exists;
- runtime has no UBS/MARBLE-derived fields;
- `macula-gold-heldout.json` is manually re-attested;
- every runtime visible pair is `q:"e"`;
- every `q:"e"` has proof;
- `q:"f"` and `q:"u"` are hidden;
- visible false positives on heldout = 0;
- unresolved LLM/human conflicts = 0;
- source manifests cover actual snapshot files;
- `build:data` is offline and deterministic;
- `npm test` and `npm run build` pass.

---

## 18. Anti-patterns

Do not do these:

- "Temporarily" use RusVZh to get better recall.
- Treat `strongs-ru-alignment.json` as per-word alignment.
- Promote all `ruMatches` to visible.
- Show `q:"f"` because it "looks useful".
- Auto-re-key old gold and call it verified.
- Let LLM consensus bypass deterministic proof.
- Weaken verifier because a high-frequency word fails.
- Store runtime `domains` because the repo is private.
- Sort pairs by token order only; runtime rendering needs span order.
- Count "no verifier errors" as precision.

---

## 19. Minimal first milestone

The smallest useful v2 milestone is not full NT coverage. It is:

- John 1 with certified-only visible pairs;
- re-attested gold for John 1:1 and at least two heldout verses;
- candidate report showing hidden alternatives;
- proof report for every visible pair;
- verifier gates green;
- UI shows only `q:"e"` pairs.

After that, expand book by book or certifier by certifier.
