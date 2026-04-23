import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Client-side preferences — the UI's source of truth for currency and other
 * small, fast-changing settings. Persisted to AsyncStorage so the first frame
 * after cold-start renders with the user's real currency, not a flashed "USD".
 *
 * The Supabase `profiles` row remains the cross-device source of truth; we
 * hydrate this store from it once on login (see useHydratePreferences in
 * `sync.ts`) and write back on every change.
 *
 * Intentional scope: only settings that must be instantly readable without a
 * network round-trip live here. Secrets (tokens, biometric opt-in flag) stay
 * in expo-secure-store; rich data (profile, transactions) stays in React Query.
 */

type PreferencesState = {
  currency: string;
  /** True once AsyncStorage has rehydrated the persisted snapshot. Readers can ignore this unless they need to avoid flashing a default. */
  _hydrated: boolean;
  setCurrency: (code: string) => void;
  _setHydrated: (value: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      currency: 'USD',
      _hydrated: false,
      setCurrency: (code) => set({ currency: code.toUpperCase() }),
      _setHydrated: (value) => set({ _hydrated: value }),
    }),
    {
      name: 'eq.preferences',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ currency: state.currency }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    },
  ),
);

/** Convenience for components that only need the currency code. */
export function useCurrency(): string {
  return usePreferences((s) => s.currency);
}
