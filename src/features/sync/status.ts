import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating, onlineManager } from '@tanstack/react-query';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

/**
 * Aggregates React Query's fetching / mutating state plus NetInfo into a
 * single ergonomic value for status indicators.
 *
 *   - syncing  → at least one query refetching OR one mutation in flight
 *   - offline  → onlineManager.isOnline() is false (we have queued writes)
 *   - synced   → nothing happening; cache is fresh
 *
 * `pendingMutations` is exposed so the UI can show "Offline · 3 pending".
 */
export function useSyncStatus(): {
  status: SyncStatus;
  pendingMutations: number;
} {
  const fetching = useIsFetching();
  const mutating = useIsMutating();

  // onlineManager isn't reactive; subscribe explicitly so changes re-render.
  const [online, setOnline] = useState<boolean>(() => onlineManager.isOnline());
  useEffect(() => {
    return onlineManager.subscribe(() => setOnline(onlineManager.isOnline()));
  }, []);

  const pendingMutations = mutating;
  if (!online) return { status: 'offline', pendingMutations };
  if (fetching > 0 || mutating > 0) return { status: 'syncing', pendingMutations };
  return { status: 'synced', pendingMutations };
}
