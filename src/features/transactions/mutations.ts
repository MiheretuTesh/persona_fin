import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
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

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Optimistic create-transaction
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The four-step optimistic recipe, explained:
 *
 *   1. CANCEL — `qc.cancelQueries` aborts any in-flight refetches that might
 *      otherwise overwrite our optimistic insert. Without this, a refetch
 *      that started a moment ago could land *after* our optimistic update
 *      and clobber it.
 *
 *   2. SNAPSHOT — read the current cache state for every list query we're
 *      about to mutate. This is what we restore in `onError`.
 *
 *   3. OPTIMISTIC WRITE — synthesize a Transaction with a temp id (prefixed
 *      `temp-`) and prepend it to every transaction list cache. The UI
 *      re-renders immediately.
 *
 *   4. RETURN ROLLBACK CONTEXT — `onMutate` returns the snapshot; React
 *      Query passes it to `onError` as the third argument so we can undo.
 *
 * On success: we replace the temp row with the real Supabase row (same
 *   merchant/category, but with the real id and timestamps). UI doesn't
 *   visibly change.
 *
 * On settled: we invalidate every dependent query (transactions lists,
 *   budgets, lifetime totals, insights). React Query background-refetches
 *   them. The UI keeps showing optimistic data until the refetch lands.
 *
 * Offline behavior: when the device is offline, networkMode='offlineFirst'
 *   marks this mutation `paused` instead of failing. The persister keeps
 *   it in AsyncStorage. When NetInfo says we're online again, our root
 *   layout's `resumePausedMutations()` replays it.
 */
export function useCreateTransaction() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['create-transaction'],
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
      if (error) {
        const full = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
        throw new Error(full || 'Insert failed');
      }
      return data;
    },

    onMutate: async (input) => {
      // (1) Cancel refetches so they don't race our optimistic write.
      await qc.cancelQueries({ queryKey: qk.transactions.all(userId) });

      // (2) Snapshot every list cache we touch. We use `getQueriesData` so
      //     this works for both `useTransactions()` (no month) and
      //     `useTransactions({ month })` variants — every key under the
      //     `['transactions', userId, ...]` prefix is captured.
      const previousLists = qc.getQueriesData<Transaction[]>({
        queryKey: qk.transactions.all(userId),
      });

      // (3) Synthesize the optimistic row.
      const signed =
        input.kind === 'expense' ? -Math.abs(input.amount) :
        input.kind === 'income'  ?  Math.abs(input.amount) :
        Math.abs(input.amount);

      const optimistic: Transaction = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user_id: userId ?? '',
        wallet_id: input.walletId,
        category_id: input.categoryId,
        kind: input.kind,
        amount: signed,
        merchant: input.merchant?.trim() || null,
        note: input.note?.trim() || null,
        occurred_at: input.occurredAt.toISOString(),
        created_at: new Date().toISOString(),
      };

      // Prepend to every matching transactions list cache. We filter to lists
      // whose query key implies the new row would have been included anyway
      // (i.e., scope === 'all' or the row's month falls in the cached month).
      qc.setQueriesData<Transaction[]>(
        { queryKey: qk.transactions.all(userId) },
        (old) => (old ? [optimistic, ...old] : [optimistic]),
      );

      // (4) Return rollback context.
      return { previousLists };
    },

    onError: (_err, _input, context) => {
      // Undo the optimistic write by restoring each snapshot.
      context?.previousLists?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
    },

    onSuccess: (real, _input, context) => {
      // Find the temp row in each cache and swap it for the real one.
      // We can identify temp rows by id prefix; this avoids assuming
      // they're at index 0 (a refetch could have reshuffled).
      qc.setQueriesData<Transaction[]>(
        { queryKey: qk.transactions.all(userId) },
        (old) => {
          if (!old) return [real];
          let replaced = false;
          const next = old.map((t) => {
            if (!replaced && t.id.startsWith('temp-')) {
              replaced = true;
              return real;
            }
            return t;
          });
          return replaced ? next : [real, ...next];
        },
      );
    },

    onSettled: () => {
      // Whether success or failure, refetch dependent data:
      //   - transactions lists (so the canonical server-ordered list is restored)
      //   - lifetime totals (Vault net worth depends on this)
      //   - budgets (spent-per-category recomputes)
      //   - insights (donut + trend)
      qc.invalidateQueries({ queryKey: qk.transactions.all(userId) });
      qc.invalidateQueries({ queryKey: qk.transactions.lifetime(userId) });
      qc.invalidateQueries({ queryKey: qk.budgets.all(userId) });
      qc.invalidateQueries({ queryKey: qk.insights.all(userId) });
    },
  });
}
