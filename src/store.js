// Small wrapper around localStorage. Browsers can block or wipe it (private windows,
// Safari after 7 days without a visit), so every call is guarded and an in-memory copy
// keeps the current session working either way.

const PREFIX = 'ts1:';
const memory = new Map();

export function load(key, fallback) {
  if (memory.has(key)) return memory.get(key);
  let value = fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) value = JSON.parse(raw);
  } catch { /* use fallback */ }
  memory.set(key, value);
  return value;
}

export function save(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* memory copy still works */ }
}

export function remove(key) {
  memory.delete(key);
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Ask the browser not to wipe our data (called once players have their own questions). */
export function askToKeepData() {
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
}
