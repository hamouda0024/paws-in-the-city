/**
 * localStorage with a safety net.
 *
 * WebView localStorage can throw (private mode, disabled storage, quota) and its
 * contents are user-writable text, so nothing here ever trusts it: reads are
 * wrapped, JSON is parsed defensively, and every value is validated against a
 * schema before the game touches it. If storage is unavailable the writes fall
 * back to an in-memory map so the current session still behaves normally.
 */

const memory = new Map();

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** True when saves actually survive a restart (false in private/quota-blocked modes). */
export function isPersistent() {
  const ls = store();
  if (!ls) return false;
  try {
    const probe = '__urban_stray_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Parsed value or `fallback`; never throws, never returns half-parsed data. */
export function readJSON(key, fallback = null) {
  const ls = store();
  if (ls) {
    try {
      const raw = ls.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // Corrupt payload: drop it so the next write starts from a clean slate.
      try { ls.removeItem(key); } catch { /* nothing else to do */ }
    }
  }
  if (memory.has(key)) return memory.get(key);
  return fallback;
}

/** Returns true when the value reached disk; the in-memory copy is always kept. */
export function writeJSON(key, value) {
  let plain;
  try {
    plain = JSON.parse(JSON.stringify(value));
  } catch {
    return false;
  }
  memory.set(key, plain);
  const ls = store();
  if (!ls) return false;
  try {
    ls.setItem(key, JSON.stringify(plain));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  memory.delete(key);
  const ls = store();
  if (!ls) return;
  try { ls.removeItem(key); } catch { /* ignore */ }
}

const TOUCH_MODES = ['auto', 'on', 'off'];
const LIGHTING_MODES = ['high', 'low'];
const LANGUAGES = ['auto', 'en', 'ar'];

/** Accepts only known keys with known types; anything else falls back to defaults. */
export function sanitizeSettings(raw, defaults) {
  const out = { ...defaults };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (typeof raw.sound === 'boolean') out.sound = raw.sound;
  if (typeof raw.haptics === 'boolean') out.haptics = raw.haptics;
  if (TOUCH_MODES.includes(raw.touch)) out.touch = raw.touch;
  if (LIGHTING_MODES.includes(raw.lighting)) out.lighting = raw.lighting;
  if (LANGUAGES.includes(raw.language)) out.language = raw.language;
  return out;
}

const RECORD_NUMBERS = ['bestDay', 'bestFood', 'bestDistance', 'runs', 'goldFish'];
const MAX_RECORD = 1e9;

/** Records are display data, so a tampered file must never produce NaN in the UI. */
export function sanitizeRecords(raw, defaults) {
  const out = { ...defaults };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of RECORD_NUMBERS) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_RECORD) {
      out[key] = Math.floor(value);
    }
  }
  if (typeof raw.doubleJump === 'boolean') out.doubleJump = raw.doubleJump;
  return out;
}
