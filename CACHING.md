# Caching & Sync Architecture

> *Local storage is the display source of truth. Supabase is the system of record. Reads come from cache; writes go to both.*

---

## 1. The mental model

```
┌──────────────────────────────────────────────────────────────────┐
│                       UI components (every tab)                  │
│        useTransactions(), useCurrentBudgets(), useProfile()…     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ reads (synchronous, instant)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│           In-memory React Query cache  (queryClient)             │
│      gcTime 24h · networkMode 'offlineFirst' · per-key staleTime │
└──────────┬───────────────────────────────────┬───────────────────┘
           │ shadow writes                     │ background refetch
           ▼                                   ▼
┌────────────────────────────────┐   ┌───────────────────────────────┐
│    AsyncStorage persister      │   │       Supabase Postgres       │
│ key: 'eq.query-cache.v1'       │   │  (RLS-scoped per auth.uid())  │
│ throttle: 1s · maxAge: 30 d    │   │                               │
└────────────────────────────────┘   └───────────────────────────────┘
           ▲                                   ▲
           │ rehydrates on mount               │ writes via mutations
           │                                   │
┌──────────┴───────────────────────────────────┴───────────────────┐
│                      mutations (writes only)                     │
│          useCreateTransaction, useCreateBudget, …                │
│  4-step optimistic recipe: cancel → snapshot → write → rollback  │
└──────────────────────────────────────────────────────────────────┘
```

The UI **never** waits on Supabase. Reads come from the in-memory query cache; that cache is rehydrated from AsyncStorage on cold start, and refreshed by background fetches. Writes go optimistically to the cache *first*, then propagate to Supabase, with automatic queueing while offline.

---

## 2. The layers

### Layer 1 — Component reads

Every screen reads through React Query hooks (`useTransactions`, `useCurrentBudgets`, etc.) — no component talks to Supabase directly. Hooks return:

- `data`: from cache (always synchronous after mount)
- `isFetching`: whether a background refetch is in flight
- `refetch()`: manual refresh

Because of `networkMode: 'offlineFirst'`, queries with cached data resolve immediately even when the device has no connectivity. The `isFetching` flag lets us show a discreet sync indicator without blocking content.

### Layer 2 — In-memory React Query cache

The `QueryClient` configured in [`src/lib/queryClient.ts`](src/lib/queryClient.ts) is the single hot cache. Tuning:

| Option | Value | Why |
|---|---|---|
| `staleTime` | per-query | How long fresh data is reused without a refetch. Profile/categories are long; transactions short. |
| `gcTime` | 24h | How long unused entries linger in memory. Long enough to survive tab switches; persister catches the rest. |
| `networkMode` | `offlineFirst` | Serve cache even when offline. For mutations, *queue* offline writes instead of failing. |
| `refetchOnReconnect` | `true` | NetInfo flips online → every stale query refetches. |
| `refetchOnWindowFocus` | `true` | App foregrounded → refetch. |
| `retry` | 4xx terminal, 5xx ×2 | Don't hammer Supabase on RLS denials. |

### Layer 3 — AsyncStorage persister

[`@tanstack/query-async-storage-persister`](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient) shadow-writes the entire query cache to a single AsyncStorage key:

```
eq.query-cache.v1   →   { dehydrated cache JSON }
```

- **`throttleTime: 1s`** — multiple cache writes within a second collapse to one disk write. Prevents AsyncStorage thrash during a burst of invalidations.
- **`buster: 'v1'`** — bump in [`app/_layout.tsx`](app/_layout.tsx) when you change a Row type or add a column to force every install to drop its persisted cache and refetch fresh.
- **`maxAge: 30 days`** — entries older than 30 days are evicted on restore.

`<PersistQueryClientProvider>` blocks first paint until restoration completes (~50–100ms typical), so the first frame after launch already has data.

### Layer 4 — Mutation queue

When a mutation is fired offline:

1. `networkMode: 'offlineFirst'` makes React Query mark it `paused` instead of erroring.
2. The mutation is *also* dehydrated to AsyncStorage via `dehydrateOptions.shouldDehydrateMutation`. If the user force-quits, the queued mutation survives.
3. `wireOnlineManager()` listens to NetInfo. When connectivity returns, `onlineManager` flips to online; React Query automatically calls each paused mutation's `mutationFn`.
4. On cold start, after the cache restores, `onSuccess` calls `queryClient.resumePausedMutations()` — replays everything that was queued before the kill.

