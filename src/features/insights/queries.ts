import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import { useCalendarSystem } from '@/features/preferences/store';
import { addPeriods, endOfPeriod, periodKey, periodScope, startOfPeriod } from '@/lib/calendar';

export type CategorySpend = { categoryId: string; total: number };

export type PeriodSpend = {
  /** Calendar-specific period key, e.g. `2026-08` or `2018-12`. */
  period: string;
  /** ISO instant inside the period — hand to the calendar formatters for a label. */
  anchor: string;
  total: number;
};

/**
 * Expense totals per category for the period containing `anchor`.
 *
 * Period boundaries follow the user's calendar preference, so an Ethiopian
 * user sees ነሐሴ's spend, not August's.
 */
export function useCategoryBreakdown(anchor = new Date()) {
  const userId = useAuth((s) => s.user?.id);
  const system = useCalendarSystem();
  const scope = periodScope(anchor, system);
  const start = startOfPeriod(anchor, system);
  const end = endOfPeriod(anchor, system);

  return useQuery({
    queryKey: ['insights', 'category', userId, scope],
    enabled: !!userId,
    queryFn: async (): Promise<CategorySpend[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('kind', 'expense')
        .gte('occurred_at', start.toISOString())
        .lte('occurred_at', end.toISOString());
      if (error) throw error;

      const totals = new Map<string, number>();
      (data ?? []).forEach((r) => {
        totals.set(r.category_id, (totals.get(r.category_id) ?? 0) + Math.abs(Number(r.amount)));
      });
      return [...totals.entries()]
        .map(([categoryId, total]) => ({ categoryId, total }))
        .sort((a, b) => b.total - a.total);
    },
  });
}

/**
 * Last N periods (including the current one) of expense totals for the trend
 * chart, oldest → newest.
 *
 * Buckets are keyed by the *active calendar's* period, so on the Ethiopian
 * calendar the six bars are six Ethiopian months. Each row carries an `anchor`
 * instant so the chart can render the label through `useCalendar()` without
 * re-deriving the period.
 */
export function useSpendTrend(periods = 6) {
  const userId = useAuth((s) => s.user?.id);
  const system = useCalendarSystem();
  // Anchor the window on the current period rather than "now" so the key is
  // stable across renders within the same month.
  const currentScope = periodScope(new Date(), system);

  return useQuery({
    queryKey: ['insights', 'trend', userId, currentScope, periods],
    enabled: !!userId,
    queryFn: async (): Promise<PeriodSpend[]> => {
      const now = new Date();
      const windowStart = startOfPeriod(addPeriods(now, -(periods - 1), system), system);
      const windowEnd = endOfPeriod(now, system);

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, occurred_at, kind')
        .eq('kind', 'expense')
        .gte('occurred_at', windowStart.toISOString())
        .lte('occurred_at', windowEnd.toISOString());
      if (error) throw error;

      // Pre-seed every period so gaps render as empty bars rather than
      // collapsing the axis.
      const buckets = new Map<string, PeriodSpend>();
      for (let i = periods - 1; i >= 0; i--) {
        const anchor = addPeriods(now, -i, system);
        const key = periodKey(anchor, system);
        buckets.set(key, { period: key, anchor: startOfPeriod(anchor, system).toISOString(), total: 0 });
      }

      (data ?? []).forEach((r) => {
        const key = periodKey(new Date(r.occurred_at), system);
        const bucket = buckets.get(key);
        if (bucket) bucket.total += Math.abs(Number(r.amount));
      });

      return [...buckets.values()];
    },
  });
}
