import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, TopBar, Avatar, Section, Card, Text, GradientHero, Icon, EmptyState, Chip } from '@/components/ui';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { Sparkline } from '@/components/charts/Sparkline';
import { palette, radius, spacing } from '@/theme';
import { useProfile } from '@/features/profile/queries';
import { useWallets } from '@/features/wallets/queries';
import { useRecentTransactions, useMonthTotals } from '@/features/transactions/queries';
import { useCategoryMap } from '@/features/categories/queries';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';

export default function Dashboard() {
  const router = useRouter();
  const profile = useProfile();
  const wallets = useWallets();
  const recent = useRecentTransactions(5);
  const now = new Date();
  const month = useMonthTotals(now);
  const categories = useCategoryMap();

  const currency = profile.data?.currency ?? 'USD';
  const netWorth = useMemo(
    () =>
      (wallets.data ?? []).reduce((s, w) => s + Number(w.starting_balance), 0) + (month.net ?? 0),
    [wallets.data, month.net],
  );
  const available = useMemo(
    () => (wallets.data ?? []).reduce((s, w) => s + Number(w.starting_balance), 0) + (month.net ?? 0),
    [wallets.data, month.net],
  );
  const trend = month.income > 0 ? ((month.income - month.expense) / Math.max(month.income, 1)) * 10 : 0;

  return (
    <View style={{ flex: 1 }}>
      <TopBar
        leading={<Avatar name={profile.data?.display_name ?? undefined} />}
        subtitle={salutation(now) + ', ' + (profile.data?.display_name?.split(' ')[0] ?? 'there')}
        title="Your Financial Vault"
        trailingIcon="notifications"
        onTrailingPress={() => {}}
      />
      <Screen
        refreshing={recent.isFetching}
        onRefresh={() => {
          recent.refetch();
          month.refetch();
          wallets.refetch();
        }}
        contentStyle={styles.content}
      >
        <GradientHero
          label="Total Net Worth"
          amount={netWorth}
          currency={currency}
          subLabel="Available Balance"
          subAmount={available}
          trendPct={trend}
        />

        <Section title="Monthly Summary">
          <View style={styles.monthRow}>
            <Chip label={format(now, 'MMMM')} tone="neutral" />
          </View>
          <View style={styles.grid}>
            <Card tone="low" padding={spacing[5]} style={{ flex: 1, gap: spacing[4] }}>
              <View style={styles.cardHeader}>
                <View style={[styles.tokenTile, { backgroundColor: 'rgba(78,222,163,0.12)' }]}>
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
                <View style={[styles.tokenTile, { backgroundColor: 'rgba(255,155,148,0.12)' }]}>
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
        </Section>

        <Section title="Recent Transactions" trailing="See All" onTrailingPress={() => router.push('/(tabs)/history')}>
          {recent.data && recent.data.length > 0 ? (
            <View style={{ gap: 2 }}>
              {recent.data.slice(0, 5).map((t) => (
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
                body="Tap the Add button in the tab bar to record your first."
              />
            </Card>
          )}
        </Section>
      </Screen>
    </View>
  );
}

function salutation(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[8] },
  monthRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -spacing[2] },
  grid: { flexDirection: 'row', gap: spacing[4] },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tokenTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
