import { useMemo } from 'react';
import * as cal from '@/lib/calendar';
import { usePreferences } from './store';

/**
 * Binds the user's calendar preference to the pure helpers in
 * `src/lib/calendar.ts`, so components and queries never have to thread
 * `(system, { script })` through every call.
 *
 *   const { formatPeriod, startOfPeriod } = useCalendar();
 *   <Text>{formatPeriod(anchor)}</Text>   // "August 2026" or "ነሐሴ 2018"
 *
 * The returned object is memoised on `[system, script]`, so it's stable enough
 * to sit in a `useMemo` / `useEffect` dependency array — and it *changes*
 * identity when the user switches calendars, which is exactly what we want:
 * every derived label and period boundary recomputes in one pass.
 */
export function useCalendar() {
  const system = usePreferences((s) => s.calendar);
  const script = usePreferences((s) => s.calendarScript);

  return useMemo(() => {
    const opts = { script };
    return {
      system,
      script,
      isEthiopian: system === 'ethiopian',

      // Period boundaries & arithmetic
      startOfPeriod: (d: Date) => cal.startOfPeriod(d, system),
      endOfPeriod: (d: Date) => cal.endOfPeriod(d, system),
      addPeriods: (d: Date, n: number) => cal.addPeriods(d, n, system),
      isSamePeriod: (a: Date, b: Date) => cal.isSamePeriod(a, b, system),
      periodKey: (d: Date) => cal.periodKey(d, system),
      periodScope: (d: Date) => cal.periodScope(d, system),

      // Labels
      formatPeriod: (d: Date) => cal.formatPeriod(d, system, opts),
      formatPeriodShort: (d: Date) => cal.formatPeriodShort(d, system, opts),
      formatMonthName: (d: Date) => cal.formatMonthName(d, system, opts),
      formatDayMonth: (d: Date) => cal.formatDayMonth(d, system, opts),
      formatDayMonthYear: (d: Date) => cal.formatDayMonthYear(d, system, opts),
      formatWeekdayDayMonth: (d: Date) => cal.formatWeekdayDayMonth(d, system, opts),
      formatWeekday: (d: Date) => cal.formatWeekday(d, system, opts),
      formatRelativeDate: (d: Date) => cal.formatRelativeDate(d, system, opts),
      formatPeriodKey: (key: string) => cal.formatPeriodKey(key, opts),
    };
  }, [system, script]);
}

export type Calendar = ReturnType<typeof useCalendar>;
