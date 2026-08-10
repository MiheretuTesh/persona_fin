import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useAuth } from '@/features/auth/store';
import { useCalendarSystem } from '@/features/preferences/store';
import { startOfPeriod } from '@/lib/calendar';
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
 *
 * IMPORTANT — `start_on` must be the *active calendar's* period start, which
 * is what `useCurrentBudgets` filters on (`start_on <= periodStart`). Using
 * Gregorian `startOfMonth` here would desync the two on the Ethiopian
 * calendar: creating a budget on 5 Oct (inside መስከረም, which began 11 Sep)
 * would write `start_on = 2026-10-01` while the query asks for
 * `start_on <= 2026-09-11` — so the budget the user just created would be
 * filtered straight back out and appear not to save.
 */
export function useCreateBudget() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const system = useCalendarSystem();

  return useMutation({
    mutationKey: ['create-budget'],
    mutationFn: async (input: CreateInput): Promise<Budget> => {
      if (!userId) throw new Error('Not authenticated.');
      const anchor = startOfPeriod(input.month ?? new Date(), system);
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

      const anchor = startOfPeriod(input.month ?? new Date(), system);
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
      // Tracking rows carry budget limits and consumption ratios, so a budget
      // change is as much a tracking change as a budget one.
      qc.invalidateQueries({ queryKey: qk.tracking.all(userId) });
    },
  });
}

/**
 * Optimistic update — pure amount change for an existing budget. Distinct
 * from useCreateBudget (which is an upsert) so the call site reads cleanly:
 * "this is editing an existing row, not creating one".
 */
export function useUpdateBudget() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['update-budget'],
    mutationFn: async (input: { id: string; amount: number }): Promise<Budget> => {
      const { data, error } = await supabase
        .from('budgets')
        .update({ amount: Math.abs(input.amount) })
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) {
        const full = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
        throw new Error(full || 'Update failed');
      }
      return data;
    },

    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.budgets.all(userId) });
      const previous = qc.getQueriesData<BudgetWithSpend[]>({ queryKey: qk.budgets.all(userId) });
      qc.setQueriesData<BudgetWithSpend[]>({ queryKey: qk.budgets.all(userId) }, (old) =>
        (old ?? []).map((b) =>
          b.id === input.id ? { ...b, amount: Math.abs(input.amount) } : b,
        ),
      );
      return { previous };
    },

    onError: (_err, _input, context) => {
      context?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.budgets.all(userId) });
      // Tracking rows carry budget limits and consumption ratios, so a budget
      // change is as much a tracking change as a budget one.
      qc.invalidateQueries({ queryKey: qk.tracking.all(userId) });
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
      // Tracking rows carry budget limits and consumption ratios, so a budget
      // change is as much a tracking change as a budget one.
      qc.invalidateQueries({ queryKey: qk.tracking.all(userId) });
    },
  });
}
