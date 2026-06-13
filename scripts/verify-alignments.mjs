#!/usr/bin/env node

/**
 * verify-alignments.mjs
 *
 * Верификация alignment после refine.
 * Проверяет: инварианты, whitelist, gold-эталон, статистику.
 *
 * Использование:
 *   node scripts/verify-alignments.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cleanRuWord } from './lib/text-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SYN_DIR = resolve(ROOT, 'assets/data/bibles/syn');
const GRC_DIR = resolve(ROOT, 'assets/data/bibles/grc');
const VARIANTS_PATH = resolve(ROOT, 'assets/data/textual-variants.json');
const GOLD_DEV_PATH = resolve(ROOT, 'test/fixtures/gold-dev.json');
const GOLD_HELDOUT_PATH = resolve(ROOT, 'test/fixtures/gold-heldout.json');

let errors = 0;
function fail(msg) { console.error('❌ ' + msg); errors++; }
function warn(msg) { console.warn('⚠ ' + msg); }

// ---------------------------------------------------------------------------
// Инварианты
// ---------------------------------------------------------------------------

function checkInvariants() {
  console.log('\n🔍 Инварианты...');
  const synFiles = readdirSync(SYN_DIR).filter(f => f.endsWith('.json'));
  const grcFiles = new Set(readdirSync(GRC_DIR).filter(f => f.endsWith('.json')));

  let totalPairs = 0, totalQe = 0, totalQf = 0, totalQu = 0;
  const validKeys = new Set(['ru', 'gr', 'src', 'q', 'c']);

  for (const file of synFiles) {
    const bookId = file.replace('.json', '');
    if (!grcFiles.has(file)) continue;

    const synBook = JSON.parse(readFileSync(resolve(SYN_DIR, file), 'utf-8'));
    const grcBook = JSON.parse(readFileSync(resolve(GRC_DIR, file), 'utf-8'));

    // Карта греческих токенов
    const grcVerseMap = new Map();
    for (const ch of grcBook.chapters) {
      for (const v of ch.verses) {
        if (v.tokens && v.tokens.length > 0) {
          grcVerseMap.set(`${ch.n}:${v.n}`, { tokens: v.tokens, n: v.n });
        }
      }
    }

    for (const ch of synBook.chapters) {
      for (const verse of ch.verses) {
        const ref = `${bookId} ${ch.n}:${verse.n}`;
        const alignment = verse.alignment;
        if (!alignment || alignment.length === 0) continue;

        const grcEntry = grcVerseMap.get(`${ch.n}:${verse.n}`);
        if (!grcEntry) continue;
        const grcTokens = grcEntry.tokens;
        const ruWords = verse.text.split(/\s+/);

        // 1. Схема
        for (const p of alignment) {
          const extraKeys = Object.keys(p).filter(k => !validKeys.has(k));
          if (extraKeys.length > 0) fail(`${ref}: недопустимые ключи: ${extraKeys.join(',')}`);
          if (!('ru' in p) || !('gr' in p)) fail(`${ref}: пара без ru или gr`);
        }

        // 2. Границы
        for (const p of alignment) {
          if (p.ru < 0 || p.ru >= ruWords.length)
            fail(`${ref}: ru=${p.ru} вне стиха (${ruWords.length} слов)`);
          if (p.gr < 0 || p.gr >= grcTokens.length)
            fail(`${ref}: gr=${p.gr} вне стиха (${grcTokens.length} токенов)`);
        }

        // 3. Уникальность (на ПОЛНОМ множестве)
        const ruSeen = new Set(), grSeen = new Set();
        for (const p of alignment) {
          if (ruSeen.has(p.ru)) fail(`${ref}: дубликат ru=${p.ru}`);
          if (grSeen.has(p.gr)) fail(`${ref}: дубликат gr=${p.gr}`);
          ruSeen.add(p.ru);
          grSeen.add(p.gr);
        }

        // 4. Подсчёт
        for (const p of alignment) {
          totalPairs++;
          const q = p.q || 'e';
          if (q === 'e') totalQe++;
          else if (q === 'f') totalQf++;
          else if (q === 'u') totalQu++;
        }
      }
    }
  }

  if (errors === 0) console.log(`   ✅ Инварианты: ${totalPairs} пар — схема, границы, уникальность OK`);
  return { totalPairs, totalQe, totalQf, totalQu };
}

// ---------------------------------------------------------------------------
// Сверка с whitelist
// ---------------------------------------------------------------------------

function checkWhitelist() {
  if (!existsSync(VARIANTS_PATH)) {
    warn('textual-variants.json не найден — пропускаем сверку');
    return;
  }

  console.log('\n🔍 Сверка с whitelist...');
  const registry = JSON.parse(readFileSync(VARIANTS_PATH, 'utf-8'));
  let whitelistErrors = 0;

  // Проверяем synOnlyPhrases
  if (registry.synOnlyPhrases) {
    for (const entry of registry.synOnlyPhrases) {
      const [bookId, chv] = entry.ref.split(' ');
      const [chStr, vStr] = chv.split(':');
      const synPath = resolve(SYN_DIR, `${bookId}.json`);
      if (!existsSync(synPath)) { warn(`${entry.ref}: syn файл не найден`); continue; }

      const synBook = JSON.parse(readFileSync(synPath, 'utf-8'));
      const ch = synBook.chapters.find(c => c.n === parseInt(chStr));
      if (!ch) { warn(`${entry.ref}: глава не найдена`); continue; }
      const verse = ch.verses.find(v => v.n === parseInt(vStr));
      if (!verse) { warn(`${entry.ref}: стих не найден`); continue; }

      const words = verse.text.split(/\s+/);
      const actual = words.slice(entry.fromIdx, entry.fromIdx + entry.ruWords.length);

      // Проверяем непрерывное совпадение
      let mismatch = false;
      for (let i = 0; i < entry.ruWords.length; i++) {
        if (i >= actual.length || actual[i] !== entry.ruWords[i]) {
          fail(`${entry.ref}: whitelist mismatch at offset ${i}: expected «${entry.ruWords[i]}», got «${actual[i] || 'EOS'}»`);
          mismatch = true;
          whitelistErrors++;
          break;
        }
      }
      if (!mismatch) {
        console.log(`   ✅ ${entry.ref}: «${entry.ruWords.slice(0, 4).join(' ')}…» — whitelist OK`);
      }
    }
  }

  if (whitelistErrors === 0) console.log('   ✅ Все whitelist-записи актуальны');
}

// ---------------------------------------------------------------------------
// Метрики против gold-эталона
// ---------------------------------------------------------------------------

function checkGold(goldPath, label) {
  if (!existsSync(goldPath)) {
    warn(`${label}: файл не найден — пропускаем`);
    return null;
  }

  console.log(`\n🔍 ${label}...`);
  const gold = JSON.parse(readFileSync(goldPath, 'utf-8'));

  let totalGoldPairs = 0;
  let matched = 0, matchedExact = 0;
  let missed = 0, extra = 0;

  for (const entry of gold) {
    const [bookId, chv] = entry.ref.split(' ');
    const [chStr, vStr] = chv.split(':');

    const synPath = resolve(SYN_DIR, `${bookId}.json`);
    if (!existsSync(synPath)) { warn(`${entry.ref}: syn не найден`); continue; }

    const synBook = JSON.parse(readFileSync(synPath, 'utf-8'));
    const ch = synBook.chapters.find(c => c.n === parseInt(chStr));
    if (!ch) continue;
    const verse = ch.verses.find(v => v.n === parseInt(vStr));
    if (!verse) continue;

    const actualPairs = verse.alignment || [];

    // Строим карту для быстрого поиска
    const actualMap = new Map();
    for (const p of actualPairs) {
      const q = p.q || 'e';
      if (q === 'u') continue; // u-пары исключены из метрик
      actualMap.set(`${p.ru}:${p.gr}`, q);
    }

    // Сравниваем с золотыми парами
    for (const gp of entry.pairs) {
      totalGoldPairs++;
      const key = `${gp.ru}:${gp.gr}`;
      const actualQ = actualMap.get(key);
      if (actualQ) {
        matched++;
        if (actualQ === gp.q) matchedExact++;
      } else {
        missed++;
        if (missed <= 5) {
          const rw = entry.ruWords[gp.ru];
          const gw = entry.grTokens[gp.gr];
          warn(`${entry.ref}: gold pair ru[${gp.ru}]="${rw}"↔gr[${gp.gr}]="${gw}" not found in actual`);
        }
      }
    }

    // Считаем лишние пары (в actual но не в gold)
    const goldKeySet = new Set(entry.pairs.map(gp => `${gp.ru}:${gp.gr}`));
    for (const p of actualPairs) {
      if ((p.q || 'e') === 'u') continue;
      if (!goldKeySet.has(`${p.ru}:${p.gr}`)) extra++;
    }
  }

  const precision = matched / (matched + extra) * 100;
  const recall = matched / totalGoldPairs * 100;
  console.log(`   Gold pairs: ${totalGoldPairs}`);
  console.log(`   Matched: ${matched} (exact q: ${matchedExact})`);
  console.log(`   Missed: ${missed}, Extra: ${extra}`);
  console.log(`   Precision: ${precision.toFixed(1)}%, Recall: ${recall.toFixed(1)}%`);

  return { precision, recall, totalGoldPairs, matched, matchedExact, missed, extra };
}

// ---------------------------------------------------------------------------
// Статистика
// ---------------------------------------------------------------------------

function printStats(inv) {
  console.log('\n📊 Статистика:');
  console.log(`   Всего пар: ${inv.totalPairs}`);
  console.log(`   q=e (exact): ${inv.totalQe} (${(inv.totalQe/inv.totalPairs*100).toFixed(1)}%)`);
  console.log(`   q=f (functional): ${inv.totalQf} (${(inv.totalQf/inv.totalPairs*100).toFixed(1)}%)`);
  console.log(`   q=u (uncertain): ${inv.totalQu} (${(inv.totalQu/inv.totalPairs*100).toFixed(1)}%)`);
  console.log(`   Видимых (e+f): ${inv.totalQe + inv.totalQf} (${((inv.totalQe+inv.totalQf)/inv.totalPairs*100).toFixed(1)}%)`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const inv = checkInvariants();
checkWhitelist();
const devMetrics = checkGold(GOLD_DEV_PATH, 'gold-dev');
const heldoutMetrics = checkGold(GOLD_HELDOUT_PATH, 'gold-heldout');
printStats(inv);

console.log(`\n${errors === 0 ? '✅' : '❌'} Верификация завершена. Ошибок: ${errors}`);

if (errors > 0) process.exit(1);
