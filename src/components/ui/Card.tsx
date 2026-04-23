import { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

type Tone = 'low' | 'container' | 'high' | 'highest';
type Props = {
  children: ReactNode;
  tone?: Tone;
  padding?: number;
  radiusToken?: keyof typeof radius;
  vault?: boolean;
  style?: ViewStyle;
};

export function Card({ children, tone = 'low', padding = spacing[5], radiusToken = 'xl', vault, style }: Props) {
  const colors = useColors();
  const surface = {
    low: colors.surfaceContainerLow,
    container: colors.surfaceContainer,
    high: colors.surfaceContainerHigh,
    highest: colors.surfaceContainerHighest,
  }[tone];

  return (
    <View
      style={[
        {
          backgroundColor: surface,
          borderRadius: radius[radiusToken],
          padding,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {vault && <View style={[styles.vaultAccent, { backgroundColor: colors.primary }]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  vaultAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.65,
  },
});
