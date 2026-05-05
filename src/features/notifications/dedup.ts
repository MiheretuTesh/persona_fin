import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny AsyncStorage-backed "have we already fired this notification?" tracker.
 *
 * Each notification rule produces a deterministic key like:
 *   `budget:100:<categoryId>:2026-05`
 *   `month:expense_over_income:2026-05`
 *
 * The key encodes the *invariant* (which alert, for which subject, in which
 * period). Once we mark it fired, we skip it until the period rolls over and a
 * new key is generated. We persist a flat `Record<key, isoTimestamp>` so we can
 * also implement future garbage-collection (e.g., evict entries older than 90 days).
 */

const STORAGE_KEY = 'eq.notifications.dedup.v1';

let cache: Record<string, string> | null = null;
let loadPromise: Promise<Record<string, string>> | null = null;

async function load(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      cache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      cache = {};
    }
    loadPromise = null;
    return cache;
  })();
  return loadPromise;
}

async function persist() {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Best-effort. Worst case: a notification fires twice across cold starts.
  }
}

export async function hasFired(key: string): Promise<boolean> {
  const map = await load();
  return Object.prototype.hasOwnProperty.call(map, key);
}

export async function markFired(key: string): Promise<void> {
  const map = await load();
  map[key] = new Date().toISOString();
  await persist();
}

/** For tests / "reset notifications" debug actions. */
export async function clearDedup(): Promise<void> {
  cache = {};
  await AsyncStorage.removeItem(STORAGE_KEY);
}
