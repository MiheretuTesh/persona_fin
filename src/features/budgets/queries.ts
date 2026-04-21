import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import type { Budget } from '@/types/database';

export type BudgetWithSpend = Budget & { spent: number };

/**
 * Current-month budgets with a computed `spent` per category. We compute on
 * the client to keep the schema migration lean — if usage grows we can push
 * this into a Postgres view.
 */
export function useCurrentBudgets(anchor = new Date()) {
  const userId = useAuth((s) => s.user?.id);
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);

  return useQuery({
    queryKey: ['budgets', userId, monthStart.toISOString()],
    enabled: !!userId,
    queryFn: async (): Promise<BudgetWithSpend[]> => {
      const [{ data: budgets, error: bErr }, { data: txns, error: tErr }] = await Promise.all([
        supabase
          .from('budgets')
          .select('*')
          .eq('period', 'monthly')
          .lte('start_on', monthStart.toISOString().slice(0, 10))
          .order('amount', { ascending: false }),
        supabase
          .from('transactions')
          .select('category_id, amount, kind')
          .eq('kind', 'expense')
          .gte('occurred_at', monthStart.toISOString())
          .lte('occurred_at', monthEnd.toISOString()),
      ]);
      if (bErr) throw bErr;
      if (tErr) throw tErr;

      const spendByCategory = new Map<string, number>();
      (txns ?? []).forEach((t) => {
        spendByCategory.set(t.category_id, (spendByCategory.get(t.category_id) ?? 0) + Math.abs(Number(t.amount)));
      });

      return (budgets ?? []).map((b) => ({ ...b, spent: spendByCategory.get(b.category_id) ?? 0 }));
    },
  });
}