Result: the user adds a transaction in airplane mode, lands, comes back online, and the row syncs to Supabase without any explicit retry.

### Layer 5 — Optimistic mutations

Every create/update/delete follows the same 4-step recipe (full implementation in [`src/features/*/mutations.ts`](src/features/transactions/mutations.ts)):

```ts
useMutation({
  // 1. The actual write to Supabase. Throws on error.
  mutationFn: async (input) => { /* supabase.from(...).insert() */ },

  // 2. Before the write fires: cancel races, snapshot, optimistic write.
  onMutate: async (input) => {
    await qc.cancelQueries({ queryKey: ... });           // (a) stop refetch races
    const previous = qc.getQueriesData({ queryKey: ... }); // (b) snapshot for rollback
    qc.setQueriesData({ queryKey: ... }, (old) => ...);    // (c) optimistic update
    return { previous };                                    // (d) rollback context
  },

  // 3. If the write fails, restore the snapshot.
  onError: (_err, _input, ctx) => {
    ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
  },

  // 4. On success, swap the temp row for the real Supabase row.
  onSuccess: (real, _input, ctx) => {
    qc.setQueriesData({ queryKey: ... }, (old) =>
      old.map((row) => row.id.startsWith('temp-') ? real : row));
  },

  // 5. Either way, invalidate dependent queries to reconcile derived data.
  onSettled: () => {
    qc.invalidateQueries({ queryKey: ... });
  },
});
```

Why each step matters:

- **Cancel** — without it, an in-flight refetch could land *after* the optimistic write and overwrite it with stale server data.
- **Snapshot** — the only way to undo on failure. We store the entire previous list (cheap; a few KB of JSON).
- **Optimistic write with `temp-` prefix** — temp ids are cheap, deterministic to detect, and avoid clashing with Supabase's UUIDs. After `onSuccess` we look up the temp row by prefix and replace it with the real one in the same array slot.
- **Invalidate on settled** — the cache may now have derived data that's stale (Vault net worth, budget spend, insights). Invalidation refetches them, but because of `networkMode: 'offlineFirst'` the UI keeps showing optimistic data until the refetch lands.

### Layer 6 — Centralized query keys

[`src/lib/queryKeys.ts`](src/lib/queryKeys.ts) is the single source of truth for cache keys. Both producers (`useQuery({ queryKey: qk.transactions.list(userId, scope) })`) and invalidators (`qc.invalidateQueries({ queryKey: qk.transactions.all(userId) })`) import from the same file. Prevents the silent bug where a key shape diverges and an invalidation misses every consumer.

The `*.all(userId)` helpers leverage React Query's prefix-matching: invalidating `['transactions', userId]` matches every key starting with that prefix, including all month-scoped variants.

---

## 3. Sync semantics — concrete scenarios

### Scenario A — Online, normal flow

User adds a $42 dining expense in the Add Transaction modal:

1. `t = 0ms` — `useCreateTransaction.mutate(...)` fires.
2. `t = 0ms` — `onMutate`: temp row prepended to every transaction list cache. **UI shows the new row immediately.**
3. `t = 0ms` — Supabase `INSERT` request goes out.
4. `t = ~150ms` — Supabase responds with the canonical row (real id).
5. `t = ~151ms` — `onSuccess`: temp row swapped for real one. UI doesn't visibly change (same merchant, amount, date).
6. `t = ~151ms` — `onSettled`: invalidates lifetime totals, budgets, insights. Background refetches start.
7. `t = ~300–500ms` — refetches complete; Vault net worth, budget progress bars, insights chart update with the canonical numbers.

User-perceived latency: **0ms**.

### Scenario B — Offline, queued, replayed

User goes into airplane mode mid-flight, adds three expenses:

1. Each `mutate(...)` fires; `networkMode: 'offlineFirst'` marks them all `paused`.
2. Each is dehydrated to AsyncStorage by the persister (via `shouldDehydrateMutation: pending`).
3. Cache shows all three temp rows. User can navigate, view history, etc. Sync indicator pill: **"Offline · 3 pending"**.
4. Plane lands, Wi-Fi connects. NetInfo fires; `onlineManager` flips to online.
5. React Query automatically replays each paused mutation in order. Three Supabase INSERTs go out.
6. `onSuccess` fires three times; temp ids replaced with real ids. Pill disappears.

