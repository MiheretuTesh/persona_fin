import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Database } from '@/types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail fast at startup in dev — silent misconfiguration on a finance app is worse
  // than a hard crash on the splash. In production, EAS Build inlines these from the
  // environment defined in eas.json / .env.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project values.',
  );
}

/**
 * SecureStore-backed auth storage.
 *
 * Sessions on a finance app must live in Keychain (iOS) / EncryptedSharedPreferences
 * (Android) — not AsyncStorage. SecureStore is hardware-backed on both platforms.
 * Web falls back to localStorage because SecureStore is native-only; web is dev-only
 * here, not a shipped surface.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const webStorage =
  typeof window !== 'undefined' && window.localStorage
    ? {
        getItem: (k: string) => Promise.resolve(window.localStorage.getItem(k)),
        setItem: (k: string, v: string) => Promise.resolve(window.localStorage.setItem(k, v)),
        removeItem: (k: string) => Promise.resolve(window.localStorage.removeItem(k)),
      }
    : undefined;

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
