import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/store';
import { useMonthTotals } from '@/features/transactions/queries';
import { useCurrentBudgets } from '@/features/budgets/queries';
import { useCategoryMap } from '@/features/categories/queries';
import { usePreferences } from '@/features/preferences/store';
import { useCalendar } from '@/features/preferences/calendar';
import { evaluateRules } from './rules';
import { hasFired, markFired } from './dedup';
import { useBanners } from './store';
import { configureForegroundHandler, ensureNotificationPermission } from './permissions';
import { cancelStaleMonthEndReminders, fireLocalNotification, scheduleMonthEndReminder } from './local';

/**
 * The notification "engine" — a single hook mounted at the app shell that:
 *
 *   1. Configures the foreground handler + asks for notification permission once.
 *   2. (Re-)schedules the period-end local reminder for the current period.
 *   3. Evaluates the rules engine whenever the underlying data changes
 *      (transactions update → useMonthTotals / useCurrentBudgets refetch),
 *      or whenever the app foregrounds.
 *   4. For each candidate the rule engine returns, checks the dedup key in
 *      AsyncStorage. If unfired: pushes an in-app banner, fires a local push,
 *      then marks fired so we don't spam.
 *
 * This deliberately runs *only* while the user is signed in. Mounting it inside
 * AuthenticatedShell guarantees that.
 *
 * ── Why alerts previously never fired ──────────────────────────────────────
 *
 * The old implementation called `useMonthTotals(new Date())`, and
 * `useTransactions` keyed its query on `month.toISOString()`. `new Date()`
 * yields a fresh millisecond value on every render, so every render minted a
 * brand-new React Query cache entry, which starts in `isLoading: true`. The
 * effect below bails while any input is loading — so it bailed essentially
 * forever, and no rule was ever evaluated. It also leaked one cache entry per
 * render and re-hit Supabase each time.
 *
 * That's fixed at the root: the queries now key on the calendar-scoped period
 * (`g:2026-08`), which collapses every instant in a period onto one key. The
 * anchor below is additionally memoised per period so the effect's dependency
 * array is stable too.
 */
export function useNotificationEngine() {
  const userId = useAuth((s) => s.user?.id);
  const calendar = useCalendar();
  const pushEnabled = usePreferences((s) => s.pushEnabled);
  const inAppEnabled = usePreferences((s) => s.inAppEnabled);

  // A single anchor for "now", refreshed only when the period actually rolls
  // over (or the calendar preference changes). Passing a raw `new Date()` into
  // hooks and dependency arrays is what broke this before.
  const [nowTick, setNowTick] = useState(() => Date.now());
  const anchor = useMemo(() => new Date(nowTick), [nowTick]);
  const scope = calendar.periodScope(anchor);

  const month = useMonthTotals(anchor);
  const budgets = useCurrentBudgets(anchor);
  const categories = useCategoryMap();
  const pushBanner = useBanners((s) => s.push);

  /** Advances the anchor if we've crossed into a new period since last check. */
  const refreshAnchor = useCallback(() => {
    setNowTick((prev) => {
      const next = Date.now();
      // Only re-render when the period changed; otherwise keep the old value so
      // downstream memos and query keys stay referentially stable.
      return calendar.isSamePeriod(new Date(prev), new Date(next)) ? prev : next;
    });
  }, [calendar]);

  // One-shot setup: permission + foreground handler.
  useEffect(() => {
    if (!userId) return;
    configureForegroundHandler();
    ensureNotificationPermission().catch(() => {});
  }, [userId]);

  // (Re)schedule the period-end reminder whenever the period or the calendar
  // changes, dropping any reminder left over from the previous calendar —
  // its identifier no longer matches, so it would otherwise linger.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      await cancelStaleMonthEndReminders(scope);
      if (cancelled) return;
      await scheduleMonthEndReminder(anchor, calendar.system, calendar.formatPeriod(anchor));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, scope, anchor, calendar]);

  // Re-check the period on foreground — that's the moment a previously-fired
  // reminder might have rolled over into a new period.
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshAnchor();
    });
    return () => sub.remove();
  }, [userId, refreshAnchor]);

  // Evaluate rules whenever the inputs change. Guard against the very common
  // pre-data state by checking that the queries have resolved at least once.
  const lastEvaluatedRef = useRef<string>('');
  useEffect(() => {
    if (!userId) return;
    // `isLoading` is true only on the *first* fetch with no cached data, so a
    // background refetch won't block re-evaluation.
    if (month.isLoading || budgets.isLoading || categories.isLoading) return;
    // Categories are needed for readable copy ("Food: budget reached"). An
    // empty map means the query resolved but returned nothing — evaluate
    // anyway; the rules fall back to "a category".
    if (month.isError || budgets.isError) return;

    // Fingerprint the inputs so we only re-run rules when something
    // meaningful changed. Cheap stringify — the data is small.
    const fingerprint = JSON.stringify({
      s: scope,
      i: month.income,
      e: month.expense,
      b: (budgets.data ?? []).map((b) => [b.id, b.spent, b.amount]),
      cs: categories.byId.size,
      p: pushEnabled,
      a: inAppEnabled,
    });
    if (fingerprint === lastEvaluatedRef.current) return;
    lastEvaluatedRef.current = fingerprint;

    const candidates = evaluateRules({
      periodScope: scope,
      monthIncome: month.income,
      monthExpense: month.expense,
      budgets: budgets.data ?? [],
      categoryById: categories.byId,
    });

    let cancelled = false;
    (async () => {
      for (const c of candidates) {
        if (cancelled) return;
        if (await hasFired(c.dedupKey)) continue;

        const wantsBanner = inAppEnabled && c.channels.includes('inapp');
        const wantsPush = pushEnabled && c.channels.includes('push') && !!c.push;
        // Both channels muted for this candidate — leave the dedup key unset so
        // the alert can still reach the user if they re-enable a channel while
        // the condition holds. Marking it fired here would silently swallow it
        // for the rest of the period.
        if (!wantsBanner && !wantsPush) continue;

        if (wantsBanner) {
          pushBanner({ id: c.dedupKey, ...c.banner });
        }
        let delivered = wantsBanner;
        if (wantsPush) {
          const id = await fireLocalNotification({
            title: c.push!.title,
            body: c.push!.body,
            data: { dedupKey: c.dedupKey, route: '/notifications' },
          });
          // A null id means permission was refused. If that was the only
          // channel we had, don't burn the dedup key on an alert nobody saw.
          delivered = delivered || id !== null;
        }
        if (delivered) await markFired(c.dedupKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    scope,
    month.income,
    month.expense,
    month.isLoading,
    month.isError,
    budgets.data,
    budgets.isLoading,
    budgets.isError,
    categories.byId,
    categories.isLoading,
    pushBanner,
    pushEnabled,
    inAppEnabled,
  ]);
}
