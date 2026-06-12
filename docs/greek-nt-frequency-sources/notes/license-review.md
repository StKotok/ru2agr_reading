# License Review — Greek NT Frequency Sources

**Date:** 2026-06-12
**Status:** Preliminary engineering assessment — NOT LEGAL ADVICE
**Action required:** Human legal review before using any source in production

---

## Summary Table

| Source | License Detected | Attribution Required | Commercial Confidence | Risk Level |
|--------|-----------------|---------------------|----------------------|------------|
| SBLGNT | SBLGNT EUL | Yes — SBL + Logos | High | Low |
| MACULA Greek | CC BY 4.0 | Yes — Clear Bible, MACULA, SBLGNT | Medium | Medium |
| MorphGNT SBLGNT | CC-BY-SA (lemmas) | Yes — MorphGNT + SBLGNT | Low | **High** |
| Core GNT Vocab | Unclear (CC-BY-SA?) | Yes — James Tauber + MorphGNT | Low | Medium |
| STEPBible Data | **CONFLICTING** | Yes — Tyndale House, STEPBible | Low | **High** |
| OpenGNT | Multi-source | Yes — Eliran Wong + multiple upstreams | Low | **High** |

---

## Detailed Per-Source Review

### 1. SBLGNT

- **License file:** `selected/sblgnt/LICENSE`
- **Upstream:** https://github.com/LogosBible/SBLGNT
- **Detected license:** SBLGNT End-User License
- **Attribution required:** Yes — "Society of Biblical Literature and Logos Bible Software"
- **Commercial-use confidence:** **High** — the license explicitly permits commercial use with attribution
- **Why:** The SBLGNT was designed as a freely usable scholarly text. The EULA is permissive.
- **Action needed:** Verify attribution wording for UI credits/About section.

### 2. MACULA Greek

