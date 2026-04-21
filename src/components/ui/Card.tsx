import { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { palette, radius, spacing, alpha } from '@/theme';

type Tone = 'low' | 'container' | 'high' | 'highest';
type Props = {
  children: ReactNode;
  tone?: Tone;
  padding?: number;
  radiusToken?: keyof typeof radius;
  /** Thin cyan top-accent line (2px). The DS calls this a "Vault" card. */
  vault?: boolean;
  style?: ViewStyle;
};

const surfaceFor = (tone: Tone) =>
  ({
    low: palette.surfaceContainerLow,
    container: palette.surfaceContainer,
    high: palette.surfaceContainerHigh,
    highest: palette.surfaceContainerHighest,
  })[tone];

/**
 * Tonal-layer card. Use these to build depth; never stack a drop shadow on
 * a Card — the tone shift *is* the elevation.
 */
export function Card({ children, tone = 'low', padding = spacing[5], radiusToken = 'xl', vault, style }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: surfaceFor(tone),
          borderRadius: radius[radiusToken],
          padding,
          overflow: 'hidden',
        },
        vault && styles.vault,
        style,
      ]}
    >
      {vault && <View style={styles.vaultAccent} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  vault: {
    borderTopWidth: 0,
  },
  vaultAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: palette.primary,
    opacity: 0.65,
  },
  hairline: {
    borderWidth: 1,
    borderColor: `rgba(66,72,86,${alpha.ghostBorder})`,
  },
});
