import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startOfMonth, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useAuth } from '@/features/auth/store';
import type { Budget } from '@/types/database';
import type { BudgetWithSpend } from './queries';

type CreateInput = {
  categoryId: string;
  amount: number;
  period?: Budget['period'];
  month?: Date;
};

/**
 * Optimistic upsert of a monthly budget. Same four-step recipe as
 * useCreateTransaction (cancel → snapshot → write → return rollback).
 *
 * One detail specific to budgets: the cache shape is `BudgetWithSpend[]`
 * (joined with computed expense totals). For an optimistic insert we set
 * `spent: 0` — the budget didn't exist a second ago, so no expenses were
 * categorized against it. The next refetch will reconcile.
 */
export function useCreateBudget() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['create-budget'],
    mutationFn: async (input: CreateInput): Promise<Budget> => {
      if (!userId) throw new Error('Not authenticated.');
      const anchor = startOfMonth(input.month ?? new Date());
      const { data, error } = await supabase
        .from('budgets')
        .upsert(
          {
            user_id: userId,
            category_id: input.categoryId,
            amount: Math.abs(input.amount),
            period: input.period ?? 'monthly',
            start_on: format(anchor, 'yyyy-MM-dd'),
          },
          { onConflict: 'user_id,category_id,period,start_on' },
        )
        .select('*')
        .single();
      if (error) {
        const full = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
        throw new Error(full || 'Upsert failed');
      }
      return data;
    },

    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.budgets.all(userId) });
      const previous = qc.getQueriesData<BudgetWithSpend[]>({ queryKey: qk.budgets.all(userId) });

      const anchor = startOfMonth(input.month ?? new Date());
      const optimistic: BudgetWithSpend = {
        id: `temp-${Date.now()}`,
        user_id: userId ?? '',
        category_id: input.categoryId,
        amount: Math.abs(input.amount),
        period: input.period ?? 'monthly',
        start_on: format(anchor, 'yyyy-MM-dd'),
        created_at: new Date().toISOString(),
        spent: 0,
      };

      qc.setQueriesData<BudgetWithSpend[]>({ queryKey: qk.budgets.all(userId) }, (old) => {
        if (!old) return [optimistic];
        // If a (real or optimistic) budget for the same category already
        // exists, replace it — upsert semantics require this so the UI
        // never shows two budgets for the same category.
        const existing = old.findIndex((b) => b.category_id === input.categoryId);
        if (existing >= 0) {
          const next = [...old];
          next[existing] = { ...optimistic, spent: old[existing]!.spent };
          return next;
        }
        return [optimistic, ...old];
      });

      return { previous };
    },

    onError: (_err, _input, context) => {
      context?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    onSuccess: (real) => {
      qc.setQueriesData<BudgetWithSpend[]>({ queryKey: qk.budgets.all(userId) }, (old) => {
        if (!old) return [{ ...real, spent: 0 }];
        return old.map((b) =>
          b.id.startsWith('temp-') && b.category_id === real.category_id
            ? { ...real, spent: b.spent }
            : b,
        );
      });
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.budgets.all(userId) });
    },
  });
}

/** Optimistic delete — remove from every cache, restore on error. */
export function useDeleteBudget() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['delete-budget'],
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) {
        const full = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
        throw new Error(full || 'Delete failed');
      }
      return id;
    },

    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.budgets.all(userId) });
      const previous = qc.getQueriesData<BudgetWithSpend[]>({ queryKey: qk.budgets.all(userId) });
      qc.setQueriesData<BudgetWithSpend[]>({ queryKey: qk.budgets.all(userId) }, (old) =>
        (old ?? []).filter((b) => b.id !== id),
      );
      return { previous };
    },

    onError: (_err, _id, context) => {
      context?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.budgets.all(userId) });
    },
  });
}
