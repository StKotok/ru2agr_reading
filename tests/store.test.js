import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/state/store.js';

describe('createStore', () => {
  it('get returns initial state', () => {
    const store = createStore({ a: 1, b: 2 });
    expect(store.get()).toEqual({ a: 1, b: 2 });
  });

  it('update modifies state and notifies relevant subscribers', () => {
    const store = createStore({ a: 1, b: 2 });
    const cb = vi.fn();
    store.subscribe(['a'], cb);
    store.update(s => ({ ...s, a: 10 }));
    expect(store.get().a).toBe(10);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not notify subscribers of unchanged keys', () => {
    const store = createStore({ a: 1, b: 2 });
    const cbA = vi.fn();
    const cbB = vi.fn();
    store.subscribe(['a'], cbA);
    store.subscribe(['b'], cbB);
    store.update(s => ({ ...s, a: 10 }));
    expect(cbA).toHaveBeenCalledTimes(1);
    expect(cbB).not.toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const store = createStore({ a: 1 });
    const cb = vi.fn();
    const unsub = store.subscribe(['a'], cb);
    unsub();
    store.update(s => ({ ...s, a: 2 }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('subscriber with empty keys is notified on any change', () => {
    const store = createStore({ a: 1, b: 2 });
    const cb = vi.fn();
    store.subscribe([], cb);
    store.update(s => ({ ...s, a: 10 }));
    store.update(s => ({ ...s, b: 20 }));
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
