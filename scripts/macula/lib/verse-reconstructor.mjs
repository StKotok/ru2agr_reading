/**
 * Verse text reconstructor using MACULA TEI XML files.
 *
 * The TSV has `after` and `text` columns but does not reliably encode
 * punctuation as separate tokens. The TEI XML provides explicit <w> and <pc>
 * elements for words and punctuation, allowing accurate verse text.
 *
 * Strategy:
 * - Parse TEI XML to extract word/pc sequences per verse
 * - Build verse text strings with correct spacing
 * - Map TSV token IDs to their text content for cross-reference
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MACULA_ROOT = resolve(__dirname, '..', '..', '..', 'docs', 'macula-greek');
const TEI_DIR = resolve(MACULA_ROOT, 'SBLGNT', 'tei');

// Book filename mapping
const BOOK_FILES = {
  'matthew': '01-matthew.xml',
  'mark': '02-mark.xml',
  'luke': '03-luke.xml',
  'john': '04-john.xml',
  'acts': '05-acts.xml',
  'romans': '06-romans.xml',
  '1corinthians': '07-1corinthians.xml',
  '2corinthians': '08-2corinthians.xml',
  'galatians': '09-galatians.xml',
  'ephesians': '10-ephesians.xml',
  'philippians': '11-philippians.xml',
  'colossians': '12-colossians.xml',
  '1thessalonians': '13-1thessalonians.xml',
  '2thessalonians': '14-2thessalonians.xml',
  '1timothy': '15-1timothy.xml',
  '2timothy': '16-2timothy.xml',
  'titus': '17-titus.xml',
  'philemon': '18-philemon.xml',
  'hebrews': '19-hebrews.xml',
  'james': '20-james.xml',
  '1peter': '21-1peter.xml',
  '2peter': '22-2peter.xml',
  '1john': '23-1john.xml',
  '2john': '24-2john.xml',
  '3john': '25-3john.xml',
  'jude': '26-jude.xml',
  'revelation': '27-revelation.xml',
};

/**
 * Very simple XML parser that extracts <w> and <pc> elements within verses.
 * This avoids adding an XML library dependency.
 *
 * @param {string} xml - TEI XML content
 * @returns {Map<string, Array<{type: 'word'|'punct', text: string, xmlId: string|null, ref: string|null}>>}
 *   Map from "chapter:verse" → array of text segments
 */
function parseTEI(xml) {
  const verses = new Map();

  // Match <w> elements: <w ref="JHN 1:1!1" xml:id="n43001001001">Ἐν</w>
  // Use \s+ before chapter:verse to avoid greedy [^"]* eating digits
  const wRe = /<w\s+ref="[^"\s]+\s+(\d+):(\d+)!(\d+)"\s+xml:id="([^"]+)"[^>]*>([^<]*)<\/w>/g;
  // Match <pc> elements: <pc type="suffix">,</pc>
  const pcRe = /<pc[^>]*>([^<]*)<\/pc>/g;
  // Match milestone elements for verse boundaries
  const milestoneRe = /<milestone\s+unit="verse"\s+ref="[^"\s]+\s+(\d+):(\d+)"\/>/g;

  // First pass: find all verse milestones to establish boundaries
  const verseBoundaries = [];
  let m;
  while ((m = milestoneRe.exec(xml)) !== null) {
    verseBoundaries.push({ chapter: parseInt(m[1]), verse: parseInt(m[2]), index: m.index });
  }

  // Second pass: for each verse boundary, scan forward for w and pc elements
  // until the next verse boundary or end of text
  for (let i = 0; i < verseBoundaries.length; i++) {
    const { chapter, verse, index: startIdx } = verseBoundaries[i];
    const endIdx = i + 1 < verseBoundaries.length ? verseBoundaries[i + 1].index : xml.length;
    const segment = xml.slice(startIdx, endIdx);
    const key = `${chapter}:${verse}`;

    const items = [];
    // Extract words
    const wRegex = /<w\s+ref="[^"\s]+\s+(\d+):(\d+)!(\d+)"\s+xml:id="([^"]+)"[^>]*>([^<]*)<\/w>/g;
    let wm;
    const wordMatches = [];
    while ((wm = wRegex.exec(segment)) !== null) {
      wordMatches.push({
        type: 'word',
        text: wm[5],
        xmlId: wm[4],
        ref: `${wm[1]}:${wm[2]}!${wm[3]}`,
        index: wm.index,
      });
    }

    // Extract punctuation
    const pcRegex = /<pc\s+type="([^"]*)"[^>]*>([^<]*)<\/pc>/g;
    let pcm;
    const punctMatches = [];
    while ((pcm = pcRegex.exec(segment)) !== null) {
      punctMatches.push({
        type: 'punct',
        text: pcm[2],
        pcType: pcm[1],
        index: pcm.index,
      });
    }

    // Merge and sort by position
    const all = [...wordMatches, ...punctMatches];
    all.sort((a, b) => a.index - b.index);
    verses.set(key, all);
  }

  return verses;
}

