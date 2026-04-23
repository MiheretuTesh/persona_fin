import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import type { Color } from '@/theme/tokens';

type Props = {
  value: number; // 0..1
  color?: Color;
  overColor?: Color;
  height?: number;
};

export function ProgressBar({ value, color = 'primary', overColor = 'tertiary', height = 8 }: Props) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, value));
  const over = value > 1;
  return (
    <View
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: colors.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height,
          backgroundColor: colors[over ? overColor : color] as string,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
});
