import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import type { Transaction, TransactionKind } from '@/types/database';

type CreateInput = {
  walletId: string;
  categoryId: string;
  kind: TransactionKind;
  amount: number; // positive; we sign it based on kind
  merchant?: string;
  note?: string;
  occurredAt: Date;
};

export function useCreateTransaction() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput): Promise<Transaction> => {
      if (!userId) throw new Error('Not authenticated.');
      const signed =
        input.kind === 'expense' ? -Math.abs(input.amount) :
        input.kind === 'income'  ?  Math.abs(input.amount) :
        Math.abs(input.amount);

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          wallet_id: input.walletId,
          category_id: input.categoryId,
          kind: input.kind,
          amount: signed,
          merchant: input.merchant?.trim() || null,
          note: input.note?.trim() || null,
          occurred_at: input.occurredAt.toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}
