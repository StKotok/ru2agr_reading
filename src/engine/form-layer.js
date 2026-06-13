import { hash01 } from './hash.js';

/**
 * Полный regex trailing punctuation: русская + греческая (включая ; U+037E).
 * Захватывает знаки препинания в конце слова.
 */
const TRAILING_PUNCT_RE = /[.,;:!?;—\-–"'«»„"()\[\]'¿¡]+$/g;

/**
 * Применяет формовый слой (режим 4): заменяет русские слова на реальные
 * греческие формы из выравнивания.
 *
 * @param {string} verseText — русский текст стиха
 * @param {Array} grcTokens — токены греческого стиха [{w, lemma, morph, strong}]
 * @param {Array} alignment — [{ru: индекс_русского_слова, gr: индекс_греческого_токена}]
 * @param {Array} dictEntries — записи словаря [{lexemeId, lemma, intensityPct, strong, forms, status}]
 * @param {object} opts — {seedPrefix, verseRef}
 * @returns {Array} Segment[]
 */
export function applyFormLayer(verseText, grcTokens, alignment, dictEntries, opts = {}) {
  const { seedPrefix = '' } = opts;
  if (!grcTokens || grcTokens.length === 0 || !alignment || alignment.length === 0) {
    return [{ plain: verseText }];
  }

  const ruWords = verseText.split(/\s+/);
  const segments = [];

  // Строим карту: индекс русского слова → греческий токен
  // Пары с q:"u" (uncertain) пропускаются — слово остаётся без подсветки
  const alignMap = new Map();
  const qualityMap = new Map(); // ruIdx → quality level для "f" пар
  for (const a of alignment) {
    if (a.q === 'u') continue;
    alignMap.set(a.ru, a.gr);
    if (a.q === 'f') qualityMap.set(a.ru, 'f');
  }

  // Карта strong → dictEntry для быстрого поиска
  const dictByStrong = new Map();
  for (const entry of dictEntries) {
    const strongNum = entry.strong || entry.strongNum;
    if (strongNum) dictByStrong.set(String(strongNum), entry);
  }

  for (let wi = 0; wi < ruWords.length; wi++) {
    const ruWord = ruWords[wi];

    // Извлекаем trailing punctuation из слова
    const cleanWord = ruWord.replace(TRAILING_PUNCT_RE, '');
    const punctMatch = ruWord.match(TRAILING_PUNCT_RE);
    const trailingPunct = punctMatch ? punctMatch[0] : '';

    const grIdx = alignMap.get(wi);

    if (grIdx !== undefined && grIdx < grcTokens.length) {
      const grToken = grcTokens[grIdx];
      const strongStr = String(grToken.strong);
      const dictEntry = dictByStrong.get(strongStr);

      if (dictEntry) {
        // Защита: валидируем русское слово через ruMatches лексикона
        // Если у словарной записи есть regexps, cleanWord должен матчиться
        if (dictEntry.regexps && dictEntry.regexps.length > 0) {
          let regexMatched = false;
          for (const re of dictEntry.regexps) {
            if (re.test(cleanWord)) {
              // Проверяем exclude-паттерны
              let excluded = false;
              for (const excRe of (dictEntry.excludeRegexps || [])) {
                if (excRe.test(cleanWord)) { excluded = true; break; }
              }
              if (!excluded) { regexMatched = true; break; }
            }
          }
          if (!regexMatched) {
            // Слово не матчится ни одной регулярке лексикона — пропускаем замену
            segments.push({ plain: ruWord });
            if (wi < ruWords.length - 1) segments.push({ plain: ' ' });
            continue;
          }
        }

        const seed = `${seedPrefix}:${wi}:${grToken.strong}`;
        const pct = dictEntry.intensityPct ?? 100;
        const shouldReplace = dictEntry.status === 'known' || hash01(seed) * 100 < pct;

        if (shouldReplace) {
          const display = dictEntry.forms === 'lemma' ? grToken.lemma : grToken.w;
          const isUpper = ruWord[0] === ruWord[0].toUpperCase();
          let greekText = display;
          if (isUpper && greekText.length > 0) {
            greekText = greekText[0].toUpperCase() + greekText.slice(1);
          }

          const seg = {
            greek: greekText,
            original: cleanWord || ruWord,
            kind: 'form',
            lexemeId: dictEntry.lexemeId,
            morph: grToken.morph,
            strong: grToken.strong
          };
          if (qualityMap.has(wi)) seg.quality = 'f';
          segments.push(seg);

          // Добавляем trailing punctuation как отдельный plain-сегмент
          if (trailingPunct) {
            segments.push({ plain: trailingPunct });
          }

          // Разделитель между словами (кроме последнего)
          if (wi < ruWords.length - 1) {
            segments.push({ plain: ' ' });
          }
          continue;
        }
      }
    }

    // Не заменяем — оставляем как plain
    segments.push({ plain: ruWord });
    if (wi < ruWords.length - 1) {
      segments.push({ plain: ' ' });
    }
  }

  // Убираем trailing space после последнего сегмента
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    if (last.plain === ' ') {
      segments.pop();
    }
  }

  return segments;
}
