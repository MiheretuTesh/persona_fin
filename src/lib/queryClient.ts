import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus, Platform } from 'react-native';

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Offline-first React Query configuration
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Three problems this file solves, in one place:
 *
 *   1. COLD-START LATENCY — without persistence, every cold app launch starts
 *      with empty caches and shows loading spinners until Supabase responds.
 *      We persist the entire query cache to AsyncStorage so the first frame
 *      after launch already has the user's last-seen data.
 *
 *   2. OFFLINE TOLERANCE — `networkMode: 'offlineFirst'` tells React Query to
 *      serve cached results even when the device is offline (default behavior
 *      would error). For mutations the same flag means "queue while offline,
 *      fire when network returns" instead of failing immediately.
 *
 *   3. CACHE LIFETIME — `gcTime` controls how long unused cache entries live
 *      in memory. The persister is layered ON TOP of this — when a query is
 *      garbage-collected from memory it's still in AsyncStorage, ready to be
 *      restored on next mount. Setting `gcTime` to 24h keeps the in-memory
 *      cache around for normal session reuse without unbounded growth.
 *
 * Stale times (queries.ts files set their own when needed):
 *   - profile, wallets:   60s   (rarely change)
 *   - categories:         5min  (effectively static)
 *   - transactions:       15s   (most volatile, but cache is warm)
 *   - budgets, insights:  30s   (derived; refetched after every tx)
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default freshness — individual queries override.
      staleTime: 30_000,
      // Long enough to survive a typical foregrounding burst, short enough that
      // dormant caches don't accumulate. Persister keeps long-term data.
      gcTime: 1000 * 60 * 60 * 24, // 24 hours

      // Serve cached data when offline instead of throwing.
      networkMode: 'offlineFirst',
      // Refetch when app foregrounds OR network reconnects — cheap and
      // keeps the UI honest when the user comes back to the app.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,

      retry: (failureCount, error: any) => {
        // PostgREST RLS denials and validation failures are deterministic —
        // no point hammering. Treat any 4xx as terminal.
        const status = error?.status ?? error?.code;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
    mutations: {
      // Mutations queued while offline are *paused*, not failed; they fire
      // automatically when onlineManager flips to online (see wireOnlineManager).
      networkMode: 'offlineFirst',
      retry: 0,
    },
  },
});

/**
 * AsyncStorage-backed persister.
 *
 * The `key` is versioned — bump the suffix when you change a query's data
 * shape (e.g. add a column to Transaction). Old caches with stale shapes
 * won't deserialize cleanly, so a fresh key forces a clean rebuild from
 * Supabase rather than letting a malformed cached value through.
 *
 * `throttleTime: 1000` collapses bursts of writes (e.g., a flurry of
 * invalidations after a single mutation) into one AsyncStorage operation.
 */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'eq.query-cache.v1',
  throttleTime: 1000,
});

/**
 * Bridges `AppState` → React Query's `focusManager`. When you swipe back
 * into the app, every query that hasn't been refetched since
 * (now - staleTime) gets a background refetch. Cache stays visible the
 * whole time — refetching is silent until new data arrives.
 */
export function wireAppStateFocus() {
  if (Platform.OS === 'web') return;
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    focusManager.setFocused(state === 'active');
  });
  return () => sub.remove();
}

/**
 * Bridges `NetInfo` → React Query's `onlineManager`. This is what makes the
 * mutation queue work: when the device is offline `onlineManager.isOnline()`
 * is false, mutations get marked `paused`, and `resumePausedMutations()`
 * replays them when we come back online.
 *
 * Returns an unsubscribe function for cleanup.
 */
export function wireOnlineManager() {
  return onlineManager.setEventListener((setOnline) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // `isInternetReachable` can be null on first call; coerce to true to
      // avoid bouncing the UI to "offline" before NetInfo has actually probed.
      const reachable = state.isInternetReachable ?? state.isConnected ?? true;
      setOnline(!!reachable);
    });
    return unsubscribe;
  });
}
