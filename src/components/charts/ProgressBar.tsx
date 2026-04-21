import { View, StyleSheet } from 'react-native';
import { palette, radius, type Color } from '@/theme';

type Props = {
  value: number; // 0..1
  color?: Color;
  overColor?: Color; // color when value > 1 (over-budget)
  height?: number;
};

export function ProgressBar({ value, color = 'primary', overColor = 'tertiary', height = 8 }: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const over = value > 1;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height,
          backgroundColor: palette[over ? overColor : color],
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
});
