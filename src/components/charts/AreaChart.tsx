import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { useColors } from '@/theme';
import type { Color } from '@/theme/tokens';

type Props = {
  values: number[];
  width: number;
  height: number;
  color?: Color;
  dots?: boolean;
  gridLines?: number;
};

export function AreaChart({ values, width, height, color = 'primary', dots = true, gridLines = 3 }: Props) {
  const colors = useColors();
  if (values.length < 2) {
    return <View style={{ width, height }} />;
  }

  const PAD = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = (width - PAD * 2) / (values.length - 1);

  const pts = values.map((v, i) => ({
    x: PAD + i * xStep,
    y: PAD + (1 - (v - min) / range) * (height - PAD * 2),
  }));

  const path = pts
    .map((p, i, arr) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = arr[i - 1]!;
      const prevPrev = arr[i - 2] ?? prev;
      const next = arr[i + 1] ?? p;
      const c1x = prev.x + (p.x - prevPrev.x) / 6;
      const c1y = prev.y + (p.y - prevPrev.y) / 6;
      const c2x = p.x - (next.x - prev.x) / 6;
      const c2y = p.y - (next.y - prev.y) / 6;
      return `C${c1x},${c1y} ${c2x},${c2y} ${p.x},${p.y}`;
    })
    .join(' ');

  const area = `${path} L${pts[pts.length - 1]!.x},${height} L${pts[0]!.x},${height} Z`;
  const stroke = colors[color] as string;
  const gradId = `area-grad-${color}-${colors.mode}`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.35} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {Array.from({ length: gridLines }).map((_, i) => {
          const y = PAD + ((height - PAD * 2) * i) / (gridLines - 1);
          return (
            <Line
              key={i}
              x1={0} x2={width} y1={y} y2={y}
              stroke={colors.outlineVariant}
              strokeOpacity={0.12}
              strokeWidth={1}
            />
          );
        })}

        <Path d={area} fill={`url(#${gradId})`} />
        <Path d={path} stroke={stroke} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {dots && pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x} cy={p.y}
            r={i === pts.length - 1 ? 5 : 0}
            fill={stroke}
            stroke={colors.surface}
            strokeWidth={3}
          />
        ))}
      </Svg>
    </View>
  );
}
