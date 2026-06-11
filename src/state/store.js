export function createStore(initial) {
  let state = { ...initial };
  const subscribers = [];

  function get() {
    return state;
  }

  function update(fn) {
    const prev = state;
    state = fn(state);
    // Уведомляем подписчиков, чьи ключи изменились
    for (const { keys, cb } of subscribers) {
      if (keys.length === 0 || keys.some(k => prev[k] !== state[k])) {
        cb(state);
      }
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
