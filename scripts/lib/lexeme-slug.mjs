// scripts/lib/lexeme-slug.mjs
// Единый детерминированный источник lexemeSlug для всех скриптов.
// Одинаковый вход → одинаковый выход, независимо от порядка запуска.

/**
 * Извлекает базовый slug из lexemeId.
 * grc-biblos-9adfa6 → biblos
 * grc-o-677c59 → o
 */
export function lexemeIdToSlug(lexemeId) {
  const parts = lexemeId.split('-');
  if (parts.length >= 3 && parts[0] === 'grc') {
    return parts.slice(1, -1).join('-');
  }
  return lexemeId;
}

/**
 * Строит полную карту Map<lexemeId, slug> по всему набору лемм + curated map.
 *
 * @param {Array} allLexemes — массив из enriched/lexemes.json (каждая запись имеет .id = lexemeId)
 * @param {Array} curatedItems — массив из top1000.core.json .items
 *        (каждая запись имеет .maculaLexemeId и .lexemeKey)
 * @returns {Map<string, string>} lexemeId → slug
 */
export function buildSlugMap(allLexemes, curatedItems) {
  // 1. curated map: maculaLexemeId → lexemeKey (приоритет, обратная совместимость)
  const curatedMap = new Map();
  if (curatedItems) {
    for (const item of curatedItems) {
      if (item.maculaLexemeId && item.lexemeKey) {
        curatedMap.set(item.maculaLexemeId, item.lexemeKey);
      }
    }
  }

  // 2. Сортируем леммы по lexemeId для детерминированности
  const sorted = [...allLexemes].sort((a, b) => (a.id || a.lexemeId || '').localeCompare(b.id || b.lexemeId || ''));

  // Первый проход: базовые slug'и
  const baseSlugs = new Map(); // lexemeId → baseSlug
  for (const lex of sorted) {
    const lexemeId = lex.id || lex.lexemeId;
    if (!lexemeId) continue;
    const slug = curatedMap.get(lexemeId) || lexemeIdToSlug(lexemeId);
    baseSlugs.set(lexemeId, slug);
  }

  // 3. Разрешение коллизий: считаем, сколько lexemeId дают одинаковый slug
  const slugCount = new Map(); // slug → count
  for (const [, slug] of baseSlugs) {
    slugCount.set(slug, (slugCount.get(slug) || 0) + 1);
  }

  // Slug'и с коллизией получают hex-суффикс из хвоста lexemeId
  // Хвост lexemeId уникален по построению → второго прохода не нужно
  const result = new Map();
  for (const lex of sorted) {
    const lexemeId = lex.id || lex.lexemeId;
    if (!lexemeId) continue;
    const baseSlug = baseSlugs.get(lexemeId);
    if (slugCount.get(baseSlug) > 1) {
      // Добавляем полный hex-хвост lexemeId (часть после последнего дефиса)
      const tail = lexemeId.split('-').pop();
      result.set(lexemeId, `${baseSlug}-${tail}`);
    } else {
      result.set(lexemeId, baseSlug);
    }
  }

  return result;
}
