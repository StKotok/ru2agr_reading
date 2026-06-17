/**
 * Auto-select example references for a lemma.
 *
 * Deterministic algorithm selects up to 5 example verses:
 * 1. First occurrence
 * 2. Most frequent surface forms (up to 2)
 * 3. Different books (up to 2 more)
 *
 * All selections are technical — NOT editorially curated "key verses".
 */

// Canonical NT book order
export const NT_BOOK_ORDER = [
  'matthew', 'mark', 'luke', 'john', 'acts',
  'romans', '1corinthians', '2corinthians', 'galatians',
  'ephesians', 'philippians', 'colossians',
  '1thessalonians', '2thessalonians',
  '1timothy', '2timothy', 'titus', 'philemon',
  'hebrews', 'james', '1peter', '2peter',
  '1john', '2john', '3john', 'jude', 'revelation',
];

const BOOK_RANK = new Map(NT_BOOK_ORDER.map((b, i) => [b, i]));

/**
 * Sort references by canonical book order.
 * Refs are in format "bookId chapter:verse".
 * @param {string[]} refs
 * @returns {string[]}
 */
export function sortRefsCanonical(refs) {
  return [...refs].sort((a, b) => {
    const [bookA] = a.split(' ');
    const [bookB] = b.split(' ');
    const rankA = BOOK_RANK.get(bookA) ?? 99;
    const rankB = BOOK_RANK.get(bookB) ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    // Same book: sort by chapter:verse
    const [refA] = a.split(' ').slice(1);
    const [refB] = b.split(' ').slice(1);
    const [cA, vA] = refA.split(':').map(Number);
    const [cB, vB] = refB.split(':').map(Number);
    if (cA !== cB) return cA - cB;
    return vA - vB;
  });
}

/**
 * Select up to 5 example references for a lemma.
 * @param {object} lemmaData
 * @param {Array<{surface: string, refs: string[], count: number}>} attestedForms
 * @param {string[]} allRefs - all unique references (already sorted canonical)
 * @returns {Array<{ref: string, reason: string}>}
 */
export function selectAutoRefs(lemmaData, attestedForms, allRefs) {
  if (!allRefs || allRefs.length === 0) return [];

  const selected = [];
  const usedRefs = new Set();

  // 1. First occurrence
  if (allRefs.length > 0) {
    selected.push({ ref: allRefs[0], reason: 'first-occurrence' });
    usedRefs.add(allRefs[0]);
  }

  // 2. Most frequent surface forms (up to 2)
  const sortedForms = [...attestedForms].sort((a, b) => b.count - a.count);
  let formCount = 0;
  for (const form of sortedForms) {
    if (formCount >= 2) break;
    if (!form.refs || form.refs.length === 0) continue;
    for (const ref of form.refs) {
      if (!usedRefs.has(ref)) {
        selected.push({ ref, reason: 'common-surface-form' });
        usedRefs.add(ref);
        formCount++;
        break;
      }
    }
  }

  // 3. Different books (up to 2 more, to reach max 5)
  const usedBooks = new Set();
  for (const ref of usedRefs) {
    usedBooks.add(ref.split(' ')[0]);
  }
  let bookCount = 0;
  for (const ref of allRefs) {
    if (selected.length >= 5) break;
    if (usedRefs.has(ref)) continue;
    const book = ref.split(' ')[0];
    if (!usedBooks.has(book)) {
      selected.push({ ref, reason: 'different-book' });
      usedBooks.add(book);
      usedRefs.add(ref);
      bookCount++;
      if (bookCount >= 2) break;
    }
  }

  // 4. If still < 5, fill with distinct morphology forms
  if (selected.length < 5) {
    for (const form of sortedForms) {
      if (selected.length >= 5) break;
      if (!form.refs || form.refs.length === 0) continue;
      for (const ref of form.refs) {
        if (selected.length >= 5) break;
        if (!usedRefs.has(ref)) {
          selected.push({ ref, reason: 'distinct-morphology' });
          usedRefs.add(ref);
        }
      }
    }
  }

  // 5. Fallback: just add more from allRefs
  for (const ref of allRefs) {
    if (selected.length >= 5) break;
    if (!usedRefs.has(ref)) {
      selected.push({ ref, reason: 'fallback' });
      usedRefs.add(ref);
    }
  }

  return selected;
}
