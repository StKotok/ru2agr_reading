export function createStore(initial) {
  let state = { ...initial };
  const subscribers = [];
  let _updating = false;

  function get() {
    return state;
  }

  function update(fn) {
    if (_updating) {
      // Реентерабельный вызов — подписчик вызывает update() во время уведомления.
      // Применяем fn, но не уведомляем повторно, чтобы избежать бесконечной рекурсии.
      state = fn(state);
      return;
    }
    _updating = true;
    try {
      const prev = state;
      state = fn(state);
      // Итерируем по снимку, чтобы unsubscribe во время итерации не сдвигал индексы
      const snapshot = [...subscribers];
      for (const { keys, cb } of snapshot) {
        // Проверяем что подписчик ещё активен (не был удалён во время уведомления)
        if (!subscribers.some(s => s.cb === cb)) continue;
        if (keys.length === 0 || keys.some(k => prev[k] !== state[k])) {
          cb(state);
        }
      }
    } finally {
      _updating = false;
    }
  }

  function subscribe(keys, cb) {
    const entry = { keys: [...keys], cb };
    subscribers.push(entry);
    return () => {
      const idx = subscribers.indexOf(entry);
      if (idx !== -1) subscribers.splice(idx, 1);
    };
  }

  return { get, update, subscribe };
}
