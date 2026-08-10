import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/store';

/**
 * Routes a tapped notification to the right screen.
 *
 * Previously nothing listened for notification responses, so tapping an alert
 * just opened the app on whatever screen it was last on — the alert itself was
 * unreachable, which made the push feel broken even when it had been delivered
 * correctly.
 *
 * `useLastNotificationResponse` is the right primitive here rather than
 * `addNotificationResponseReceivedListener`: it also replays the response that
 * *launched* the app from a cold start, which a listener registered during
 * React mount would miss entirely.
 *
 * The `route` field is written by the notification producers in `local.ts`.
 * Anything without one falls back to the notifications inbox, which is a
 * sensible destination for every alert we send.
 */
export function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    // Only navigate once we're past the auth gate; otherwise AuthGate's own
    // redirect races us and wins, dropping the user on the tab root.
    if (status !== 'authenticated') return;

    const id = response.notification.request.identifier;
    if (handledRef.current === id) return;
    handledRef.current = id;

    const data = response.notification.request.content.data as
      | { route?: string }
      | undefined;
    const route = typeof data?.route === 'string' ? data.route : '/notifications';
    router.push(route as never);
  }, [response, router, status]);
}
