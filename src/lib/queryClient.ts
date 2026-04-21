import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, AppStateStatus, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 2,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * React Query's default focus manager is browser-centric. On native we bridge
 * AppState → focusManager so queries revalidate when the app returns to
 * foreground (e.g., after biometric re-unlock).
 */
export function wireAppStateFocus() {
  if (Platform.OS === 'web') return;
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    focusManager.setFocused(state === 'active');
  });
  return () => sub.remove();
}
