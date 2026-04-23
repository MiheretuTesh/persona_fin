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
        q = q
          .gte('occurred_at', startOfMonth(month).toISOString())
          .lte('occurred_at', endOfMonth(month).toISOString());
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

/**
 * Month totals — sums income and expense for the given month (always absolute
 * values on the expense side so the UI can show e.g. $3,120 instead of -$3,120).
 * Note: kind is the source of truth, not the sign of `amount` — a user might
 * have miskeyed a negative income at some point.
 */
export function useMonthTotals(month: Date) {
  const q = useTransactions({ month });
  const income = (q.data ?? [])
    .filter((t) => t.kind === 'income')
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const expense = (q.data ?? [])
    .filter((t) => t.kind === 'expense')
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  return { ...q, income, expense, net: income - expense };
}

/**
 * Lifetime running totals — the single source of truth for "Net Worth" and
 * "Available Balance" on the Vault. This sums every transaction the user has
 * ever logged (signed amounts, since insert mutations flip the sign for
 * expenses). Paired with wallet starting_balance in the dashboard.
 *
 * Uses Supabase's head:true + foreign key trick isn't helpful here — we need
 * the actual sum. Select only the amount column to keep payload small.
 */
export function useLifetimeTotals() {
  const userId = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ['transactions', 'lifetime', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, kind');
      if (error) throw error;
      let lifetimeIncome = 0;
      let lifetimeExpense = 0;
      let lifetimeNet = 0;
      for (const t of data ?? []) {
        const n = Number(t.amount);
        lifetimeNet += n; // amount is already signed in the DB
        if (t.kind === 'income') lifetimeIncome += Math.abs(n);
        else if (t.kind === 'expense') lifetimeExpense += Math.abs(n);
      }
      return { lifetimeIncome, lifetimeExpense, lifetimeNet };
    },
  });
}
