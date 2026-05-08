import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments, SplashScreen } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { View } from 'react-native';
import { queryClient, persister, wireAppStateFocus, wireOnlineManager } from '@/lib/queryClient';
import { useAuth, wireAuthAutoRefresh } from '@/features/auth/store';
import { BiometricLockOverlay } from '@/features/auth/BiometricLockOverlay';
import { useHydratePreferencesFromProfile } from '@/features/preferences/sync';
import { useNotificationEngine } from '@/features/notifications/engine';
import { InAppBannerHost } from '@/components/ui/InAppBannerHost';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const hydrate = useAuth((s) => s.hydrate);
  const status = useAuth((s) => s.status);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    hydrate().finally(() => setHydrated(true));
    // Three listeners running for the lifetime of the app:
    //   - AppState → focusManager: refetch on foreground (React Query)
    //   - NetInfo  → onlineManager: pause/resume mutations on offline/online
    //   - AppState → Supabase auto-refresh: stop on background, start on
    //     foreground. Without this, the auto-refresh timer fires while the
    //     app is backgrounded, hits a closed network socket, fails, and
    //     SIGNED_OUT gets emitted — which kicks the user back to login on
    //     next foreground, even though the refresh token was fine.
    const offFocus = wireAppStateFocus();
    const offOnline = wireOnlineManager();
    const offAutoRefresh = wireAuthAutoRefresh();
    return () => {
      offFocus?.();
      offOnline?.();
      offAutoRefresh?.();
    };
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, hydrated]);

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/*
            PersistQueryClientProvider replaces QueryClientProvider for
            offline-first behavior:
              - On mount, blocks first paint until the persisted snapshot
                is restored from AsyncStorage.
              - `maxAge` evicts caches older than 30 days on restore.
              - `buster` is a manual cache invalidator — bump it to force
                every client to drop its persisted cache and refetch.
              - `dehydrateOptions.shouldDehydrateMutation` keeps queued
                offline mutations alive across restarts so they replay
                when network returns.
              - `onSuccess` runs once after restoration; we call
                `resumePausedMutations()` to flush whatever was queued.
          */}
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister,
              maxAge: 1000 * 60 * 60 * 24 * 30,
              buster: 'v1',
              dehydrateOptions: {
                shouldDehydrateMutation: (mutation) =>
                  // Persist mutations that are pending or paused — we want
                  // them to replay after a restart. Successful/erroring
                  // mutations have already done their job.
                  mutation.state.status === 'pending',
              },
            }}
            onSuccess={() => {
              // Cache restored. Replay any mutation that was queued offline.
              queryClient.resumePausedMutations();
            }}
          >
            {!fontsLoaded || status === 'unknown' ? <GateFallback /> : (
              <AuthenticatedShell />
            )}
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Wraps the authenticated tree and boots per-session subsystems: preference
 * sync from Supabase → local store, and the biometric lock overlay. Kept as
 * its own component so the hydration hook runs inside a React tree that has
 * access to QueryClientProvider (for useProfile).
 */
function AuthenticatedShell() {
  useHydratePreferencesFromProfile();
  // Drives push + in-app notifications: schedules the month-end reminder,
  // evaluates budget/income rules whenever finance data changes, and feeds
  // the in-app banner queue. Mounted here so it only runs while signed in.
  useNotificationEngine();
  return (
    <>
      <ThemedStatusBar />
      <AuthGate>
        <ThemedStack />
      </AuthGate>
      {/* Overlay paints above the Stack when biometric unlock is pending. */}
      <BiometricLockOverlay />
      {/* Renders the active in-app banner stack above all routes. */}
      <InAppBannerHost />
    </>
  );
}

function GateFallback() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
}

function ThemedStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="transaction/new"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: colors.surfaceContainerLow },
        }}
      />
      <Stack.Screen
        name="transaction/[id]"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: colors.surfaceContainerLow },
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: colors.surfaceContainerLow },
        }}
      />
    </Stack>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (status === 'guest' && inTabsGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [status, segments, router]);

  return <>{children}</>;
}
