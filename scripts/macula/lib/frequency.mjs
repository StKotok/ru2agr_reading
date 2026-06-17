/**
 * Frequency calculation utilities.
 *
 * Computes token counts, verse counts, ranks, coverage metrics
 * for lemmas and surface forms.
 */

/**
 * Compute lemma-level frequency statistics.
 * @param {Map<string, {tokens: Array, verses: Set<string>}>} lemmaGroups
 *   Map from lemma → { tokens: [...], verses: Set("book c:v") }
 * @param {number} totalLexicalTokens - total number of lexical tokens in corpus
 * @returns {Array} sorted array of lemma frequency entries
 */
export function computeLemmaFrequencies(lemmaGroups, totalLexicalTokens) {
  const entries = [];

  for (const [lemma, group] of lemmaGroups) {
    entries.push({
      lemma,
      tokenCount: group.tokens.length,
      verseCount: group.verses.size,
    });
  }

  // Sort: tokenCount desc, then lemma NFC for stability
  entries.sort((a, b) => {
    if (b.tokenCount !== a.tokenCount) return b.tokenCount - a.tokenCount;
    return a.lemma.localeCompare(b.lemma);
  });

  // Assign ranks
  let cumulative = 0;
  let prevCount = null;
  let denseRank = 0;
  let prevDenseCount = null;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    e.rank = i + 1;

    if (e.tokenCount !== prevDenseCount) {
      denseRank = i + 1;
      prevDenseCount = e.tokenCount;
    }
    e.denseRank = denseRank;

    e.coverage = e.tokenCount / totalLexicalTokens;
    e.coveragePercent = e.coverage * 100;
    cumulative += e.coverage;
    e.cumulativeCoverage = cumulative;

    prevCount = e.tokenCount;
  }

  return entries;
}

/**
 * Compute form-level frequency statistics within a lemma.
 * @param {Map<string, number>} formCounts - Map from surface form → count
 * @param {number} lemmaTokenCount - total tokens for this lemma
 * @returns {Array}
 */
export function computeFormFrequencies(formCounts, lemmaTokenCount) {
  const entries = [];

  for (const [form, count] of formCounts.entries()) {
    entries.push({
      surface: form,
      count,
      coverage: count / lemmaTokenCount,
    });
  }

  entries.sort((a, b) => b.count - a.count);
  return entries;
}

/**
 * Create slider breakpoints based on frequency distribution.
 * @param {Array} lemmaFreqs - sorted lemma frequency entries
 * @returns {object}
 */
export function computeBreakpoints(lemmaFreqs) {
  const breakpoints = {};
  const targets = [50, 80, 90, 95];

  for (const target of targets) {
    let idx = lemmaFreqs.findIndex(e => e.cumulativeCoverage * 100 >= target);
    if (idx === -1) idx = lemmaFreqs.length - 1;
    breakpoints[`p${target}`] = {
      lemmasNeeded: idx + 1,
      cumulativeCoverage: lemmaFreqs[idx].cumulativeCoverage,
    };
  }

  return breakpoints;
}
