export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

export function formatTimestamp(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function createEmitter() {
  const handlers = new Map();
  function on(type, fn) {
    const list = handlers.get(type) || [];
    handlers.set(type, [...list, fn]);
    return () => off(type, fn);
  }
  function off(type, fn) {
    const list = handlers.get(type) || [];
    handlers.set(type, list.filter(h => h !== fn));
  }
  function emit(type, ...args) {
    const list = handlers.get(type) || [];
    for (const h of list) h(...args);
  }
  return { on, off, emit };
}