/**
 * Reconstruct verse text from TEI elements.
 * Rules:
 * - No space before punctuation
 * - Space between words
 * - Suffix punctuation attaches to preceding word
 * - Prefix punctuation (like opening quotes) attaches to following word
 * @param {Array} elements - parsed TEI elements for a verse
 * @returns {{ text: string, tokenIds: string[], punctBefore: boolean[] }}
 */
function reconstructVerseText(elements) {
  let text = '';
  const tokenIds = [];
  const punctBefore = [];

  for (const el of elements) {
    if (el.type === 'word') {
      if (text.length > 0 && !text.endsWith(' ')) {
        text += ' ';
      }
      text += el.text;
      tokenIds.push(el.xmlId);
    } else if (el.type === 'punct') {
      if (el.pcType === 'prefix') {
        // Prefix: space before, no space after (opening quote, bracket)
        if (text.length > 0 && !text.endsWith(' ')) text += ' ';
        text += el.text;
      } else {
        // Suffix/other: no space before, space after
        text += el.text;
      }
    }
  }

  return { text: text.trim(), tokenIds };
}

/**
 * Load and parse TEI for a book, return verse text + token IDs.
 * @param {string} bookId
 * @returns {{ bookId: string, verses: Map<string, {text: string, tokenIds: string[]}> }}
 */
function loadTEIBook(bookId) {
  const filename = BOOK_FILES[bookId];
  if (!filename) {
    console.warn(`No TEI file for book: ${bookId}`);
    return { bookId, verses: new Map() };
  }

  const filePath = resolve(TEI_DIR, filename);
  let xml;
  try {
    xml = readFileSync(filePath, 'utf8');
  } catch (e) {
    console.warn(`Failed to read TEI for ${bookId}: ${e.message}`);
    return { bookId, verses: new Map() };
  }

  const parsedVerses = parseTEI(xml);
  const result = new Map();

  for (const [key, elements] of parsedVerses) {
    result.set(key, reconstructVerseText(elements));
  }

  return { bookId, verses: result };
}

/**
 * Build verse text for all 27 books from TEI XML.
 * @returns {Map<string, {text: string, tokenIds: string[]}>} key = "bookId chapter:verse"
 */
export function buildAllVerses() {
  const all = new Map();

  for (const bookId of Object.keys(BOOK_FILES)) {
    const { verses } = loadTEIBook(bookId);
    for (const [cv, data] of verses) {
      const [chapter, verse] = cv.split(':');
      all.set(`${bookId} ${chapter}:${verse}`, {
        ...data,
        chapter: parseInt(chapter),
        verse: parseInt(verse),
        ref: `${bookId} ${chapter}:${verse}`,
      });
    }
  }

  return all;
}

/**
 * Build verse data grouped by book.
 * @returns {Map<string, Array<{chapter: number, verse: number, text: string, tokenIds: string[]}>>}
 */
export function buildVersesByBook() {
  const byBook = new Map();

  for (const bookId of Object.keys(BOOK_FILES)) {
    const { verses } = loadTEIBook(bookId);
    const bookVerses = [];

    for (const [cv, data] of verses) {
      const [chapter, verse] = cv.split(':');
      bookVerses.push({
        ref: `${bookId} ${chapter}:${verse}`,
        chapter: parseInt(chapter),
        verse: parseInt(verse),
        text: data.text,
        tokenIds: data.tokenIds,
      });
    }

    bookVerses.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
    byBook.set(bookId, bookVerses);
  }

  return byBook;
}
