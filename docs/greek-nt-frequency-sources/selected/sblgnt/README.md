# SBLGNT — Source README

## Provenance

- **Source name:** SBL Greek New Testament (SBLGNT)
- **Repository:** https://github.com/LogosBible/SBLGNT
- **Retrieved at:** 2026-06-12T06:59:05Z
- **Git commit:** `c4d241a9c1c479a55b989ba35a4976c1d0b8052c` (short: `c4d241a`)
- **Branch:** master
- **Commit date:** 2025-01-19

## License

SBLGNT text is made available under the SBLGNT End-User License (see `LICENSE` file). Permits free use with attribution to the Society of Biblical Literature and Logos Bible Software.

**Engineering assessment (not legal advice):** Appears permissive for both non-commercial and commercial use with proper attribution.

## Files in selected/

```
README.md          — this file
LICENSE            — SBLGNT license text
About.md           — project description
data/sblgntapp/xml/
  Matt.xml .. Rev.xml  — 27 XML files, one per NT book
```

## File format

Each XML file contains the SBLGNT text with `<book>`, `<chapter n="...">`, `<verse n="...">` structure.

## Usefulness for this project

- **Role:** Canonical text source. Reference point for Greek NT text.
- **Priority:** Medium. Raw text only — no lemma/morphology. For frequency, use MACULA or MorphGNT.
- **Use for frequency builder:** Compare against MACULA/OpenGNT to verify text base consistency.

## License warning

- **License review status:** needs_human_review (for commercial use)
- **Attribution required:** Society of Biblical Literature and Logos Bible Software
