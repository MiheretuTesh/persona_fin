import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarScript, CalendarSystem } from '@/lib/calendar';

/**
 * Client-side preferences — the UI's source of truth for currency, calendar,
 * and notification channels. Persisted to AsyncStorage so the first frame
 * after cold-start renders with the user's real settings, not a flashed default.
 *
 * The Supabase `profiles` row remains the cross-device source of truth; we
 * hydrate this store from it once on login (see useHydratePreferences in
 * `sync.ts`) and write back on every change.
 *
 * Intentional scope: only settings that must be instantly readable without a
 * network round-trip live here. Secrets (tokens, biometric opt-in flag) stay
 * in expo-secure-store; rich data (profile, transactions) stays in React Query.
 *
 * The calendar preference in particular must be synchronous and available
 * before first paint — it decides what "this month" means for every query key
 * in the app, and a flash from Gregorian to Ethiopian would refetch the whole
 * dashboard against a different period.
 */

/** Keys the user can explicitly set on this device. See `_touched`. */
export type PreferenceKey =
  | 'currency'
  | 'calendar'
  | 'calendarScript'
  | 'pushEnabled'
  | 'inAppEnabled';

type PreferencesState = {
  currency: string;
  /** Which calendar drives period boundaries and date labels. */
  calendar: CalendarSystem;
  /** Script for Ethiopian month names. No effect when calendar is 'gregorian'. */
  calendarScript: CalendarScript;
  /** Master switch for OS-level push (local) notifications. */
  pushEnabled: boolean;
  /** Master switch for in-app banners. */
  inAppEnabled: boolean;
  /**
   * Keys the user has explicitly changed on *this* device. The profile-sync
   * hook adopts the server's value only for keys absent from this list, so an
   * offline change is never clobbered by a stale remote row — and a deliberate
   * choice that happens to equal the default (picking USD on purpose) is
   * respected, which a "is it still the default?" check gets wrong.
   */
  _touched: PreferenceKey[];
  /** True once AsyncStorage has rehydrated the persisted snapshot. Readers can ignore this unless they need to avoid flashing a default. */
  _hydrated: boolean;
  setCurrency: (code: string) => void;
  setCalendar: (system: CalendarSystem) => void;
  setCalendarScript: (script: CalendarScript) => void;
  setPushEnabled: (value: boolean) => void;
  setInAppEnabled: (value: boolean) => void;
  /** Applies a server value without marking the key as locally touched. */
  adoptFromProfile: (patch: Partial<Pick<PreferencesState, PreferenceKey>>) => void;
  _setHydrated: (value: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => {
      /** Records a key as locally chosen, then applies the value. */
      const touch = <K extends PreferenceKey>(key: K, value: PreferencesState[K]) =>
        set((s) => ({
          [key]: value,
          _touched: s._touched.includes(key) ? s._touched : [...s._touched, key],
        }) as Partial<PreferencesState>);

      return {
        currency: 'USD',
        calendar: 'gregorian',
        calendarScript: 'amharic',
        pushEnabled: true,
        inAppEnabled: true,
        _touched: [],
        _hydrated: false,
        setCurrency: (code) => touch('currency', code.toUpperCase()),
        setCalendar: (system) => touch('calendar', system),
        setCalendarScript: (script) => touch('calendarScript', script),
        setPushEnabled: (value) => touch('pushEnabled', value),
        setInAppEnabled: (value) => touch('inAppEnabled', value),
        adoptFromProfile: (patch) =>
          set((s) => {
            const next: Partial<PreferencesState> = {};
            for (const [key, value] of Object.entries(patch) as [PreferenceKey, never][]) {
              if (value === undefined || value === null) continue;
              if (s._touched.includes(key)) continue;
              next[key] = value;
            }
            return next;
          }),
        _setHydrated: (value) => set({ _hydrated: value }),
      };
    },
    {
      name: 'eq.preferences',
      // v2 adds calendar + notification channel switches. The persisted v1
      // snapshot only held `currency`; zustand merges the missing keys from
      // the initializer above, so no explicit `migrate` step is needed.
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currency: state.currency,
        calendar: state.calendar,
        calendarScript: state.calendarScript,
        pushEnabled: state.pushEnabled,
        inAppEnabled: state.inAppEnabled,
        _touched: state._touched,
      }),
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

/**
 * The active calendar system. Read this anywhere a period boundary or a date
 * label is computed — never hard-code `startOfMonth` / `format` again.
 */
export function useCalendarSystem(): CalendarSystem {
  return usePreferences((s) => s.calendar);
}

/** Script for Ethiopian month names — pass through to the `calendar.ts` formatters. */
export function useCalendarScript(): CalendarScript {
  return usePreferences((s) => s.calendarScript);
}
