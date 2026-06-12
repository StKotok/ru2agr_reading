# STEPBible Data — Source README

## Provenance

- **Source name:** STEPBible Data
- **Organization:** Tyndale House, Cambridge
- **Repository:** https://github.com/STEPBible/STEPBible-Data
- **Retrieved at:** 2026-06-12T06:59:05Z
- **Git commit:** `b86d26cdb1f51729e73b5b4eb7f7ccadc5dfba39` (short: `b86d26c`)
- **Branch:** master
- **Commit date:** 2026-06-09

## License

**CONFLICTING INFORMATION:**
1. GitHub README (current): **CC BY 4.0**
2. Historical/external pages: **CC BY-NC 3.0** or **CC BY-NC-ND**
3. Individual file headers: mixed — "CC BY 4.0", "CC BY-NC-ND", "CC BY"

**Engineering assessment (not legal advice):** The messiest license situation among all sources. DO NOT use for production without human legal review.

**License review status:** needs_human_review — conflicting license claims.

## Files in selected/

### Tagged Greek NT (TAGNT):

| File | Content |
|------|---------|
| `Translators Amalgamated OT+NT/TAGNT Mat-Jhn - ... .txt` | Matthew–John, full morphological tagging |
| `Translators Amalgamated OT+NT/TAGNT Act-Rev - ... .txt` | Acts–Revelation, full morphological tagging |
| `Older Formats/TAGNT Mat-Jhn - ... .txt` | Older format version |
| `Older Formats/TAGNT Act-Rev - ... .txt` | Older format version |

### Lexicons:

| File | Content |
|------|---------|
| `Lexicons/TBESG - ... .txt` | **TBESG** — Translators Brief lexicon of Extended Strongs for Greek |

### Morphology codes:

| File | Content |
|------|---------|
| `Morphology codes/TEGMC - ... .txt` | Translators Expansion of Greek Morphology Codes |
| `Morphology codes/TEHMC - ... .txt` | Translators Expansion of Hebrew Morphology Codes |

## TAGNT file format

Tab-separated. Columns for: Greek word forms (NA27/28, TR, SBL, TH, Byz, WH, Treg editions), lemmas, morphology (Robinson codes), Extended Strong's numbers, English glosses, translational variants, source attributions. **Richest single Greek NT annotation source** but complex format.

## TBESG file format

Maps Extended Strong's numbers → Greek lemma, transliteration, English gloss, part of speech, morphology. **Excellent gloss source** for joining with Strong's-keyed data.

## Usefulness for this project

- **Role:** Supplementary source for gloss/Strong/lexicon layer. Not primary for frequency.
- **Priority:** Medium. Best used as gloss reference (TBESG) to enrich MACULA-derived frequency dictionary.
- **Key assets:**
  - TBESG — Best single gloss source. Map Extended Strong's → English gloss.
  - TEGMC — Authoritative morphology code reference.
- **Use for frequency builder:**
  1. Extract TBESG as Strong's → gloss lookup table
  2. Join with MACULA frequency data via Strong's numbers
  3. Use TEGMC to decode Robinson morphology codes

## License warning

- **CRITICAL:** Mixed/conflicting licenses. "Useful but requires license review before commercial embedding."
- **Attribution:** Tyndale House, STEPBible.org, and contributors.
- **Recommendation:** Wait for license clarification. Use MACULA SBLGNT as primary, reference TBESG for manual verification.
