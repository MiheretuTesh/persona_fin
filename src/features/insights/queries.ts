import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';

export type CategorySpend = { categoryId: string; total: number };
export type MonthSpend = { month: string; total: number };

export function useCategoryBreakdown(anchor = new Date()) {
  const userId = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ['insights', 'category', userId, format(anchor, 'yyyy-MM')],
    enabled: !!userId,
    queryFn: async (): Promise<CategorySpend[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('kind', 'expense')
        .gte('occurred_at', startOfMonth(anchor).toISOString())
        .lte('occurred_at', endOfMonth(anchor).toISOString());
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

/** Last N months (including current) of expense totals for the trend area chart. */
export function useSpendTrend(months = 6) {
  const userId = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ['insights', 'trend', userId, months],
    enabled: !!userId,
    queryFn: async (): Promise<MonthSpend[]> => {
      const end = endOfMonth(new Date());
      const start = startOfMonth(subMonths(new Date(), months - 1));
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, occurred_at, kind')
        .eq('kind', 'expense')
        .gte('occurred_at', start.toISOString())
        .lte('occurred_at', end.toISOString());
      if (error) throw error;

      const buckets = new Map<string, number>();
      for (let i = 0; i < months; i++) {
        const m = subMonths(new Date(), months - 1 - i);
        buckets.set(format(m, 'yyyy-MM'), 0);
      }
      (data ?? []).forEach((r) => {
        const key = format(new Date(r.occurred_at), 'yyyy-MM');
        buckets.set(key, (buckets.get(key) ?? 0) + Math.abs(Number(r.amount)));
      });
      return [...buckets.entries()].map(([month, total]) => ({ month, total }));
    },
  });
}
