import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useAuth } from '@/features/auth/store';
import type { Wallet } from '@/types/database';

export function useWallets() {
  const userId = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: qk.wallets.list(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Wallet[]> => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
