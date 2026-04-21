import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import type { Category, TransactionKind } from '@/types/database';

type CreateInput = {
  name: string;
  icon: string;
  kind: TransactionKind;
  colorToken?: Category['color_token'];
};

/**
 * Create a user-scoped custom category. RLS guarantees user_id = auth.uid().
 * After success we invalidate the categories query; TanStack Query refetches
 * and the new tile appears in the Add Transaction grid.
 */
export function useCreateCategory() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput): Promise<Category> => {
      if (!userId) throw new Error('Not authenticated.');
      const name = input.name.trim();
      if (!name) throw new Error('Name is required.');

      // Pick a sensible sort_order: just above the largest existing for this
      // user + kind. Not worth a roundtrip to figure out the max — stick it
      // at 9999 so user categories sort after system ones.
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name,
          icon: input.icon,
          kind: input.kind,
          color_token: input.colorToken ?? defaultTokenFor(input.kind),
          sort_order: 9999,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

function defaultTokenFor(kind: TransactionKind): Category['color_token'] {
  if (kind === 'income') return 'secondary';
  if (kind === 'expense') return 'primary';
  return 'onSurfaceVariant';
}
