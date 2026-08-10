import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen, TopBar, Avatar, Card, Text, Section, Icon, MonthPager, EmptyState,
} from '@/components/ui';
import { Donut, DonutSlice } from '@/components/charts/Donut';
import { BarChart, BarDatum } from '@/components/charts/BarChart';
import { ProgressBar } from '@/components/charts/ProgressBar';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import type { Color } from '@/theme/tokens';
import { useCategoryBreakdown, useSpendTrend } from '@/features/insights/queries';
import { useExpenseTracking } from '@/features/insights/tracking';
import { useCategoryMap } from '@/features/categories/queries';
import { useProfile } from '@/features/profile/queries';
import { useCurrency } from '@/features/preferences/store';
import { useCalendar } from '@/features/preferences/calendar';
import { formatCurrency, currencySymbol } from '@/lib/formatters';

const ROTATING_COLORS: Color[] = ['primary', 'secondary', 'tertiary', 'primaryDim', 'primaryContainer'];

/** Compact currency for chart labels: $1,234 → "$1.2k", ETB 45 → "ETB 45". */
function compact(v: number, currency: string) {
  const sym = currencySymbol(currency);
  if (v >= 1000) {
    const scaled = (v / 1000).toFixed(v >= 10_000 ? 0 : 1);
    // For glyph-style symbols keep them hugging the number; for ISO codes ("ETB") add a space.
    return sym.length === 1 ? `${sym}${scaled}k` : `${sym} ${scaled}k`;
  }
  return formatCurrency(v, currency).replace(/\.\d{2}$/, '');
}

