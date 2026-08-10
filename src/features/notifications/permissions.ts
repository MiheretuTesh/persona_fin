import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Android notification channel for Equilibrium's budget/spending alerts.
 *
 * The id is versioned deliberately. Android treats a channel as immutable once
 * created: re-creating it with a different importance is silently ignored (an
 * app may lower importance, never raise it — that's the user's call). The
 * original `default` channel shipped at `IMPORTANCE_DEFAULT`, which puts
 * notifications in the tray but never shows a heads-up banner, so alerts
 * looked like they "weren't working" for anyone who already had the app
 * installed. A new id is the only way to hand those installs a channel that
 * can actually interrupt. If you ever need to change importance again, bump
 * the version rather than editing in place.
 */
export const ALERT_CHANNEL_ID = 'equilibrium.alerts.v2';

/**
 * Sets the foreground behavior once per process. Without this, notifications
 * fired while the app is in the foreground are silently swallowed on iOS — we
 * want them to render as a banner just like background-fired ones.
 */
let handlerSet = false;
export function configureForegroundHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // shouldShowAlert is the legacy flag; the SDK still requires it on the
      // type. shouldShowBanner/shouldShowList are the new iOS 14+ split.
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Creates the Android alert channel. Idempotent and safe to call on every
 * launch — Android no-ops when the channel already exists.
 *
 * `HIGH` importance is what earns a heads-up banner + sound. Anything lower
 * and a "you've blown your Food budget" alert lands silently in the shade,
 * which is indistinguishable from the feature being broken.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
    name: 'Budget & spending alerts',
    description: 'Budget warnings, income alerts, and month-end reminders.',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#4EDEA3',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/**
 * Ensures we can post notifications, creating the Android channel on the way.
 * Idempotent — the OS only prompts the first time.
 *
 * Returns false when permission is denied *or* permanently unavailable, so
 * callers can distinguish "we chose not to notify" from "we tried and failed".
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const req = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return req.granted;
}

export type PermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
};

/**
 * Reads permission state without prompting. Used by Settings to show why
 * alerts aren't arriving and to deep-link into the OS settings page.
 */
export async function getNotificationPermission(): Promise<PermissionSnapshot> {
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain, status: p.status };
}
