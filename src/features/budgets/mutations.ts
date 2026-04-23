import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startOfMonth, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import type { Budget } from '@/types/database';

type CreateInput = {
  categoryId: string;
  amount: number; // positive
  period?: Budget['period'];
  month?: Date;
};

export function useCreateBudget() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
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
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}
