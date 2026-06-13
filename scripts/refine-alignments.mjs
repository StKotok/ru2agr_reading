#!/usr/bin/env node

/**
 * refine-alignments.mjs
 *
 * Постобработка alignment после build:data.
 * Три прохода:
 *   A — исправление G846 (αὐτός) → личное местоимение
 *   B — понижение качества сомнительных пар до q:"u"
 *   C — q-каскад, дедупликация, валидация
 *
 * Использование:
 *   node scripts/refine-alignments.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  cleanRuWord,
  SVOV_FORMS, SVOV_LEMMAS, SVOV_REFLEXIVE,
  SUBST_ARTICLE_RU, SUBST_ARTICLE_GR,
  RU_PRONOUNS, RU_PRONOUN_WORDS,
  parseG846Case, caseFromCode,
  CASE_COMPAT, lookupPrep
} from './lib/text-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SYN_DIR = resolve(ROOT, 'assets/data/bibles/syn');
const GRC_DIR = resolve(ROOT, 'assets/data/bibles/grc');

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveJson(path, data) {
  if (DRY_RUN) return;
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

// Русские служебные слова (для классового несоответствия в Pass B)
const RU_FUNCTION_WORDS = new Set([
  'и', 'а', 'но', 'же', 'ли', 'то', 'вот', 'да', 'или', 'ни', 'не', 'нибудь',
  'бы', 'у', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'от', 'из', 'по', 'о', 'об',
  'для', 'до', 'над', 'под', 'при', 'через', 'ради', 'пред', 'без', 'за', 'между',
  'что', 'чтобы', 'дабы', 'если', 'когда', 'как', 'так', 'потому', 'ибо', 'ведь',
  'пусть', 'даже', 'только', 'лишь', 'вот', 'ведь', 'мол', 'де', 'дескать'
]);

// Греческие служебные части речи (pos-колонка)
const GR_FUNCTION_POS = new Set(['det', 'conj', 'prep', 'adv', 'intj', 'part']);

// Греческие служебные леммы (Strong's)
const GR_FUNCTION_STRONG = new Set([
  3588,  // ὁ
  1161,  // δέ
  3303,  // μέν
  2532,  // καί
  1063,  // γάρ
  3767,  // οὖν
  5037,  // τέ
  2228,  // ἤ
  1487,  // εἰ
  1437,  // ἐάν
  302,   // ἄν
  3361,  // μή
  3756,  // οὐ
  3754,  // ὅτι
  2443,  // ἵνα
  3752,  // ὅταν
  5620,  // ὥστε
  5613,  // ὡς
  1722,  // ἐν
  1519,  // εἰς
  1537,  // ἐκ
  575,   // ἀπό
  4314,  // πρός
  2596,  // κατά
  1223,  // διά
  4012,  // περί
  5228,  // ὑπέρ
  5259,  // ὑπό
  3326,  // μετά
  4862,  // σύν
  4253,  // πρό
]);

function isGrFunction(grToken) {
  if (GR_FUNCTION_POS.has(grToken.morph)) return true;
  if (GR_FUNCTION_STRONG.has(grToken.strong)) return true;
  return false;
}

function isRuFunction(cleanWord) {
  return RU_FUNCTION_WORDS.has(cleanWord);
}

// ---------------------------------------------------------------------------
// Статистика
// ---------------------------------------------------------------------------

const stats = {
  totalVerses: 0,
  totalPairs: 0,
  passA_redirected: 0,
  passA_added: 0,
  passA_kept: 0,
  passB_downgraded: 0,
  passC_removedOOB: 0,
  passC_removedDup: 0,
  qE: 0, qF: 0, qU: 0,
};

const dryRunLog = [];

function logDryRun(msg) {
  if (DRY_RUN) dryRunLog.push(msg);
}

// ---------------------------------------------------------------------------
// Проход A: исправление G846 → личное местоимение
// ---------------------------------------------------------------------------

function passA(ruWords, grTokens, alignment, ref) {
  if (!alignment || alignment.length === 0) return alignment;

  // 1. Собрать orphans — невыровненные русские местоимения с признаками
  const alignedRu = new Set(alignment.map(p => p.ru));
  const orphans = [];
  for (let i = 0; i < ruWords.length; i++) {
    if (alignedRu.has(i)) continue;
    const cw = cleanRuWord(ruWords[i]).toLowerCase();
    const pron = RU_PRONOUNS[cw];
    if (pron) {
      orphans.push({ idx: i, word: ruWords[i], ...pron });
    }
  }

  // 2. Найти alignment-пары: gr.strong === 846 И ru ∈ SVOV_FORMS
  const pairs846 = [];
  const otherPairs = [];
  for (const p of alignment) {
    if (p.gr < 0 || p.gr >= grTokens.length) { otherPairs.push(p); continue; }
    const grTok = grTokens[p.gr];
    if (grTok.strong === 846) {
      const cw = cleanRuWord(ruWords[p.ru] || '').toLowerCase();
      if (SVOV_FORMS.has(cw)) {
        pairs846.push(p);
        continue;
      }
    }
    otherPairs.push(p);
  }

  if (pairs846.length === 0 || orphans.length === 0) return alignment;

  // Определяем падеж G846 из поля c
  const enriched = pairs846.map(p => {
    const tok = grTokens[p.gr];
    const grCase = tok.c ? caseFromCode(tok.c) : null;
    // Проверяем: G846 после предлога?
    const prevTok = p.gr > 0 ? grTokens[p.gr - 1] : null;
    const afterPrep = prevTok && (prevTok.morph === 'prep' || prevTok.strong);
    return { ...p, grCase, prevTok, afterPrep };
  });

  // Сортируем по gr-индексу для детерминизма
  enriched.sort((a, b) => a.gr - b.gr);

  const usedOrphans = new Set();
  const result = [...otherPairs];

  for (const ep of enriched) {
    let matchedOrphan = null;

    // Фильтр 1: предложный
    if (ep.afterPrep && ep.grCase && ep.prevTok) {
      const prepGreek = grTokens[ep.gr - 1].w.replace(/[ʼ']/g, '').trim().toLowerCase();
      const prepEntry = lookupPrep(prepGreek, ep.grCase.toUpperCase());
      if (prepEntry) {
        // Ищем orphan с русским предлогом и совместимым падежом
        let best = null;
        for (const orph of orphans) {
          if (usedOrphans.has(orph.idx)) continue;
          // Проверяем: за orphan'ом идёт русский предлог из таблицы?
          const ruPrep = cleanRuWord(ruWords[orph.idx - 1] || '').toLowerCase();
          if (prepEntry.ruPrep.size > 0 && !prepEntry.ruPrep.has(ruPrep)) continue;
          // Совместимость чисел
          const numOk = [...orph.numbers].some(n => ep.grCase); // число не в коде, падеж из кода
          // Совместимость падежей
          const caseOk = [...orph.cases].some(rc => prepEntry.ruCases.has(rc));
          if (!caseOk) continue;
          if (!best || orph.idx < best.idx) best = orph;
        }
        if (best) matchedOrphan = best;
      }
    }

    // Фильтр 2: падежный fallback (беспредложные, или предлог не в таблице)
    if (!matchedOrphan && ep.grCase) {
      const compatCases = CASE_COMPAT[ep.grCase.toUpperCase()];
      if (compatCases) {
        let best = null, bestGenderMatch = false;
        for (const orph of orphans) {
          if (usedOrphans.has(orph.idx)) continue;
          // Nom-сироты — только от Nom
          if (orph.cases.has('N') && ep.grCase.toUpperCase() !== 'N') continue;
          // Совместимость падежей
          const caseOk = [...orph.cases].some(rc => compatCases.has(rc));
          if (!caseOk) continue;
          // Совместимость чисел (жёстко)
          // Из кода: второй символ = число (s/p)
          const grNum = ep.grTok?.c ? ep.grTok.c[1] : null;
          const numOk = !grNum || orph.numbers.has(grNum);
          if (!numOk) continue;
          // Род — предпочтение, не запрет
          const grGend = ep.grTok?.c ? ep.grTok.c[2] : null;
          const genderMatch = !grGend || orph.genders.has(grGend);
          if (!best || (genderMatch && !bestGenderMatch) || (genderMatch === bestGenderMatch && orph.idx < best.idx)) {
            best = orph;
            bestGenderMatch = genderMatch;
          }
        }
        if (best) matchedOrphan = best;
      }
    }

    if (matchedOrphan) {
      // Перенаправить: G846 → orphan
      result.push({ ru: matchedOrphan.idx, gr: ep.gr, src: 'a' });
      usedOrphans.add(matchedOrphan.idx);
      stats.passA_redirected++;
      logDryRun(`[${ref}] A: ru[${ep.ru}]="${ruWords[ep.ru]}" → ru[${matchedOrphan.idx}]="${ruWords[matchedOrphan.idx]}" (gr[${ep.gr}]="${grTokens[ep.gr].w}")`);
    } else {
      // Нет совместимого orphan — оставить, q:"f"
      result.push(ep);
      stats.passA_kept++;
    }
  }

  // 7. Добавление пар для двойных сирот
  const remainingRu = new Set(result.map(p => p.ru));
  const remainingGr = new Set(result.map(p => p.gr));
  const unaligned846 = [];
  for (let gi = 0; gi < grTokens.length; gi++) {
    if (remainingGr.has(gi)) continue;
    if (grTokens[gi].strong === 846) unaligned846.push(gi);
  }
  const remainingOrphans = orphans.filter(o => !remainingRu.has(o.idx));

  if (unaligned846.length === 1 && remainingOrphans.length === 1) {
    const gi = unaligned846[0];
    const orph = remainingOrphans[0];
    const grTok = grTokens[gi];
    const grCase = grTok.c ? caseFromCode(grTok.c) : null;
    const grNum = grTok.c ? grTok.c[1] : null;
    // Nom только при Nom
    if (grCase && (!orph.cases.has('N') || grCase.toUpperCase() === 'N')) {
      const compatCases = CASE_COMPAT[grCase.toUpperCase()];
      const caseOk = compatCases && [...orph.cases].some(rc => compatCases.has(rc));
      const numOk = !grNum || orph.numbers.has(grNum);
      if (caseOk && numOk) {
        result.push({ ru: orph.idx, gr: gi, src: 'a' });
        stats.passA_added++;
        logDryRun(`[${ref}] A: +added ru[${orph.idx}]="${ruWords[orph.idx]}" ↔ gr[${gi}]="${grTok.w}"`);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Проход B: понижение качества до q:"u"
// ---------------------------------------------------------------------------

function determineQ(p, ruWords, grTokens, alignment) {
  const ru = p.ru, gr = p.gr;
  if (gr < 0 || gr >= grTokens.length) return 'u';
  const cw = cleanRuWord(ruWords[ru] || '').toLowerCase();
  const grTok = grTokens[gr];

  // Белый список — не понижать
  if (grTok.strong === 2400 && (cw === 'вот' || cw === 'се')) return 'e';        // ἰδού
  if (grTok.strong === 302 && cw === 'бы') return 'f';                            // ἄν
  if (SVOV_REFLEXIVE.has(grTok.strong) && SVOV_FORMS.has(cw)) return 'e';         // ἑαυτοῦ/ἴδιος…
  if (grTok.strong === 846 && SVOV_FORMS.has(cw)) return 'f';                     // αὐτός→свой без orphan (уже прошёл A)
  // Субстантивный артикль
  if (grTok.strong === 3588 && SUBST_ARTICLE_RU.has(cw)) {
    const nextTok = gr + 1 < grTokens.length ? grTokens[gr + 1] : null;
    if (nextTok && SUBST_ARTICLE_GR.has(nextTok.strong)) return 'f';
  }
  // μὲν οὖν
  if (grTok.strong === 3303 && cw === 'итак') {
    const nextTok = gr + 1 < grTokens.length ? grTokens[gr + 1] : null;
    if (nextTok && nextTok.strong === 3767) return 'f';
  }

  // Правила понижения до 'u'
  // 1. Артикль не в субстантивной позиции
  if (grTok.strong === 3588 && !SUBST_ARTICLE_RU.has(cw)) return 'u';

  // 2. «свой» без legitimate греческого источника
  if (SVOV_FORMS.has(cw) && !SVOV_LEMMAS.has(grTok.strong)) return 'u';

  // 3. μέν без οὖν
  if (grTok.strong === 3303 && cw !== 'итак') return 'u';

  // 4. Классовое несоответствие (на любой дистанции)
  const ruIsFunc = isRuFunction(cw);
  const grIsFunc = isGrFunction(grTok);
  if (ruIsFunc !== grIsFunc) return 'u';

  return null; // не понижать
}

function passB(ruWords, grTokens, alignment, ref) {
  if (!alignment) return alignment;

  const result = [];
  for (const p of alignment) {
    // Если q уже задан проходом A — не трогаем
    if (p.q && p.q !== 'u') { result.push(p); continue; }

    const newQ = determineQ(p, ruWords, grTokens, alignment);
    if (newQ === 'u') {
      stats.passB_downgraded++;
      logDryRun(`[${ref}] B: ru[${p.ru}]="${ruWords[p.ru]}" → gr[${p.gr}]="${grTokens[p.gr]?.w}" downgraded to u`);
      result.push({ ...p, q: 'u' });
    } else if (newQ) {
      result.push({ ...p, q: newQ });
    } else {
      result.push(p);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Проход C: q-каскад, дедупликация, валидация
// ---------------------------------------------------------------------------

function passC(alignment, ruWords, grTokens) {
  if (!alignment) return null;

  // 1. Удалить пары с индексами вне границ
  const inBounds = alignment.filter(p => {
    if (p.ru < 0 || p.ru >= ruWords.length || p.gr < 0 || p.gr >= grTokens.length) {
      stats.passC_removedOOB++;
      return false;
    }
    return true;
  });

  // 2. Дедупликация ru: z > a > l > remove
  const byRu = new Map();
  for (const p of inBounds) {
    const existing = byRu.get(p.ru);
    if (!existing) { byRu.set(p.ru, p); continue; }
    const rank = (s) => ({ z: 3, a: 2, l: 1 }[s] || 0);
    if (rank(p.src) > rank(existing.src)) {
      byRu.set(p.ru, p);
      stats.passC_removedDup++;
    } else {
      stats.passC_removedDup++;
    }
  }

  // 3. Дедупликация gr
  const byGr = new Map();
  for (const p of byRu.values()) {
    const existing = byGr.get(p.gr);
    if (!existing) { byGr.set(p.gr, p); continue; }
    const rank = (s) => ({ z: 3, a: 2, l: 1 }[s] || 0);
    if (rank(p.src) > rank(existing.src)) {
      byGr.set(p.gr, p);
      stats.passC_removedDup++;
    } else {
      stats.passC_removedDup++;
    }
  }

  const deduped = [...byGr.values()];

  // 4. q-каскад
  const result = deduped.map(p => {
    if (p.q) return p; // уже задан (из A или B)

    // Каскад
    if (p.src === 'z') return { ...p, q: 'e' };
    if (p.src === 'a') return { ...p, q: 'e' };
    if (p.src === 'l') return { ...p, q: 'u' };
    return { ...p, q: 'e' }; // default
  });

  return result.length > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// Оптимизация JSON при записи
// ---------------------------------------------------------------------------

function compactPair(p) {
  const out = { ru: p.ru, gr: p.gr };
  if (p.src && p.src !== 'z') out.src = p.src;      // default z
  if (p.q && p.q !== 'e') out.q = p.q;              // default e
  // c на паре не хранится — он на токене
  return out;
}

// ---------------------------------------------------------------------------
// Главный цикл
// ---------------------------------------------------------------------------

function main() {
  const synFiles = readdirSync(SYN_DIR).filter(f => f.endsWith('.json'));
  const grcFiles = new Set(readdirSync(GRC_DIR).filter(f => f.endsWith('.json')));

  for (const file of synFiles) {
    const bookId = file.replace('.json', '');
    if (!grcFiles.has(file)) continue;

    const synPath = resolve(SYN_DIR, file);
    const grcPath = resolve(GRC_DIR, file);
    const synBook = loadJson(synPath);
    const grcBook = loadJson(grcPath);

    // Строим карту греческих токенов: "ch:v" → tokens
    const grcVerseMap = new Map();
    for (const ch of grcBook.chapters) {
      for (const v of ch.verses) {
        if (v.tokens && v.tokens.length > 0) {
          grcVerseMap.set(`${ch.n}:${v.n}`, v.tokens);
        }
      }
    }

    for (const ch of synBook.chapters) {
      for (const verse of ch.verses) {
        stats.totalVerses++;
        const ref = `${bookId} ${ch.n}:${verse.n}`;
        const grcTokens = grcVerseMap.get(`${ch.n}:${verse.n}`);
        if (!grcTokens) continue;

        let alignment = verse.alignment || [];
        stats.totalPairs += alignment.length;
        if (alignment.length === 0) continue;

        const ruWords = verse.text.split(/\s+/);

        // Проход A
        alignment = passA(ruWords, grcTokens, alignment, ref);

        // Проход B
        alignment = passB(ruWords, grcTokens, alignment, ref);

        // Проход C
        alignment = passC(alignment, ruWords, grcTokens);

        if (alignment) {
          verse.alignment = alignment.map(compactPair);
          for (const p of alignment) {
            if (p.q === 'e') stats.qE++;
            else if (p.q === 'f') stats.qF++;
            else if (p.q === 'u') stats.qU++;
            else stats.qE++;
          }
        } else {
          delete verse.alignment;
        }
      }
    }

    saveJson(synPath, synBook);
    console.log(`  ${bookId}: OK`);
  }

  // Отчёт
  console.log(`\n📊 Refine statistics:`);
  console.log(`   Стихов: ${stats.totalVerses}`);
  console.log(`   Пар всего (вход): ${stats.totalPairs}`);
  console.log(`   Pass A: перенаправлено ${stats.passA_redirected}, добавлено ${stats.passA_added}, оставлено q:f ${stats.passA_kept}`);
  console.log(`   Pass B: понижено до u ${stats.passB_downgraded}`);
  console.log(`   Pass C: удалено OOB ${stats.passC_removedOOB}, дублей ${stats.passC_removedDup}`);
  console.log(`   q-распределение: e=${stats.qE}, f=${stats.qF}, u=${stats.qU}`);

  if (DRY_RUN) {
    const logPath = resolve(ROOT, 'alignment-refine.log');
    writeFileSync(logPath, dryRunLog.join('\n'), 'utf-8');
    console.log(`\n📝 Dry-run лог: ${logPath} (${dryRunLog.length} записей)`);
  }
}

main();
