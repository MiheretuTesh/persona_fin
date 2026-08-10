import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { subDays } from 'date-fns';
import { ALERT_CHANNEL_ID, ensureNotificationPermission } from './permissions';
import { endOfPeriod, periodScope, type CalendarSystem } from '@/lib/calendar';

/**
 * Thin wrapper around expo-notifications that fires (or schedules) a local
 * push notification. Returns the OS notification id, or null if the user has
 * denied permission.
 *
 * "Local" means: scheduled by the device, no remote server involved. Free,
 * private, and works offline — at the cost of only being able to fire while
 * the OS still has the app installed (we lose pending schedules on uninstall).
 */

/**
 * Immediate local notification.
 *
 * Note the trigger: a 1-second TIME_INTERVAL rather than `null`. This is not
 * cosmetic. expo-notifications reads the Android channel off the *trigger*,
 * and with `trigger: null` its Android builder logs
 *   "Couldn't get channel for the notifications - trigger is 'null'"
 * and falls back to `expo_notifications_fallback_notification_channel` — a
 * "Miscellaneous" channel at default importance. So every alert bypassed our
 * configured channel: no brand colour, no vibration, and no heads-up banner.
 * A schedulable trigger lets us name the channel, at the cost of a delay no
 * user can perceive. iOS ignores channelId and treats 1s as immediate.
 */
export async function fireLocalNotification(opts: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
      sound: true,
      // Android: lifts the notification to heads-up alongside channel importance.
      priority: Notifications.AndroidNotificationPriority.HIGH,
      color: '#4EDEA3',
      // iOS: `active` shows a banner and lights the screen without needing any
      // entitlement. `timeSensitive` would also break through Focus modes, but
      // that requires the com.apple.developer.usernotifications.time-sensitive
      // entitlement, which this app doesn't declare — so it would silently
      // degrade to `active` anyway.
      ...(Platform.OS === 'ios' ? { interruptionLevel: 'active' as const } : null),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: ALERT_CHANNEL_ID,
    },
  });
}

/**
 * Schedules the "your period is ending in 3 days" reminder for the *current*
 * period. Fires once at 9 AM local time on (lastDayOfPeriod - 3).
 *
 * Period boundaries follow the user's calendar preference, so an Ethiopian
 * user is reminded three days before ጳጉሜ/ነሐሴ ends rather than before the
 * Gregorian month does.
 *
 * Idempotent across cold starts: the identifier encodes the calendar-scoped
 * period, and we cancel any prior schedule with the same id before
 * re-scheduling. That makes running this on every app launch safe (and
 * necessary — we want to schedule next period's reminder once the current one
 * fires). Switching calendars produces a different identifier, so the stale
 * schedule is cancelled explicitly by `cancelMonthEndReminders`.
 */
export async function scheduleMonthEndReminder(
  now = new Date(),
  system: CalendarSystem = 'gregorian',
  periodLabel?: string,
): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  const scope = periodScope(now, system);
  const identifier = `month-end-${scope}`;

  // Always cancel first, then re-create. expo-notifications de-dupes by id.
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // No prior schedule — fine.
  }

  const reminderAt = subDays(endOfPeriod(now, system), 3);
  reminderAt.setHours(9, 0, 0, 0);

  // If the 3-days-out point has already passed this period, skip (we'll
  // schedule next period's when this one rolls over).
  if (reminderAt.getTime() <= now.getTime()) return;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'Period is wrapping up',
      body: periodLabel
        ? `Three days left in ${periodLabel} — review your spending and close out the period.`
        : 'Three days left in this period — review your spending and close out the period.',
      data: { kind: 'month-end', period: scope, route: '/notifications' },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      color: '#4EDEA3',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderAt,
      channelId: ALERT_CHANNEL_ID,
    },
  });
}

/**
 * Cancels every pending month-end reminder except the one for `keepScope`.
 * Called when the calendar preference changes — the previously-scheduled
 * Gregorian reminder is meaningless once the user is on Ethiopian months, and
 * its identifier no longer matches so `scheduleMonthEndReminder` won't
 * overwrite it.
 */
export async function cancelStaleMonthEndReminders(keepScope?: string): Promise<void> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((n) => n.identifier.startsWith('month-end-'))
        .filter((n) => !keepScope || n.identifier !== `month-end-${keepScope}`)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Best-effort — a stale reminder is a cosmetic problem, not a crash.
  }
}

/** Cancels every Equilibrium-scheduled notification. Used by sign-out. */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Best-effort.
  }
}
