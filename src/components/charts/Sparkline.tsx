import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { radius } from '@/theme/tokens';
import type { Color } from '@/theme/tokens';

type Props = {
  values: number[];
  color?: Color;
  highlightIndex?: number;
  height?: number;
  width?: number;
  gap?: number;
};

export function Sparkline({ values, color = 'secondary', highlightIndex, height = 40, width = 60, gap = 4 }: Props) {
  const colors = useColors();
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
              backgroundColor: colors[color] as string,
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
