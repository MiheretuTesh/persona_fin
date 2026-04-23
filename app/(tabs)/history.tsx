import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Screen, TopBar, Avatar, Input, Chip, Text, EmptyState, Card } from '@/components/ui';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import { useTransactions } from '@/features/transactions/queries';
import { useCategoryMap } from '@/features/categories/queries';
import { useProfile } from '@/features/profile/queries';
import { useCurrency } from '@/features/preferences/store';

type Filter = 'all' | 'income' | 'expense';

export default function History() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const profile = useProfile();
  const currency = useCurrency();
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar leading={<Avatar name={profile.data?.display_name ?? undefined} />} title="Transaction History" subtitle="Your ledger" />
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

        {filtered.length === 0 ? (
          <Card tone="low" padding={spacing[4]}>
            <EmptyState
              icon="search"
              title={txns.data?.length ? 'Nothing matches that filter' : 'Your ledger is empty'}
              body={txns.data?.length ? 'Clear the search or switch filters.' : 'Tap Add below to log your first transaction.'}
            />
          </Card>
        ) : (
          <View style={{ height: 520 }}>
            <FlashList
              data={filtered}
              keyExtractor={(item) => item.id}
              estimatedItemSize={72}
              renderItem={({ item }) => (
                <TransactionRow
                  transaction={item}
                  category={categories.byId.get(item.category_id)}
                  currency={currency}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
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
});
