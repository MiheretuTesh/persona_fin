import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, radius, spacing, shadow } from '@/theme';
import { Text } from './Text';
import { splitCurrency, formatCurrency, formatPercent } from '@/lib/formatters';
import { Icon } from './Icon';

type Props = {
  label: string;
  amount: number;
  currency?: string;
  subLabel?: string;
  subAmount?: number;
  trendPct?: number;
  style?: ViewStyle;
};

/**
 * The Balance Hero — direct translation of the Stitch dashboard's
 * balance-hero class: 135° deep-teal gradient, oversized display number
 * with a small leading currency symbol, soft inner glow, trend chip.
 */
export function GradientHero({ label, amount, currency = 'USD', subLabel, subAmount, trendPct, style }: Props) {
  const { symbol, whole, cents } = splitCurrency(amount, currency);

  return (
    <View style={[styles.wrap, shadow.lifted, style]}>
      <LinearGradient
        colors={[...palette.heroGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* soft inner glow orb — matches the -right-10 -top-10 blur-3xl motif */}
        <View style={styles.glow} />

        <View style={styles.innerTop}>
          <Text variant="labelSm" color="onPrimaryContainer" style={{ opacity: 0.75 }}>
            {label}
          </Text>
          <View style={styles.amountRow}>
            <Text variant="titleMd" color="onPrimary" style={styles.symbol}>
              {symbol}
            </Text>
            <Text variant="displayLg" color="onPrimary" style={styles.whole}>
              {whole}
            </Text>
            <Text variant="headlineSm" color="onPrimary" style={styles.cents}>
              .{cents}
            </Text>
          </View>
        </View>

        <View style={styles.innerBottom}>
          {subLabel !== undefined && (
            <View>
              <Text variant="labelSm" color="onPrimaryContainer" style={{ opacity: 0.6 }}>
                {subLabel}
              </Text>
              <Text variant="titleLg" color="onPrimary">
                {subAmount !== undefined ? formatCurrency(subAmount, currency) : '—'}
              </Text>
            </View>
          )}
          {trendPct !== undefined && (
            <View style={styles.trend}>
              <Icon name={trendPct >= 0 ? 'trending_up' : 'trending_down'} size={14} color="onPrimary" />
              <Text variant="labelSm" color="onPrimary">
                {formatPercent(trendPct)}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius['2xl'] },
  card: {
    borderRadius: radius['2xl'],
    padding: spacing[8],
    gap: spacing[6],
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  innerTop: { gap: spacing[1] },
  amountRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing[1] },
  symbol: { marginTop: 8, marginRight: 4 },
  whole: { letterSpacing: -1.5 },
  cents: { marginTop: 8, opacity: 0.9 },
  innerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.md,
  },
});
