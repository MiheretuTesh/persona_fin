import { View, StyleSheet } from 'react-native';
import { palette, radius, type Color } from '@/theme';

type Props = {
  values: number[];
  color?: Color;
  /** Index into `values` that should render at 100% tint — typically the latest bar. */
  highlightIndex?: number;
  height?: number;
  width?: number;
  gap?: number;
};

/**
 * Lightweight bar sparkline — 3-to-7 thin bars, last one emphasized.
 * Avoids a full charting engine for the tiny dashboard-card use case.
 */
export function Sparkline({ values, color = 'secondary', highlightIndex, height = 40, width = 60, gap = 4 }: Props) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const barWidth = Math.max(4, (width - gap * (values.length - 1)) / values.length);
  const hi = highlightIndex ?? values.length - 1;

  return (
    <View style={[styles.wrap, { height, width, gap }]}>
      {values.map((v, i) => {
        const h = Math.max(4, (Math.abs(v) / max) * height);
        return (
          <View
            key={i}
            style={{
              width: barWidth,
              height: h,
              backgroundColor: palette[color],
              opacity: i === hi ? 1 : 0.25,
              borderRadius: radius.xs,
              alignSelf: 'flex-end',
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end' },
});
