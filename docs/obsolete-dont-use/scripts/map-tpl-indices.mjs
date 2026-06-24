// Maps data-dc-tpl indices to source code positions in a DC template.
// Usage: node scripts/map-tpl-indices.mjs [target indices...]
// If no indices given, prints ALL indices with element signatures.

import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const TARGETS = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
const SHOW_ALL = TARGETS.length === 0;

// ------ encodeCase (mirrors support.js) ------
const CAMEL_ATTR = "sc-camel-";
const RAW_WRAP = {
  select: "sc-raw-select", table: "sc-raw-table", tbody: "sc-raw-tbody",
  thead: "sc-raw-thead", tfoot: "sc-raw-tfoot", tr: "sc-raw-tr",
  td: "sc-raw-td", th: "sc-raw-th", caption: "sc-raw-caption"
};
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const IMPORT_SELF_CLOSE_RE = new RegExp("<(x-import|dc-import)(" + ATTRS + ")/>", "gi");
const CAMEL_ATTR_RE = /(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g;

function encodeCase(html) {
  html = html.replace(IMPORT_SELF_CLOSE_RE, (_, t, a) => "<" + t + a + "></" + t + ">");
  html = html.replace(/<helmet(\s|>)/gi, "<sc-helmet$1");
  html = html.replace(/<\/helmet\s*>/gi, "</sc-helmet>");
  html = html.replace(CAMEL_ATTR_RE, (_, sp, name, eq) =>
    sp + CAMEL_ATTR + name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()) + eq
  );
  for (const [real, alias] of Object.entries(RAW_WRAP)) {
    html = html.replace(new RegExp("(</?)" + real + "(?=[\\s>])", "gi"), "$1" + alias);
  }
  return html;
}

// ------ Main ------
const filePath = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : 'docs/ru2gr_design-example/project/ru2gr.dc.html';

const src = readFileSync(filePath, 'utf-8');

// Extract template between <x-dc ...> and </x-dc>
const xdcMatch = src.match(/<x-dc(?:\s[^>]*)?>([\s\S]*?)<\/x-dc>/);
if (!xdcMatch) {
  console.error('No <x-dc> block found');
  process.exit(1);
}

const templateSrc = xdcMatch[1];
const encoded = encodeCase(templateSrc);
const encodedLines = encoded.split('\n');

// Parse with jsdom
const dom = new JSDOM(`<!DOCTYPE html><html><body>${encoded}</body></html>`);
const doc = dom.window.document;
const body = doc.body;

// Depth-first walk, assign tpl indices to element nodes (matching compileTemplate logic)
let tplN = 0;
const indexToElement = new Map(); // tplN -> { tagName, attributes, textSnippet, startLine, endLine }

function walk(node) {
  if (node.nodeType === 1) { // ELEMENT_NODE (same check as in support.js)
    const tplId = tplN++;
    const el = node;
    // Collect attributes
    const attrs = [];
    for (const attr of el.attributes) {
      attrs.push(`${attr.name}="${attr.value}"`);
    }
    const textSnippet = (el.textContent || '').trim().slice(0, 80);

    // Track line numbers: we approximate by looking at the outerHTML
    // More precisely, we use the node's position in the DOM
    indexToElement.set(tplId, {
      tagName: el.tagName.toLowerCase(),
      attrs,
      textSnippet,
      id: el.getAttribute('id') || '',
      className: el.getAttribute('class') || '',
      style: (el.getAttribute('style') || '').slice(0, 80),
      outerHtmlSnippet: (el.outerHTML || '').slice(0, 200),
    });
  }
  for (const child of node.childNodes) {
    walk(child);
  }
}

walk(body);

console.log(`Total element nodes with data-dc-tpl: ${tplN}\n`);

// Also try XPath from args
const xpathArg = process.argv.includes('--xpath')
  ? process.argv[process.argv.indexOf('--xpath') + 1]
  : null;
if (xpathArg) {
  console.log(`=== XPath trace: ${xpathArg} ===`);
  const steps = xpathArg.split('/').filter(Boolean);
  let expr = '';
  for (const step of steps) {
    expr += '/' + step;
    try {
      const result = doc.evaluate(expr, doc, null, 9, null);
      const n = result.singleNodeValue;
      if (n) {
        const idx = indexToElement.get(n);
        console.log(`${expr} => <${n.tagName.toLowerCase()}> idx=${idx !== undefined ? idx : 'N/A'} text="${(n.textContent||'').trim().slice(0,60)}"`);
      } else {
        console.log(`${expr} => NOT FOUND`);
        break;
      }
    } catch(e) {
      console.log(`${expr} => ERROR: ${e.message}`);
      break;
    }
  }
}

if (SHOW_ALL) {
  console.log('=== ALL INDICES ===');
  for (const [idx, info] of indexToElement) {
    console.log(`\n--- data-dc-tpl="${idx}" ---`);
    console.log(`  tag: <${info.tagName}>`);
    if (info.id) console.log(`  id: ${info.id}`);
    if (info.className) console.log(`  class: ${info.className}`);
    if (info.style) console.log(`  style: ${info.style}`);
    if (info.textSnippet) console.log(`  text: "${info.textSnippet}"`);
    console.log(`  outer: ${info.outerHtmlSnippet}`);
  }
} else {
  console.log('=== TARGET INDICES ===');
  for (const idx of TARGETS) {
    const info = indexToElement.get(idx);
    if (info) {
      console.log(`\n--- data-dc-tpl="${idx}" ---`);
      console.log(`  tag: <${info.tagName}>`);
      if (info.id) console.log(`  id: ${info.id}`);
      if (info.className) console.log(`  class: ${info.className}`);
      if (info.style) console.log(`  style: ${info.style}`);
      if (info.textSnippet) console.log(`  text: "${info.textSnippet}"`);
      console.log(`  outer: ${info.outerHtmlSnippet}`);
    } else {
      console.log(`\n--- data-dc-tpl="${idx}" --- NOT FOUND (max: ${tplN - 1})`);
    }
  }
}
