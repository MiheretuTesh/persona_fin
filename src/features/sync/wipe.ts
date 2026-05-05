import { useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';

/**
 * Wipe the user's finance data — transactions, budgets, custom categories —
 * from Supabase AND the local cache.
 *
 * What gets deleted:
 *   - public.transactions  WHERE user_id = me
 *   - public.budgets       WHERE user_id = me
 *   - public.categories    WHERE user_id = me   (system seeds with user_id IS NULL stay)
 *
 * What stays:
 *   - auth.users (account itself — separate concern, requires admin API)
 *   - public.profiles (display name, currency preference)
 *   - public.wallets (signup trigger seeded a default; user can re-use it)
 *
 * Order matters: transactions reference categories via FK with ON DELETE
 * RESTRICT, so we must delete transactions before categories. Budgets also
 * reference categories — same rule. Wallets are not referenced by anything
 * we delete.
 *
 * After Supabase succeeds we:
 *   1. Clear React Query in-memory cache → every screen empties immediately.
 *   2. Remove the persisted snapshot from AsyncStorage → next cold start
 *      doesn't restore stale data.
 */
export function useWipeFinanceData() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['wipe-finance-data'],
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated.');

      // 1. Transactions first (referenced by nothing we keep).
      const txRes = await supabase.from('transactions').delete().eq('user_id', userId);
      if (txRes.error) throw enrichError(txRes.error, 'transactions');

      // 2. Budgets next (reference categories).
      const bRes = await supabase.from('budgets').delete().eq('user_id', userId);
      if (bRes.error) throw enrichError(bRes.error, 'budgets');

      // 3. User-scoped categories (system categories with user_id IS NULL stay).
      const cRes = await supabase.from('categories').delete().eq('user_id', userId);
      if (cRes.error) throw enrichError(cRes.error, 'categories');

      return { wipedAt: new Date().toISOString() };
    },

    onSuccess: async () => {
      // Drop the in-memory cache for finance-related queries. Profile,
      // wallets, and preferences stay so the user doesn't get logged out
      // or lose their currency choice.
      qc.removeQueries({ queryKey: ['transactions'] });
      qc.removeQueries({ queryKey: ['budgets'] });
      qc.removeQueries({ queryKey: ['categories'] });
      qc.removeQueries({ queryKey: ['insights'] });
      // Trigger refetches so the seeded system categories rehydrate.
      qc.invalidateQueries({ queryKey: ['categories'] });

      // Remove the persisted query snapshot — otherwise next cold start
      // would restore yesterday's transactions until the first refetch
      // overwrote them. Cleaner to start fresh.
      try {
        await AsyncStorage.removeItem('eq.query-cache.v1');
      } catch {
        // AsyncStorage failures here are non-critical; the in-memory
        // wipe above is the main safeguard. The next cache write will
        // overwrite whatever's stale anyway.
      }
    },
  });
}

function enrichError(error: { message?: string; details?: string; hint?: string }, table: string) {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
  return new Error(`Failed deleting ${table}: ${detail || 'unknown error'}`);
}
