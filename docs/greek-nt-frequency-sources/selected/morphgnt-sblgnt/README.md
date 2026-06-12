# MorphGNT SBLGNT — Source README

## Provenance

- **Source name:** MorphGNT SBLGNT
- **Repository:** https://github.com/morphgnt/sblgnt
- **Retrieved at:** 2026-06-12T06:59:05Z
- **Git commit:** `aaed91e57c8e4a8dc9a2383e129ca5e75fe6393d` (short: `aaed91e`)
- **Branch:** master
- **Commit date:** 2024-01-21

## License

Two components with separate licenses:
1. **SBLGNT Greek text** — SBLGNT End-User License (permissive with attribution).
2. **Morphological parsing and lemmatization** — **CC-BY-SA** (share-alike).

**Engineering assessment (not legal advice):** CC-BY-SA on lemmatization is a potential blocker for proprietary/commercial use. Share-alike may require derivative frequency dictionaries to also be CC-BY-SA.

**License review status:** needs_human_review — CC-BY-SA on lemmatization.

## Files in selected/

27 `-morphgnt.txt` files, one per NT book (61-Mt through 87-Re), plus `README.md`.

## File format (space-separated, 7 columns):

```
bcv   pos   parsing   text   word   normalized   lemma
```

Example (Matthew 1:1):
```
010101 N- ----NSF- Βίβλος Βίβλος βίβλος βίβλος
010101 N- ----GSF- γενέσεως γενέσεως γενέσεως γένεσις
010101 N- ----GSM- Ἰησοῦ Ἰησοῦ Ἰησοῦ Ἰησοῦς
```

- `bcv` — BookChapterVerse (e.g. 010101)
- `pos` — Part of speech (N-, V-, PREP, CONJ, etc.)
- `parsing` — Robinson morphological code (----NSF-)
- `text` — Surface form with diacritics (Βίβλος)
- `word` — Word form (may differ from text)
- `normalized` — Normalized lowercase (βίβλος)
- `lemma` — Dictionary lemma (βίβλος)

## Usefulness for this project

- **Role:** Control corpus for lemma frequency verification.
- **Priority:** High for verification, Medium for direct use (CC-BY-SA concern).
- **Use for frequency builder:**
  1. Parse all 27 files
  2. Group by `lemma` → verify against MACULA frequencies
  3. Use `pos` field to filter function words
  4. Cross-check Core GNT Vocab (built from this data)

## License warning

- **CRITICAL:** Morphological parsing and lemmatization are **CC-BY-SA**.
- **Do not use as primary production source** without legal review of share-alike implications.
- **Safer approach:** Use MorphGNT only as verification/cross-check, not as primary data.
