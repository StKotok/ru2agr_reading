// scripts/lib/align-normalize.mjs
// Единый модуль нормализации для build и verify.
// Используется ТОЛЬКО через импорт — build и verify обязаны применять одни и те же
// функции нормализации и WORD_PATTERN, чтобы accuracy-инвариант не давал ложных срабатываний.

// =============================================================================
// Word pattern (synchronized with build-bibles.mjs tokenizeWords)
// =============================================================================

export const WORD_PATTERN = /[\p{L}\p{N}'’]+/gu;

// =============================================================================
// Normalization functions
// =============================================================================

export function normalizeWord(w) {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').trim();
}

export function normalizeBerean(gloss) {
  // Berean '[The] book' → 'book' (strip optional bracketed words + brackets)
  // '[the] God' → 'God', 'of [the] genealogy' → 'of genealogy'
  // Then lowercase and trim.
  const stripped = gloss.replace(/\[.*?\]/g, '').replace(/\s{2,}/g, ' ').toLowerCase().trim();
  return stripped;
}

export function fuzzyNormalize(w) {
  // Lowercase, strip punctuation, normalize apostrophes
  return w.toLowerCase()
    .replace(/[’'']/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, '')
    .trim();
}

export function tokenizeGloss(text) {
  const words = [];
  let match;
  WORD_PATTERN.lastIndex = 0;
  while ((match = WORD_PATTERN.exec(text)) !== null) {
    words.push(match[0]);
  }
  return words;
}

// =============================================================================
// Method registry — закрытый перечень методов выравнивания
// =============================================================================

export const ALIGN_METHODS = {
  'gloss-exact':        { tier: 'proven',  q: 'a' },
  'bracket-optional':   { tier: 'proven',  q: 'a' },
  'phrase':             { tier: 'proven',  q: 'a' },
  'alt-gloss-exact':    { tier: 'proven',  q: 'a' },
  'alt-gloss-bracket':  { tier: 'proven',  q: 'a' },
  'alt-gloss-phrase':   { tier: 'proven',  q: 'a' },
  'lexicon-gloss-exact': { tier: 'proven', q: 'a' },
  'fuzzy':              { tier: 'fuzzy',   q: 'f' },
  'manual':             { tier: 'manual',  q: 'a' },
  'positional-equal-count': { tier: 'proposal', q: 'a' }, // off by default
};

// =============================================================================
// Resolution taxonomy — категории РАЗРЕШЕНИЯ не-служебных токенов БЕЗ пары.
// Каждый fw===false токен попадает ровно в одну категорию: либо он `aligned`
// (есть пара в pairsByRef), либо ровно одна из категорий ниже (в exclusionsByRef).
// `auto-deferred` — честная замена фейковой ручной курации: «алгоритм не разрешил»
// (backlog), а НЕ «человек решил, что слово невыравниваемо».
// =============================================================================

export const RESOLUTION_KINDS = {
  'manual-exclusion': { source: 'human', countsAligned: false }, // рукописная причина
  'no-bsb-verse':     { source: 'auto',  countsAligned: false }, // нет BSB-стиха для ref
  'no-gloss':         { source: 'auto',  countsAligned: false }, // обе глоссы пусты
  'auto-deferred':    { source: 'auto',  countsAligned: false }, // backlog, см. AUTO_DEFER_REASONS
};

export const AUTO_DEFER_REASONS = ['no-matching-word', 'ambiguous', 'already-claimed'];

// =============================================================================
// Accuracy invariant — проверка формального соответствия slice ↔ gloss по методу
// =============================================================================

/**
 * Проверяет, соответствует ли BSB-slice глоссе по заданному методу.
 *
 * @param {string} slice — текст из verse.text.slice(span[0], span[1])
 * @param {string} gloss — глосса (Berean или Cherith в зависимости от метода)
 * @param {string} method — метод выравнивания
 * @param {{ lexiconGlosses?: Set<string> }} [opts]
 *        lexiconGlosses — множество нормализованных однословных глосс лексемы
 *        (для метода 'lexicon-gloss-exact')
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkPairAccuracy(slice, gloss, method, opts = {}) {
  const m = ALIGN_METHODS[method];
  if (!m) {
    return { ok: false, reason: `unknown method: ${method}` };
  }

  const tier = m.tier;

  switch (method) {
    // ── proven: single-word exact ──
    case 'gloss-exact':
    case 'alt-gloss-exact': {
      const ok = normalizeWord(slice) === normalizeWord(gloss);
      return ok ? { ok: true } : { ok: false, reason: `exact mismatch: "${normalizeWord(slice)}" !== "${normalizeWord(gloss)}"` };
    }

    // ── proven: bracket-optional ──
    case 'bracket-optional':
    case 'alt-gloss-bracket': {
      const ok = normalizeWord(slice) === normalizeWord(normalizeBerean(gloss));
      return ok ? { ok: true } : { ok: false, reason: `bracket mismatch: "${normalizeWord(slice)}" !== "${normalizeWord(normalizeBerean(gloss))}"` };
    }

    // ── proven: phrase ──
    case 'phrase':
    case 'alt-gloss-phrase': {
      const sliceTokens = tokenizeGloss(slice).map(normalizeWord);
      const glossTokens = tokenizeGloss(gloss).map(normalizeWord);
      if (sliceTokens.length !== glossTokens.length) {
        return { ok: false, reason: `phrase token count mismatch: ${sliceTokens.length} vs ${glossTokens.length}` };
      }
      for (let i = 0; i < sliceTokens.length; i++) {
        if (sliceTokens[i] !== glossTokens[i]) {
          return { ok: false, reason: `phrase token[${i}] mismatch: "${sliceTokens[i]}" !== "${glossTokens[i]}"` };
        }
      }
      return { ok: true };
    }

    // ── proven: lexicon-gloss-exact ──
    case 'lexicon-gloss-exact': {
      const lexGlosses = opts.lexiconGlosses;
      if (!lexGlosses || lexGlosses.size === 0) {
        return { ok: false, reason: 'no lexicon glosses provided for lexicon-gloss-exact' };
      }
      const ok = lexGlosses.has(normalizeWord(slice));
      return ok ? { ok: true } : { ok: false, reason: `"${normalizeWord(slice)}" not in lexicon glosses` };
    }

    // ── fuzzy ──
    case 'fuzzy': {
      const ok = fuzzyNormalize(slice) === fuzzyNormalize(gloss);
      return ok ? { ok: true } : { ok: false, reason: `fuzzy mismatch: "${fuzzyNormalize(slice)}" !== "${fuzzyNormalize(gloss)}"` };
    }

    // ── manual ──
    case 'manual': {
      // Базовая проверка: slice содержит буквы/цифры (структурная валидация в verify)
      const hasLetters = /[\p{L}\p{N}]/u.test(slice);
      if (!hasLetters) {
        return { ok: false, reason: 'manual pair has no letters/digits in slice' };
      }
      return { ok: true };
    }

    // ── positional-equal-count (proposal) ──
    case 'positional-equal-count': {
      // Формально валидируем так же как exact (но tier=proposal, off by default)
      const ok = normalizeWord(slice) === normalizeWord(gloss);
      return ok ? { ok: true } : { ok: false, reason: `positional mismatch: "${normalizeWord(slice)}" !== "${normalizeWord(gloss)}"` };
    }

    default:
      return { ok: false, reason: `unhandled method: ${method}` };
  }
}
