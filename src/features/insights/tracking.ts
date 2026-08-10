import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import { useCalendarSystem } from '@/features/preferences/store';
import { addPeriods, endOfPeriod, periodKey, periodScope, startOfPeriod } from '@/lib/calendar';
import type { Transaction } from '@/types/database';

/**
 * Per-expense-type tracking.
 *
 * The insights screen answers "where did my money go this month?" as a single
 * snapshot. Tracking answers the follow-up questions for *one* kind of expense:
 * am I spending more on it than last month, how does it compare to my usual,
 * how much of my budget for it is left, and which merchants drive it.
 *
 * Two hooks:
 *   - `useExpenseTracking(anchor)`  → one row per expense category, for the
 *     tracking list. One round-trip covers the current and previous period.
 *   - `useCategoryTracking(id, anchor)` → the deep view for a single category:
 *     a multi-period trend, the transaction list, and merchant roll-ups.
 *
 * Both respect the active calendar: "this period" is an Ethiopian month for
 * users on the Ethiopian calendar. See `src/lib/calendar.ts`.
 */

export type CategoryTrackingRow = {
  categoryId: string;
  /** Total spent in the current period. */
  total: number;
  /** Total spent in the immediately preceding period. */
  previousTotal: number;
  /**
   * Fractional change vs the previous period (0.25 = +25%). `null` when the
   * previous period was zero — a percentage from a zero baseline is infinite
   * and reads as a bug, so callers should render an absolute label instead.
   */
  delta: number | null;
  /** Number of transactions in the current period. */
  count: number;
  /** Mean transaction size this period. */
  average: number;
  /** Share of all expense spend this period, 0–1. */
  share: number;
  /** Monthly limit for this category, if one is set. */
  budget: number | null;
  /** `total / budget`, or `null` with no budget. Can exceed 1. */
  budgetRatio: number | null;
  /** Most recent transaction date in the period, ISO. */
  lastSpentAt: string | null;
};

export type ExpenseTracking = {
  rows: CategoryTrackingRow[];
  /** Sum of every expense category this period. */
  periodTotal: number;
  previousPeriodTotal: number;
};

/**
 * Every expense category with current-vs-previous period comparison, budget
 * consumption, and share of total. Sorted by current spend, descending.
 *
 * Categories with no activity in either period are omitted *unless* they have
 * a budget — an untouched budget is meaningful information ("you've spent
 * nothing on Transport, and you'd allowed 2,000").
 */
export function useExpenseTracking(anchor = new Date()) {
  const userId = useAuth((s) => s.user?.id);
  const system = useCalendarSystem();
  const scope = periodScope(anchor, system);

  const currentStart = startOfPeriod(anchor, system);
  const currentEnd = endOfPeriod(anchor, system);
  const previousAnchor = addPeriods(anchor, -1, system);
  const previousStart = startOfPeriod(previousAnchor, system);

  return useQuery({
    queryKey: ['tracking', 'expenses', userId, scope],
    enabled: !!userId,
    queryFn: async (): Promise<ExpenseTracking> => {
      // One window covering both periods, split client-side. Two round-trips
      // would double latency for a payload this small.
      const [{ data: txns, error: tErr }, { data: budgets, error: bErr }] = await Promise.all([
        supabase
          .from('transactions')
          .select('category_id, amount, occurred_at')
          .eq('kind', 'expense')
          .gte('occurred_at', previousStart.toISOString())
          .lte('occurred_at', currentEnd.toISOString()),
        supabase
          .from('budgets')
          .select('category_id, amount, start_on')
          .eq('period', 'monthly')
          .order('start_on', { ascending: false }),
      ]);
      if (tErr) throw tErr;
      if (bErr) throw bErr;

      const budgetByCategory = new Map<string, number>();
      for (const b of budgets ?? []) {
        // Rows are newest-first, so the first hit per category wins.
        if (!budgetByCategory.has(b.category_id)) {
          budgetByCategory.set(b.category_id, Number(b.amount));
        }
      }

      const currentStartMs = currentStart.getTime();
      const stats = new Map<
        string,
        { total: number; previousTotal: number; count: number; lastSpentAt: string | null }
      >();

      const bucketFor = (categoryId: string) => {
        let s = stats.get(categoryId);
        if (!s) {
          s = { total: 0, previousTotal: 0, count: 0, lastSpentAt: null };
          stats.set(categoryId, s);
        }
        return s;
      };

      let periodTotal = 0;
      let previousPeriodTotal = 0;

      for (const t of txns ?? []) {
        const abs = Math.abs(Number(t.amount));
        const at = new Date(t.occurred_at);
        const s = bucketFor(t.category_id);
        if (at.getTime() >= currentStartMs) {
          s.total += abs;
          s.count += 1;
          if (!s.lastSpentAt || t.occurred_at > s.lastSpentAt) s.lastSpentAt = t.occurred_at;
          periodTotal += abs;
        } else {
          s.previousTotal += abs;
          previousPeriodTotal += abs;
        }
      }

      // Surface budgeted categories with zero activity — "nothing spent yet"
      // is a real state worth showing next to the limit.
      for (const categoryId of budgetByCategory.keys()) bucketFor(categoryId);

      const rows: CategoryTrackingRow[] = [...stats.entries()].map(([categoryId, s]) => {
        const budget = budgetByCategory.get(categoryId) ?? null;
        return {
          categoryId,
          total: s.total,
          previousTotal: s.previousTotal,
          delta: s.previousTotal > 0 ? (s.total - s.previousTotal) / s.previousTotal : null,
          count: s.count,
          average: s.count > 0 ? s.total / s.count : 0,
          share: periodTotal > 0 ? s.total / periodTotal : 0,
          budget,
          budgetRatio: budget && budget > 0 ? s.total / budget : null,
          lastSpentAt: s.lastSpentAt,
        };
      });

      rows.sort((a, b) => b.total - a.total || b.previousTotal - a.previousTotal);
      return { rows, periodTotal, previousPeriodTotal };
    },
  });
}

