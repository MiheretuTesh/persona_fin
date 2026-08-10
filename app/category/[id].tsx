import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Screen, TopBar, Card, Text, Icon, Section, EmptyState, MonthPager,
} from '@/components/ui';
import { BarChart, BarDatum } from '@/components/charts/BarChart';
import { ProgressBar } from '@/components/charts/ProgressBar';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { useCategoryTracking } from '@/features/insights/tracking';
import { useCategoryMap } from '@/features/categories/queries';
import { useCurrency } from '@/features/preferences/store';
import { useCalendar } from '@/features/preferences/calendar';
import { formatCurrency, currencySymbol } from '@/lib/formatters';

/**
 * Tracker for a single expense type.
 *
 * The insights screen tells you *what* you spent on; this tells you whether
 * that's normal. Four questions, in order of how often they're asked:
 *
 *   1. How much this period, and is that up or down on last? → hero
 *   2. How does it compare to my usual? → "typical" baseline + trend chart
 *   3. Am I within budget? → progress bar, only when a budget exists
 *   4. What drove it? → merchant roll-up, then the raw transactions
 *
 * The MonthPager at the top re-anchors all of it, so the same screen doubles
 * as history for the category. Periods follow the user's calendar preference.
 */
export default function CategoryTracker() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const currency = useCurrency();
  const calendar = useCalendar();
  const categories = useCategoryMap();

  const [anchor, setAnchor] = useState(() => calendar.startOfPeriod(new Date()));
  const tracking = useCategoryTracking(id, anchor, 6);

  const category = id ? categories.byId.get(id) : undefined;
  const data = tracking.data;

  const trendBars: BarDatum[] = (data?.trend ?? []).map((r) => {
    const periodDate = new Date(r.anchor);
    return {
      label: calendar.formatPeriodShort(periodDate),
      value: r.total,
      highlight: calendar.isSamePeriod(periodDate, anchor),
    };
  });

  const overBudget = data?.budgetRatio != null && data.budgetRatio > 1;
  // "vs typical" compares this period against the mean of the trend window,
  // which is a steadier reference than last period alone — one unusual month
  // shouldn't redefine what normal looks like.
  const vsTypical =
    data && data.typical > 0 ? (data.total - data.typical) / data.typical : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar
        leading={
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backTile}>
            <Icon name="arrow_back" size={20} color="onSurface" />
          </Pressable>
        }
        title={category?.name ?? 'Expense type'}
        subtitle="Tracking"
      />
      <Screen
        contentStyle={styles.content}
        refreshing={tracking.isFetching}
        onRefresh={() => tracking.refetch()}
      >
        <Card tone="container" padding={spacing[4]} radiusToken="lg">
          <MonthPager value={anchor} onChange={setAnchor} />
        </Card>

        {/* Hero — spend this period, with both comparison baselines. */}
        <Card tone="high" padding={spacing[6]} vault>
          <View style={styles.heroHead}>
            <View style={[styles.heroTile, { backgroundColor: colors.surfaceContainerHighest }]}>
              <Icon name={category?.icon ?? 'label'} size={22} color="primary" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="labelSm" color="onSurfaceVariant">
                {calendar.formatPeriod(anchor)}
              </Text>
              <Text variant="displaySm" color="onSurface">
                {formatCurrency(data?.total ?? 0, currency)}
              </Text>
            </View>
          </View>

          <View style={styles.compareRow}>
            <Comparison
              label="vs last period"
              delta={data?.delta ?? null}
              fallback={
                (data?.previousTotal ?? 0) === 0 ? 'No spend last period' : undefined
              }
            />
            <Comparison
              label="vs typical"
              delta={vsTypical}
              fallback={data && data.typical === 0 ? 'No history yet' : undefined}
            />
          </View>

          {data?.budgetRatio != null && (
            <View style={{ marginTop: spacing[5], gap: spacing[2] }}>
              <ProgressBar
                value={data.budgetRatio}
                color="primary"
                overColor="tertiary"
                height={10}
              />
              <View style={styles.rowBetween}>
                <Text variant="bodySm" color="onSurfaceVariant">
                  {Math.round(data.budgetRatio * 100)}% of {formatCurrency(data.budget ?? 0, currency)}
                </Text>
                <Text variant="bodySm" color={overBudget ? 'tertiary' : 'secondary'}>
                  {overBudget
                    ? `${formatCurrency(data.total - (data.budget ?? 0), currency)} over`
                    : `${formatCurrency((data.budget ?? 0) - data.total, currency)} left`}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* At-a-glance stats. */}
        <View style={styles.statGrid}>
          <Stat label="Entries" value={String(data?.count ?? 0)} />
          <Stat label="Average" value={compact(data?.average ?? 0, currency)} />
          <Stat label="Largest" value={compact(data?.largest ?? 0, currency)} />
        </View>

        <Section title="Spending Over Time">
          <Card tone="low" padding={spacing[5]}>
            {trendBars.every((b) => b.value === 0) ? (
              <EmptyState
                icon="trending_up"
                title="No history for this type yet"
                body="Once you've logged a few periods, the trend will appear here."
              />
            ) : (
              <BarChart data={trendBars} height={190} formatValue={(v) => compact(v, currency)} />
            )}
          </Card>
        </Section>

        <Section title="Where It Went">
          {(data?.merchants ?? []).length === 0 ? (
            <Card tone="low" padding={spacing[4]}>
              <Text variant="bodyMd" color="onSurfaceVariant" center>
                No {category?.name ?? 'expenses'} logged in {calendar.formatPeriod(anchor)}.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing[2] }}>
              {(data?.merchants ?? []).slice(0, 6).map((m) => {
                const share = (data?.total ?? 0) > 0 ? m.total / (data?.total ?? 1) : 0;
                return (
                  <Card key={m.name} tone="low" padding={spacing[4]}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text variant="titleSm" color="onSurface" numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Text variant="bodySm" color="onSurfaceVariant">
                          {m.count} {m.count === 1 ? 'entry' : 'entries'} · {Math.round(share * 100)}%
                        </Text>
                      </View>
                      <Text variant="titleSm" color="onSurface">
                        {formatCurrency(m.total, currency)}
                      </Text>
                    </View>
                    <View style={{ marginTop: spacing[3] }}>
                      <ProgressBar value={share} color="primary" height={4} />
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </Section>

        <Section title="Transactions">
          {(data?.transactions ?? []).length === 0 ? (
            <Card tone="low" padding={spacing[4]}>
              <EmptyState
                icon="receipt_long"
                title="Nothing logged this period"
                body="Transactions in this category will list here."
              />
            </Card>
          ) : (
            <Card tone="low" padding={spacing[2]}>
              {(data?.transactions ?? []).map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  category={category}
                  currency={currency}
                  onPress={() => router.push(`/transaction/${t.id}`)}
                />
              ))}
            </Card>
          )}
        </Section>
      </Screen>
    </View>
  );
}

/**
 * A single comparison figure. Less spend is good here, so a fall renders in
 * the positive (secondary) colour — the reverse of a stock ticker.
 */
function Comparison({
  label,
  delta,
  fallback,
}: {
  label: string;
  delta: number | null;
  fallback?: string;
}) {
  const flat = delta !== null && Math.abs(delta) < 0.005;
  const up = (delta ?? 0) > 0;
  return (
    <View style={{ flex: 1 }}>
      <Text variant="labelSm" color="onSurfaceVariant">
        {label}
      </Text>
      {delta === null || fallback ? (
        <Text variant="titleSm" color="onSurfaceVariant" numberOfLines={1}>
          {fallback ?? '—'}
        </Text>
      ) : flat ? (
        <Text variant="titleSm" color="onSurfaceVariant">
          Flat
        </Text>
      ) : (
        <Text variant="titleSm" color={up ? 'tertiary' : 'secondary'}>
          {up ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}%
        </Text>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceContainerLow }]}>
      <Text variant="labelSm" color="onSurfaceVariant">
        {label}
      </Text>
      <Text variant="titleMd" color="onSurface" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Compact currency for tight tiles and chart labels: 1,234 → "$1.2k". */
function compact(v: number, currency: string): string {
  const sym = currencySymbol(currency);
  if (v >= 1000) {
    const scaled = (v / 1000).toFixed(v >= 10_000 ? 0 : 1);
    return sym.length === 1 ? `${sym}${scaled}k` : `${sym} ${scaled}k`;
  }
  return formatCurrency(v, currency).replace(/\.\d{2}$/, '');
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[6] },
  backTile: {
    width: 36, height: 36,
    borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  heroTile: {
    width: 48, height: 48,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  compareRow: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[5] },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statGrid: { flexDirection: 'row', gap: spacing[3] },
  stat: {
    flex: 1,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    gap: 2,
  },
});
