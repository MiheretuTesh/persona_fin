import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { isToday, isYesterday, isThisYear, format } from 'date-fns';
import { Screen, TopBar, Avatar, Input, Chip, Text, EmptyState, Card } from '@/components/ui';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import { useTransactions } from '@/features/transactions/queries';
import { useCategoryMap } from '@/features/categories/queries';
import { useProfile } from '@/features/profile/queries';
import { useCurrency } from '@/features/preferences/store';
import { useCalendar, type Calendar } from '@/features/preferences/calendar';
import { formatCurrency } from '@/lib/formatters';
import type { Transaction } from '@/types/database';

type Filter = 'all' | 'income' | 'expense';

/**
 * History list — grouped by day with a header row that shows the friendly
 * date label and the day's net (income − expenses, signed). The flat-list
 * approach lets FlashList recycle both row types without the overhead of
 * SectionList's separate rendering paths.
 */
type Row =
  | { type: 'header'; key: string; label: string; net: number }
  | { type: 'item'; key: string; transaction: Transaction };

function groupByDay(transactions: Transaction[], calendar: Calendar): Row[] {
  // Group by yyyy-MM-dd in local time. Transactions are already
  // ordered desc by occurred_at from the query. The grouping key stays
  // Gregorian (it's just a stable bucket id); only the *label* is rendered
  // through the user's calendar.
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const day = format(new Date(t.occurred_at), 'yyyy-MM-dd');
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(t);
  }

  const rows: Row[] = [];
  for (const [day, items] of groups) {
    const date = new Date(day + 'T00:00:00');
    const label = isToday(date)
      ? 'Today'
      : isYesterday(date)
        ? 'Yesterday'
        : isThisYear(date)
          ? calendar.formatWeekdayDayMonth(date)
          : calendar.formatDayMonthYear(date);
    const net = items.reduce((s, t) => s + Number(t.amount), 0);
    rows.push({ type: 'header', key: `h:${day}`, label, net });
    for (const t of items) rows.push({ type: 'item', key: t.id, transaction: t });
  }
  return rows;
}

export default function History() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const profile = useProfile();
  const currency = useCurrency();
  const calendar = useCalendar();
  const txns = useTransactions();
  const categories = useCategoryMap();

  const filtered = useMemo(() => {
    const src = txns.data ?? [];
    return src.filter((t) => {
      if (filter !== 'all' && t.kind !== filter) return false;
      if (!query) return true;
      const needle = query.toLowerCase();
      const cat = categories.byId.get(t.category_id)?.name.toLowerCase() ?? '';
      return (
        (t.merchant ?? '').toLowerCase().includes(needle) ||
        (t.note ?? '').toLowerCase().includes(needle) ||
        cat.includes(needle)
      );
    });
  }, [txns.data, categories.byId, filter, query]);

  const rows = useMemo(() => groupByDay(filtered, calendar), [filtered, calendar]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar
        leading={<Avatar name={profile.data?.display_name ?? undefined} />}
        title="Transaction History"
        subtitle="Your ledger"
        trailingIcon="notifications"
        onTrailingPress={() => router.push('/notifications')}
        onLeadingPress={() => router.push('/(tabs)/settings')}
      />
      <Screen
        contentStyle={styles.content}
        refreshing={txns.isFetching}
        onRefresh={() => txns.refetch()}
      >
        <Input
          placeholder="Search merchants, categories, notes…"
          value={query}
          onChangeText={setQuery}
          leftIcon="search"
          autoCapitalize="none"
          returnKeyType="search"
        />

        <View style={styles.filters}>
          <Chip label="All" tone={filter === 'all' ? 'primary' : 'neutral'} onPress={() => setFilter('all')} />
          <Chip label="Income" tone={filter === 'income' ? 'secondary' : 'neutral'} onPress={() => setFilter('income')} />
          <Chip label="Expenses" tone={filter === 'expense' ? 'tertiary' : 'neutral'} onPress={() => setFilter('expense')} />
        </View>

        {rows.length === 0 ? (
          <Card tone="low" padding={spacing[4]}>
            <EmptyState
              icon="search"
              title={txns.data?.length ? 'Nothing matches that filter' : 'Your ledger is empty'}
              body={txns.data?.length ? 'Clear the search or switch filters.' : 'Tap Add below to log your first transaction.'}
            />
          </Card>
        ) : (
          <View style={{ height: 560 }}>
            <FlashList
              data={rows}
              keyExtractor={(row) => row.key}
              estimatedItemSize={64}
              getItemType={(row) => row.type}
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return (
                    <View style={styles.header}>
                      <Text variant="labelLg" color="onSurfaceVariant">{item.label}</Text>
                      <Text
                        variant="labelMd"
                        color={item.net > 0 ? 'secondary' : item.net < 0 ? 'tertiary' : 'onSurfaceVariant'}
                      >
                        {item.net === 0
                          ? '—'
                          : (item.net > 0 ? '+' : '') + formatCurrency(item.net, currency)}
                      </Text>
                    </View>
                  );
                }
                return (
                  <TransactionRow
                    transaction={item.transaction}
                    category={categories.byId.get(item.transaction.category_id)}
                    currency={currency}
                    onPress={() => router.push(`/transaction/${item.transaction.id}`)}
                  />
                );
              }}
            />
          </View>
        )}

        <Text variant="bodySm" color="onSurfaceVariant" center>
          Showing {filtered.length} of {txns.data?.length ?? 0}
        </Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[5] },
  filters: { flexDirection: 'row', gap: spacing[2] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
});
