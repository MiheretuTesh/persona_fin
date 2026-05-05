import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, startOfDay, subDays, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
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
 * Fetch a single transaction by id. Uses any cached list as `initialData` so
 * navigating from History → Edit paints with real values on the very first
 * frame; the background refetch reconciles if the server-side row diverges.
 */
export function useTransaction(id: string | undefined) {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useQuery({
    queryKey: ['transaction', id],
    enabled: !!id && !!userId,
    queryFn: async (): Promise<Transaction> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    initialData: () => {
      if (!id) return undefined;
      // Sweep every cached list for a matching row.
      const lists = qc.getQueriesData<Transaction[]>({ queryKey: qk.transactions.all(userId) });
      for (const [, data] of lists) {
        const found = data?.find((t) => t.id === id);
        if (found) return found;
      }
      return undefined;
    },
  });
}

/**
 * Last-N-days income & expense bucketed by day, oldest → newest.
 *
 * Used for the dashboard sparklines. Returns two parallel arrays so the
 * Sparkline component can render either independently.
 *
 * Why we're not just deriving this from `useTransactions`: the dashboard
 * mounts before the user touches any month, so we want a tight query that
 * pulls only the last N days regardless of which month is being viewed.
 */
export function useDailyTotals(days = 7) {
  const userId = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ['transactions', 'daily', userId, days],
    enabled: !!userId,
    queryFn: async (): Promise<{ income: number[]; expense: number[]; labels: string[] }> => {
      const start = startOfDay(subDays(new Date(), days - 1));
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, kind, occurred_at')
        .gte('occurred_at', start.toISOString());
      if (error) throw error;

      // Pre-seed every day so no day is missing from the array. Day keys
      // use yyyy-MM-dd so they sort lexically and align with the LOCAL day
      // (toISOString is UTC and would shift in eastern timezones — same
      // bug class as the budget date filter).
      const incomeBuckets = new Map<string, number>();
      const expenseBuckets = new Map<string, number>();
      const labels: string[] = [];
      for (let i = 0; i < days; i++) {
        const d = startOfDay(subDays(new Date(), days - 1 - i));
        const key = format(d, 'yyyy-MM-dd');
        incomeBuckets.set(key, 0);
        expenseBuckets.set(key, 0);
        labels.push(format(d, 'EEE'));
      }

      for (const t of data ?? []) {
        const key = format(new Date(t.occurred_at), 'yyyy-MM-dd');
        const abs = Math.abs(Number(t.amount));
        if (t.kind === 'income') {
          incomeBuckets.set(key, (incomeBuckets.get(key) ?? 0) + abs);
        } else if (t.kind === 'expense') {
          expenseBuckets.set(key, (expenseBuckets.get(key) ?? 0) + abs);
        }
      }

      return {
        income: [...incomeBuckets.values()],
        expense: [...expenseBuckets.values()],
        labels,
      };
    },
  });
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
