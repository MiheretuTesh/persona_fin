import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Sets the foreground behavior once per process. Without this, scheduled
 * notifications fired while the app is in the foreground are silently swallowed
 * on iOS — we want them to render as a banner just like background-fired ones.
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
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ensures we have permission to schedule local notifications. Idempotent —
 * the OS only prompts the first time. On Android we additionally create a
 * default channel so notifications render with our brand color.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Equilibrium alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#4EDEA3',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  if (!existing.canAskAgain) return false;

  const req = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: false,
    },
  });
  return req.status === 'granted';
}
