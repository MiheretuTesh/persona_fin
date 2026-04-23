import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useColors } from '@/theme';
import type { Color } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';

export type DonutSlice = {
  value: number;
  color: Color;
  label: string;
};

type Props = {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerTop?: string;
  centerBottom?: string;
};

export function Donut({ slices, size = 160, strokeWidth = 14, centerTop, centerBottom }: Props) {
  const colors = useColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((s, sl) => s + Math.max(0, sl.value), 0) || 1;

  let accumulated = 0;
  const GAP = 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceContainerHigh}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {slices.map((s, i) => {
            const fraction = Math.max(0, s.value) / total;
            const dash = fraction * circumference - GAP;
            const offset = (accumulated / total) * circumference;
            accumulated += Math.max(0, s.value);
            if (dash <= 0) return null;
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors[s.color] as string}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
          })}
        </G>
      </Svg>

      {(centerTop || centerBottom) && (
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          {centerTop && (
            <Text variant="headlineMd" color="onSurface">
              {centerTop}
            </Text>
          )}
          {centerBottom && (
            <Text variant="labelMd" color="onSurfaceVariant">
              {centerBottom}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
