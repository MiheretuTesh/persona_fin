import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useAuth } from '@/features/auth/store';
import type { Category, TransactionKind } from '@/types/database';

type CreateInput = {
  name: string;
  icon: string;
  kind: TransactionKind;
  colorToken?: Category['color_token'];
};

/**
 * Optimistic create-category.
 *
 * UX motivation: this mutation fires from inside the Add Transaction modal —
 * the user types a category name and expects to tap it the next instant.
 * Without optimism we'd have to await the Supabase round-trip before the
 * tile appears, and on poor networks that's a visible jank.
 *
 * Implementation note: the categories list is keyed without a month, so a
 * single cache lives at `qk.categories.list(userId)`. We don't need to fan
 * out across month-scoped variants like transactions does.
 */
export function useCreateCategory() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['create-category'],
    mutationFn: async (input: CreateInput): Promise<Category> => {
      if (!userId) throw new Error('Not authenticated.');
      const name = input.name.trim();
      if (!name) throw new Error('Name is required.');

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
      if (error) {
        const full = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
        throw new Error(full || 'Insert failed');
      }
      return data;
    },

    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.categories.list(userId) });
      const previous = qc.getQueryData<Category[]>(qk.categories.list(userId));

      const optimistic: Category = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user_id: userId ?? null,
        name: input.name.trim(),
        icon: input.icon,
        color_token: input.colorToken ?? defaultTokenFor(input.kind),
        kind: input.kind,
        sort_order: 9999,
      };

      qc.setQueryData<Category[]>(qk.categories.list(userId), (old) =>
        old ? [...old, optimistic] : [optimistic],
      );

      return { previous, optimisticId: optimistic.id };
    },

    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(qk.categories.list(userId), context.previous);
    },

    onSuccess: (real, _input, context) => {
      // Replace the temp tile with the real Supabase row in place — keeping
      // it in the same array index so any "selected category" state in the
      // UI keeps pointing at it after the swap (the consumer also calls
      // setValue('categoryId', real.id) — see app/transaction/new.tsx).
      qc.setQueryData<Category[]>(qk.categories.list(userId), (old) => {
        if (!old) return [real];
        return old.map((c) => (c.id === context?.optimisticId ? real : c));
      });
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.categories.list(userId) });
    },
  });
}

function defaultTokenFor(kind: TransactionKind): Category['color_token'] {
  if (kind === 'income') return 'secondary';
  if (kind === 'expense') return 'primary';
  return 'onSurfaceVariant';
}