export type CategoryTrackingDetail = {
  categoryId: string;
  /** Current-period spend. */
  total: number;
  previousTotal: number;
  delta: number | null;
  count: number;
  average: number;
  /** Largest single transaction this period. */
  largest: number;
  /** Mean per-period spend across the trend window — the "usual" baseline. */
  typical: number;
  budget: number | null;
  budgetRatio: number | null;
  /** Oldest → newest period totals for the trend chart. */
  trend: { period: string; anchor: string; total: number }[];
  /** This period's transactions, newest first. */
  transactions: Transaction[];
  /** Merchant roll-up for this period, biggest first. */
  merchants: { name: string; total: number; count: number }[];
};

/**
 * Deep tracking view for a single expense category.
 *
 * `periods` controls the trend window (default 6). The transaction list is
 * scoped to the current period only — history for older periods is one
 * `MonthPager` tap away rather than a scroll through everything.
 */
export function useCategoryTracking(categoryId: string | undefined, anchor = new Date(), periods = 6) {
  const userId = useAuth((s) => s.user?.id);
  const system = useCalendarSystem();
  const scope = periodScope(anchor, system);

  return useQuery({
    queryKey: ['tracking', 'category', userId, categoryId, scope, periods],
    enabled: !!userId && !!categoryId,
    queryFn: async (): Promise<CategoryTrackingDetail> => {
      const currentStart = startOfPeriod(anchor, system);
      const currentEnd = endOfPeriod(anchor, system);
      const windowStart = startOfPeriod(addPeriods(anchor, -(periods - 1), system), system);

      const [{ data: txns, error: tErr }, { data: budgets, error: bErr }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('kind', 'expense')
          .eq('category_id', categoryId!)
          .gte('occurred_at', windowStart.toISOString())
          .lte('occurred_at', currentEnd.toISOString())
          .order('occurred_at', { ascending: false }),
        supabase
          .from('budgets')
          .select('amount, start_on')
          .eq('period', 'monthly')
          .eq('category_id', categoryId!)
          .lte('start_on', currentStart.toISOString().slice(0, 10))
          .order('start_on', { ascending: false })
          .limit(1),
      ]);
      if (tErr) throw tErr;
      if (bErr) throw bErr;

      const budget = budgets?.[0] ? Number(budgets[0].amount) : null;

      // Pre-seed the trend so empty periods render as gaps, not omissions.
      const trend = new Map<string, { period: string; anchor: string; total: number }>();
      for (let i = periods - 1; i >= 0; i--) {
        const periodAnchor = addPeriods(anchor, -i, system);
        const key = periodKey(periodAnchor, system);
        trend.set(key, {
          period: key,
          anchor: startOfPeriod(periodAnchor, system).toISOString(),
          total: 0,
        });
      }

      const currentKey = periodKey(anchor, system);
      const previousKey = periodKey(addPeriods(anchor, -1, system), system);

      const transactions: Transaction[] = [];
      const merchants = new Map<string, { name: string; total: number; count: number }>();
      let total = 0;
      let previousTotal = 0;
      let largest = 0;

      for (const t of (txns ?? []) as Transaction[]) {
        const abs = Math.abs(Number(t.amount));
        const key = periodKey(new Date(t.occurred_at), system);
        const bucket = trend.get(key);
        if (bucket) bucket.total += abs;

        if (key === previousKey) previousTotal += abs;
        if (key !== currentKey) continue;

        total += abs;
        largest = Math.max(largest, abs);
        transactions.push(t);

        const name = (t.merchant ?? '').trim() || 'Unlabelled';
        const m = merchants.get(name) ?? { name, total: 0, count: 0 };
        m.total += abs;
        m.count += 1;
        merchants.set(name, m);
      }

      const trendRows = [...trend.values()];
      const typical =
        trendRows.length > 0 ? trendRows.reduce((s, r) => s + r.total, 0) / trendRows.length : 0;

      return {
        categoryId: categoryId!,
        total,
        previousTotal,
        delta: previousTotal > 0 ? (total - previousTotal) / previousTotal : null,
        count: transactions.length,
        average: transactions.length > 0 ? total / transactions.length : 0,
        largest,
        typical,
        budget,
        budgetRatio: budget && budget > 0 ? total / budget : null,
        trend: trendRows,
        transactions,
        merchants: [...merchants.values()].sort((a, b) => b.total - a.total),
      };
    },
  });
}
