import { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { format } from 'date-fns';
import { Screen, TopBar, Avatar, Card, Text, Section, Icon } from '@/components/ui';
import { Donut, DonutSlice } from '@/components/charts/Donut';
import { AreaChart } from '@/components/charts/AreaChart';
import { palette, radius, spacing, type Color } from '@/theme';
import { useCategoryBreakdown, useSpendTrend } from '@/features/insights/queries';
import { useCategoryMap } from '@/features/categories/queries';
import { useProfile } from '@/features/profile/queries';
import { formatCurrency } from '@/lib/formatters';

const ROTATING_COLORS: Color[] = ['primary', 'secondary', 'tertiary', 'primaryDim', 'secondaryContainer' as Color];

export default function Insights() {
  const profile = useProfile();
  const currency = profile.data?.currency ?? 'USD';
  const breakdown = useCategoryBreakdown();
  const trend = useSpendTrend(6);
  const categories = useCategoryMap();
  const [anchorMonth] = useState(new Date());
  const chartWidth = Dimensions.get('window').width - spacing[6] * 2 - spacing[5] * 2;

  const slices: DonutSlice[] = useMemo(() => {
    return (breakdown.data ?? []).slice(0, 5).map((row, i) => ({
      value: row.total,
      color: (ROTATING_COLORS[i % ROTATING_COLORS.length] ?? 'primary') as Color,
      label: categories.byId.get(row.categoryId)?.name ?? 'Other',
    }));
  }, [breakdown.data, categories.byId]);

  const totalSpend = (breakdown.data ?? []).reduce((s, r) => s + r.total, 0);

  return (
    <View style={{ flex: 1 }}>
      <TopBar leading={<Avatar name={profile.data?.display_name ?? undefined} />} title="Financial Insights" subtitle={format(anchorMonth, 'MMMM yyyy')} />
      <Screen contentStyle={styles.content}>
        <Section title="Spending Breakdown">
          <Card tone="low" padding={spacing[6]}>
            {slices.length === 0 ? (
              <Text variant="bodyMd" color="onSurfaceVariant" center>
                No expenses recorded this month yet.
              </Text>
            ) : (
              <View style={styles.donutRow}>
                <Donut
                  slices={slices}
                  size={160}
                  strokeWidth={16}
                  centerTop={formatCurrency(totalSpend, currency).replace(/\.\d{2}$/, '')}
                  centerBottom="This month"
                />
                <View style={styles.legend}>
                  {slices.map((s, i) => (
                    <View key={i} style={styles.legendItem}>
                      <View style={[styles.dot, { backgroundColor: palette[s.color] }]} />
                      <Text variant="bodySm" color="onSurface" numberOfLines={1}>
                        {s.label}
                      </Text>
                      <Text variant="bodySm" color="onSurfaceVariant">
                        {Math.round((s.value / Math.max(1, totalSpend)) * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Card>
        </Section>

        <Section title="Spending Over Time">
          <Card tone="low" padding={spacing[5]}>
            <View style={styles.trendHeader}>
              <View>
                <Text variant="labelSm" color="onSurfaceVariant">
                  Last 6 months
                </Text>
                <Text variant="headlineSm" color="onSurface">
                  {formatCurrency(
                    (trend.data ?? []).reduce((s, r) => s + r.total, 0) / Math.max(1, (trend.data ?? []).length),
                    currency,
                  )}
                  <Text variant="bodySm" color="onSurfaceVariant">
                    {' '}
                    / month avg
                  </Text>
                </Text>
              </View>
              <Icon name="trending_up" size={18} color="secondary" />
            </View>

            <View style={{ marginTop: spacing[4] }}>
              <AreaChart
                values={(trend.data ?? []).map((r) => r.total)}
                width={chartWidth}
                height={160}
                color="primary"
              />
            </View>

            <View style={styles.monthLabels}>
              {(trend.data ?? []).map((r) => (
                <Text key={r.month} variant="labelSm" color="onSurfaceVariant">
                  {r.month.slice(5)}
                </Text>
              ))}
            </View>
          </Card>
        </Section>

        <Section title="Top Categories">
          <View style={{ gap: spacing[3] }}>
            {(breakdown.data ?? []).slice(0, 5).map((row, i) => {
              const cat = categories.byId.get(row.categoryId);
              const pct = totalSpend > 0 ? row.total / totalSpend : 0;
              return (
                <Card key={row.categoryId} tone="low" padding={spacing[4]}>
                  <View style={styles.topRow}>
                    <View style={styles.left}>
                      <View style={[styles.tile, { backgroundColor: palette.surfaceContainerHighest }]}>
                        <Icon name={cat?.icon ?? 'label'} size={20} color={(ROTATING_COLORS[i % ROTATING_COLORS.length] ?? 'primary') as Color} />
                      </View>
                      <View>
                        <Text variant="titleSm" color="onSurface">
                          {cat?.name ?? 'Other'}
                        </Text>
                        <Text variant="bodySm" color="onSurfaceVariant">
                          {Math.round(pct * 100)}% of spend
                        </Text>
                      </View>
                    </View>
                    <Text variant="titleSm" color="onSurface">
                      {formatCurrency(row.total, currency)}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        </Section>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[6] },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[5] },
  legend: { flex: 1, gap: spacing[2] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  monthLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[2] },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
