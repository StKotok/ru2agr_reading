/**
 * Ползунок интенсивности греческого слоя.
 * @param {object} ctx — { store, onUpdate }
 * @returns {HTMLElement}
 */
export function createIntensitySlider(ctx) {
  const { store, onUpdate } = ctx;

  const container = document.createElement('div');
  container.className = 'intensity-slider';

  const label = document.createElement('label');
  label.textContent = 'Греческий: ';
  container.appendChild(label);

  const valueSpan = document.createElement('span');
  valueSpan.className = 'intensity-value';
  container.appendChild(valueSpan);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '5';
  slider.setAttribute('aria-label', 'Интенсивность греческого слоя');
  container.appendChild(slider);

  function updateUI(state) {
    const val = state.settings?.intensity ?? 35;
    slider.value = String(val);
    valueSpan.textContent = val + '%';
  }

  let debounceTimer = null;
  slider.addEventListener('input', () => {
    const val = parseInt(slider.value);
    valueSpan.textContent = val + '%';

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (onUpdate) onUpdate('intensity', val);
    }, 150);
  });

  store.subscribe(['settings'], updateUI);
  updateUI(store.get());

  return container;
}
