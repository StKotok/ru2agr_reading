/**
 * Анализатор покрытия alignment.
 * Выводит статистику по книгам и рекомендации для расширения лексикона.
 *
 * Использование:
 *   node scripts/analyze-coverage.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SYN_DIR = resolve(ROOT, 'public', 'data', 'bibles', 'syn');
const LEXICON_PATH = resolve(ROOT, 'public', 'data', 'lexicon', 'core.json');

function main() {
  console.log('=== Анализатор покрытия alignment ===\n');

  // 1. Покрытие по книгам
  console.log('📊 Покрытие alignment по книгам:\n');
  const files = readdirSync(SYN_DIR).filter(f => f.endsWith('.json'));
  const bookStats = [];
  let totalVerses = 0;
  let alignedVerses = 0;

  for (const file of files.sort()) {
    const syn = JSON.parse(readFileSync(resolve(SYN_DIR, file), 'utf-8'));
    let bookTotal = 0;
    let bookAligned = 0;

    for (const ch of syn.chapters) {
      for (const verse of ch.verses) {
        bookTotal++;
        if (verse.alignment && verse.alignment.length > 0) bookAligned++;
      }
    }

    totalVerses += bookTotal;
    alignedVerses += bookAligned;
    const pct = bookTotal > 0 ? (bookAligned / bookTotal * 100).toFixed(1) : '0.0';
    bookStats.push({ id: syn.id, short: syn.short, total: bookTotal, aligned: bookAligned, pct });
    console.log(`  ${syn.short.padEnd(5)} ${String(bookAligned).padStart(4)}/${String(bookTotal).padStart(4)} = ${pct}%`);
  }

  console.log(`\n  Всего: ${alignedVerses}/${totalVerses} = ${(alignedVerses / totalVerses * 100).toFixed(1)}%`);

  // 2. Топ-50 русских слов БЕЗ alignment
  console.log('\n\n📖 Топ-50 русских слов, не покрытых alignment:\n');
  const wordFreq = new Map();
  for (const file of files) {
    const syn = JSON.parse(readFileSync(resolve(SYN_DIR, file), 'utf-8'));
    for (const ch of syn.chapters) {
      for (const verse of ch.verses) {
        if (verse.alignment && verse.alignment.length > 0) continue; // покрытые стихи пропускаем
        const words = verse.text.split(/\s+/);
        const alignedSet = new Set((verse.alignment || []).map(a => a.ru));
        for (let wi = 0; wi < words.length; wi++) {
          if (alignedSet.has(wi)) continue;
          const clean = words[wi].replace(/[.,;:!?—\-–"'«»„"()\[\]¿¡;]+$/g, '').replace(/^[«»"'(\[\]]+/g, '').toLowerCase();
          if (clean.length < 3) continue;
          wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1);
        }
      }
    }
  }

  const sorted = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
  for (const [word, count] of sorted) {
    console.log(`  ${word.padEnd(20)} ${count}`);
  }

  // 3. Топ-50 лемм, которые увеличили бы покрытие
  console.log('\n\n📚 Топ-50 лемм, которые увеличили бы покрытие:\n');
  const lexicon = JSON.parse(readFileSync(LEXICON_PATH, 'utf-8'));
  const lexStrongs = new Set(lexicon.filter(l => l.strong && !l.skip).map(l => l.strong));

  // Собираем Strong-номера из непокрытых стихов
  const missingByStrong = new Map();
  for (const file of files) {
    // Для этого нужен grc-файл, но у нас нет прямого доступа без полноценного пайплайна
    // Поэтому просто анализируем непокрытые слова
  }

  // Вместо полноценного анализа выводим рекомендации
  console.log('  (для детального анализа нужен запуск build:data с лексиконом)');
  console.log('  Рекомендация: добавить леммы для слов из топа-50 выше');
  console.log('  с соответствующими номерами Стронга.');

  // 4. Книги с наихудшим покрытием
  console.log('\n\n⚠️  Книги с наихудшим покрытием:\n');
  const worst = bookStats.sort((a, b) => parseFloat(a.pct) - parseFloat(b.pct)).slice(0, 5);
  for (const b of worst) {
    console.log(`  ${b.short.padEnd(5)} ${b.pct}% (${b.aligned}/${b.total})`);
  }

  console.log('\n✅ Анализ завершён.');
}

main();