export default function Insights() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useProfile();
  const currency = useCurrency();
  const calendar = useCalendar();
  const [anchor, setAnchor] = useState(() => calendar.startOfPeriod(new Date()));
  const breakdown = useCategoryBreakdown(anchor);
  const trend = useSpendTrend(6);
  const tracking = useExpenseTracking(anchor);
  const categoryMap = useCategoryMap();

  const slices: DonutSlice[] = useMemo(() => {
    return (breakdown.data ?? []).slice(0, 5).map((row, i) => ({
      value: row.total,
      color: (ROTATING_COLORS[i % ROTATING_COLORS.length] ?? 'primary') as Color,
      label: categoryMap.byId.get(row.categoryId)?.name ?? 'Other',
    }));
  }, [breakdown.data, categoryMap.byId]);

  const totalSpend = (breakdown.data ?? []).reduce((s, r) => s + r.total, 0);

  const trendBars: BarDatum[] = useMemo(() => {
    const today = new Date();
    return (trend.data ?? []).map((r) => {
      // `anchor` is an instant inside the period, so the label renders in
      // whichever calendar the user picked without re-deriving boundaries.
      const periodDate = new Date(r.anchor);
      return {
        label: calendar.formatPeriodShort(periodDate),
        value: r.total,
        highlight: calendar.isSamePeriod(periodDate, today),
      };
    });
  }, [trend.data, calendar]);

  const trendHasAnyData = trendBars.some((b) => b.value > 0);
  const trendAvg =
    trendBars.length > 0 ? trendBars.reduce((s, b) => s + b.value, 0) / trendBars.length : 0;
  const trendMax = Math.max(0, ...trendBars.map((b) => b.value));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar
        leading={<Avatar name={profile.data?.display_name ?? undefined} />}
        title="Financial Insights"
        subtitle="Where your money goes"
        trailingIcon="notifications"
        onTrailingPress={() => router.push('/notifications')}
        onLeadingPress={() => router.push('/(tabs)/settings')}
      />
      <Screen
        contentStyle={styles.content}
        refreshing={breakdown.isFetching || trend.isFetching || tracking.isFetching}
        onRefresh={() => {
          breakdown.refetch();
          trend.refetch();
          tracking.refetch();
        }}
      >
        <Card tone="container" padding={spacing[4]} radiusToken="lg">
          <MonthPager value={anchor} onChange={setAnchor} />
        </Card>

        <Section title="Spending Breakdown">
          <Card tone="low" padding={spacing[6]}>
            {slices.length === 0 ? (
              <EmptyState
                icon="pie_chart"
                title={`Nothing tracked for ${calendar.formatMonthName(anchor)}`}
                body="Expenses you log will appear here as a breakdown."
              />
            ) : (
              <View style={styles.donutRow}>
                <Donut
                  slices={slices}
                  size={160}
                  strokeWidth={16}
                  centerTop={formatCurrency(totalSpend, currency).replace(/\.\d{2}$/, '')}
                  centerBottom={calendar.formatPeriod(anchor)}
                />
                <View style={styles.legend}>
                  {slices.map((s, i) => (
                    <View key={i} style={styles.legendItem}>
                      <View style={[styles.dot, { backgroundColor: colors[s.color] as string }]} />
                      <Text variant="bodySm" color="onSurface" numberOfLines={1} style={{ flex: 1 }}>
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
            {!trendHasAnyData ? (
              <EmptyState
                icon="trending_up"
                title="Not enough history yet"
                body="A 6-month comparison will appear here as soon as you've logged expenses."
              />
            ) : (
              <>
                <View style={styles.trendHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="labelSm" color="onSurfaceVariant">
                      Last 6 periods · average
                    </Text>
                    <Text variant="headlineSm" color="onSurface">
                      {formatCurrency(trendAvg, currency)}
                    </Text>
                  </View>
                  <View style={styles.trendPeak}>
                    <Text variant="labelSm" color="onSurfaceVariant">
                      Peak
                    </Text>
                    <Text variant="titleMd" color="primary">
                      {formatCurrency(trendMax, currency)}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: spacing[5] }}>
                  <BarChart
                    data={trendBars}
                    height={200}
                    formatValue={(v) => compact(v, currency)}
                  />
                </View>
              </>
            )}
          </Card>
        </Section>

        {/*
          Per-expense-type tracking. Unlike the breakdown above (a single
          snapshot), each row compares this period against the last and shows
          budget consumption, so the list answers "what's drifting?" not just
          "what's big?". Tapping a row opens the full tracker for that type.
        */}
        <Section title="Tracking by Expense Type">
          {(tracking.data?.rows ?? []).length === 0 ? (
            <Card tone="low" padding={spacing[4]}>
              <Text variant="bodyMd" color="onSurfaceVariant" center>
                Once you start logging expenses, each type will be tracked here — spend
                versus last period, and how much of its budget is left.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing[3] }}>
              {(tracking.data?.rows ?? []).map((row, i) => {
                const cat = categoryMap.byId.get(row.categoryId);
                const sliceColor = (ROTATING_COLORS[i % ROTATING_COLORS.length] ?? 'primary') as Color;
                const overBudget = row.budgetRatio !== null && row.budgetRatio > 1;
                return (
                  <Pressable
                    key={row.categoryId}
                    onPress={() => router.push(`/category/${row.categoryId}`)}
                  >
                    <Card tone="low" padding={spacing[4]}>
                      <View style={styles.topRow}>
                        <View style={styles.left}>
                          <View style={[styles.tile, { backgroundColor: colors.surfaceContainerHighest }]}>
                            <Icon name={cat?.icon ?? 'label'} size={20} color={sliceColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text variant="titleSm" color="onSurface" numberOfLines={1}>
                              {cat?.name ?? 'Other'}
                            </Text>
                            <Text variant="bodySm" color="onSurfaceVariant" numberOfLines={1}>
                              {row.count === 0
                                ? 'Nothing logged this period'
                                : `${row.count} ${row.count === 1 ? 'entry' : 'entries'} · ${Math.round(row.share * 100)}% of spend`}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text variant="titleSm" color="onSurface">
                            {formatCurrency(row.total, currency)}
                          </Text>
                          <DeltaChip delta={row.delta} previous={row.previousTotal} />
                        </View>
                      </View>

                      {row.budgetRatio !== null && (
                        <View style={{ marginTop: spacing[3], gap: spacing[1] }}>
                          <ProgressBar
                            value={row.budgetRatio}
                            color={overBudget ? 'tertiary' : 'primary'}
                            height={6}
                          />
                          <Text
                            variant="labelSm"
                            color={overBudget ? 'tertiary' : 'onSurfaceVariant'}
                          >
                            {Math.round(row.budgetRatio * 100)}% of{' '}
                            {formatCurrency(row.budget ?? 0, currency)} budget
                          </Text>
                        </View>
                      )}
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

/**
 * Period-over-period change label. Spending *less* is good, so a negative
 * delta reads as the positive (secondary) colour — the inverse of a stock
 * ticker, and the opposite of what a naive sign check would produce.
 *
 * A `null` delta means the previous period was zero. A percentage from a zero
 * baseline is infinite, so we say "new" instead of rendering "+∞%".
 */
function DeltaChip({ delta, previous }: { delta: number | null; previous: number }) {
  if (delta === null) {
    return (
      <Text variant="labelSm" color="onSurfaceVariant">
        {previous === 0 ? 'New this period' : '—'}
      </Text>
    );
  }
  if (Math.abs(delta) < 0.005) {
    return (
      <Text variant="labelSm" color="onSurfaceVariant">
        Flat vs last
      </Text>
    );
  }
  const up = delta > 0;
  return (
    <Text variant="labelSm" color={up ? 'tertiary' : 'secondary'}>
      {up ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}% vs last
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[6] },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[5] },
  legend: { flex: 1, gap: spacing[2] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[4] },
  trendPeak: { alignItems: 'flex-end' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
