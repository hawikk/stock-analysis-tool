type Entry<T> = { value: T; expires: number; staleUntil: number };

type CacheState = {
  store: Map<string, Entry<unknown>>;
  inflight: Map<string, Promise<unknown>>;
};

const globalForCache = globalThis as unknown as { __marketCache?: CacheState };

const state: CacheState =
  globalForCache.__marketCache ??
  (globalForCache.__marketCache = { store: new Map(), inflight: new Map() });

const MAX_ENTRIES = 2000;

function evictIfNeeded() {
  if (state.store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of state.store) {
    if (entry.staleUntil < now) state.store.delete(key);
  }
  while (state.store.size > MAX_ENTRIES) {
    const oldest = state.store.keys().next().value;
    if (oldest === undefined) break;
    state.store.delete(oldest);
  }
}

function refresh<T>(key: string, ttlMs: number, staleMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = state.inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = loader()
    .then((value) => {
      const now = Date.now();
      state.store.set(key, { value, expires: now + ttlMs, staleUntil: now + ttlMs + staleMs });
      evictIfNeeded();
      return value;
    })
    .finally(() => state.inflight.delete(key));
  state.inflight.set(key, p);
  return p;
}

export function invalidate(key: string) {
  state.store.delete(key);
}

/**
 * In-memory TTL cache with stale-while-revalidate and in-flight de-duplication.
 * Fresh hits return immediately; stale hits return the old value and refresh in the background;
 * if a refresh fails and a stale value exists, the stale value is served.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  { staleSeconds = ttlSeconds * 10 }: { staleSeconds?: number } = {},
): Promise<{ value: T; stale: boolean }> {
  const ttlMs = ttlSeconds * 1000;
  const staleMs = staleSeconds * 1000;
  const now = Date.now();
  const hit = state.store.get(key) as Entry<T> | undefined;

  if (hit && hit.expires > now) return { value: hit.value, stale: false };

  if (hit && hit.staleUntil > now) {
    refresh(key, ttlMs, staleMs, loader).catch(() => undefined);
    return { value: hit.value, stale: true };
  }

  try {
    return { value: await refresh(key, ttlMs, staleMs, loader), stale: false };
  } catch (err) {
    if (hit) return { value: hit.value, stale: true };
    throw err;
  }
}
