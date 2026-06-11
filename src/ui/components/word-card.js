/**
 * Карточка буквы / слова.
 * Единый компонент для инспектора (десктоп) и bottom sheet (мобайл).
 */

/**
 * @param {object} letter — { lower, upper, name, translit, sound, ruEquivalents }
 * @param {object} progressEntry — { status } или undefined
 * @param {function} onMarkKnown — callback для кнопки «Я знаю эту букву»
 * @returns {HTMLElement}
 */
export function renderLetterCard(letter, progressEntry, onMarkKnown) {
  const card = document.createElement('div');
  card.className = 'card word-card';

  const status = progressEntry?.status || null;

  card.innerHTML = `
    <div class="word-card-letter">${letter.upper} ${letter.lower}</div>
    <div class="word-card-name">${letter.name}</div>
    <div class="word-card-sound">${letter.sound}</div>
    <div class="word-card-equiv">Соответствует русской «${letter.ruEquivalents[0]}»</div>
    <div class="word-card-actions"></div>
    <div class="word-card-disclaimer">Произношение — учебное приближение, не научная реконструкция.</div>
  `;

  const actions = card.querySelector('.word-card-actions');
  if (status === 'known') {
    const badge = document.createElement('span');
    badge.className = 'word-card-badge badge-known';
    badge.textContent = 'Освоена ✓';
    actions.appendChild(badge);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Я знаю эту букву';
    btn.addEventListener('click', () => {
      if (onMarkKnown) onMarkKnown(letter.lower);
      // Обновляем карточку
      const badge = document.createElement('span');
      badge.className = 'word-card-badge badge-known';
      badge.textContent = 'Освоена ✓';
      btn.replaceWith(badge);
    });
    actions.appendChild(btn);
  }

  return card;
}

/**
 * @param {object} lexeme — { id, lemma, translit, gloss, pos }
 * @param {object} dictEntry — запись из словаря или undefined
 * @param {object} context — { originalText }
 * @param {object} callbacks — { onMarkKnown, onAddToDict, onShowDetails }
 * @returns {HTMLElement}
 */
export function renderWordCard(lexeme, dictEntry, context = {}, callbacks = {}) {
  const card = document.createElement('div');
  card.className = 'card word-card';

  const inDict = !!dictEntry;
  const status = dictEntry?.status;

  card.innerHTML = `
    <div class="word-card-lemma">${lexeme.lemma}</div>
    <div class="word-card-translit">${lexeme.translit}</div>
    <div class="word-card-gloss">${lexeme.gloss}</div>
    ${context.originalText ? `<div class="word-card-replaces">Сейчас заменяет: «${context.originalText}»</div>` : ''}
    <div class="word-card-actions"></div>
    <div class="word-card-details" hidden></div>
  `;

  const actions = card.querySelector('.word-card-actions');

  // [Подробнее]
  const detailsBtn = document.createElement('button');
  detailsBtn.className = 'btn';
  detailsBtn.textContent = 'Подробнее';
  detailsBtn.addEventListener('click', () => {
    const details = card.querySelector('.word-card-details');
    if (details.hidden) {
      details.hidden = false;
      details.innerHTML = `
        <p><strong>Часть речи:</strong> ${lexeme.pos || '—'}</p>
        ${status ? `<p><strong>Статус:</strong> ${status}</p>` : ''}
      `;
      detailsBtn.textContent = 'Скрыть';
    } else {
      details.hidden = true;
      detailsBtn.textContent = 'Подробнее';
    }
  });
  actions.appendChild(detailsBtn);

  // [Я знаю] или [Добавить в словарь]
  if (inDict) {
    const knowBtn = document.createElement('button');
    knowBtn.className = 'btn';
    knowBtn.textContent = 'Я знаю';
    knowBtn.addEventListener('click', () => {
      if (callbacks.onMarkKnown) callbacks.onMarkKnown(lexeme.id);
      knowBtn.textContent = 'Освоено ✓';
      knowBtn.disabled = true;
    });
    actions.appendChild(knowBtn);
  } else {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.textContent = 'Добавить в словарь';
    addBtn.addEventListener('click', () => {
      if (callbacks.onAddToDict) callbacks.onAddToDict(lexeme.id);
      addBtn.textContent = 'Добавлено ✓';
      addBtn.disabled = true;
    });
    actions.appendChild(addBtn);
  }

  return card;
}
