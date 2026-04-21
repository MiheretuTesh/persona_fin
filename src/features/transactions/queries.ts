import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import type { Transaction } from '@/types/database';

const PAGE_SIZE = 200;

export function useTransactions(opts: { month?: Date; limit?: number } = {}) {
  const userId = useAuth((s) => s.user?.id);
  const month = opts.month;
  return useQuery({
    queryKey: ['transactions', userId, month?.toISOString() ?? 'all', opts.limit ?? PAGE_SIZE],
    enabled: !!userId,
    queryFn: async (): Promise<Transaction[]> => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(opts.limit ?? PAGE_SIZE);
      if (month) {
        q = q.gte('occurred_at', startOfMonth(month).toISOString()).lte('occurred_at', endOfMonth(month).toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Recent N for the dashboard's "Recent Transactions" card. DS says ≤5. */
export function useRecentTransactions(limit = 5) {
  return useTransactions({ limit });
}

/** Aggregate income/expense totals for a given month. */
export function useMonthTotals(month: Date) {
  const q = useTransactions({ month });
  const income = q.data?.filter((t) => t.kind === 'income').reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  const expense =
    q.data?.filter((t) => t.kind === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0) ?? 0;
  return { ...q, income, expense, net: income - expense };
}
