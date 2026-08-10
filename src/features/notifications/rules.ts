import type { Banner } from './store';
import type { BudgetWithSpend } from '@/features/budgets/queries';
import type { Category } from '@/types/database';

/**
 * Pure rules engine. Given a snapshot of the user's current state, returns
 * a list of notifications that *should* fire — tagged with a stable dedup key
 * and the channel(s) they should go through (push, in-app, or both).
 *
 * Keeping this pure (no side effects, no async) means we can unit-test rule
 * boundaries trivially and replay them against historical data without
 * touching real notification APIs.
 *
 * Channel decision (matches the user-facing decisions in the implementation
 * plan):
 *   - 80% budget warning            → push + in-app (soft copy)
 *   - 100% budget reached           → push + in-app
 *   - 120% budget badly exceeded    → push + in-app (stronger copy)
 *   - 80% income consumed           → push + in-app (soft copy)
 *   - 95%+ income consumed          → push + in-app (high stakes)
 *
 * The two 80% warnings were in-app-only in an earlier revision, on the theory
 * that a soft heads-up shouldn't interrupt. In practice that made the most
 * *useful* alert — the one that arrives while you can still change course —
 * invisible to anyone not holding the phone at that moment. They now go
 * through both channels; users who don't want them can turn push off wholesale
 * in Settings.
 */

export type Channel = 'push' | 'inapp';

export type NotificationCandidate = {
  /** Stable dedup key. Encodes: rule + subject + period. */
  dedupKey: string;
  channels: Channel[];
  /** What we'd render in either channel. Same copy works for both. */
  banner: Omit<Banner, 'id'>;
  /** Title/body for the OS push, if `channels` includes 'push'. */
  push?: { title: string; body: string };
};

export type RuleInputs = {
  /**
   * Calendar-scoped identifier for the period under evaluation, e.g.
   * `g:2026-08` or `e:2018-12` (see `periodScope` in `src/lib/calendar.ts`).
   *
   * Every dedup key is suffixed with this, which is what makes an alert fire
   * once *per period* and re-arm when the period rolls over. It carries the
   * calendar tag so that switching between Gregorian and Ethiopian months
   * can't collide two different periods onto one key.
   */
  periodScope: string;
  /** This period's totals, both as positive numbers. */
  monthIncome: number;
  monthExpense: number;
  /** Per-category budget rows for the current period. */
  budgets: BudgetWithSpend[];
  /** Looked up by category id for friendlier copy. */
  categoryById: Map<string, Category>;
};

const BUDGET_WARN = 0.8;
const BUDGET_HIT = 1.0;
const BUDGET_OVER = 1.2;

const INCOME_WARN = 0.8;
const INCOME_DANGER = 0.95;

export function evaluateRules(input: RuleInputs): NotificationCandidate[] {
  const monthKey = input.periodScope;
  const out: NotificationCandidate[] = [];

  // ─── 1. Income vs expenses ────────────────────────────────────────────
  if (input.monthIncome > 0) {
    const ratio = input.monthExpense / input.monthIncome;

    if (ratio >= INCOME_DANGER && input.monthExpense < input.monthIncome) {
      out.push({
        dedupKey: `income:near_overdraw:${monthKey}`,
        channels: ['push', 'inapp'],
        banner: {
          tone: 'danger',
          title: 'Expenses are about to exceed income',
          body: `You've spent ${pct(ratio)} of this month's income. Consider pausing non-essential spending.`,
          icon: 'priority_high',
        },
        push: {
          title: 'Spending alert',
          body: `Expenses are at ${pct(ratio)} of income this month — you're close to going negative.`,
        },
      });
    } else if (input.monthExpense >= input.monthIncome) {
      out.push({
        dedupKey: `income:over:${monthKey}`,
        channels: ['push', 'inapp'],
        banner: {
          tone: 'danger',
          title: 'Expenses exceeded income this month',
          body: 'Your spending is now higher than your income for this period.',
          icon: 'trending_down',
        },
        push: {
          title: 'Over your income',
          body: 'This month\'s expenses just passed your income.',
        },
      });
    } else if (ratio >= INCOME_WARN) {
      out.push({
        dedupKey: `income:warn80:${monthKey}`,
        channels: ['push', 'inapp'],
        banner: {
          tone: 'warn',
          title: `${pct(ratio)} of your income is spent`,
          body: 'You\'re on the higher end this period. Worth a quick look at your top categories.',
          icon: 'savings',
          autoDismissMs: 7000,
        },
        push: {
          title: 'Spending heads-up',
          body: `You've spent ${pct(ratio)} of this period's income. Still time to ease off.`,
        },
      });
    }
  }

  // ─── 2. Per-category budgets ──────────────────────────────────────────
  for (const b of input.budgets) {
    if (!b.amount || b.amount <= 0) continue;
    const ratio = b.spent / b.amount;
    const cat = input.categoryById.get(b.category_id);
    const name = cat?.name ?? 'a category';

    if (ratio >= BUDGET_OVER) {
      out.push({
        dedupKey: `budget:over120:${b.category_id}:${monthKey}`,
        channels: ['push', 'inapp'],
        banner: {
          tone: 'danger',
          title: `${name}: well over budget`,
          body: `You're at ${pct(ratio)} of your ${name} budget for this month.`,
          icon: 'error',
        },
        push: {
          title: `${name} — over budget`,
          body: `You've spent ${pct(ratio)} of your ${name} limit this month.`,
        },
      });
    } else if (ratio >= BUDGET_HIT) {
      out.push({
        dedupKey: `budget:hit100:${b.category_id}:${monthKey}`,
        channels: ['push', 'inapp'],
        banner: {
          tone: 'danger',
          title: `${name}: budget reached`,
          body: `You've used 100% of your ${name} budget for this month.`,
          icon: 'block',
        },
        push: {
          title: `${name} — limit reached`,
          body: `Your ${name} budget for this month is fully used.`,
        },
      });
    } else if (ratio >= BUDGET_WARN) {
      out.push({
        dedupKey: `budget:warn80:${b.category_id}:${monthKey}`,
        channels: ['push', 'inapp'],
        banner: {
          tone: 'warn',
          title: `${name}: ${pct(ratio)} of budget used`,
          body: `Heads-up — you've spent past 80% of your ${name} limit.`,
          icon: 'warning',
          autoDismissMs: 7000,
        },
        push: {
          title: `${name} — 80% of budget used`,
          body: `You've spent ${pct(ratio)} of your ${name} limit for this period.`,
        },
      });
    }
  }

  return out;
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
