import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments, SplashScreen } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
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
import { queryClient, wireAppStateFocus } from '@/lib/queryClient';
import { useAuth } from '@/features/auth/store';
import { BiometricLockOverlay } from '@/features/auth/BiometricLockOverlay';
import { useHydratePreferencesFromProfile } from '@/features/preferences/sync';
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
    return wireAppStateFocus();
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, hydrated]);

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {!fontsLoaded || status === 'unknown' ? <GateFallback /> : (
              <AuthenticatedShell />
            )}
          </QueryClientProvider>
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
  return (
    <>
      <ThemedStatusBar />
      <AuthGate>
        <ThemedStack />
      </AuthGate>
      {/* Overlay paints above the Stack when biometric unlock is pending. */}
      <BiometricLockOverlay />
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
