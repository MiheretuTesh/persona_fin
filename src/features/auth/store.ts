import { create } from 'zustand';
import { AppState, AppStateStatus, Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  status: 'unknown' | 'authenticated' | 'guest';
  /**
   * Timestamp (ms since epoch) of the most recent fresh sign-in or sign-up.
   *
   * Set by signIn/signUp; cleared by signOut. Deliberately NOT touched by
   * hydrate — when the app boots and pulls a session out of SecureStore this
   * stays null, signaling "this session was restored, not just created."
   *
   * Read by BiometricLockOverlay to skip the biometric prompt that would
   * otherwise fire immediately after the user typed their password (which
   * already proved who they are). A short grace window (60s) is plenty to
   * cover the navigation hop from sign-in → tabs.
   */
  sessionAuthenticatedAt: number | null;
  hydrate: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
};

/**
 * Auth is the only piece of global state we actually need — everything else
 * lives in React Query. Session events from Supabase are forwarded here so
 * the gate in `app/_layout.tsx` can redirect on sign-in/out without polling.
 */
export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  status: 'unknown',
  sessionAuthenticatedAt: null,

  hydrate: async () => {
    const { data } = await supabase.auth.getSession();
    // IMPORTANT: leave sessionAuthenticatedAt unchanged. A restored session
    // is *not* a fresh authentication — biometric should still gate it.
    set({
      session: data.session,
      user: data.session?.user ?? null,
      status: data.session ? 'authenticated' : 'guest',
    });
    supabase.auth.onAuthStateChange((event, session) => {
      // Forward Supabase-side events (token refresh, sign-out from another
      // device) without lying about freshness. Only signIn/signUp set
      // sessionAuthenticatedAt — those run their own set() below.
      const next: Partial<AuthState> = {
        session,
        user: session?.user ?? null,
        status: session ? 'authenticated' : 'guest',
      };
      // SIGNED_OUT is the canonical clear signal across devices.
      if (event === 'SIGNED_OUT') {
        next.sessionAuthenticatedAt = null;
      }
      set(next);
    });
  },

  signIn: async (email, password) => {
    // CRITICAL ORDERING: write sessionAuthenticatedAt BEFORE calling Supabase.
    //
    // signInWithPassword is async, but Supabase's onAuthStateChange listener
    // fires the SIGNED_IN event synchronously inside the same task. That
    // listener calls set({ status: 'authenticated' }), which causes the
    // BiometricLockOverlay's effect to re-run. If sessionAuthenticatedAt is
    // still null at that moment, the overlay assumes "this is a restored
    // session, gate it" and fires the biometric prompt. Then the user sees
    // a redundant biometric ask immediately after typing their password.
    //
    // By stamping the timestamp first, we guarantee the overlay sees a fresh
    // auth marker regardless of the order in which the two state updates
    // land. On failure, we roll it back so a typo doesn't leave the app
    // stuck in "skip biometric" mode.
    const previousStamp = get().sessionAuthenticatedAt;
    set({ sessionAuthenticatedAt: Date.now() });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e) {
      set({ sessionAuthenticatedAt: previousStamp });
      throw e;
    }
  },

  signUp: async (email, password, displayName) => {
    // Same race-prevention as signIn — see comment above.
    const previousStamp = get().sessionAuthenticatedAt;
    set({ sessionAuthenticatedAt: Date.now() });
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: displayName ? { display_name: displayName } : undefined },
      });
      if (error) throw error;
    } catch (e) {
      set({ sessionAuthenticatedAt: previousStamp });
      throw e;
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ sessionAuthenticatedAt: null });
  },

  sendPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'equilibrium://auth/reset',
    });
    if (error) throw error;
  },
}));

/**
 * Bridges AppState → Supabase auto-refresh.
 *
 * Why this exists: Supabase's `autoRefreshToken: true` schedules a periodic
 * refresh of the access token. By default that timer keeps ticking while the
 * app is backgrounded. If the app has been away long enough for the access
 * token to expire AND the device went offline AND the timer happens to fire,
 * Supabase eventually gives up and emits SIGNED_OUT — even though the
 * refresh token is perfectly valid. The user opens the app and finds
 * themselves on the login screen for no apparent reason.
 *
 * The recommended pattern (from Supabase's React Native docs) is to stop
 * auto-refresh whenever the app leaves the foreground and restart it on
 * return. Refreshes happen on demand in foreground via `getSession()` calls,
 * which is plenty.
 *
 * Mount this once in the root layout. Returns an unsubscribe function.
 */
export function wireAuthAutoRefresh() {
  if (Platform.OS === 'web') return;
  // Start immediately for the foreground we're already in.
  supabase.auth.startAutoRefresh();

  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      // Covers both 'background' and 'inactive' (iOS shows 'inactive' during
      // bio prompts, app switcher, control center). Pausing here prevents
      // the spurious failed-refresh → SIGNED_OUT chain.
      supabase.auth.stopAutoRefresh();
    }
  });
  return () => sub.remove();
}
