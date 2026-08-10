import { useEffect, useRef } from 'react';
import { useProfile } from '@/features/profile/queries';
import { usePreferences } from './store';

/**
 * Bridges server-side preferences (Supabase `profiles`) into the local Zustand
 * store ONCE per login. Rule of thumb: local is authoritative for the UI, but
 * on a fresh device we adopt whatever the user already picked on a previous
 * device — as long as they haven't made a different choice locally yet.
 *
 * "Haven't chosen locally" is tracked explicitly by the store's `_touched`
 * list rather than inferred from "is it still the default value?", so a user
 * who deliberately selects the default (USD, or the Gregorian calendar) keeps
 * that choice instead of having a stale remote row overwrite it.
 *
 * Mount this hook once in the root layout while authenticated. It runs only
 * after AsyncStorage has rehydrated, to avoid racing the local snapshot.
 */
export function useHydratePreferencesFromProfile() {
  const profile = useProfile();
  const hydrated = usePreferences((s) => s._hydrated);
  const adopt = usePreferences((s) => s.adoptFromProfile);
  const hasAdoptedFromProfile = useRef(false);

  const row = profile.data;

  useEffect(() => {
    if (!hydrated || !row || hasAdoptedFromProfile.current) return;
    hasAdoptedFromProfile.current = true;

    adopt({
      currency: row.currency ? row.currency.toUpperCase() : undefined,
      calendar: row.calendar_system ?? undefined,
      calendarScript: row.calendar_script ?? undefined,
      pushEnabled: row.push_enabled ?? undefined,
      inAppEnabled: row.inapp_enabled ?? undefined,
    });
  }, [hydrated, row, adopt]);
}
