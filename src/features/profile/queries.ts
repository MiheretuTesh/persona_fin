import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useAuth } from '@/features/auth/store';
import type { Profile } from '@/types/database';

export function useProfile() {
  const userId = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: qk.profile.me(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
  });
}
