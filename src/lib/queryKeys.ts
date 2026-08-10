/**
 * Centralized query keys.
 *
 * Why this file exists:
 *
 * React Query identifies cache entries by an array key (e.g.
 * `['transactions', userId, '2026-04']`). Both the *producer* of a query
 * (the hook that fetches) and the *invalidator* (the mutation's onSettled)
 * have to agree on the exact shape of that array. If a mutation invalidates
 * `['transactions', userId]` but a hook fetched as `['transactions', userId,
 * 'all']`, the invalidation silently misses — the UI looks stale until a
 * different code path triggers a refetch.
 *
 * Centralizing keys here:
 *   - Forces both sides to import from the same source.
 *   - Lets us rename keys (cache busting) by changing one constant.
 *   - Makes "invalidate everything for a user" a one-liner.
 *
 * Pattern: hierarchical arrays. `qk.transactions.all(userId)` matches every
 * `qk.transactions.list(userId, ...)` because React Query's invalidation
 * is prefix-based.
 *
 * ── The userId-position rule ────────────────────────────────────────────────
 *
 * Prefix matching is positional: a filter of `['insights', userId]` matches
 * `['insights', userId, ...]` but NOT `['insights', 'category', userId, ...]`
 * — at index 1 it compares `'category'` against the user id and bails.
 *
 * Earlier revisions interleaved the discriminator before the user id for
 * `insights`, `transactions.lifetime`, and the daily-totals key. The result
 * was exactly the silent miss this file was written to prevent: adding a
 * transaction invalidated `['insights', userId]`, which matched nothing, so
 * the spending breakdown and the dashboard sparklines kept serving stale data
 * until something else happened to refetch them.
 *
 * So: **the user id is always at index 1**, and any discriminator
 * (`'lifetime'`, `'category'`, `'trend'`) comes after it. Keep it that way,
 * and `<domain>.all(userId)` stays a reliable "invalidate everything for this
 * user in this domain".
 */

export const qk = {
  profile: {
    me: (userId: string | undefined) => ['profile', userId] as const,
  },
  wallets: {
    list: (userId: string | undefined) => ['wallets', userId] as const,
  },
  categories: {
    list: (userId: string | undefined) => ['categories', userId] as const,
  },
  transactions: {
    /**
     * Prefix for invalidating *all* transaction queries at once — period
     * lists, the lifetime roll-up, and the daily sparkline buckets.
     *
     * Use this for `invalidateQueries` only. Do NOT use it with
     * `setQueriesData` / `getQueriesData`: `lifetime` and `daily` cache plain
     * objects rather than arrays, so an optimistic updater written for a list
     * would corrupt them (and `[...old]` on an object throws). Reach for
     * `lists()` when you're writing rows.
     */
    all: (userId: string | undefined) => ['transactions', userId] as const,
    /** Prefix matching only the array-shaped period lists. Safe to write through. */
    lists: (userId: string | undefined) => ['transactions', userId, 'list'] as const,
    list: (userId: string | undefined, scope: string, limit: number) =>
      ['transactions', userId, 'list', scope, limit] as const,
    one: (id: string | undefined) => ['transaction', id] as const,
    lifetime: (userId: string | undefined) => ['transactions', userId, 'lifetime'] as const,
    daily: (userId: string | undefined, days: number) =>
      ['transactions', userId, 'daily', days] as const,
  },
  budgets: {
    all: (userId: string | undefined) => ['budgets', userId] as const,
    forPeriod: (userId: string | undefined, scope: string) =>
      ['budgets', userId, scope] as const,
  },
  insights: {
    all: (userId: string | undefined) => ['insights', userId] as const,
    categoryBreakdown: (userId: string | undefined, scope: string) =>
      ['insights', userId, 'category', scope] as const,
    spendTrend: (userId: string | undefined, scope: string, periods: number) =>
      ['insights', userId, 'trend', scope, periods] as const,
  },
  /** Per-expense-type tracking — see `src/features/insights/tracking.ts`. */
  tracking: {
    all: (userId: string | undefined) => ['tracking', userId] as const,
    expenses: (userId: string | undefined, scope: string) =>
      ['tracking', userId, 'expenses', scope] as const,
    category: (
      userId: string | undefined,
      categoryId: string | undefined,
      scope: string,
      periods: number,
    ) => ['tracking', userId, 'category', categoryId, scope, periods] as const,
  },
} as const;
