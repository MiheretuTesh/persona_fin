import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { startOfMonth, isSameMonth } from 'date-fns';
import {
  Screen, TopBar, Avatar, Section, Card, Text, GradientHero, Icon, EmptyState, MonthPager,
} from '@/components/ui';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { Sparkline } from '@/components/charts/Sparkline';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { useProfile } from '@/features/profile/queries';
import { useWallets } from '@/features/wallets/queries';
import {
  useRecentTransactions, useMonthTotals, useLifetimeTotals,
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
  const lifetime = useLifetimeTotals();
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
        contentStyle={styles.content}
      >
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
                <Sparkline values={[2, 3, 4]} color="secondary" />
              </View>
              <View>
                <Text variant="labelMd" color="onSurfaceVariant">
                  Income
                </Text>
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
                <Sparkline values={[4, 3, 2]} color="tertiary" highlightIndex={0} />
              </View>
              <View>
                <Text variant="labelMd" color="onSurfaceVariant">
                  Expenses
                </Text>
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
});
