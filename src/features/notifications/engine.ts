import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/store';
import { useMonthTotals } from '@/features/transactions/queries';
import { useCurrentBudgets } from '@/features/budgets/queries';
import { useCategoryMap } from '@/features/categories/queries';
import { evaluateRules } from './rules';
import { hasFired, markFired } from './dedup';
import { useBanners } from './store';
import { configureForegroundHandler, ensureNotificationPermission } from './permissions';
import { fireLocalNotification, scheduleMonthEndReminder } from './local';

/**
 * The notification "engine" — a single hook mounted at the app shell that:
 *
 *   1. Configures the foreground handler + asks for notification permission once.
 *   2. (Re-)schedules the month-end local reminder for the current month.
 *   3. Evaluates the rules engine whenever the underlying data changes
 *      (transactions update → useMonthTotals / useCurrentBudgets refetch),
 *      or whenever the app foregrounds.
 *   4. For each candidate the rule engine returns, checks the dedup key in
 *      AsyncStorage. If unfired: pushes an in-app banner, optionally fires a
 *      local push, then marks fired so we don't spam.
 *
 * This deliberately runs *only* while the user is signed in. Mounting it inside
 * AuthenticatedShell guarantees that.
 */
export function useNotificationEngine() {
  const userId = useAuth((s) => s.user?.id);
  const month = useMonthTotals(new Date());
  const budgets = useCurrentBudgets(new Date());
  const categories = useCategoryMap();
  const pushBanner = useBanners((s) => s.push);

  // One-shot setup: permission + foreground handler + schedule month-end.
  useEffect(() => {
    if (!userId) return;
    configureForegroundHandler();
    ensureNotificationPermission().catch(() => {});
    scheduleMonthEndReminder(new Date()).catch(() => {});
  }, [userId]);

  // Re-schedule the month-end reminder when the app foregrounds — that's the
  // moment a previously-fired one might have rolled over to a new month.
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        scheduleMonthEndReminder(new Date()).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [userId]);

  // Evaluate rules whenever the inputs change. Guard against the very common
  // pre-data state by checking that we have a non-empty categories map and
  // the month query has resolved at least once.
  const lastEvaluatedRef = useRef<string>('');
  useEffect(() => {
    if (!userId) return;
    if (month.isLoading || budgets.isLoading || categories.isLoading) return;

    // Fingerprint the inputs so we only re-run rules when something
    // meaningful changed. Cheap stringify — the data is small.
    const fingerprint = JSON.stringify({
      i: month.income,
      e: month.expense,
      b: (budgets.data ?? []).map((b) => [b.id, b.spent, b.amount]),
      cs: categories.byId.size,
    });
    if (fingerprint === lastEvaluatedRef.current) return;
    lastEvaluatedRef.current = fingerprint;

    const candidates = evaluateRules({
      now: new Date(),
      monthIncome: month.income,
      monthExpense: month.expense,
      budgets: budgets.data ?? [],
      categoryById: categories.byId,
    });

    // Fire each candidate at most once per dedup key. Sequential awaits would
    // be tidier but we want UI banners to render immediately; the dedup write
    // is fire-and-forget.
    (async () => {
      for (const c of candidates) {
        if (await hasFired(c.dedupKey)) continue;

        if (c.channels.includes('inapp')) {
          pushBanner({ id: c.dedupKey, ...c.banner });
        }
        if (c.channels.includes('push') && c.push) {
          await fireLocalNotification({
            title: c.push.title,
            body: c.push.body,
            data: { dedupKey: c.dedupKey },
          });
        }
        await markFired(c.dedupKey);
      }
    })();
  }, [
    userId,
    month.income,
    month.expense,
    month.isLoading,
    budgets.data,
    budgets.isLoading,
    categories.byId,
    categories.isLoading,
    pushBanner,
  ]);
}
