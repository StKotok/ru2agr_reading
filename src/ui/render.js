/**
 * Превращает Segment[] в DocumentFragment.
 * plain-сегменты → текстовые узлы,
 * greek-сегменты → <span class="gr" data-original="..." data-kind="..." data-letter="..." data-lexeme="...">
 *
 * @param {Array} segments — массив сегментов
 * @param {object} ctx — контекст (letterNames: Map буква → имя для aria-label)
 * @returns {DocumentFragment}
 */
export function segmentsToFragment(segments, ctx = {}) {
  const { letterNames } = ctx;
  const frag = document.createDocumentFragment();

  for (const seg of segments) {
    if (seg.plain !== undefined) {
      frag.appendChild(document.createTextNode(seg.plain));
    } else if (seg.greek !== undefined) {
      const span = document.createElement('span');
      span.className = 'gr';
      span.textContent = seg.greek;
      span.setAttribute('data-original', seg.original);
      span.setAttribute('data-kind', seg.kind || 'letter');

      if (seg.letter) {
        span.setAttribute('data-letter', seg.letter);
      }
      if (seg.lexemeId) {
        span.setAttribute('data-lexeme', seg.lexemeId);
      }
      if (seg.morph) {
        span.setAttribute('data-morph', seg.morph);
      }
      if (seg.strong) {
        span.setAttribute('data-strong', String(seg.strong));
      }

      // Доступность
      span.setAttribute('tabindex', '0');
      span.setAttribute('role', 'button');

      const letter = seg.letter;
      if (letter && letterNames && letterNames.has(letter)) {
        span.setAttribute('aria-label', `греческая буква ${letterNames.get(letter)}`);
      } else if (seg.kind === 'word' || seg.kind === 'form') {
        span.setAttribute('aria-label', `греческое слово ${seg.greek}`);
      } else {
        span.setAttribute('aria-label', `греческая вставка ${seg.greek}`);
      }

      frag.appendChild(span);
    }
  }

  return frag;
}
