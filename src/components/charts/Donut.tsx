import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { palette, type Color } from '@/theme';
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

/**
 * Donut chart — stroked Circle segments with rounded caps, matching the DS
 * call-out: 12px stroke, full rounded caps, no fill. Center copy stacks two
 * lines (amount + label) in Manrope.
 */
export function Donut({ slices, size = 160, strokeWidth = 14, centerTop, centerBottom }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((s, sl) => s + Math.max(0, sl.value), 0) || 1;

  let accumulated = 0;
  const GAP = 2; // visual separator between slices in degrees

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={palette.surfaceContainerHigh}
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
                stroke={palette[s.color]}
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