If the user kills the app during airplane mode, the queued mutations survive in AsyncStorage and replay on next launch (after `resumePausedMutations()` in the persister's `onSuccess` callback).

### Scenario C — Cold start with stale cache

User opens the app after 6 hours away:

1. `t = 0ms` — `<PersistQueryClientProvider>` mounts, starts AsyncStorage read.
2. `t = ~80ms` — restoration completes. Every cached query is now in the in-memory client.
3. `t = ~80ms` — first paint. Vault, history, budget, insights all show real data from cache.
4. `t = ~80ms` — `refetchOnWindowFocus` triggers background refetches for every query whose `staleTime` has passed (most have).
5. `t = ~80ms+` — sync indicator pulses.
6. `t = ~500ms` — refetches complete; any new server-side changes (e.g., a transaction added on another device) reconcile.

User sees real data in <100ms; the freshness reconciliation happens in the background while they're already interacting.

### Scenario D — Conflict (two devices, same row)

User edits their currency to ETB on phone A, then to EUR on phone B, both before phone A's mutation reaches Supabase.

- Phone A `useUpdateProfile` is a *server-truth* mutation (no temp row). Writes to Supabase via `upsert(... onConflict: 'id')` — last-write-wins on the server.
- Whichever update reaches Supabase last is canonical. The other phone's local cache is reconciled on next refetch.
- For the local Zustand `usePreferences` store ([`src/features/preferences/store.ts`](src/features/preferences/store.ts)), each device keeps its local choice until the next login or sync — see [`src/features/preferences/sync.ts`](src/features/preferences/sync.ts) for the policy (local wins unless local is still at default).

This app is single-user so true conflicts are rare. If you ever add multi-user (joint accounts) this is where you'd need a CRDT or `updated_at` LWW tiebreaker.

---

## 4. Files to know

| File | Role |
|---|---|
| [`src/lib/queryClient.ts`](src/lib/queryClient.ts) | QueryClient config, persister, focusManager + onlineManager wiring |
| [`src/lib/queryKeys.ts`](src/lib/queryKeys.ts) | Centralized query keys |
| [`app/_layout.tsx`](app/_layout.tsx) | `<PersistQueryClientProvider>` mount + `resumePausedMutations` |
| [`src/features/*/queries.ts`](src/features/transactions/queries.ts) | Read hooks |
| [`src/features/*/mutations.ts`](src/features/transactions/mutations.ts) | Optimistic write hooks |
| [`src/features/sync/status.ts`](src/features/sync/status.ts) | `useSyncStatus()` aggregator |
| [`src/components/ui/SyncIndicator.tsx`](src/components/ui/SyncIndicator.tsx) | TopBar status pill |
| [`src/features/preferences/store.ts`](src/features/preferences/store.ts) | Zustand local prefs (currency) |

---

## 5. Operational notes

### Bumping cache versions

Change anything in `Database` types (add a column, rename a field) and old persisted caches will deserialize into rows missing that field. Two ways to handle:

1. **Hard bust**: change `buster: 'v1'` → `'v2'` in [`app/_layout.tsx`](app/_layout.tsx). Every install drops its persisted cache on next launch.
2. **Soft bust**: change `key: 'eq.query-cache.v1'` → `'v2'` in [`src/lib/queryClient.ts`](src/lib/queryClient.ts). Same effect, but you can revert by switching back.

Either is correct. Use #1 unless you need to support rollback.

### Forcing a fresh fetch

In a screen: `query.refetch()`. Globally: `queryClient.invalidateQueries()`.

To wipe AsyncStorage entirely (debug only):

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.removeItem('eq.query-cache.v1');
```

### Debugging stale cache

If a screen shows yesterday's data and refetch isn't landing:

1. Check Network tab in Flipper or the device debug menu — is the Supabase request actually going out?
2. Check the Sync indicator. Pulsing? Then it's in-flight; wait. Offline pill? NetInfo thinks the device is offline (likely real).
3. `console.log(queryClient.getQueryCache().findAll())` to dump the cache.

### Why not just SQLite?

For this app's data volume (a few thousand transactions max per user) AsyncStorage + JSON serialization is fast enough — restoration is well under 100ms. SQLite would be the right choice if:

- Volumes hit 10k+ rows
- We need full-text search inside transactions
- We need joins/aggregations done on-device

Right now the simpler approach wins. The persister abstracts this — swapping to SQLite later is a one-file change in [`src/lib/queryClient.ts`](src/lib/queryClient.ts).
