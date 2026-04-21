import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import type { Category, TransactionKind } from '@/types/database';

export function useCategories() {
  const userId = useAuth((s) => s.user?.id);
  return useQuery({
    queryKey: ['categories', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Index categories by id for quick lookup from transaction rows. */
export function useCategoryMap() {
  const q = useCategories();
  const byId = useMemo(() => {
    const map = new Map<string, Category>();
    q.data?.forEach((c) => map.set(c.id, c));
    return map;
  }, [q.data]);
  return { ...q, byId };
}

export function useCategoriesByKind(kind: TransactionKind) {
  const q = useCategories();
  return { ...q, data: q.data?.filter((c) => c.kind === kind) ?? [] };
}
