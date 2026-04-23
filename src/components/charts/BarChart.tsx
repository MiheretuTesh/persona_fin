import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import type { Color } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';

export type BarDatum = {
  label: string; // short label, e.g. "Nov"
  value: number;
  highlight?: boolean; // current month / currently-selected bar
};

type Props = {
  data: BarDatum[];
  height?: number;
  color?: Color;
  highlightColor?: Color;
  formatValue?: (v: number) => string;
  /** Show the value above each bar. Default: true. */
  showValues?: boolean;
};

/**
 * 6-to-12 bar "spending over time" chart. Built to degrade gracefully: when
 * most months are zero the empty bars still draw a minimum baseline so the
 * chart never collapses to a flat line. Month labels render beneath, and
 * the current month bar is rendered at full tint.
 */
export function BarChart({
  data,
  height = 180,
  color = 'primaryContainer',
  highlightColor = 'primary',
  formatValue,
  showValues = true,
}: Props) {
  const colors = useColors();
  const max = Math.max(1, ...data.map((d) => d.value));
  const BAR_AREA = height - 44; // leave space for value label + month label
  const MIN_BAR = 6;

  return (
    <View style={{ height }}>
      <View style={styles.row}>
        {data.map((d, i) => {
          const fraction = d.value / max;
          const barH = Math.max(MIN_BAR, fraction * BAR_AREA);
          const active = d.highlight;
          const valueStr =
            d.value === 0
              ? '—'
              : formatValue?.(d.value) ?? Math.round(d.value).toString();

          return (
            <View key={i} style={styles.column}>
              {showValues && (
                <Text
                  variant="labelSm"
                  color={active ? 'primary' : 'onSurfaceVariant'}
                  numberOfLines={1}
                  style={styles.value}
                >
                  {valueStr}
                </Text>
              )}
              <View style={[styles.barTrack, { height: BAR_AREA }]}>
                <View
                  style={{
                    width: '100%',
                    height: barH,
                    backgroundColor: colors[active ? highlightColor : color] as string,
                    opacity: active ? 1 : d.value === 0 ? 0.25 : 0.55,
                    borderRadius: radius.sm,
                  }}
                />
              </View>
              <Text
                variant="labelSm"
                color={active ? 'primary' : 'onSurfaceVariant'}
                center
                numberOfLines={1}
                style={styles.label}
              >
                {d.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  value: { marginBottom: spacing[1], height: 14 },
  label: { marginTop: spacing[2] },
});
