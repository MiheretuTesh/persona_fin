import { useEffect, useRef } from 'react';
import { useProfile } from '@/features/profile/queries';
import { usePreferences } from './store';

/**
 * Bridges server-side preferences (Supabase `profiles`) into the local Zustand
 * store ONCE per login. Rule of thumb: local is authoritative for the UI, but
 * on a fresh device we adopt whatever the user already picked on a previous
 * device — as long as they haven't made a different choice locally yet.
 *
 * Mount this hook once in the root layout while authenticated. It runs only
 * after AsyncStorage has rehydrated, to avoid racing the local snapshot.
 */
export function useHydratePreferencesFromProfile() {
  const profile = useProfile();
  const hydrated = usePreferences((s) => s._hydrated);
  const localCurrency = usePreferences((s) => s.currency);
  const setCurrency = usePreferences((s) => s.setCurrency);
  const hasAdoptedFromProfile = useRef(false);

  useEffect(() => {
    if (!hydrated || !profile.data?.currency || hasAdoptedFromProfile.current) return;

    const remote = profile.data.currency.toUpperCase();
    // Only adopt the remote value if the user hasn't explicitly changed it on
    // this device (i.e., local is still at the 'USD' default). That keeps an
    // in-progress offline change from being clobbered by the server.
    if (localCurrency === 'USD' && remote !== 'USD') {
      setCurrency(remote);
    }
    hasAdoptedFromProfile.current = true;
  }, [hydrated, profile.data?.currency, localCurrency, setCurrency]);
}