- **License file:** `selected/macula-greek/LICENSE.md`
- **Upstream:** https://github.com/Clear-Bible/macula-greek
- **Detected license:** CC BY 4.0
- **Attribution required:** Yes — "Clear Bible" and "MACULA project" and SBLGNT contributors
- **Commercial-use confidence:** **Medium** — CC BY 4.0 permits commercial use, but:
  - Underlying SBLGNT text has separate license (see #1)
  - Word sense data (Clear) may have additional terms
  - Attribution chain: MACULA → SBLGNT → SBL + Logos
- **Why:** CC BY 4.0 is the standard open-data license and explicitly permits commercial use. The main risk is ensuring all attribution requirements are met for the dependency chain.
- **Action needed:**
  1. Confirm CC BY 4.0 covers all TSV columns (especially `english` glosses, `mandarin` glosses, `domain` annotations)
  2. Verify attribution text satisfies all upstream requirements
  3. Check if Clear Bible requires separate permission for app embedding

### 3. MorphGNT SBLGNT

- **License file:** No license file in repo; license stated in README
- **Upstream:** https://github.com/morphgnt/sblgnt
- **Detected license:** Dual license:
  - SBLGNT text: SBLGNT EUL (permissive)
  - Morphological parsing + lemmatization: **CC-BY-SA** (share-alike)
- **Attribution required:** Yes — MorphGNT project + SBLGNT
- **Commercial-use confidence:** **Low** — CC-BY-SA is the problem
- **Why:** CC-BY-SA requires derivative works to be released under the same license. If you build a frequency dictionary from MorphGNT lemmas, that dictionary may legally be considered a "derivative work" and would need to be released under CC-BY-SA. This conflicts with:
  - Desire to keep the app's data proprietary or under a different license
  - Integration with CC-BY data from MACULA
  - Potential commercial distribution
- **Action needed:**
  1. **Legal question:** Is a lemma frequency count a "derivative work" of CC-BY-SA lemmatization?
  2. If yes, production use is blocked without releasing frequency data under CC-BY-SA
  3. **Safe use:** Cross-check only — compare MACULA frequencies against MorphGNT frequencies without incorporating MorphGNT data into the final product

### 4. Core GNT Vocab

- **License file:** None in repository
- **Upstream:** https://github.com/jtauber/core-gnt-vocab
- **Detected license:** None stated. Likely inherits CC-BY-SA from MorphGNT (same author, derived data)
- **Attribution required:** Yes — James Tauber + MorphGNT
- **Commercial-use confidence:** **Low** — unclear license
- **Why:** No license file. The data is derived from MorphGNT (CC-BY-SA), so share-alike likely applies. Frequency counts may be "facts" (not copyrightable), but glosses from Dodson may have separate protection. The `.py` scripts are separately copyrightable.
- **Action needed:**
  1. Contact James Tauber for license clarification
  2. Legal question: Are word frequency lists "facts" (not copyrightable) or "creative works" (copyrightable) in the relevant jurisdiction?
  3. **Safe use:** Reference/baseline only. Recalculate frequencies independently from MACULA data.

### 5. STEPBible Data

- **License file:** None in repository; license claims in README and file headers
- **Upstream:** https://github.com/STEPBible/STEPBible-Data
- **Detected license:** **CONFLICTING INFORMATION**
  - GitHub README (2026): "CC BY 4.0"
  - Older STEPBible web pages: "CC BY-NC 3.0" for datasets
  - Some TBESG file headers: "CC BY-NC-ND"
  - TAGNT file headers: "CC BY 4.0"
  - TANTT files: "CC BY"
- **Attribution required:** Yes — Tyndale House, STEPBible.org, and contributors
- **Commercial-use confidence:** **Low** — license is genuinely uncertain
- **Why:** This is the messiest license situation. The most restrictive terms in the conflict (CC BY-NC-ND) would prohibit:
  - Commercial use (NC = Non-Commercial)
  - Any modification/adaptation (ND = No Derivatives)
  - But the README says CC BY 4.0...
- **Action needed:**
  1. **Do not embed in production** without explicit written confirmation from Tyndale House
  2. Contact Tyndale House for clarification: which license applies to TBESG and TAGNT specifically?
  3. If cleared: TBESG is the best single gloss source available
  4. If not cleared: use MACULA's built-in `english` gloss column as primary gloss source

### 6. OpenGNT

- **License file:** None in repository; license statement in README
- **Upstream:** https://github.com/eliranwong/OpenGNT
- **Detected license:** "Public license" (exact terms unclear). Aggregates from multiple licensed sources:
  - TANTT: CC BY
  - TBESG: CC BY / CC BY-NC (conflict — see #5)
  - Berean translations: Berean Bible license
  - OpenText annotations: OpenText license
  - Levinsohn GNT features: Levinsohn license
  - MorphGNT: CC-BY-SA
- **Attribution required:** Yes — Eliran Wong + ALL upstream sources
- **Commercial-use confidence:** **Low** — complex multi-source heritage
- **Why:** Even if the OGNT aggregation itself is "public," the component data carries its own licenses. TBESG's CC BY-NC ambiguity alone makes commercial use risky.
- **Action needed:**
  1. Map each column to its source and verify each source's license
  2. If any column traces to CC-BY-NC or CC-BY-SA data, that column must be excluded or the frequency dictionary must comply
  3. **Safe use:** Cross-reference and manual inspection only

---

## Recommended Safe Path (for Engineering)

1. **Use MACULA Greek SBLGNT TSV** as the sole primary data source for the frequency dictionary
2. **Cross-check** results against MorphGNT and Core GNT Vocab (but do not incorporate their data)
3. **Extract glosses** from MACULA's own `english` column (avoid TBESG until STEPBible license is clarified)
4. **Use SBL transliterations** from OpenGNT only if that column's source license can be isolated and verified
5. **Document all attributions** in the app's About/Credits section before release

---

**⚠️ DISCLAIMER:** This document is an engineering assessment of license status based on publicly available information. It does not constitute legal advice. Consult a legal professional before:
- Embedding any source data in a commercially distributed application
- Combining data from sources with different licenses (CC BY + CC BY-SA)
- Releasing derivative works based on share-alike licensed data
- Making claims about "fair use" or "facts vs. creative works" in specific jurisdictions
