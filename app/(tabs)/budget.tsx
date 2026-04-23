import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Alert, TextInput } from 'react-native';
import {
  Screen, TopBar, Avatar, Card, Text, Icon, EmptyState, Section, Button,
} from '@/components/ui';
import { ProgressBar } from '@/components/charts/ProgressBar';
import { useTheme } from '@/theme';
import { radius, spacing, type } from '@/theme/tokens';
import { useCurrentBudgets } from '@/features/budgets/queries';
import { useCreateBudget, useDeleteBudget } from '@/features/budgets/mutations';
import { useCategoriesByKind, useCategoryMap } from '@/features/categories/queries';
import { useProfile } from '@/features/profile/queries';
import { useCurrency } from '@/features/preferences/store';
import { formatCurrency, currencySymbol } from '@/lib/formatters';

export default function Budget() {
  const { colors } = useTheme();
  const profile = useProfile();
  const currency = useCurrency();
  const budgets = useCurrentBudgets();
  const expenseCategories = useCategoriesByKind('expense');
  const categoryMap = useCategoryMap();
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();

  const [adding, setAdding] = useState(false);
  const [pickedCategoryId, setPickedCategoryId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');

  const totalBudget = (budgets.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = (budgets.data ?? []).reduce((s, b) => s + b.spent, 0);
  const remaining = totalBudget - totalSpent;

  // Only show categories that don't already have a budget for the current month.
  const availableCategories = useMemo(() => {
    const budgetedIds = new Set((budgets.data ?? []).map((b) => b.category_id));
    return (expenseCategories.data ?? []).filter((c) => !budgetedIds.has(c.id));
  }, [expenseCategories.data, budgets.data]);

  const resetForm = () => {
    setAdding(false);
    setPickedCategoryId(null);
    setAmountText('');
  };

  const save = async () => {
    if (!pickedCategoryId) return Alert.alert('Pick a category', 'Choose which category this budget is for.');
    const n = Number(amountText);
    if (!Number.isFinite(n) || n <= 0) return Alert.alert('Enter an amount', 'Monthly limit must be greater than 0.');
    try {
      await createBudget.mutateAsync({ categoryId: pickedCategoryId, amount: n });
      resetForm();
    } catch (e: any) {
      // Make the real Postgres error visible — `details` and `hint` are what
      // actually explain upsert conflicts, missing constraints, and RLS denials.
      const msg = [e?.message, e?.details, e?.hint].filter(Boolean).join(' · ');
      Alert.alert('Could not save budget', msg || 'Something went wrong. Please try again.');
    }
  };

  const confirmDelete = (id: string, name: string) =>
    Alert.alert('Remove budget', `Remove the monthly limit for "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteBudget.mutate(id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar
        leading={<Avatar name={profile.data?.display_name ?? undefined} />}
        title="Budget Planner"
        subtitle="This month"
      />
      <Screen contentStyle={styles.content} refreshing={budgets.isFetching} onRefresh={() => budgets.refetch()}>
        {/* Roll-up */}
        <Card tone="high" padding={spacing[6]} vault>
          <Text variant="labelSm" color="onSurfaceVariant">
            Monthly Limit
          </Text>
          <Text variant="displaySm" color="onSurface">
            {formatCurrency(totalBudget, currency)}
          </Text>
          <View style={{ marginTop: spacing[4], gap: spacing[2] }}>
            <ProgressBar
              value={totalBudget > 0 ? totalSpent / totalBudget : 0}
              color="primary"
              overColor="tertiary"
              height={10}
            />
            <View style={styles.rowBetween}>
              <Text variant="bodySm" color="onSurfaceVariant">
                Spent {formatCurrency(totalSpent, currency)}
              </Text>
              <Text variant="bodySm" color={remaining < 0 ? 'tertiary' : 'secondary'}>
                {remaining >= 0
                  ? `${formatCurrency(remaining, currency)} remaining`
                  : `${formatCurrency(Math.abs(remaining), currency)} over`}
              </Text>
            </View>
          </View>
        </Card>

        {/* Add budget flow */}
        <Section
          title="Category Budgets"
          trailing={adding ? 'Cancel' : undefined}
          onTrailingPress={adding ? () => resetForm() : undefined}
        >
          {/* Prominent CTA button — the old tiny "+ New" link was easy to miss */}
          {!adding && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon="add"
              onPress={() => setAdding(true)}
              haptic="light"
            >
              {(budgets.data ?? []).length === 0 ? 'Create your first budget' : 'Add another budget'}
            </Button>
          )}

          {adding && (
            <Card tone="low" padding={spacing[5]} style={{ gap: spacing[4] }}>
              <View>
                <Text variant="labelMd" color="onSurfaceVariant" style={{ marginBottom: spacing[2] }}>
                  Category
                </Text>
                {availableCategories.length === 0 ? (
                  <Text variant="bodyMd" color="onSurfaceVariant">
                    Every expense category already has a budget for this month.
                  </Text>
                ) : (
                  <View style={styles.catGrid}>
                    {availableCategories.map((c) => {
                      const selected = pickedCategoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setPickedCategoryId(c.id)}
                          style={[
                            styles.catTile,
                            { backgroundColor: selected ? colors.surfaceContainerHighest : colors.surfaceContainer },
                          ]}
                        >
                          <View style={[styles.catIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
                            <Icon name={c.icon} size={18} color={selected ? 'primary' : 'onSurfaceVariant'} />
                          </View>
                          <Text
                            variant="labelMd"
                            color={selected ? 'primary' : 'onSurfaceVariant'}
                            center
                            numberOfLines={1}
                          >
                            {c.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View>
                <Text variant="labelMd" color="onSurfaceVariant" style={{ marginBottom: spacing[2] }}>
                  Monthly limit
                </Text>
                <View style={[styles.amountField, { backgroundColor: colors.surfaceContainer }]}>
                  <Text variant="titleLg" color="onSurfaceVariant">{currencySymbol(currency)}</Text>
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor={colors.onSurfaceVariant}
                    keyboardType="decimal-pad"
                    value={amountText}
                    onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                    selectionColor={colors.primary}
                    cursorColor={colors.primary}
                    style={[styles.amountInput, { color: colors.onSurface }]}
                    returnKeyType="done"
                    onSubmitEditing={save}
                  />
                </View>
              </View>

              <Button
                variant="primary"
                size="md"
                fullWidth
                loading={createBudget.isPending}
                onPress={save}
                haptic="success"
                disabled={!pickedCategoryId || amountText === ''}
              >
                Save budget
              </Button>
            </Card>
          )}

          {(budgets.data ?? []).length === 0 && !adding ? (
            <Card tone="low" padding={spacing[4]}>
              <EmptyState
                icon="pie_chart"
                title="No budgets yet"
                body="Set monthly spending limits per category to stay in equilibrium."
              />
            </Card>
          ) : (
            <View style={{ gap: spacing[3] }}>
              {budgets.data!.map((b) => {
                const cat = categoryMap.byId.get(b.category_id);
                const limit = Number(b.amount);
                const pct = limit > 0 ? b.spent / limit : 0;
                const over = pct > 1;
                return (
                  <Pressable
                    key={b.id}
                    onLongPress={() => confirmDelete(b.id, cat?.name ?? 'this category')}
                    delayLongPress={400}
                  >
                    <Card tone="low" padding={spacing[5]}>
                      <View style={styles.rowBetween}>
                        <View style={styles.left}>
                          <View style={[styles.tile, { backgroundColor: colors.surfaceContainerHighest }]}>
                            <Icon name={cat?.icon ?? 'label'} size={20} color="primary" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text variant="titleSm" color="onSurface" numberOfLines={1}>
                              {cat?.name ?? 'Category'}
                            </Text>
                            <Text variant="bodySm" color="onSurfaceVariant" numberOfLines={1}>
                              {formatCurrency(b.spent, currency)} of {formatCurrency(limit, currency)}
                              {over ? ` · ${formatCurrency(b.spent - limit, currency)} over` : ''}
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
              <Text variant="bodySm" color="onSurfaceVariant" center>
                Long-press a budget to remove it.
              </Text>
            </View>
          )}
        </Section>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[6] },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  tile: {
    width: 44, height: 44,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  catTile: {
    width: '31.5%',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
    gap: spacing[2],
  },
  catIcon: {
    width: 36, height: 36,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    gap: spacing[2],
  },
  amountInput: {
    flex: 1,
    ...type.bodyLg,
    padding: 0,
    includeFontPadding: false,
  },
});
