import * as Notifications from 'expo-notifications';
import { endOfMonth, format, subDays } from 'date-fns';
import { ensureNotificationPermission } from './permissions';

/**
 * Thin wrapper around expo-notifications that fires (or schedules) a local
 * push notification. Returns the OS notification id, or null if the user has
 * denied permission.
 *
 * "Local" means: scheduled by the device, no remote server involved. Free,
 * private, and works offline — at the cost of only being able to fire while
 * the OS still has the app installed (we lose pending schedules on uninstall).
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
    },
    trigger: null, // immediate
  });
}

/**
 * Schedules the "your month is ending in 3 days" reminder for the *current*
 * calendar month. Fires once at 9 AM local time on (lastDayOfMonth - 3).
 *
 * Idempotent across cold starts: we tag the request with an identifier
 * derived from the year/month, then cancel any prior schedule with the same
 * id before re-scheduling. That way running this on every app launch is safe
 * (and necessary — we want to schedule next month's reminder once the current
 * one fires).
 */
export async function scheduleMonthEndReminder(now = new Date()): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;

  const monthKey = format(now, 'yyyy-MM');
  const identifier = `month-end-${monthKey}`;

  // Always cancel first, then re-create. expo-notifications de-dupes by id.
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // No prior schedule — fine.
  }

  const fireAt = new Date(endOfMonth(now));
  const reminderAt = subDays(fireAt, 3);
  reminderAt.setHours(9, 0, 0, 0);

  // If the 3-days-out point has already passed this month, skip (we'll
  // schedule next month's when this one rolls over).
  if (reminderAt.getTime() <= now.getTime()) return;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'Month is wrapping up',
      body: 'Three days left in this period — review your spending and close out the month.',
      data: { kind: 'month-end', month: monthKey },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderAt,
    },
  });
}

/** Cancels every Equilibrium-scheduled notification. Used by sign-out. */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Best-effort.
  }
}
