import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import type { Budget } from '@/types/database';

export type BudgetWithSpend = Budget & { spent: number };

/**
 * Current-period budgets with a computed `spent` per category.
 *
 * IMPORTANT — date handling: Postgres `date` columns are stored as calendar
 * dates (no timezone). We use date-fns `format(d, 'yyyy-MM-dd')` here to match
 * the serializer in `mutations.ts`. Using `toISOString().slice(0,10)` — as a
 * prior revision did — produces UTC-shifted dates and in any eastern timezone
 * you'd insert `2026-04-01` and query `<= 2026-03-31`, silently losing the
 * just-created row.
 *
 * Carry-over semantics: a budget with `start_on <= thisMonth` applies this
 * month, picking the most recent per category so a May update supersedes
 * an April one for the same category.
 */
export function useCurrentBudgets(anchor = new Date()) {
  const userId = useAuth((s) => s.user?.id);
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['budgets', userId, monthStartStr],
    enabled: !!userId,
    queryFn: async (): Promise<BudgetWithSpend[]> => {
      const [{ data: budgets, error: bErr }, { data: txns, error: tErr }] = await Promise.all([
        supabase
          .from('budgets')
          .select('*')
          .eq('period', 'monthly')
          .lte('start_on', monthStartStr)
          .order('start_on', { ascending: false }),
        supabase
          .from('transactions')
          .select('category_id, amount')
          .eq('kind', 'expense')
          .gte('occurred_at', monthStart.toISOString())
          .lte('occurred_at', monthEnd.toISOString()),
      ]);
      if (bErr) throw bErr;
      if (tErr) throw tErr;

      // Collapse to most-recent budget per category.
      const byCategory = new Map<string, Budget>();
      for (const b of budgets ?? []) {
        if (!byCategory.has(b.category_id)) byCategory.set(b.category_id, b);
      }

      const spendByCategory = new Map<string, number>();
      for (const t of txns ?? []) {
        spendByCategory.set(
          t.category_id,
          (spendByCategory.get(t.category_id) ?? 0) + Math.abs(Number(t.amount)),
        );
      }

      return [...byCategory.values()].map((b) => ({
        ...b,
        spent: spendByCategory.get(b.category_id) ?? 0,
      }));
    },
  });
}
