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
    /** Prefix for invalidating *all* transaction lists at once. */
    all: (userId: string | undefined) => ['transactions', userId] as const,
    list: (userId: string | undefined, scope: string) =>
      ['transactions', userId, scope] as const,
    lifetime: (userId: string | undefined) => ['transactions', 'lifetime', userId] as const,
  },
  budgets: {
    all: (userId: string | undefined) => ['budgets', userId] as const,
    forMonth: (userId: string | undefined, monthStart: string) =>
      ['budgets', userId, monthStart] as const,
  },
  insights: {
    all: (userId: string | undefined) => ['insights', userId] as const,
    categoryBreakdown: (userId: string | undefined, monthStart: string) =>
      ['insights', 'category', userId, monthStart] as const,
    spendTrend: (userId: string | undefined, months: number) =>
      ['insights', 'trend', userId, months] as const,
  },
} as const;
