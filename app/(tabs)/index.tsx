import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { startOfMonth, isSameMonth, subMonths } from 'date-fns';
import {
  Screen, TopBar, Avatar, Section, Card, Text, GradientHero, Icon, EmptyState, MonthPager, Button,
} from '@/components/ui';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { Sparkline } from '@/components/charts/Sparkline';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { useProfile } from '@/features/profile/queries';
import { useWallets } from '@/features/wallets/queries';
import {
  useRecentTransactions, useMonthTotals, useLifetimeTotals, useDailyTotals,
} from '@/features/transactions/queries';
import { useCategoryMap } from '@/features/categories/queries';
import { useCurrency } from '@/features/preferences/store';
import { formatCurrency } from '@/lib/formatters';

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useProfile();
  const wallets = useWallets();
  const recent = useRecentTransactions(5);
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const month = useMonthTotals(anchor);
  // Previous month — same hook with a shifted anchor. React Query keys this
  // separately so it caches independently and refetches on its own schedule.
  const prevMonth = useMonthTotals(subMonths(anchor, 1));
  const lifetime = useLifetimeTotals();
  const daily = useDailyTotals(7);
  const categories = useCategoryMap();

  const currency = useCurrency();
  const walletsStartingBalance = useMemo(
    () => (wallets.data ?? []).reduce((s, w) => s + Number(w.starting_balance), 0),
    [wallets.data],
  );

  // Net worth = starting balance across all wallets + every signed transaction ever.
  // Available balance reads the same number for a single-currency single-user view;
  // it will diverge once we add "reserved for goals" or multi-currency conversion.
  const netWorth = walletsStartingBalance + (lifetime.data?.lifetimeNet ?? 0);
  const available = netWorth;

  // Trend = net change in the *current* anchor month relative to lifetime net.
  // Small, meaningful number — capped to make the hero chip look sensible.
  const trend = useMemo(() => {
    const net = month.net;
    const base = Math.abs(lifetime.data?.lifetimeNet ?? 0) || Math.abs(walletsStartingBalance) || 1;
    const raw = (net / base) * 100;
    return Number.isFinite(raw) ? Math.max(-99, Math.min(99, raw)) : 0;
  }, [month.net, lifetime.data?.lifetimeNet, walletsStartingBalance]);

  const isCurrentMonth = isSameMonth(anchor, new Date());

  // Month-over-month deltas. We use a percentage when there's a non-zero
  // baseline; for "from zero" we fall back to a flat absolute label so we
  // don't show "+∞%" or "+1000%" which read as bugs.
  const incomeDelta = pctChange(month.income, prevMonth.income);
  const expenseDelta = pctChange(month.expense, prevMonth.expense);

  // First-run welcome state: zero net worth AND zero transactions (lifetime).
  // We don't show this just because *this month* is empty — that's normal.
  const isFirstRun =
    !lifetime.isFetching &&
    (lifetime.data?.lifetimeIncome ?? 0) === 0 &&
    (lifetime.data?.lifetimeExpense ?? 0) === 0 &&
    walletsStartingBalance === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar
        leading={<Avatar name={profile.data?.display_name ?? undefined} />}
        subtitle={salutation(new Date()) + ', ' + (profile.data?.display_name?.split(' ')[0] ?? 'there')}
        title="Your Financial Vault"
        trailingIcon="notifications"
        onTrailingPress={() => {}}
        onLeadingPress={() => router.push('/(tabs)/settings')}
      />
      <Screen
        refreshing={recent.isFetching || month.isFetching || lifetime.isFetching}
        onRefresh={() => {
          recent.refetch();
          month.refetch();
          lifetime.refetch();
          wallets.refetch();
        }}
        contentStyle={isFirstRun ? styles.welcomeWrap : styles.content}
      >
        {isFirstRun ? (
          <>
            <View style={[styles.welcomeOrb, { backgroundColor: colors.surfaceContainerHighest }]}>
              <Icon name="account_balance_wallet" size={42} color="primary" />
            </View>
            <View style={{ gap: spacing[3] }}>
              <Text variant="displaySm" color="onSurface" center>
                Welcome to your Vault
              </Text>
              <Text variant="bodyLg" color="onSurfaceVariant" center>
                Log your first transaction to start seeing your net worth, monthly summary, and insights here.
              </Text>
            </View>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon="add_circle"
              onPress={() => router.push('/transaction/new')}
              haptic="medium"
            >
              Add your first transaction
            </Button>
            <Card tone="low" padding={spacing[5]} style={{ gap: spacing[3] }}>
              <Text variant="labelMd" color="onSurfaceVariant">A quick tour</Text>
              <View style={styles.welcomeTip}>
                <View style={[styles.welcomeTipNum, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <Text variant="labelSm" color="primary">1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSm" color="onSurface">Tap the cyan + in the tab bar</Text>
                  <Text variant="bodySm" color="onSurfaceVariant">to log income, expenses, or transfers — pick a date and add a note.</Text>
                </View>
              </View>
              <View style={styles.welcomeTip}>
                <View style={[styles.welcomeTipNum, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <Text variant="labelSm" color="primary">2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSm" color="onSurface">Set monthly limits in Budget</Text>
                  <Text variant="bodySm" color="onSurfaceVariant">to stay on top of categories that tend to drift.</Text>
                </View>
              </View>
              <View style={styles.welcomeTip}>
                <View style={[styles.welcomeTipNum, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <Text variant="labelSm" color="primary">3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSm" color="onSurface">Insights does the math</Text>
                  <Text variant="bodySm" color="onSurfaceVariant">spending breakdown, 6-month trend, and your top categories.</Text>
                </View>
              </View>
            </Card>
          </>
        ) : (
        <>
        <GradientHero
          label={isCurrentMonth ? 'Total Net Worth' : 'Net Worth (as of today)'}
          amount={netWorth}
          currency={currency}
          subLabel="Available Balance"
          subAmount={available}
          trendPct={trend}
        />

        <Card tone="container" padding={spacing[4]} radiusToken="lg">
          <MonthPager value={anchor} onChange={setAnchor} />
        </Card>

        <Section title="Monthly Summary">
          <View style={styles.grid}>
            <Card tone="low" padding={spacing[5]} style={{ flex: 1, gap: spacing[4] }}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.tokenTile,
                    { backgroundColor: colors.mode === 'dark' ? 'rgba(78,222,163,0.12)' : 'rgba(0,108,73,0.1)' },
                  ]}
                >
                  <Icon name="south_west" size={18} color="secondary" />
                </View>
                <Sparkline
                  values={daily.data?.income ?? [0, 0, 0, 0, 0, 0, 0]}
                  color="secondary"
                />
              </View>
              <View>
                <View style={styles.amountWithPill}>
                  <Text variant="labelMd" color="onSurfaceVariant">Income</Text>
                  {incomeDelta && (
                    <View style={[styles.deltaPill, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <Icon name={incomeDelta.pct >= 0 ? 'trending_up' : 'trending_down'} size={11} color={incomeDelta.pct >= 0 ? 'secondary' : 'tertiary'} />
                      <Text variant="labelSm" color={incomeDelta.pct >= 0 ? 'secondary' : 'tertiary'}>
                        {incomeDelta.label}
                      </Text>
                    </View>
                  )}
                </View>
                <Text variant="headlineSm" color="secondary">
                  {formatCurrency(month.income, currency)}
                </Text>
              </View>
            </Card>
            <Card tone="low" padding={spacing[5]} style={{ flex: 1, gap: spacing[4] }}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.tokenTile,
                    { backgroundColor: colors.mode === 'dark' ? 'rgba(255,155,148,0.12)' : 'rgba(192,48,43,0.1)' },
                  ]}
                >
                  <Icon name="north_east" size={18} color="tertiary" />
                </View>
                <Sparkline
                  values={daily.data?.expense ?? [0, 0, 0, 0, 0, 0, 0]}
                  color="tertiary"
                />
              </View>
              <View>
                <View style={styles.amountWithPill}>
                  <Text variant="labelMd" color="onSurfaceVariant">Expenses</Text>
                  {expenseDelta && (
                    // Note: for expenses an INCREASE is a *negative* event,
                    // so we flip the chip color: rising = tertiary (warn),
                    // falling = secondary (good).
                    <View style={[styles.deltaPill, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <Icon name={expenseDelta.pct >= 0 ? 'trending_up' : 'trending_down'} size={11} color={expenseDelta.pct >= 0 ? 'tertiary' : 'secondary'} />
                      <Text variant="labelSm" color={expenseDelta.pct >= 0 ? 'tertiary' : 'secondary'}>
                        {expenseDelta.label}
                      </Text>
                    </View>
                  )}
                </View>
                <Text variant="headlineSm" color="tertiary">
                  {formatCurrency(month.expense, currency)}
                </Text>
              </View>
            </Card>
          </View>

          <Card tone="low" padding={spacing[4]}>
            <View style={styles.netRow}>
              <Text variant="labelMd" color="onSurfaceVariant">
                Net this month
              </Text>
              <Text variant="titleMd" color={month.net >= 0 ? 'secondary' : 'tertiary'}>
                {(month.net >= 0 ? '+' : '') + formatCurrency(month.net, currency)}
              </Text>
            </View>
          </Card>
        </Section>

        <Section title={isCurrentMonth ? 'Recent Transactions' : `Transactions in ${formatMonthLabel(anchor)}`} trailing="See All" onTrailingPress={() => router.push('/(tabs)/history')}>
          {(isCurrentMonth ? recent.data : month.data)?.length ? (
            <View style={{ gap: 2 }}>
              {(isCurrentMonth ? recent.data! : month.data!).slice(0, 5).map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  category={categories.byId.get(t.category_id)}
                  currency={currency}
                  onPress={() => router.push(`/transaction/${t.id}`)}
                />
              ))}
            </View>
          ) : (
            <Card tone="low" padding={spacing[4]}>
              <EmptyState
                icon="receipt_long"
                title="No transactions yet"
                body={isCurrentMonth ? 'Tap the Add button in the tab bar to record your first.' : 'Nothing to show for this month.'}
              />
            </Card>
          )}
        </Section>
        </>
        )}
      </Screen>
    </View>
  );
}

function salutation(d: Date) {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Month-over-month change as a small object { pct, label }.
 *   - When prev is 0 and now > 0: return null (nothing meaningful to compare).
 *   - When both are 0: return null.
 *   - Otherwise: return signed % capped at ±999 to avoid silly numbers.
 */
function pctChange(now: number, prev: number): { pct: number; label: string } | null {
  if (prev === 0 && now === 0) return null;
  if (prev === 0) return null;
  const raw = ((now - prev) / prev) * 100;
  const capped = Math.max(-999, Math.min(999, raw));
  const sign = capped > 0 ? '+' : '';
  return { pct: capped, label: `${sign}${capped.toFixed(0)}%` };
}

function formatMonthLabel(d: Date) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[6] },
  grid: { flexDirection: 'row', gap: spacing[4] },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tokenTile: {
    width: 40, height: 40,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountWithPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  deltaPill: {
    flexDirection: 'row', alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: 999,
  },
  welcomeWrap: { paddingHorizontal: spacing[6], paddingTop: spacing[10], gap: spacing[6] },
  welcomeOrb: {
    width: 88, height: 88,
    borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },
  welcomeTip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3],
    paddingVertical: spacing[2],
  },
  welcomeTipNum: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
});
