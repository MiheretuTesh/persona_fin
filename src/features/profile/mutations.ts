import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/store';
import type { Profile } from '@/types/database';

type ProfileUpdate = Partial<
  Pick<
    Profile,
    | 'display_name'
    | 'avatar_url'
    | 'currency'
    | 'biometric_enabled'
    | 'calendar_system'
    | 'calendar_script'
    | 'push_enabled'
    | 'inapp_enabled'
  >
>;

/**
 * Upserts the current user's profile.
 *
 * Prior revision used `.update(...).select().single()` — which fails with
 * PGRST116 ("0 rows") whenever the profile row is missing. That happened to
 * users who signed up before the on_auth_user_created trigger was installed,
 * producing a silent no-op: the optimistic cache updated, the mutation errored,
 * onError rolled back, and the UI snapped to its original value with no alert.
 *
 * Upsert keyed on `id` makes this self-healing — if the row is absent we create it.
 */
export function useUpdateProfile() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate): Promise<Profile> => {
      if (!userId) throw new Error('Not authenticated.');
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...patch }, { onConflict: 'id' })
        .select('*')
        .single();
      if (error) {
        // Compose a readable message that includes the Postgres details/hint
        // so the Alert in the caller shows the actual cause (RLS, constraints, etc.).
        const full = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
        throw new Error(full || 'Update failed');
      }
      return data;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['profile', userId] });
      const previous = qc.getQueryData<Profile>(['profile', userId]);
      if (previous) qc.setQueryData<Profile>(['profile', userId], { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(['profile', userId], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
