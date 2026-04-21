import { View, StyleSheet, Pressable } from 'react-native';
import { Screen, TopBar, Avatar, Card, Text, Icon, EmptyState, Section } from '@/components/ui';
import { ProgressBar } from '@/components/charts/ProgressBar';
import { palette, radius, spacing } from '@/theme';
import { useCurrentBudgets } from '@/features/budgets/queries';
import { useCategoryMap } from '@/features/categories/queries';
import { useProfile } from '@/features/profile/queries';
import { formatCurrency } from '@/lib/formatters';

export default function Budget() {
  const profile = useProfile();
  const currency = profile.data?.currency ?? 'USD';
  const budgets = useCurrentBudgets();
  const categories = useCategoryMap();

  const totalBudget = (budgets.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = (budgets.data ?? []).reduce((s, b) => s + b.spent, 0);
  const remaining = Math.max(0, totalBudget - totalSpent);

  return (
    <View style={{ flex: 1 }}>
      <TopBar leading={<Avatar name={profile.data?.display_name ?? undefined} />} title="Budget Planner" subtitle="This month" />
      <Screen contentStyle={styles.content} refreshing={budgets.isFetching} onRefresh={() => budgets.refetch()}>
        {/* Roll-up card */}
        <Card tone="high" padding={spacing[6]} vault>
          <Text variant="labelSm" color="onSurfaceVariant">
            Monthly Limit
          </Text>
          <Text variant="displaySm" color="onSurface">
            {formatCurrency(totalBudget, currency)}
          </Text>
          <View style={{ marginTop: spacing[4], gap: spacing[2] }}>
            <ProgressBar value={totalBudget > 0 ? totalSpent / totalBudget : 0} color="primary" overColor="tertiary" height={10} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySm" color="onSurfaceVariant">
                Spent {formatCurrency(totalSpent, currency)}
              </Text>
              <Text variant="bodySm" color="secondary">
                {formatCurrency(remaining, currency)} remaining
              </Text>
            </View>
          </View>
        </Card>

        <Section title="Category Budgets" trailing="+ New" onTrailingPress={() => {}}>
          {(budgets.data ?? []).length === 0 ? (
            <Card tone="low" padding={spacing[4]}>
              <EmptyState
                icon="pie_chart"
                title="No budgets yet"
                body="Set spending limits per category to stay in equilibrium."
              />
            </Card>
          ) : (
            <View style={{ gap: spacing[3] }}>
              {budgets.data!.map((b) => {
                const cat = categories.byId.get(b.category_id);
                const pct = Number(b.amount) > 0 ? b.spent / Number(b.amount) : 0;
                const over = pct > 1;
                return (
                  <Pressable key={b.id}>
                    <Card tone="low" padding={spacing[5]}>
                      <View style={styles.row}>
                        <View style={styles.left}>
                          <View style={styles.tile}>
                            <Icon name={cat?.icon ?? 'label'} size={20} color="primary" />
                          </View>
                          <View>
                            <Text variant="titleSm" color="onSurface">
                              {cat?.name ?? 'Category'}
                            </Text>
                            <Text variant="bodySm" color="onSurfaceVariant">
                              {formatCurrency(b.spent, currency)} of {formatCurrency(Number(b.amount), currency)}
                            </Text>
                          </View>
                        </View>
                        <Text variant="titleSm" color={over ? 'tertiary' : 'onSurface'}>
                          {Math.round(pct * 100)}%
                        </Text>
                      </View>
                      <View style={{ marginTop: spacing[3] }}>
                        <ProgressBar value={pct} color={over ? 'tertiary' : 'primary'} height={6} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[6] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
