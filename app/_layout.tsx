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
import { palette } from '@/theme';

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

  // Hydrate session once, then wire AppState → focusManager.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    hydrate().finally(() => setHydrated(true));
    return wireAppStateFocus();
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || status === 'unknown') {
    // Keep the native splash up. Returning a dark view prevents a FOUC white flash.
    return <View style={{ flex: 1, backgroundColor: palette.surface }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.surface }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.surface },
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
                  contentStyle: { backgroundColor: palette.surfaceContainerLow },
                }}
              />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Routes-as-policy: redirects based on session + current segment. */
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
